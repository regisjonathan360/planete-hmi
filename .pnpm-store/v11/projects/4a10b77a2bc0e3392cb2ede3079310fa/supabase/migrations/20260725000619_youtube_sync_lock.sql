-- =========================================================
-- Planète HMI — Verrou persistant (lease) pour collectes YouTube (K3 v4)
--
-- Principe : une table youtube_sync_leases stocke un bail par source+période.
-- L'acquisition est atomique : pg_advisory_xact_lock sérialise la première
-- insertion même quand aucun lease n'existe encore.
-- Le fencing token (owner_token) protège toute écriture conditionnelle.
-- =========================================================

-- Table de leases
CREATE TABLE IF NOT EXISTS public.youtube_sync_leases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_key text NOT NULL CHECK (source_key <> ''),
  period_key text NOT NULL CHECK (period_key <> ''),
  owner_token text NOT NULL CHECK (owner_token <> ''),
  acquired_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  released_at timestamptz,
  sync_run_id uuid NOT NULL REFERENCES sync_runs(id) ON DELETE RESTRICT,
  cancel_requested boolean NOT NULL DEFAULT false,
  UNIQUE (source_key, period_key),
  CONSTRAINT lease_duration_positive CHECK (expires_at > acquired_at)
);

CREATE INDEX IF NOT EXISTS yt_leases_active_idx
  ON public.youtube_sync_leases (source_key, period_key)
  WHERE released_at IS NULL;

ALTER TABLE public.youtube_sync_leases ENABLE ROW LEVEL SECURITY;
-- Pas de policy publique. Service_role bypass la RLS.

-- Droits minimaux pour service_role
REVOKE ALL ON public.youtube_sync_leases FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.youtube_sync_leases TO service_role;

