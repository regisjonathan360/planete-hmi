/**
 * Chart Builder — Génération des 3 classements TikTok.
 *
 * Ce module est un complément standalone au score engine.
 * Il peut être appelé indépendamment pour :
 * - Filtrer et trier les sons validés selon 3 logiques (Global, En montée, Nouveautés)
 * - Créer/mettre à jour les chart_editions (draft) et chart_entries
 *
 * Les fonctions pures (filter*, sort*, build*) sont exportées pour les tests
 * de propriété (property-based testing) sans dépendance à la base de données.
 *
 * Requirements: 5.2, 5.3, 5.4, 5.5, 6.2, 6.3
 */
import "server-only";

import type { TikTokSound } from "./types";
import { SOURCE_KEYS, NOUVEAUTES_WINDOW_DAYS } from "./constants";
import { createAdminClient } from "../supabase/admin";

// ---------------------------------------------------------------------------
// Types — Chart Entry Data (retour des fonctions pures)
// ---------------------------------------------------------------------------

/** Données d'une entrée de classement produite par le chart builder */
export interface ChartEntryData {
  source_position: number;
  raw_track_title: string;
  raw_artist_text: string | null;
  metric_value: number;
  metric_unit: string;
  music_id: string;
}

// ---------------------------------------------------------------------------
// Fonctions pures — testables sans DB
// ---------------------------------------------------------------------------

/**
 * Filtre uniquement les sons avec validation_status === "valide".
 *
 * Property 7: Only validated sounds appear in charts.
 */
export function filterValidatedSounds(sounds: TikTokSound[]): TikTokSound[] {
  return sounds.filter((s) => s.validation_status === "valide");
}

/**
 * Tri du classement Global par score composite descendant.
 *
 * Property 8: Global chart sorted by composite score descending.
 */
export function sortGlobalChart(sounds: TikTokSound[]): TikTokSound[] {
  return [...sounds].sort((a, b) => b.score - a.score);
}

/**
 * Tri du classement En montée par growth_7d descendant.
 *
 * Property 9: En montée chart sorted by 7-day growth descending.
 */
export function sortEnMonteeChart(sounds: TikTokSound[]): TikTokSound[] {
  return [...sounds].sort((a, b) => b.growth_7d - a.growth_7d);
}

/**
 * Filtre les sons dont first_seen_at est dans les N derniers jours,
 * puis tri par score descendant.
 *
 * Property 10: Nouveautés filter and sort.
 *
 * @param sounds — sons à filtrer
 * @param windowDays — fenêtre en jours (défaut : NOUVEAUTES_WINDOW_DAYS = 14)
 * @param referenceDate — date de référence pour le calcul (défaut : maintenant).
 *   Paramètre utile pour les tests déterministes.
 */
export function filterAndSortNouveautes(
  sounds: TikTokSound[],
  windowDays: number = NOUVEAUTES_WINDOW_DAYS,
  referenceDate: Date = new Date()
): TikTokSound[] {
  const cutoff = new Date(referenceDate);
  cutoff.setDate(cutoff.getDate() - windowDays);

  const recent = sounds.filter((s) => {
    const firstSeen = new Date(s.first_seen_at);
    return firstSeen >= cutoff;
  });

  return recent.sort((a, b) => b.score - a.score);
}

/**
 * Construit les entrées de classement à partir d'une liste triée de sons.
 *
 * Property 11: Chart entries metric_value equals publications count.
 *
 * - source_position : 1-based (position dans le classement)
 * - metric_value : total_videos du son
 * - metric_unit : "posts_count"
 */
export function buildChartEntries(sounds: TikTokSound[]): ChartEntryData[] {
  return sounds.map((sound, index) => ({
    source_position: index + 1,
    raw_track_title: sound.sound_title,
    raw_artist_text: sound.sound_author,
    metric_value: sound.total_videos,
    metric_unit: "posts_count",
    music_id: sound.music_id,
  }));
}

// ---------------------------------------------------------------------------
// Fonction async — interaction base de données
// ---------------------------------------------------------------------------

/**
 * Construit les 3 classements TikTok et persiste les éditions brouillon.
 *
 * 1. Récupère tous les sons validés depuis tiktok_sounds
 * 2. Applique les filtres et tris pour chaque source (Global, En montée, Nouveautés)
 * 3. Crée ou met à jour les chart_editions (status = "draft")
 * 4. Insère les chart_entries correspondantes
 *
 * Peut être appelé indépendamment du score engine.
 */
