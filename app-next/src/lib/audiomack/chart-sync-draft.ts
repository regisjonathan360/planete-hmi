/**
 * Synchronisation Audiomack → chart_editions en mode BROUILLON (draft).
 *
 * Contrairement à chart-sync.ts qui publie automatiquement, cette version
 * enregistre les données avec status "draft" pour validation manuelle
 * dans l'interface admin.
 */
import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeTitle } from "@/lib/charts/normalization/normalize-title";
import { normalizeArtists } from "@/lib/charts/normalization/normalize-artists";
import { AUDIOMACK_HAITI_CHART_SOURCES } from "@/lib/charts/audiomack-sources";
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

interface SourceConfig {
  platform: string;
  displayName: string;
  chartContext: string;
  sourceUrl: string;
  ingestionMode: string;
  genreId?: string;
}

const SOURCE_CONFIGS: Record<string, SourceConfig> = {
  audiomack_haiti_weekly100: {
    platform: "audiomack",
    displayName: "Audiomack - Top Songs Haiti",
    chartContext: "Top Songs Haiti officiel Audiomack",
    sourceUrl: "https://audiomack.com/top/songs?country=haiti",
    ingestionMode: "OFFICIAL_EXPORT",
  },
  deezer_haiti_top100: {
    platform: "deezer",
    displayName: "Deezer - Top Haiti",
    chartContext: "Top 100 Haiti (playlist communautaire Deezer)",
    sourceUrl: "https://www.deezer.com/playlist/15034575123",
    ingestionMode: "OFFICIAL_EXPORT",
  },
  spotify_haiti_popular: {
    platform: "spotify",
    displayName: "Spotify — Top 50 GlobHaitian",
    chartContext: "Top 50 GlobHaitian (playlist Spotify)",
    sourceUrl: "https://open.spotify.com/playlist/1cXIKrbi0PwJkNQgrzOokU",
    // Une playlist éditoriale n'est pas un export officiel de classement :
    // chaque édition est vérifiée puis publiée à la main.
    ingestionMode: "VERIFIED_ADMIN_IMPORT",
  },
  tiktok_haiti_viral_playlist: {
    platform: "tiktok",
    displayName: "Top TikTok Haiti — Viral (playlist)",
    chartContext: "TikTok Viral Haiti (playlist Spotify)",
    sourceUrl: "https://open.spotify.com/playlist/4SRJiaVoFWqcVLKvsvd5dH",
    ingestionMode: "VERIFIED_ADMIN_IMPORT",
  },
};

// Sources genre Audiomack — configurations créées depuis la liste officielle.
// Elles ne servent qu'à créer une source inexistante ; une source déjà en base
// n'est jamais réécrite (ensureSource).
for (const source of AUDIOMACK_HAITI_CHART_SOURCES) {
  if (source.genreId === "all") continue;
  SOURCE_CONFIGS[source.sourceKey] = {
    platform: "audiomack",
    displayName: source.displayName,
    chartContext: source.chartContext,
    sourceUrl: source.sourceUrl,
    ingestionMode: "OFFICIAL_EXPORT",
    genreId: source.genreId,
  };
}

/**
 * Garantit l'existence de la source.
 *
 * Une source déjà présente n'est PAS réécrite : seuls les champs volatils sont
 * touchés. Sans cela, chaque collecte annulait les réglages faits en admin
 * (URL de playlist, libellé, mode d'ingestion).
 */
async function ensureSource(supabase: SupabaseClient, sourceKey: string): Promise<string> {
  const now = new Date().toISOString();

  const { data: existing } = await supabase
    .from("chart_sources")
    .select("id")
    .eq("source_key", sourceKey)
    .maybeSingle();

  if (existing?.id) {
    await supabase
      .from("chart_sources")
      .update({ last_success_at: now, last_error: null })
      .eq("id", existing.id);
    return existing.id as string;
  }

  const config = SOURCE_CONFIGS[sourceKey] ?? SOURCE_CONFIGS.audiomack_haiti_weekly100;
  const { data, error } = await supabase
    .from("chart_sources")
    .insert({
      platform: config.platform,
      source_key: sourceKey,
      display_name: config.displayName,
      chart_context: config.chartContext,
      market_code: "HT",
      genre_id: config.genreId ?? "all",
      ingestion_mode: config.ingestionMode,
      source_url: config.sourceUrl,
      is_enabled: true,
      is_automatic: false,
      last_success_at: now,
      last_error: null,
    })
    .select("id")
    .single();

  if (error || !data) throw new Error(`Source introuvable: ${error?.message ?? "aucune donnée"}`);
  return data.id;
}

/**
 * Retrouve une chanson depuis son identifiant plateforme.
 *
 * Le repli sur `audiomack` couvre les lignes historiques : avant la
 * généralisation multi-plateforme, toutes les correspondances étaient
 * enregistrées sous cette plateforme, y compris celles de Deezer.
 */
async function findTrackByPlatformId(
  supabase: SupabaseClient,
  platformTrackId: string,
  platform: string
): Promise<string | null> {
  const platforms = platform === "audiomack" ? [platform] : [platform, "audiomack"];

  for (const candidate of platforms) {
    const { data } = await supabase
      .from("platform_tracks")
      .select("track_id")
      .eq("platform", candidate)
      .eq("external_id", platformTrackId)
      .maybeSingle();

    if (data?.track_id) return data.track_id as string;
  }

  return null;
}