-- =========================================================
-- acquire_sync_lease : acquisition atomique avec pg_advisory_xact_lock
--
-- Sérialise les appels concurrents pour la même source+période via
-- un verrou transactionnel advisory (libéré automatiquement au commit).
-- Retourne: acquired, run_id, owner_token, lease_expires_at, run_status
-- =========================================================
CREATE OR REPLACE FUNCTION public.acquire_sync_lease(
  p_source_key text,
  p_period_key text,
  p_owner_token text,
  p_lease_duration_seconds integer DEFAULT 300,
  p_chart_source_id uuid DEFAULT NULL
)
RETURNS TABLE(
  acquired boolean,
  run_id uuid,
  owner_token text,
  lease_expires_at timestamptz,
  run_status text
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_lease public.youtube_sync_leases%ROWTYPE;
  v_now timestamptz := clock_timestamp();
  v_expires timestamptz;
  v_run_id uuid;
  v_run_status text;
  v_lock_key bigint;
BEGIN
  -- Validation des paramètres
  IF p_source_key IS NULL OR p_source_key = '' THEN
    RAISE EXCEPTION 'p_source_key ne peut pas être vide';
  END IF;
  IF p_period_key IS NULL OR p_period_key = '' THEN
    RAISE EXCEPTION 'p_period_key ne peut pas être vide';
  END IF;
  IF p_owner_token IS NULL OR p_owner_token = '' THEN
    RAISE EXCEPTION 'p_owner_token ne peut pas être vide';
  END IF;
  IF p_lease_duration_seconds IS NULL
     OR p_lease_duration_seconds < 10
     OR p_lease_duration_seconds > 3600 THEN
    RAISE EXCEPTION 'p_lease_duration_seconds doit être entre 10 et 3600';
  END IF;

  v_expires := v_now + make_interval(secs => p_lease_duration_seconds);

  -- Verrou advisory transactionnel : sérialise l'acquisition pour ce couple source+période.
  -- Utilise un hash stable pour dériver la clé advisory.
  v_lock_key := hashtext(p_source_key || '::' || p_period_key);
  PERFORM pg_advisory_xact_lock(v_lock_key);

  -- Lire le lease existant (le verrou advisory garantit la sérialisation)
  SELECT * INTO v_lease
  FROM public.youtube_sync_leases
  WHERE youtube_sync_leases.source_key = p_source_key
    AND youtube_sync_leases.period_key = p_period_key
  FOR UPDATE;

  IF FOUND THEN
    -- Lire le statut du run associé
    SELECT sr.status INTO v_run_status
    FROM public.sync_runs sr WHERE sr.id = v_lease.sync_run_id;

    -- Cas 1 : run déjà terminé avec succès → idempotence (ne pas relancer)
    IF v_run_status IN ('COMPLETED', 'COMPLETED_WITH_WARNINGS') THEN
      RETURN QUERY SELECT false, v_lease.sync_run_id, v_lease.owner_token, v_lease.expires_at, v_run_status;
      RETURN;
    END IF;

    -- Cas 2 : c'est notre lease valide (idempotence du même owner)
    IF v_lease.owner_token = p_owner_token AND v_lease.released_at IS NULL AND v_lease.expires_at >= v_now THEN
      RETURN QUERY SELECT true, v_lease.sync_run_id, v_lease.owner_token, v_lease.expires_at, v_run_status;
      RETURN;
    END IF;

    -- Cas 3 : lease expiré ou libéré, run FAILED/PENDING → reprendre le même run
    IF (v_lease.expires_at < v_now OR v_lease.released_at IS NOT NULL)
       AND v_run_status IN ('FAILED', 'PENDING', 'RUNNING') THEN
      -- Réinitialiser le run pour reprise
      UPDATE public.sync_runs
      SET status = 'RUNNING', started_at = v_now, finished_at = NULL
      WHERE id = v_lease.sync_run_id;

      -- Prendre le lease
      UPDATE public.youtube_sync_leases
      SET owner_token = p_owner_token,
          acquired_at = v_now,
          expires_at = v_expires,
          released_at = NULL,
          cancel_requested = false
      WHERE youtube_sync_leases.id = v_lease.id;

      RETURN QUERY SELECT true, v_lease.sync_run_id, p_owner_token, v_expires, 'RUNNING'::text;
      RETURN;
    END IF;

    -- Cas 4 : lease actif d'un autre propriétaire (non expiré, non libéré)
    IF v_lease.released_at IS NULL AND v_lease.expires_at >= v_now AND v_lease.owner_token <> p_owner_token THEN
      RETURN QUERY SELECT false, v_lease.sync_run_id, v_lease.owner_token, v_lease.expires_at, v_run_status;
      RETURN;
    END IF;

    -- Cas résiduel (ne devrait pas arriver) : traiter comme lease expiré
    -- Créer un nouveau sync_run
    INSERT INTO public.sync_runs (chart_source_id, run_type, started_at, status, metadata)
    VALUES (
      p_chart_source_id,
      'youtube_weekly_delta',
      v_now,
      'RUNNING',
      jsonb_build_object('sourceKey', p_source_key, 'periodKey', p_period_key)
    )
    RETURNING id INTO v_run_id;

    UPDATE public.youtube_sync_leases
    SET owner_token = p_owner_token,
        acquired_at = v_now,
        expires_at = v_expires,
        released_at = NULL,
        sync_run_id = v_run_id,
        cancel_requested = false
    WHERE youtube_sync_leases.id = v_lease.id;

    RETURN QUERY SELECT true, v_run_id, p_owner_token, v_expires, 'RUNNING'::text;
    RETURN;
  END IF;

  -- Pas de lease existant → créer sync_run + lease
  -- Le pg_advisory_xact_lock empêche deux créations concurrentes.
  IF p_chart_source_id IS NULL THEN
    RAISE EXCEPTION 'p_chart_source_id requis pour une première collecte';
  END IF;

  INSERT INTO public.sync_runs (chart_source_id, run_type, started_at, status, metadata)
  VALUES (
    p_chart_source_id,
    'youtube_weekly_delta',
    v_now,
    'RUNNING',
    jsonb_build_object('sourceKey', p_source_key, 'periodKey', p_period_key)
  )
  RETURNING id INTO v_run_id;

  INSERT INTO public.youtube_sync_leases (source_key, period_key, owner_token, acquired_at, expires_at, sync_run_id)
  VALUES (p_source_key, p_period_key, p_owner_token, v_now, v_expires, v_run_id);

  RETURN QUERY SELECT true, v_run_id, p_owner_token, v_expires, 'RUNNING'::text;
END;
$$;

-- =========================================================
-- renew_sync_lease : heartbeat
-- Renouvelle SEULEMENT si owner correspond ET lease non expiré ET non libéré.
-- Un lease expiré ne peut PAS être ressuscité.
-- =========================================================
CREATE OR REPLACE FUNCTION public.renew_sync_lease(
  p_source_key text,
  p_period_key text,
  p_owner_token text,
  p_lease_duration_seconds integer DEFAULT 300
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_updated integer;
BEGIN
  IF p_source_key IS NULL OR p_source_key = ''
     OR p_period_key IS NULL OR p_period_key = ''
     OR p_owner_token IS NULL OR p_owner_token = '' THEN
    RAISE EXCEPTION 'source_key, period_key et owner_token sont requis';
  END IF;
  IF p_lease_duration_seconds IS NULL
     OR p_lease_duration_seconds < 10
     OR p_lease_duration_seconds > 3600 THEN
    RAISE EXCEPTION 'p_lease_duration_seconds doit être entre 10 et 3600';
  END IF;

  UPDATE public.youtube_sync_leases
  SET expires_at = clock_timestamp() + make_interval(secs => p_lease_duration_seconds)
  WHERE source_key = p_source_key
    AND period_key = p_period_key
    AND owner_token = p_owner_token
    AND released_at IS NULL
    AND expires_at >= clock_timestamp();
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

-- =========================================================
-- release_sync_lease : libération conditionnée au token
-- =========================================================
CREATE OR REPLACE FUNCTION public.release_sync_lease(
  p_source_key text,
  p_period_key text,
  p_owner_token text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_updated integer;
BEGIN
  UPDATE public.youtube_sync_leases
  SET released_at = clock_timestamp()
  WHERE source_key = p_source_key
    AND period_key = p_period_key
    AND owner_token = p_owner_token
    AND released_at IS NULL;
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

-- =========================================================
-- fenced_update_sync_run : écriture conditionnelle avec fencing token
-- Vérifie que le lease est valide (owner correct, non expiré, non libéré)
-- avant de permettre la mise à jour du sync_run.
-- Supporte p_clear_error pour remettre error_code/error_message à NULL.
-- Retourne true si la mise à jour a été effectuée.
-- =========================================================
CREATE OR REPLACE FUNCTION public.fenced_update_sync_run(
  p_source_key text,
  p_period_key text,
  p_owner_token text,
  p_run_id uuid,
  p_status text DEFAULT NULL,
  p_finished_at timestamptz DEFAULT NULL,
  p_error_code text DEFAULT NULL,
  p_error_message text DEFAULT NULL,
  p_records_received integer DEFAULT NULL,
  p_records_normalized integer DEFAULT NULL,
  p_records_matched integer DEFAULT NULL,
  p_records_rejected integer DEFAULT NULL,
  p_metadata jsonb DEFAULT NULL,
  p_clear_error boolean DEFAULT false
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_lease public.youtube_sync_leases%ROWTYPE;
BEGIN
  -- Vérifier le lease avec verrouillage
  SELECT * INTO v_lease
  FROM public.youtube_sync_leases
  WHERE source_key = p_source_key
    AND period_key = p_period_key
  FOR UPDATE;

  -- Refuser si le lease n'existe pas, est expiré, libéré, ou appartient à un autre
  IF NOT FOUND
    OR v_lease.owner_token <> p_owner_token
    OR v_lease.released_at IS NOT NULL
    OR v_lease.expires_at < clock_timestamp()
  THEN
    RETURN false;
  END IF;

  -- Vérifier que le run_id correspond
  IF v_lease.sync_run_id <> p_run_id THEN
    RETURN false;
  END IF;

  -- Mise à jour conditionnelle du sync_run
  UPDATE public.sync_runs
  SET
    status = COALESCE(p_status, sync_runs.status),
    finished_at = COALESCE(p_finished_at, sync_runs.finished_at),
    error_code = CASE WHEN p_clear_error THEN NULL ELSE COALESCE(p_error_code, sync_runs.error_code) END,
    error_message = CASE WHEN p_clear_error THEN NULL ELSE COALESCE(p_error_message, sync_runs.error_message) END,
    records_received = COALESCE(p_records_received, sync_runs.records_received),
    records_normalized = COALESCE(p_records_normalized, sync_runs.records_normalized),
    records_matched = COALESCE(p_records_matched, sync_runs.records_matched),
    records_rejected = COALESCE(p_records_rejected, sync_runs.records_rejected),
    metadata = COALESCE(p_metadata, sync_runs.metadata)
  WHERE id = p_run_id;

  RETURN true;
END;
$$;

-- =========================================================
-- request_sync_cancellation : demande d'annulation sur le lease
-- =========================================================
CREATE OR REPLACE FUNCTION public.request_sync_cancellation(
  p_source_key text,
  p_period_key text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_updated integer;
BEGIN
  UPDATE public.youtube_sync_leases
  SET cancel_requested = true
  WHERE source_key = p_source_key
    AND period_key = p_period_key
    AND released_at IS NULL
    AND expires_at >= clock_timestamp();
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

-- =========================================================
-- Permissions : uniquement service_role
-- =========================================================
REVOKE EXECUTE ON FUNCTION public.acquire_sync_lease FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.acquire_sync_lease TO service_role;

REVOKE EXECUTE ON FUNCTION public.renew_sync_lease FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.renew_sync_lease TO service_role;

REVOKE EXECUTE ON FUNCTION public.release_sync_lease FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_sync_lease TO service_role;

REVOKE EXECUTE ON FUNCTION public.fenced_update_sync_run FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fenced_update_sync_run TO service_role;

REVOKE EXECUTE ON FUNCTION public.request_sync_cancellation FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.request_sync_cancellation TO service_role;

;