export async function buildCharts(): Promise<void> {
  const supabase = createAdminClient();

  // 1. Récupérer tous les sons validés
  const { data: allSounds, error: fetchError } = await supabase
    .from("tiktok_sounds")
    .select("*")
    .eq("validation_status", "valide");

  if (fetchError) {
    throw new Error(`[chart-builder] Erreur récupération sons validés: ${fetchError.message}`);
  }

  if (!allSounds || allSounds.length === 0) {
    return;
  }

  // Cast vers TikTokSound (les champs DB correspondent au type)
  const validatedSounds = allSounds as unknown as TikTokSound[];

  // 2. Définir les 3 classements avec leurs fonctions de tri/filtre
  const charts: Array<{
    sourceKey: string;
    entries: ChartEntryData[];
  }> = [
    {
      sourceKey: SOURCE_KEYS.global,
      entries: buildChartEntries(sortGlobalChart(validatedSounds)),
    },
    {
      sourceKey: SOURCE_KEYS.enMontee,
      entries: buildChartEntries(sortEnMonteeChart(validatedSounds)),
    },
    {
      sourceKey: SOURCE_KEYS.nouveautes,
      entries: buildChartEntries(filterAndSortNouveautes(validatedSounds)),
    },
  ];

  // 3. Pour chaque classement, créer/mettre à jour l'édition et les entrées
  for (const chart of charts) {
    await upsertChartEdition(supabase, chart.sourceKey, chart.entries);
  }
}

// ---------------------------------------------------------------------------
// Helpers internes
// ---------------------------------------------------------------------------

/**
 * Crée ou met à jour une chart_edition (draft) pour une source donnée,
 * et insère les chart_entries.
 */
async function upsertChartEdition(
  supabase: ReturnType<typeof createAdminClient>,
  sourceKey: string,
  entries: ChartEntryData[]
): Promise<void> {
  // Récupérer l'ID de la source
  const { data: source, error: sourceError } = await supabase
    .from("chart_sources")
    .select("id")
    .eq("source_key", sourceKey)
    .single();

  if (sourceError || !source) {
    console.warn(`[chart-builder] Source introuvable: ${sourceKey}`);
    return;
  }

  const now = new Date();
  const periodEnd = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59)
  );
  const periodStart = new Date(periodEnd);
  periodStart.setUTCDate(periodStart.getUTCDate() - 6);
  periodStart.setUTCHours(0, 0, 0, 0);

  const editionKey = `tiktok-${sourceKey}-${periodEnd.toISOString().slice(0, 10)}`;

  // Chercher une édition existante pour cette période
  const { data: existing } = await supabase
    .from("chart_editions")
    .select("id")
    .eq("chart_source_id", source.id)
    .eq("period_start", periodStart.toISOString())
    .eq("period_end", periodEnd.toISOString())
    .maybeSingle();

  let editionId: string;

  if (existing?.id) {
    editionId = existing.id;
    // Supprimer les anciennes entrées
    await supabase.from("chart_entries").delete().eq("chart_edition_id", editionId);
    // Mettre à jour l'édition
    await supabase
      .from("chart_editions")
      .update({
        edition_key: editionKey,
        collected_at: now.toISOString(),
        status: "draft",
        is_stale: false,
        entry_count: entries.length,
        validation_notes: "Chart builder — en attente de validation.",
      })
      .eq("id", editionId);
  } else {
    // Créer une nouvelle édition
    const { data: newEdition, error: insertError } = await supabase
      .from("chart_editions")
      .insert({
        chart_source_id: source.id,
        edition_key: editionKey,
        period_start: periodStart.toISOString(),
        period_end: periodEnd.toISOString(),
        collected_at: now.toISOString(),
        status: "draft",
        is_stale: false,
        entry_count: entries.length,
        validation_notes: "Chart builder — en attente de validation.",
      })
      .select("id")
      .single();

    if (insertError || !newEdition) {
      console.error(
        `[chart-builder] Création édition échouée pour ${sourceKey}:`,
        insertError?.message
      );
      return;
    }
    editionId = newEdition.id;
  }

  // Insérer les entrées
  if (entries.length > 0) {
    const rows = entries.map((entry) => ({
      chart_edition_id: editionId,
      source_position: entry.source_position,
      raw_track_title: entry.raw_track_title,
      raw_artist_text: entry.raw_artist_text,
      metric_value: entry.metric_value,
      metric_unit: entry.metric_unit,
    }));

    const { error: entriesError } = await supabase
      .from("chart_entries")
      .insert(rows);

    if (entriesError) {
      console.error(
        `[chart-builder] Insertion entrées échouée pour ${sourceKey}:`,
        entriesError.message
      );
    }
  }
}
