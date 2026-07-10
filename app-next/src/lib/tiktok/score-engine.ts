/**
 * Score Engine — Calcul du score composite par son TikTok.
 *
 * Ce module recalcule les scores après chaque collecte réussie :
 * - Normalisation min-max de chaque métrique
 * - Pondération par coefficients configurables
 * - Croissance 7 jours (growth_7d)
 * - Diversité créateurs (unique_creators)
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5
 */
import "server-only";

import type { ScoreCoefficients, ScoreEngineResult } from "./types";
import { DEFAULT_SCORE_COEFFICIENTS, SOURCE_KEYS } from "./constants";
import { createAdminClient } from "../supabase/admin";

// ---------------------------------------------------------------------------
// Types internes
// ---------------------------------------------------------------------------

/** Métriques d'un son utilisées pour le calcul du score */
export interface SoundMetrics {
  totalVideos: number;
  totalViews: number;
  totalLikes: number;
  totalComments: number;
  totalShares: number;
  growth7d: number;
  creatorDiversity: number;
}

/** Plages min/max pour chaque métrique (pour la normalisation) */
export interface MetricRanges {
  totalVideos: { min: number; max: number };
  totalViews: { min: number; max: number };
  totalLikes: { min: number; max: number };
  totalComments: { min: number; max: number };
  totalShares: { min: number; max: number };
  growth7d: { min: number; max: number };
  creatorDiversity: { min: number; max: number };
}

// ---------------------------------------------------------------------------
// Valeur maximale pour la croissance infinie (P=0, C>0)
// ---------------------------------------------------------------------------

export const MAX_GROWTH_VALUE = 9999.99;

// ---------------------------------------------------------------------------
// Fonctions utilitaires exportées
// ---------------------------------------------------------------------------

/**
 * Calcule la croissance 7 jours en pourcentage.
 *
 * - Si previous > 0 : ((current - previous) / previous) * 100
 * - Si previous === 0 et current > 0 : MAX_GROWTH_VALUE (croissance "infinie")
 * - Si previous === 0 et current === 0 : 0
 */
export function computeGrowth7d(current: number, previous: number): number {
  if (previous > 0) {
    return ((current - previous) / previous) * 100;
  }
  if (current > 0) {
    return MAX_GROWTH_VALUE;
  }
  return 0;
}

/**
 * Calcule la diversité de créateurs : nombre de noms d'utilisateur distincts.
 */
export function computeCreatorDiversity(videos: { username: string }[]): number {
  const uniqueUsernames = new Set(videos.map((v) => v.username));
  return uniqueUsernames.size;
}

/**
 * Normalisation min-max : ramène une valeur entre 0 et 1.
 *
 * - Si max === min (tous les sons ont la même valeur), retourne 0 pour éviter
 *   une division par zéro.
 */
export function normalizeMinMax(value: number, min: number, max: number): number {
  if (max === min) return 0;
  return (value - min) / (max - min);
}

/**
 * Calcule le score composite à partir des métriques normalisées et des coefficients.
 */
export function computeCompositeScore(
  metrics: SoundMetrics,
  ranges: MetricRanges,
  coefficients: ScoreCoefficients = DEFAULT_SCORE_COEFFICIENTS
): number {
  const score =
    coefficients.videoCount * normalizeMinMax(metrics.totalVideos, ranges.totalVideos.min, ranges.totalVideos.max) +
    coefficients.totalViews * normalizeMinMax(metrics.totalViews, ranges.totalViews.min, ranges.totalViews.max) +
    coefficients.totalLikes * normalizeMinMax(metrics.totalLikes, ranges.totalLikes.min, ranges.totalLikes.max) +
    coefficients.totalComments * normalizeMinMax(metrics.totalComments, ranges.totalComments.min, ranges.totalComments.max) +
    coefficients.totalShares * normalizeMinMax(metrics.totalShares, ranges.totalShares.min, ranges.totalShares.max) +
    coefficients.growth7d * normalizeMinMax(metrics.growth7d, ranges.growth7d.min, ranges.growth7d.max) +
    coefficients.creatorDiversity * normalizeMinMax(metrics.creatorDiversity, ranges.creatorDiversity.min, ranges.creatorDiversity.max);

  return score;
}

// ---------------------------------------------------------------------------
// Helper — Diversité créateurs depuis la base de données
// ---------------------------------------------------------------------------

/**
 * Récupère le nombre de créateurs distincts pour un son donné (music_id)
 * en interrogeant la table tiktok_videos.
 */
export async function computeCreatorDiversityFromDb(musicId: string): Promise<number> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("tiktok_videos")
    .select("username")
    .eq("music_id", musicId);

  if (error) {
    throw new Error(`Erreur lors du calcul de diversité créateurs pour ${musicId}: ${error.message}`);
  }

  if (!data || data.length === 0) return 0;
  return computeCreatorDiversity(data);
}

