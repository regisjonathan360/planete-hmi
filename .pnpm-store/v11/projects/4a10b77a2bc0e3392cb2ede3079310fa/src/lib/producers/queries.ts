/**
 * Lectures partagées autour des producteurs / beatmakers.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export const PRODUCER_ARTIST_TYPES = ["producer", "beatmaker"] as const;

export const PRODUCTION_ROLE_LABELS: Record<string, string> = {
  producer: "Producteur",
  beatmaker: "Beatmaker",
  "co-producer": "Co-producteur",
  executive_producer: "Producteur exécutif",
};

export const CREDIT_SOURCE_LABELS: Record<string, string> = {
  manual_admin: "Saisi en admin",
  title_credit: "Crédit du titre",
  spotify_sync: "Spotify",
  chart_collect: "Collecte classement",
};

export interface ProductionItem {
  id: string;
  trackId: string;
  title: string;
  role: string;
  creditSource: string;
  creditNote: string | null;
  confidence: number;
  isVerified: boolean;
  artworkUrl: string | null;
  releaseDate: string | null;
  /** Interprètes principaux du titre. */
  performers: { name: string; slug: string }[];
}

/**
 * Supabase type une relation imbriquée comme un tableau ou un objet selon la
 * cardinalité inférée. On normalise vers un objet unique.
 */
function firstRelation<T>(value: unknown): T | null {
  if (Array.isArray(value)) return (value[0] as T) ?? null;
  return (value as T) ?? null;
}

/**
 * Productions rattachées à un producteur, les crédits vérifiés d'abord.
 */
export async function getProductionsForProducer(
  supabase: SupabaseClient,
  producerId: string,
  limit = 60,
): Promise<ProductionItem[]> {
  const { data } = await supabase
    .from("artist_productions")
    .select(
      `id, track_id, role, credit_source, credit_note, confidence, is_verified,
       tracks(title, default_artwork_url, release_date)`,
    )
    .eq("producer_id", producerId)
    .order("is_verified", { ascending: false })
    .order("confidence", { ascending: false })
    .limit(limit);

  const rows = data ?? [];
  if (rows.length === 0) return [];

  // Interprètes principaux, chargés en une requête pour tous les titres.
  const trackIds = rows.map((r) => r.track_id as string);
  const { data: credits } = await supabase
    .from("track_artists")
    .select("track_id, billing_order, artists(name, slug)")
    .in("track_id", trackIds)
    .in("role", ["primary", "co_primary"]);

  const performersByTrack = new Map<string, { name: string; slug: string }[]>();
  for (const credit of credits ?? []) {
    const artist = firstRelation<{ name: string; slug: string }>(credit.artists);
    if (!artist?.slug) continue;
    const trackId = credit.track_id as string;
    const list = performersByTrack.get(trackId) ?? [];
    list.push({ name: artist.name, slug: artist.slug });
    performersByTrack.set(trackId, list);
  }

  return rows.map((row) => {
    const track = firstRelation<{
      title: string;
      default_artwork_url: string | null;
      release_date: string | null;
    }>(row.tracks);
    return {
      id: row.id as string,
      trackId: row.track_id as string,
      title: track?.title ?? "Sans titre",
      role: (row.role as string) ?? "producer",
      creditSource: (row.credit_source as string) ?? "manual_admin",
      creditNote: (row.credit_note as string) ?? null,
      confidence: Number(row.confidence ?? 1),
      isVerified: !!row.is_verified,
      artworkUrl: track?.default_artwork_url ?? null,
      releaseDate: track?.release_date ?? null,
      performers: performersByTrack.get(row.track_id as string) ?? [],
    };
  });
}

/** Nombre de productions par producteur, pour les listes et les grilles. */
export async function countProductionsByProducer(
  supabase: SupabaseClient,
  producerIds: readonly string[],
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  const ids = [...new Set(producerIds)];
  if (ids.length === 0) return counts;

  const { data } = await supabase
    .from("artist_productions")
    .select("producer_id")
    .in("producer_id", ids);

  for (const row of data ?? []) {
    const id = row.producer_id as string;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}