async function ensureArtist(supabase: SupabaseClient, name: string, fallbackIndex: number, imageUrl?: string | null): Promise<string> {
  const slugBase = slugify(name);
  const { data: existing } = await supabase
    .from("artists")
    .select("id, is_excluded")
    .eq("slug", slugBase)
    .maybeSingle();

  if (existing?.id) {
    // Mettre à jour la photo si on en a une et qu'il n'en avait pas.
    if (imageUrl && !existing.is_excluded) {
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
    const trackId = await findTrackByPlatformId(supabase, entry.platformTrackId, entry.platform);
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

    // Enregistrer l'identité plateforme de l'artiste (multi-plateforme)
    if (entry.artistSlug || entry.sourceTrackUrl) {
      await supabase
        .from("artist_platform_identities")
        .upsert({
          artist_id: artistId,
          platform: entry.platform,
          external_id: entry.artistSlug ?? slugify(artist.nom),
          external_url: entry.sourceTrackUrl ? entry.sourceTrackUrl.split("/song/")[0] : null,
          platform_name: artist.nom,
          platform_image_url: entry.artistImageUrl ?? null,
          match_method: "auto_collect",
          last_seen_at: new Date().toISOString(),
        }, { onConflict: "platform,external_id", ignoreDuplicates: true })
        .select("id");
    }

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

async function isTrackGloballyExcluded(
  supabase: SupabaseClient,
  trackId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("track_artists")
    .select("artists!inner(is_excluded)")
    .eq("track_id", trackId)
    .eq("artists.is_excluded", true)
    .limit(1);

  if (error) throw new Error(`Vérification des exclusions échouée: ${error.message}`);
  return (data?.length ?? 0) > 0;
}

async function isEntryGloballyExcluded(
  supabase: SupabaseClient,
  entry: AudiomackNormalizedEntry
): Promise<boolean> {
  if (entry.artistSlug) {
    const { data: identity, error: identityError } = await supabase
      .from("artist_platform_identities")
      .select("artists!inner(is_excluded)")
      .eq("platform", entry.platform)
      .eq("external_id", entry.artistSlug)
      .eq("artists.is_excluded", true)
      .limit(1);
    if (identityError) throw new Error(`Vérification d’identité exclue échouée: ${identityError.message}`);
    if ((identity?.length ?? 0) > 0) return true;
  }

  const candidateSlugs = normalizeArtists(entry.artistName).map((artist) => slugify(artist.nom));
  if (!candidateSlugs.length) return false;
  const { data: artists, error } = await supabase
    .from("artists")
    .select("id")
    .in("slug", candidateSlugs)
    .eq("is_excluded", true)
    .limit(1);
  if (error) throw new Error(`Vérification d’artiste exclu échouée: ${error.message}`);
  return (artists?.length ?? 0) > 0;
}

async function ensurePlatformTrack(
  supabase: SupabaseClient,
  entry: AudiomackNormalizedEntry,
  trackId: string
): Promise<string | null> {
  const externalId = entry.platformTrackId ?? entry.sourceTrackUrl;
  if (!externalId) return null;

  // La plateforme réelle de l'entrée est enregistrée : la contrainte
  // unique (platform, external_id) ne peut donc plus faire collisionner
  // deux identifiants numériques venant de plateformes différentes.
  const platform = entry.platform;

  const { data, error } = await supabase
    .from("platform_tracks")
    .upsert({
      track_id: trackId,
      platform,
      external_id: externalId,
      external_url: entry.sourceTrackUrl,
      preview_url: entry.previewUrl ?? null,
      audio_url: entry.previewUrl ?? null,
      platform_title: entry.title,
      platform_artist_text: entry.artistName,
      artwork_url: entry.artworkUrl,
      match_status:
        platform === "audiomack"
          ? "official_audiomack_haiti"
          : `official_${platform}_${entry.countryCode.toLowerCase()}`,
      match_confidence: 1,
      verified_at: new Date().toISOString(),
    }, { onConflict: "platform,external_id" })
    .select("id")
    .single();

  if (error) throw new Error(`Correspondance ${platform} échouée: ${error.message}`);
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
): Promise<{ editionId: string; imported: number; excluded: number }> {
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

  // Insérer uniquement les entrées dont aucun artiste n'est dans le registre
  // global d'exclusion. Ce filtre commun couvre Audiomack, Deezer, Spotify et
  // toute future collecte Apple Music qui réutilise ce pipeline.
  let imported = 0;
  let excluded = 0;
  for (const entry of entries) {
    if (await isEntryGloballyExcluded(supabase, entry)) {
      excluded++;
      continue;
    }
    const trackId = await ensureTrack(supabase, entry);
    if (await isTrackGloballyExcluded(supabase, trackId)) {
      excluded++;
      continue;
    }
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
    imported++;
  }

  // Mettre à jour le count final
  await supabase
    .from("chart_editions")
    .update({ entry_count: imported })
    .eq("id", editionId);

  return { editionId, imported, excluded };
}