// ---------------------------------------------------------------------------
// Fonction principale de recalcul
// ---------------------------------------------------------------------------

/**
 * Recalcule les scores de tous les sons validés et génère les éditions brouillon.
 *
 * 1. Récupère tous les sons avec validation_status = "valide"
 * 2. Calcule growth_7d pour chaque son
 * 3. Calcule les plages min/max pour la normalisation
 * 4. Calcule le score composite pour chaque son
 * 5. Met à jour tiktok_sounds avec score et growth_7d
 * 6. Crée une chart_edition brouillon pour chaque source
 *
 * @param coefficients — Coefficients partiels (fusionnés avec les défauts)
 * @returns Le nombre de sons scorés et l'ID de l'édition globale créée
 */
export async function recalculate(
  coefficients?: Partial<ScoreCoefficients>
): Promise<ScoreEngineResult> {
  const supabase = createAdminClient();
  const mergedCoefficients: ScoreCoefficients = {
    ...DEFAULT_SCORE_COEFFICIENTS,
    ...coefficients,
  };

  // 1. Récupérer tous les sons validés
  const { data: sounds, error: soundsError } = await supabase
    .from("tiktok_sounds")
    .select("*")
    .eq("validation_status", "valide");

  if (soundsError) {
    throw new Error(`Erreur récupération sons validés: ${soundsError.message}`);
  }

  if (!sounds || sounds.length === 0) {
    return { soundsScored: 0, editionId: "" };
  }

  // 2. Calculer growth_7d et unique_creators pour chaque son
  const soundsWithMetrics = await Promise.all(
    sounds.map(async (sound) => {
      const growth7d = computeGrowth7d(
        sound.total_videos ?? 0,
        sound.previous_total_videos ?? 0
      );

      // Calculer la diversité créateurs depuis les vidéos
      const creatorDiversity = await computeCreatorDiversityFromDb(sound.music_id);

      return {
        ...sound,
        growth_7d_computed: growth7d,
        unique_creators_computed: creatorDiversity,
      };
    })
  );

  // 3. Calculer les plages min/max pour la normalisation
  const ranges: MetricRanges = {
    totalVideos: computeRange(soundsWithMetrics.map((s) => s.total_videos ?? 0)),
    totalViews: computeRange(soundsWithMetrics.map((s) => Number(s.total_views ?? 0))),
    totalLikes: computeRange(soundsWithMetrics.map((s) => Number(s.total_likes ?? 0))),
    totalComments: computeRange(soundsWithMetrics.map((s) => Number(s.total_comments ?? 0))),
    totalShares: computeRange(soundsWithMetrics.map((s) => Number(s.total_shares ?? 0))),
    growth7d: computeRange(soundsWithMetrics.map((s) => s.growth_7d_computed)),
    creatorDiversity: computeRange(soundsWithMetrics.map((s) => s.unique_creators_computed)),
  };

  // 4. Calculer le score composite et mettre à jour chaque son
  for (const sound of soundsWithMetrics) {
    const metrics: SoundMetrics = {
      totalVideos: sound.total_videos ?? 0,
      totalViews: Number(sound.total_views ?? 0),
      totalLikes: Number(sound.total_likes ?? 0),
      totalComments: Number(sound.total_comments ?? 0),
      totalShares: Number(sound.total_shares ?? 0),
      growth7d: sound.growth_7d_computed,
      creatorDiversity: sound.unique_creators_computed,
    };

    const score = computeCompositeScore(metrics, ranges, mergedCoefficients);

    // 5. Mettre à jour le son dans la base
    await supabase
      .from("tiktok_sounds")
      .update({
        score: parseFloat(score.toFixed(4)),
        growth_7d: parseFloat(sound.growth_7d_computed.toFixed(4)),
        unique_creators: sound.unique_creators_computed,
        last_updated_at: new Date().toISOString(),
      })
      .eq("music_id", sound.music_id);
  }

  // 6. Créer une chart_edition brouillon pour chaque source
  const editionId = await createDraftEditions(supabase, soundsWithMetrics, ranges, mergedCoefficients);

  return {
    soundsScored: soundsWithMetrics.length,
    editionId,
  };
}

// ---------------------------------------------------------------------------
// Fonctions internes
// ---------------------------------------------------------------------------

/** Calcule le min/max d'un tableau de nombres */
function computeRange(values: number[]): { min: number; max: number } {
  if (values.length === 0) return { min: 0, max: 0 };
  return {
    min: Math.min(...values),
    max: Math.max(...values),
  };
}

/**
 * Crée les éditions brouillon pour les 3 sources TikTok.
 * Retourne l'ID de l'édition globale.
 */
