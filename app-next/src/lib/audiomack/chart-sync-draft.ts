/**
 * Synchronisation Audiomack → chart_editions en mode BROUILLON (draft).
 *
 * Contrairement à chart-sync.ts qui publie automatiquement, cette version
 * enregistre les données avec status "draft" pour validation manuelle
 * dans l'interface admin.
 */
import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { AUDIOMACK_HAITI_SOURCE_URL } from "@/lib/charts/audiomack-sources";
import { normalizeTitle } from "@/lib/charts/normalization/normalize-title";
import { normalizeArtists } from "@/lib/charts/normalization/normalize-artists";
import type { AudiomackNormalizedEntry } from "./types";

const DEFAULT_SOURCE_KEY = "audiomack_haiti_weekly100";

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
    editionKey: `audiomack-haiti-draft-${end.toISOString().slice(0, 10)}`,
  };
}

const SOURCE_CONFIGS: Record<string, { platform: string; displayName: string; chartContext: string; sourceUrl: string }> = {
  audiomack_haiti_weekly100: {
    platform: "audiomack",
    displayName: "Audiomack - Top Songs Haiti",
    chartContext: "Top Songs Haiti officiel Audiomack",
    sourceUrl: "https://audiomack.com/top/songs?country=haiti",
  },
  deezer_haiti_top100: {
    platform: "deezer",
    displayName: "Deezer - Top Haiti",
    chartContext: "Top 100 Haiti (playlist communautaire Deezer)",
    sourceUrl: "https://www.deezer.com/playlist/15034575123",
  },
};

async function ensureSource(supabase: SupabaseClient, sourceKey: string): Promise<string> {
  const config = SOURCE_CONFIGS[sourceKey] ?? SOURCE_CONFIGS.audiomack_haiti_weekly100;

  const { data, error } = await supabase
    .from("chart_sources")
    .upsert({
      platform: config.platform,
      source_key: sourceKey,
      display_name: config.displayName,
      chart_context: config.chartContext,
      market_code: "HT",
      genre_id: "all",
      ingestion_mode: "OFFICIAL_EXPORT",
      source_url: config.sourceUrl,
      is_enabled: true,
      is_automatic: false,
      last_success_at: new Date().toISOString(),
      last_error: null,
    }, { onConflict: "source_key" })
    .select("id")
    .single();

  if (error || !data) throw new Error(`Source introuvable: ${error?.message ?? "aucune donnée"}`);
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

async function ensureArtist(supabase: SupabaseClient, name: string, fallbackIndex: number, imageUrl?: string | null): Promise<string> {
  const slugBase = slugify(name);
  const { data: existing } = await supabase
    .from("artists")
    .select("id")
    .eq("slug", slugBase)
    .maybeSingle();

  if (existing?.id) {
    // Mettre à jour la photo si on en a une et qu'il n'en avait pas.
    if (imageUrl) {
      await supabase
        .from("artists")
        .update({ image_url: imageUrl })
        .eq("id", existing.id)
        .is("image_url", null);
    }
    return existing.id;
  }

  const { data, error } = await supabase
    .from("artists")
    .insert({
      name,
      slug: fallbackIndex === 0 ? slugBase : `${slugBase}-${fallbackIndex}`,
      haitian_status: "pending_review",
      country_code: null,
      image_url: imageUrl ?? null,
    })
    .select("id")
    .single();

  if (error || !data) {
    if (error?.code === "23505") return ensureArtist(supabase, name, fallbackIndex + 1, imageUrl);
    throw new Error(`Création artiste échouée (${name}): ${error?.message ?? "aucune donnée"}`);
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

  if (error || !track) throw new Error(`Création chanson échouée (${entry.title}): ${error?.message ?? "aucune donnée"}`);

  const artists = normalizeArtists(entry.artistName);
  for (const artist of artists) {
    const artistId = await ensureArtist(supabase, artist.nom, 0, entry.artistImageUrl);
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

  if (error) throw new Error(`Correspondance Audiomack échouée: ${error.message}`);
  return data?.id ?? null;
}

/**
 * Synchronise les entrées Audiomack dans chart_editions avec status "draft".
 * Les données ne seront PAS publiées — elles attendent validation admin.
 */
export async function syncAudiomackEntriesToChartsDraft(
  supabase: SupabaseClient,
  entries: AudiomackNormalizedEntry[],
  options: { sourceUpdatedAt?: string | null; sourceKey?: string } = {}
): Promise<{ editionId: string; imported: number }> {
  if (!entries.length) throw new Error("Aucune entrée à synchroniser.");

  const sourceKey = options.sourceKey ?? DEFAULT_SOURCE_KEY;
  const sourceId = await ensureSource(supabase, sourceKey);
  const { periodStart, periodEnd, editionKey } = weekWindowFromSourceDate(options.sourceUpdatedAt);

  // Chercher une édition existante pour la même période (quel que soit le
  // statut) : la contrainte d'unicité porte sur (source, période). On la
  // repasse en brouillon pour une nouvelle collecte.
  const { data: existing } = await supabase
    .from("chart_editions")
    .select("id")
    .eq("chart_source_id", sourceId)
    .eq("period_start", periodStart)
    .eq("period_end", periodEnd)
    .maybeSingle();

  let editionId = existing?.id ?? null;

  if (editionId) {
    // Remplacer le brouillon existant
    await supabase.from("chart_entries").delete().eq("chart_edition_id", editionId);
    await supabase
      .from("chart_editions")
      .update({
        edition_key: editionKey,
        source_updated_at: options.sourceUpdatedAt ?? null,
        collected_at: new Date().toISOString(),
        status: "draft",
        is_stale: false,
        validation_notes: "Collecte admin — en attente de validation.",
      })
      .eq("id", editionId);
  } else {
    // Créer un nouveau brouillon
    const { data, error } = await supabase
      .from("chart_editions")
      .insert({
        chart_source_id: sourceId,
        edition_key: editionKey,
        period_start: periodStart,
        period_end: periodEnd,
        source_updated_at: options.sourceUpdatedAt ?? null,
        collected_at: new Date().toISOString(),
        status: "draft",
        is_stale: false,
        entry_count: entries.length,
        validation_notes: "Collecte admin — en attente de validation.",
      })
      .select("id")
      .single();

    if (error || !data) throw new Error(`Création édition brouillon échouée: ${error?.message ?? "aucune donnée"}`);
    editionId = data.id;
  }

  // Archiver toutes les AUTRES éditions brouillon de cette source :
  // la nouvelle collecte remplace l'ancienne. Ainsi la section « À valider »
  // et le classement ne montrent que les artistes de la collecte courante.
  await supabase
    .from("chart_editions")
    .update({ status: "archived" })
    .eq("chart_source_id", sourceId)
    .eq("status", "draft")
    .neq("id", editionId);

  // Insérer les entrées
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

  // Mettre à jour le count final
  await supabase
    .from("chart_editions")
    .update({ entry_count: entries.length })
    .eq("id", editionId);

  return { editionId, imported: entries.length };
}
