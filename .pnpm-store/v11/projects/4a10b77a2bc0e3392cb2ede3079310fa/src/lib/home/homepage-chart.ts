/**
 * Classement planétaire de la page d'accueil.
 *
 * Moyenne des positions de chaque titre à travers tous les classements publiés.
 * Le top 5 est calculé automatiquement, puis validé et publié par l'admin. Tant
 * que l'admin ne publie pas, la section reste en mode « démonstration ».
 */
import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export interface HomepageChartEntry {
  id: string;
  trackId: string;
  artistId: string | null;
  title: string;
  artistName: string;
  artistSlug: string | null;
  artworkUrl: string | null;
  platformUrl: string | null;
  avgPosition: number;
  platformsCount: number;
  platformsDetail: { source_key: string; platform: string; display_name: string; position: number }[];
  displayPosition: number;
  movement: number | null;
  previousPosition: number | null;
}

export interface ComputedEntry {
  trackId: string;
  artistId: string | null;
  title: string;
  artistName: string;
  artistSlug: string | null;
  artworkUrl: string | null;
  platformUrl: string | null;
  avgPosition: number;
  platformsCount: number;
  platformsDetail: { source_key: string; platform: string; display_name: string; position: number }[];
}

/** Résultat du calcul automatique. */
export async function computeHomepageChart(
  supabase: SupabaseClient,
  limit = 20,
): Promise<ComputedEntry[]> {
  const { data, error } = await supabase.rpc("compute_homepage_chart", { p_limit: limit });
  if (error) throw new Error(`Calcul du classement impossible : ${error.message}`);

  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    trackId: row.track_id as string,
    artistId: (row.artist_id as string) ?? null,
    title: (row.title as string) ?? "Sans titre",
    artistName: (row.artist_name as string) ?? "Artiste",
    artistSlug: (row.artist_slug as string) ?? null,
    artworkUrl: (row.artwork_url as string) ?? null,
    platformUrl: (row.platform_url as string) ?? null,
    avgPosition: Number(row.avg_position ?? 999),
    platformsCount: Number(row.platforms_count ?? 0),
    platformsDetail: (row.platforms_detail ?? []) as ComputedEntry["platformsDetail"],
  }));
}

/** Classement publié (lu par la page d'accueil). */
export async function getPublishedHomepageChart(
  supabase: SupabaseClient,
): Promise<HomepageChartEntry[]> {
  const { data, error } = await supabase
    .from("homepage_chart")
    .select("*")
    .eq("is_published", true)
    .order("display_position")
    .limit(10);

  if (error) throw new Error(`Lecture du classement d'accueil impossible : ${error.message}`);
  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    id: row.id as string,
    trackId: row.track_id as string,
    artistId: (row.artist_id as string) ?? null,
    title: (row.title as string) ?? "Sans titre",
    artistName: (row.artist_name as string) ?? "Artiste",
    artistSlug: (row.artist_slug as string) ?? null,
    artworkUrl: (row.artwork_url as string) ?? null,
    platformUrl: (row.platform_url as string) ?? null,
    avgPosition: Number(row.avg_position ?? 0),
    platformsCount: Number(row.platforms_count ?? 0),
    platformsDetail: (row.platforms_detail ?? []) as HomepageChartEntry["platformsDetail"],
    displayPosition: Number(row.display_position),
    movement: (row.movement as number) ?? null,
    previousPosition: (row.previous_position as number) ?? null,
  }));
}

export interface PublishHomepageResult {
  published: number;
  message: string;
}

/**
 * Publie les N premières entrées du calcul automatique.
 * Remplace intégralement le contenu de `homepage_chart`.
 */
export async function publishHomepageChart(
  supabase: SupabaseClient,
  entries: ComputedEntry[],
  options: { limit?: number; publishedBy?: string | null } = {},
): Promise<PublishHomepageResult> {
  const limit = Math.min(Math.max(options.limit ?? 5, 1), 10);
  const toPublish = entries.slice(0, limit);
  if (toPublish.length === 0) {
    return { published: 0, message: "Aucun titre à publier : les classements sont vides." };
  }

  // Charger les positions précédentes pour calculer les mouvements.
  const { data: previous } = await supabase
    .from("homepage_chart")
    .select("track_id, display_position")
    .eq("is_published", true);

  const prevByTrack = new Map<string, number>();
  for (const row of previous ?? []) {
    prevByTrack.set(row.track_id as string, row.display_position as number);
  }

  // Remplacer toutes les entrées.
  await supabase.from("homepage_chart").delete().neq("id", "00000000-0000-0000-0000-000000000000");

  const now = new Date().toISOString();
  const rows = toPublish.map((entry, index) => {
    const newPos = index + 1;
    const oldPos = prevByTrack.get(entry.trackId) ?? null;
    return {
      track_id: entry.trackId,
      artist_id: entry.artistId,
      title: entry.title,
      artist_name: entry.artistName,
      artist_slug: entry.artistSlug,
      artwork_url: entry.artworkUrl,
      platform_url: entry.platformUrl,
      avg_position: entry.avgPosition,
      platforms_count: entry.platformsCount,
      platforms_detail: entry.platformsDetail,
      display_position: newPos,
      movement: oldPos !== null ? oldPos - newPos : null,
      previous_position: oldPos,
      is_published: true,
      published_at: now,
      published_by: options.publishedBy ?? null,
    };
  });

  const { error } = await supabase.from("homepage_chart").insert(rows);
  if (error) throw new Error(`Publication du classement d'accueil échouée : ${error.message}`);

  return {
    published: rows.length,
    message: `Top ${rows.length} publié sur la page d'accueil.`,
  };
}