async function createDraftEditions(
  supabase: ReturnType<typeof createAdminClient>,
  sounds: Array<Record<string, unknown>>,
  ranges: MetricRanges,
  coefficients: ScoreCoefficients
): Promise<string> {
  const sourceKeys = [SOURCE_KEYS.global, SOURCE_KEYS.enMontee, SOURCE_KEYS.nouveautes];
  let globalEditionId = "";

  for (const sourceKey of sourceKeys) {
    // Récupérer l'ID de la source
    const { data: source } = await supabase
      .from("chart_sources")
      .select("id")
      .eq("source_key", sourceKey)
      .single();

    if (!source) {
      console.warn(`[score-engine] Source introuvable: ${sourceKey}`);
      continue;
    }

    const now = new Date();
    const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59));
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
      // Supprimer les anciennes entrées et mettre à jour l'édition
      await supabase.from("chart_entries").delete().eq("chart_edition_id", editionId);
      await supabase
        .from("chart_editions")
        .update({
          edition_key: editionKey,
          collected_at: now.toISOString(),
          status: "draft",
          is_stale: false,
          validation_notes: "Recalcul score engine — en attente de validation.",
        })
        .eq("id", editionId);
    } else {
      const { data: newEdition, error } = await supabase
        .from("chart_editions")
        .insert({
          chart_source_id: source.id,
          edition_key: editionKey,
          period_start: periodStart.toISOString(),
          period_end: periodEnd.toISOString(),
          collected_at: now.toISOString(),
          status: "draft",
          is_stale: false,
          entry_count: 0,
          validation_notes: "Recalcul score engine — en attente de validation.",
        })
        .select("id")
        .single();

      if (error || !newEdition) {
        console.error(`[score-engine] Création édition échouée pour ${sourceKey}:`, error?.message);
        continue;
      }
      editionId = newEdition.id;
    }

    if (sourceKey === SOURCE_KEYS.global) {
      globalEditionId = editionId;
    }

    // Insérer les entrées triées selon le type de classement
    const sortedSounds = sortSoundsForSource(sourceKey, sounds, ranges, coefficients);

    for (let i = 0; i < sortedSounds.length; i++) {
      const sound = sortedSounds[i];
      await supabase.from("chart_entries").insert({
        chart_edition_id: editionId,
        source_position: i + 1,
        raw_track_title: sound.sound_title as string,
        raw_artist_text: (sound.sound_author as string) ?? null,
        metric_value: sound.total_videos as number,
        metric_unit: "posts_count",
      });
    }

    // Mettre à jour le nombre d'entrées
    await supabase
      .from("chart_editions")
      .update({ entry_count: sortedSounds.length })
      .eq("id", editionId);
  }

  return globalEditionId;
}

/**
 * Trie les sons selon le type de source (classement).
 */
function sortSoundsForSource(
  sourceKey: string,
  sounds: Array<Record<string, unknown>>,
  ranges: MetricRanges,
  coefficients: ScoreCoefficients
): Array<Record<string, unknown>> {
  // Filtrer les sons pour les nouveautés (14 jours)
  let filtered = [...sounds];

  if (sourceKey === SOURCE_KEYS.nouveautes) {
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
    filtered = filtered.filter((s) => {
      const firstSeen = new Date(s.first_seen_at as string);
      return firstSeen >= fourteenDaysAgo;
    });
  }

  // Trier selon le type de classement
  if (sourceKey === SOURCE_KEYS.enMontee) {
    // En montée : tri par growth_7d descendant
    return filtered.sort((a, b) => {
      return (b.growth_7d_computed as number) - (a.growth_7d_computed as number);
    });
  }

  // Global et Nouveautés : tri par score composite descendant
  return filtered.sort((a, b) => {
    const scoreA = computeCompositeScore(
      {
        totalVideos: (a.total_videos as number) ?? 0,
        totalViews: Number((a.total_views as number) ?? 0),
        totalLikes: Number((a.total_likes as number) ?? 0),
        totalComments: Number((a.total_comments as number) ?? 0),
        totalShares: Number((a.total_shares as number) ?? 0),
        growth7d: a.growth_7d_computed as number,
        creatorDiversity: a.unique_creators_computed as number,
      },
      ranges,
      coefficients
    );
    const scoreB = computeCompositeScore(
      {
        totalVideos: (b.total_videos as number) ?? 0,
        totalViews: Number((b.total_views as number) ?? 0),
        totalLikes: Number((b.total_likes as number) ?? 0),
        totalComments: Number((b.total_comments as number) ?? 0),
        totalShares: Number((b.total_shares as number) ?? 0),
        growth7d: b.growth_7d_computed as number,
        creatorDiversity: b.unique_creators_computed as number,
      },
      ranges,
      coefficients
    );
    return scoreB - scoreA;
  });
}
