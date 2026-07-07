import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { AUDIOMACK_HAITI_SOURCE_URL } from "@/lib/charts/audiomack-sources";
import { normalizeTitle } from "@/lib/charts/normalization/normalize-title";
import { normalizeArtists } from "@/lib/charts/normalization/normalize-artists";
import { recomputeEdition } from "@/lib/charts/publish/recompute-edition";
import type { AudiomackNormalizedEntry } from "./types";

const SOURCE_KEY = "audiomack_haiti_weekly100";

function slugify(value: string): string {
  const slug = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return slug || "artiste-a-verifier";
}

function weekWindowFromSourceDate(sourceUpdatedAt: string | null | undefined): {
  periodStart: string;
  periodEnd: string;
  editionKey: string;
} {
  const sourceDate = sourceUpdatedAt ? new Date(sourceUpdatedAt) : new Date();
  const end = new Date(Date.UTC(
    sourceDate.getUTCFullYear(),
    sourceDate.getUTCMonth(),
    sourceDate.getUTCDate(),
    23,
    59,
    59
  ));
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 6);
  start.setUTCHours(0, 0, 0, 0);

  return {
    periodStart: start.toISOString(),
    periodEnd: end.toISOString(),
    editionKey: `audiomack-haiti-${end.toISOString().slice(0, 10)}`,
  };
}

async function ensureAudiomackSource(supabase: SupabaseClient): Promise<string> {
  const { data, error } = await supabase
    .from("chart_sources")
    .upsert({
      platform: "audiomack",
      source_key: SOURCE_KEY,
      display_name: "Audiomack - Weekly 100 Haiti",
      chart_context: "Weekly 100: Haiti officiel Audiomack",
      market_code: "HT",
      genre_id: "all",
      ingestion_mode: "OFFICIAL_EXPORT",
      source_url: AUDIOMACK_HAITI_SOURCE_URL,
      is_enabled: true,
      is_automatic: true,
      last_success_at: new Date().toISOString(),
      last_error: null,
    }, { onConflict: "source_key" })
    .select("id")
    .single();

  if (error || !data) throw new Error(`Source Audiomack introuvable: ${error?.message ?? "aucune donnee"}`);
  return data.id;
}

async function findTrackByPlatformId(
  supabase: SupabaseClient,
  platformTrackId: string
): Promise<string | null> {
  const { data } = await supabase
    .from("platform_tracks")
    .select("track_id")
    .eq("platform", "audiomack")
    .eq("external_id", platformTrackId)
    .maybeSingle();

  return data?.track_id ?? null;
}

async function ensureArtist(supabase: SupabaseClient, name: string, fallbackIndex: number): Promise<string> {
  const slugBase = slugify(name);
  const { data: existing } = await supabase
    .from("artists")
    .select("id")
    .eq("slug", slugBase)
    .maybeSingle();

  if (existing?.id) return existing.id;

  const { data, error } = await supabase
    .from("artists")
    .insert({
      name,
      slug: fallbackIndex === 0 ? slugBase : `${slugBase}-${fallbackIndex}`,
      haitian_status: "pending_review",
      country_code: null,
    })
    .select("id")
    .single();

  if (error || !data) {
    if (error?.code === "23505") return ensureArtist(supabase, name, fallbackIndex + 1);
    throw new Error(`Creation artiste echouee (${name}): ${error?.message ?? "aucune donnee"}`);
  }

  return data.id;
}

async function ensureTrack(
  supabase: SupabaseClient,
  entry: AudiomackNormalizedEntry
): Promise<string> {
  if (entry.platformTrackId) {
    const trackId = await findTrackByPlatformId(supabase, entry.platformTrackId);
    if (trackId) return trackId;
  }

  const { data: track, error } = await supabase
    .from("tracks")
    .insert({
      title: entry.title,
      normalized_title: normalizeTitle(entry.title),
      default_artwork_url: entry.artworkUrl,
    })
    .select("id")
    .single();

  if (error || !track) throw new Error(`Creation chanson echouee (${entry.title}): ${error?.message ?? "aucune donnee"}`);

  const artists = normalizeArtists(entry.artistName);
  for (const artist of artists) {
    const artistId = await ensureArtist(supabase, artist.nom, 0);
    await supabase
      .from("track_artists")
      .upsert({
        track_id: track.id,
        artist_id: artistId,
        role: artist.role,
        billing_order: artist.billingOrder,
      }, { onConflict: "track_id,artist_id,role" });
  }

  return track.id;
}

