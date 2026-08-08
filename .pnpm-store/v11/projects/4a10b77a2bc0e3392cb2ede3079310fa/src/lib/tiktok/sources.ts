/**
 * Sources — Gestion des chart_sources TikTok et intégrations liées.
 *
 * Ce module fournit les fonctions helper pour :
 * - Récupérer les 3 chart_sources TikTok par source_key
 * - Créer/récupérer les éditions (chart_editions) liées
 * - Assurer la correspondance platform_tracks (platform = "tiktok", external_id = music_id)
 *
 * Requirements: 5.1, 6.1, 6.2, 6.4
 */
import "server-only";

import { SOURCE_KEYS } from "./constants";
import { createAdminClient } from "../supabase/admin";

// ---------------------------------------------------------------------------
// Types locaux
// ---------------------------------------------------------------------------

/** Enregistrement chart_sources pour TikTok */
export interface ChartSource {
  id: string;
  source_key: string;
  platform: string;
  display_name: string;
  chart_context: string | null;
  market_code: string | null;
  ingestion_mode: string | null;
  metric_unit: string | null;
  is_active: boolean;
}

/** Enregistrement chart_editions */
export interface ChartEdition {
  id: string;
  chart_source_id: string;
  edition_key: string;
  period_start: string;
  period_end: string;
  collected_at: string | null;
  status: string;
  is_stale: boolean;
  entry_count: number;
  published_at: string | null;
  validation_notes: string | null;
}

// ---------------------------------------------------------------------------
// Fonctions publiques
// ---------------------------------------------------------------------------

/**
 * Récupère une chart_source par sa source_key.
 *
 * @param sourceKey — clé unique de la source (ex: "tiktok_haiti_global")
 * @returns la source correspondante ou null si introuvable
 */
export async function getSourceByKey(sourceKey: string): Promise<ChartSource | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("chart_sources")
    .select("*")
    .eq("source_key", sourceKey)
    .maybeSingle();

  if (error) {
    console.error(`[sources] Erreur récupération source ${sourceKey}:`, error.message);
    return null;
  }

  return (data as ChartSource | null) ?? null;
}

/**
 * Récupère ou crée une chart_edition pour une source et une période données.
 *
 * Si une édition existe déjà pour cette source + période, retourne son ID.
 * Sinon, crée une nouvelle édition en statut "draft" et retourne son ID.
 *
 * @param sourceId — UUID de la chart_source
 * @param periodStart — début de la période couverte
 * @param periodEnd — fin de la période couverte
 * @returns l'ID de l'édition (existante ou nouvellement créée)
 */
export async function getOrCreateEdition(
  sourceId: string,
  periodStart: Date,
  periodEnd: Date
): Promise<string> {
  const supabase = createAdminClient();

  const periodStartIso = periodStart.toISOString();
  const periodEndIso = periodEnd.toISOString();

  // Chercher une édition existante pour cette source + période
  const { data: existing } = await supabase
    .from("chart_editions")
    .select("id")
    .eq("chart_source_id", sourceId)
    .eq("period_start", periodStartIso)
    .eq("period_end", periodEndIso)
    .maybeSingle();

  if (existing?.id) {
    return existing.id;
  }

  // Créer une nouvelle édition draft
  const now = new Date();
  const editionKey = `tiktok-${sourceId}-${periodEnd.toISOString().slice(0, 10)}`;

  const { data: newEdition, error } = await supabase
    .from("chart_editions")
    .insert({
      chart_source_id: sourceId,
      edition_key: editionKey,
      period_start: periodStartIso,
      period_end: periodEndIso,
      collected_at: now.toISOString(),
      status: "draft",
      is_stale: false,
      entry_count: 0,
      validation_notes: "Édition créée automatiquement — en attente de données.",
    })
    .select("id")
    .single();

  if (error || !newEdition) {
    throw new Error(
      `[sources] Création édition échouée pour source ${sourceId}: ${error?.message ?? "aucune donnée"}`
    );
  }

  return newEdition.id;
}

/**
 * Assure l'existence d'un enregistrement platform_tracks pour un son TikTok.
 *
 * Upsert dans platform_tracks avec :
 * - platform = "tiktok"
 * - external_id = musicId (identifiant unique TikTok du son)
 * - platform_title = soundTitle
 * - platform_artist_text = soundAuthor (optionnel)
 *
 * @param musicId — identifiant TikTok du son (music_id)
 * @param soundTitle — titre du son
 * @param soundAuthor — auteur du son (optionnel)
 * @returns l'ID du platform_track (uuid)
 */
export async function ensurePlatformTrack(
  musicId: string,
  soundTitle: string,
  soundAuthor?: string
): Promise<string> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("platform_tracks")
    .upsert(
      {
        platform: "tiktok",
        external_id: musicId,
        platform_title: soundTitle,
        platform_artist_text: soundAuthor ?? null,
        match_status: "tiktok_sound",
        match_confidence: 1,
        verified_at: new Date().toISOString(),
      },
      { onConflict: "platform,external_id" }
    )
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(
      `[sources] Upsert platform_track échoué pour music_id=${musicId}: ${error?.message ?? "aucune donnée"}`
    );
  }

  return data.id;
}

/**
 * Récupère les 3 chart_sources TikTok définies dans le système.
 *
 * Utilise les SOURCE_KEYS (global, enMontee, nouveautes) pour filtrer.
 *
 * @returns les 3 sources TikTok (ou moins si certaines n'existent pas encore)
 */
export async function getTikTokSources(): Promise<ChartSource[]> {
  const supabase = createAdminClient();

  const keys = Object.values(SOURCE_KEYS);

  const { data, error } = await supabase
    .from("chart_sources")
    .select("*")
    .in("source_key", keys);

  if (error) {
    console.error("[sources] Erreur récupération sources TikTok:", error.message);
    return [];
  }

  return (data as ChartSource[]) ?? [];
}

/**
 * Récupère l'édition la plus récente pour une source donnée (par period_end DESC).
 *
 * @param sourceKey — clé de la source (ex: "tiktok_haiti_global")
 * @returns l'édition la plus récente ou null si aucune n'existe
 */
export async function getLatestEdition(sourceKey: string): Promise<ChartEdition | null> {
  const supabase = createAdminClient();

  // D'abord récupérer l'ID de la source
  const { data: source } = await supabase
    .from("chart_sources")
    .select("id")
    .eq("source_key", sourceKey)
    .maybeSingle();

  if (!source?.id) {
    return null;
  }

  // Récupérer l'édition la plus récente
  const { data: edition, error } = await supabase
    .from("chart_editions")
    .select("*")
    .eq("chart_source_id", source.id)
    .order("period_end", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error(`[sources] Erreur récupération dernière édition pour ${sourceKey}:`, error.message);
    return null;
  }

  return (edition as ChartEdition | null) ?? null;
}
