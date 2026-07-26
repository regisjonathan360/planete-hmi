-- Une collecte déclenchée explicitement par un administrateur doit exécuter
-- les options choisies, même si une autre collecte de la même période est
-- déjà terminée. Un run encore actif reste protégé contre les doubles clics.

CREATE OR REPLACE FUNCTION public.acquire_manual_sync_lease(
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
  v_had_lease boolean := false;
BEGIN
  IF p_source_key IS NULL OR btrim(p_source_key) = '' THEN
    RAISE EXCEPTION 'p_source_key ne peut pas être vide';
  END IF;
  IF p_period_key IS NULL OR btrim(p_period_key) = '' THEN
    RAISE EXCEPTION 'p_period_key ne peut pas être vide';
  END IF;
  IF p_owner_token IS NULL OR btrim(p_owner_token) = '' THEN
    RAISE EXCEPTION 'p_owner_token ne peut pas être vide';
  END IF;
  IF p_lease_duration_seconds IS NULL
     OR p_lease_duration_seconds < 10
     OR p_lease_duration_seconds > 3600 THEN
    RAISE EXCEPTION 'p_lease_duration_seconds doit être entre 10 et 3600';
  END IF;
  IF p_chart_source_id IS NULL THEN
    RAISE EXCEPTION 'p_chart_source_id est requis';
  END IF;

  v_expires := v_now + make_interval(secs => p_lease_duration_seconds);
  v_lock_key := hashtext(p_source_key || '::' || p_period_key);
  PERFORM pg_advisory_xact_lock(v_lock_key);

  SELECT * INTO v_lease
  FROM public.youtube_sync_leases
  WHERE source_key = p_source_key
    AND period_key = p_period_key
  FOR UPDATE;

  v_had_lease := FOUND;

  IF v_had_lease
     AND v_lease.released_at IS NULL
     AND v_lease.expires_at >= v_now THEN
    SELECT status INTO v_run_status
    FROM public.sync_runs
    WHERE id = v_lease.sync_run_id;

    RETURN QUERY
      SELECT false, v_lease.sync_run_id, v_lease.owner_token,
             v_lease.expires_at, v_run_status;
    RETURN;
  END IF;

  INSERT INTO public.sync_runs (
    chart_source_id,
    run_type,
    started_at,
    status,
    metadata
  )
  VALUES (
    p_chart_source_id,
    'youtube_weekly_delta',
    v_now,
    'RUNNING',
    jsonb_build_object(
      'sourceKey', p_source_key,
      'periodKey', p_period_key,
      'manualRun', true
    )
  )
  RETURNING id INTO v_run_id;

  IF v_had_lease THEN
    UPDATE public.youtube_sync_leases
    SET owner_token = p_owner_token,
        acquired_at = v_now,
        expires_at = v_expires,
        released_at = NULL,
        sync_run_id = v_run_id,
        cancel_requested = false
    WHERE id = v_lease.id;
  ELSE
    INSERT INTO public.youtube_sync_leases (
      source_key,
      period_key,
      owner_token,
      acquired_at,
      expires_at,
      sync_run_id
    )
    VALUES (
      p_source_key,
      p_period_key,
      p_owner_token,
      v_now,
      v_expires,
      v_run_id
    );
  END IF;

  RETURN QUERY
    SELECT true, v_run_id, p_owner_token, v_expires, 'RUNNING'::text;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.acquire_manual_sync_lease(
  text, text, text, integer, uuid
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.acquire_manual_sync_lease(
  text, text, text, integer, uuid
) TO service_role;