async function ensurePlatformTrack(
  supabase: SupabaseClient,
  entry: AudiomackNormalizedEntry,
  trackId: string
): Promise<string | null> {
  const externalId = entry.platformTrackId ?? entry.sourceTrackUrl;
  if (!externalId) return null;

  const { data, error } = await supabase
    .from("platform_tracks")
    .upsert({
      track_id: trackId,
      platform: "audiomack",
      external_id: externalId,
      external_url: entry.sourceTrackUrl,
      platform_title: entry.title,
      platform_artist_text: entry.artistName,
      artwork_url: entry.artworkUrl,
      match_status: "official_audiomack_haiti",
      match_confidence: 1,
      verified_at: new Date().toISOString(),
    }, { onConflict: "platform,external_id" })
    .select("id")
    .single();

  if (error) throw new Error(`Correspondance Audiomack echouee: ${error.message}`);
  return data?.id ?? null;
}

export async function syncAudiomackEntriesToCharts(
  supabase: SupabaseClient,
  entries: AudiomackNormalizedEntry[],
  options: { sourceUpdatedAt?: string | null } = {}
): Promise<{ editionId: string; imported: number; eligible: number }> {
  if (!entries.length) throw new Error("Aucune entree Audiomack a synchroniser.");

  const sourceId = await ensureAudiomackSource(supabase);
  const { periodStart, periodEnd, editionKey } = weekWindowFromSourceDate(options.sourceUpdatedAt);

  const { data: existing } = await supabase
    .from("chart_editions")
    .select("id")
    .eq("chart_source_id", sourceId)
    .eq("period_start", periodStart)
    .eq("period_end", periodEnd)
    .maybeSingle();

  let editionId = existing?.id ?? null;
  if (editionId) {
    await supabase.from("chart_entries").delete().eq("chart_edition_id", editionId);
    await supabase
      .from("chart_editions")
      .update({
        edition_key: editionKey,
        source_updated_at: options.sourceUpdatedAt ?? null,
        collected_at: new Date().toISOString(),
        status: "imported",
        is_stale: false,
      })
      .eq("id", editionId);
  } else {
    const { data, error } = await supabase
      .from("chart_editions")
      .insert({
        chart_source_id: sourceId,
        edition_key: editionKey,
        period_start: periodStart,
        period_end: periodEnd,
        source_updated_at: options.sourceUpdatedAt ?? null,
        collected_at: new Date().toISOString(),
        status: "imported",
        is_stale: false,
      })
      .select("id")
      .single();

    if (error || !data) throw new Error(`Creation edition Audiomack echouee: ${error?.message ?? "aucune donnee"}`);
    editionId = data.id;
  }

  for (const entry of entries) {
    const trackId = await ensureTrack(supabase, entry);
    const platformTrackId = await ensurePlatformTrack(supabase, entry, trackId);

    await supabase.from("chart_entries").insert({
      chart_edition_id: editionId,
      track_id: trackId,
      platform_track_id: platformTrackId,
      source_position: entry.rank,
      raw_track_title: entry.title,
      raw_artist_text: entry.artistName,
      metric_value: entry.rank,
      metric_unit: "source_rank",
    });
  }

  const { eligibles } = await recomputeEdition(supabase, editionId);
  await supabase
    .from("chart_editions")
    .update({
      status: "published",
      published_at: new Date().toISOString(),
      validated_at: new Date().toISOString(),
      entry_count: eligibles,
      is_stale: false,
      validation_notes: null,
    })
    .eq("id", editionId);

  return { editionId, imported: entries.length, eligible: eligibles };
}
