/**
 * Service de gestion des snapshots Audiomack (Supabase).
 * Enregistre les classements, vérifie les doublons (content_hash),
 * et fournit la lecture publique.
 */
import "server-only";
import crypto from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AudiomackSnapshotEntry, AudiomackChartResponse } from "./types";
import { calculateMovements } from "./movements";
import { validateEntries } from "./schemas";
import type { AudiomackNormalizedEntry } from "./types";

const PLATFORM = "audiomack";
const COUNTRY = "HT";
const CHART_NAME = "Weekly 100: Haiti";
const SOURCE_URL = "https://audiomack.com/geo-charts/playlist/haiti";

function computeContentHash(entries: AudiomackNormalizedEntry[]): string {
  const payload = entries.map((e) => `${e.platformTrackId ?? e.title}:${e.rank}`).join("|");
  return crypto.createHash("sha256").update(payload).digest("hex").slice(0, 16);
}

/** Récupère les entrées du dernier snapshot réussi. */
export async function getLastSuccessfulEntries(
  supabase: SupabaseClient
): Promise<AudiomackSnapshotEntry[] | null> {
  const { data: snapshot } = await supabase
    .from("chart_snapshots")
    .select("id")
    .eq("platform", PLATFORM)
    .eq("country_code", COUNTRY)
    .eq("status", "success")
    .order("collected_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!snapshot) return null;

  const { data: entries } = await supabase
    .from("chart_snapshot_entries")
    .select("*")
    .eq("snapshot_id", snapshot.id)
    .order("rank");

  if (!entries?.length) return null;

  return entries.map((e) => ({
    platform: "audiomack" as const,
    countryCode: "HT" as const,
    rank: e.rank,
    platformTrackId: e.platform_track_id,
    title: e.title,
    artistName: e.artist_name,
    artworkUrl: e.artwork_url,
    artistImageUrl: e.artist_image_url ?? null,
    sourceTrackUrl: e.source_track_url ?? SOURCE_URL,
    artistSlug: e.artist_slug,
    trackSlug: e.track_slug,
    albumName: e.album_name,
    genre: e.genre,
    previousRank: e.previous_rank,
    rankChange: e.rank_change,
    isNew: e.is_new,
    weeksOnChart: e.weeks_on_chart,
    peakRank: e.peak_rank ?? e.rank,
  }));
}

/** Enregistre un nouveau snapshot si le contenu a changé. Retourne true si créé. */
export async function saveSnapshot(
  supabase: SupabaseClient,
  normalized: AudiomackNormalizedEntry[],
  options: { sourceUpdatedAt?: string | null } = {}
): Promise<{ created: boolean; error?: string }> {
  // Validation Zod
  const { valid, entries: validated, errors } = validateEntries(normalized);
  if (!valid) return { created: false, error: errors.join(" | ") };

  // Hash de contenu
  const hash = computeContentHash(validated);

  // Vérifier si le même hash existe déjà
  const { data: existing } = await supabase
    .from("chart_snapshots")
    .select("id")
    .eq("platform", PLATFORM)
    .eq("country_code", COUNTRY)
    .eq("content_hash", hash)
    .limit(1)
    .maybeSingle();

  if (existing) return { created: false, error: "Contenu identique au dernier snapshot." };

  // Récupérer les données précédentes pour calculer les mouvements
  const previousEntries = await getLastSuccessfulEntries(supabase);
  const withMovements = calculateMovements(validated, previousEntries);

  // Créer le snapshot
  const { data: snapshot, error: snapErr } = await supabase
    .from("chart_snapshots")
    .insert({
      platform: PLATFORM,
      country_code: COUNTRY,
      chart_name: CHART_NAME,
      source_url: SOURCE_URL,
      source_updated_at: options.sourceUpdatedAt ?? null,
      content_hash: hash,
      status: "success",
    })
    .select("id")
    .single();

  if (snapErr || !snapshot) return { created: false, error: snapErr?.message ?? "Échec création snapshot." };

  // Insérer les entrées
  const rows = withMovements.map((e) => ({
    snapshot_id: snapshot.id,
    platform_track_id: e.platformTrackId,
    rank: e.rank,
    previous_rank: e.previousRank,
    rank_change: e.rankChange,
    title: e.title,
    artist_name: e.artistName,
    artwork_url: e.artworkUrl,
    artist_image_url: e.artistImageUrl,
    source_track_url: e.sourceTrackUrl,
    artist_slug: e.artistSlug,
    track_slug: e.trackSlug,
    album_name: e.albumName,
    genre: e.genre,
    is_new: e.isNew,
    weeks_on_chart: e.weeksOnChart,
    peak_rank: e.peakRank,
  }));

  const { error: entErr } = await supabase.from("chart_snapshot_entries").insert(rows);
  if (entErr) return { created: false, error: entErr.message };

  return { created: true };
}

/** Lecture publique : dernier classement disponible. */
export async function getPublicChart(supabase: SupabaseClient, limit = 20): Promise<AudiomackChartResponse | null> {
  const { data: snapshot } = await supabase
    .from("chart_snapshots")
    .select("id, collected_at, source_updated_at")
    .eq("platform", PLATFORM)
    .eq("country_code", COUNTRY)
    .eq("status", "success")
    .order("collected_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!snapshot) return null;

  const { data: entries } = await supabase
    .from("chart_snapshot_entries")
    .select("*")
    .eq("snapshot_id", snapshot.id)
    .order("rank")
    .limit(limit);

  // Stale si plus de 8 jours sans mise à jour
  const collectedAt = new Date(snapshot.collected_at);
  const isStale = Date.now() - collectedAt.getTime() > 8 * 24 * 3600 * 1000;

  return {
    platform: "audiomack",
    countryCode: "HT",
    chartName: "Weekly 100: Haiti",
    sourceUrl: SOURCE_URL,
    sourceUpdatedAt: snapshot.source_updated_at,
    collectedAt: snapshot.collected_at,
    isStale,
    entries: (entries ?? []).map((e) => ({
      platform: "audiomack" as const,
      countryCode: "HT" as const,
      rank: e.rank,
      platformTrackId: e.platform_track_id,
      title: e.title,
      artistName: e.artist_name,
      artworkUrl: e.artwork_url,
      artistImageUrl: e.artist_image_url ?? null,
      sourceTrackUrl: e.source_track_url ?? SOURCE_URL,
      artistSlug: e.artist_slug,
      trackSlug: e.track_slug,
      albumName: e.album_name,
      genre: e.genre,
      previousRank: e.previous_rank,
      rankChange: e.rank_change,
      isNew: e.is_new,
      weeksOnChart: e.weeks_on_chart,
      peakRank: e.peak_rank ?? e.rank,
    })),
  };
}
