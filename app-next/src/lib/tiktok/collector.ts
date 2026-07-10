import "server-only";

import { TikTokApiClient } from "./api-client";
import { normalizeVideo, type ValidatedTikTokVideo } from "./schemas";
import { HAITIAN_HASHTAGS, HAITIAN_MUSIC_KEYWORDS } from "./constants";
import type { CollectionResult, TikTokVideoQueryParams } from "./types";
import { createAdminClient } from "../supabase/admin";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Formate une date en YYYYMMDD pour l'API TikTok */
function formatDateYYYYMMDD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

/** Retourne la date de début par défaut (7 jours avant aujourd'hui) */
function defaultStartDate(): string {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return formatDateYYYYMMDD(d);
}

/** Retourne la date de fin par défaut (aujourd'hui) */
function defaultEndDate(): string {
  return formatDateYYYYMMDD(new Date());
}

// ---------------------------------------------------------------------------
// Types internes
// ---------------------------------------------------------------------------

interface StrategyResult {
  videos: ValidatedTikTokVideo[];
  errors: string[];
}

interface SoundAggregate {
  music_id: string;
  sound_title: string;
  sound_author: string | null;
  total_videos: number;
  total_views: number;
  total_likes: number;
  total_comments: number;
  total_shares: number;
  unique_creators: Set<string>;
}

// ---------------------------------------------------------------------------
// Collection Strategies
// ---------------------------------------------------------------------------

/**
 * Exécute une requête paginée et collecte toutes les vidéos correspondantes.
 * Suit le cursor tant que has_more = true.
 */
async function fetchAllPages(
  client: TikTokApiClient,
  params: TikTokVideoQueryParams
): Promise<ValidatedTikTokVideo[]> {
  const allVideos: ValidatedTikTokVideo[] = [];
  let cursor: number | undefined = undefined;
  let hasMore = true;

  while (hasMore) {
    const response = await client.queryVideos({ ...params, cursor });

    for (const rawVideo of response.videos) {
      try {
        const normalized = normalizeVideo(rawVideo);
        // Requirement 2.5: skip videos without music_id
        if (!normalized.music_id) continue;
        allVideos.push(normalized);
      } catch {
        // Vidéo invalide — skip silently
      }
    }

    cursor = response.cursor;
    hasMore = response.has_more && response.videos.length > 0;
  }

  return allVideos;
}

/** Stratégie 1 : vidéos de la région HT */
async function strategyRegion(
  client: TikTokApiClient,
  startDate: string,
  endDate: string
): Promise<StrategyResult> {
  try {
    const videos = await fetchAllPages(client, {
      region_code: "HT",
      start_date: startDate,
      end_date: endDate,
      max_count: 100,
    });
    return { videos, errors: [] };
  } catch (error) {
    const msg =
      error instanceof Error ? error.message : "Erreur stratégie région";
    console.error("[Collector] Échec stratégie région HT:", msg);
    return { videos: [], errors: [msg] };
  }
}

/** Stratégie 2 : vidéos par hashtags haïtiens (en lots) */
async function strategyHashtags(
  client: TikTokApiClient,
  startDate: string,
  endDate: string
): Promise<StrategyResult> {
  const allVideos: ValidatedTikTokVideo[] = [];
  const errors: string[] = [];

  // Batch les hashtags par 5 (limite API raisonnable)
  const batchSize = 5;
  for (let i = 0; i < HAITIAN_HASHTAGS.length; i += batchSize) {
    const batch = HAITIAN_HASHTAGS.slice(i, i + batchSize);
    try {
      const videos = await fetchAllPages(client, {
        hashtag_names: batch,
        start_date: startDate,
        end_date: endDate,
        max_count: 100,
      });
      allVideos.push(...videos);
    } catch (error) {
      const msg =
        error instanceof Error
          ? error.message
          : `Erreur hashtags batch [${batch.join(", ")}]`;
      console.error("[Collector] Échec stratégie hashtags:", msg);
      errors.push(msg);
    }
  }

  return { videos: allVideos, errors };
}

/** Stratégie 3 : vidéos par mots-clés musicaux haïtiens */
async function strategyKeywords(
  client: TikTokApiClient,
  startDate: string,
  endDate: string
): Promise<StrategyResult> {
  const allVideos: ValidatedTikTokVideo[] = [];
  const errors: string[] = [];

  for (const keyword of HAITIAN_MUSIC_KEYWORDS) {
    try {
      const videos = await fetchAllPages(client, {
        keyword,
        start_date: startDate,
        end_date: endDate,
        max_count: 100,
      });
      allVideos.push(...videos);
    } catch (error) {
      const msg =
        error instanceof Error
          ? error.message
          : `Erreur keyword "${keyword}"`;
      console.error("[Collector] Échec stratégie keyword:", msg);
      errors.push(msg);
    }
  }

  return { videos: allVideos, errors };
}

/** Stratégie 4 : vidéos par noms d'artistes validés */
async function strategyArtists(
  client: TikTokApiClient,
  startDate: string,
  endDate: string
): Promise<StrategyResult> {
  const allVideos: ValidatedTikTokVideo[] = [];
  const errors: string[] = [];

  // Récupérer les noms d'artistes validés depuis la table artists
  const supabase = createAdminClient();
  const { data: artists, error: dbError } = await supabase
    .from("artists")
    .select("name")
    .not("name", "is", null);

  if (dbError) {
    const msg = `Erreur lecture artistes: ${dbError.message}`;
    console.error("[Collector]", msg);
    return { videos: [], errors: [msg] };
  }

  const artistNames = (artists ?? [])
    .map((a: { name: string }) => a.name)
    .filter(Boolean);

  for (const artistName of artistNames) {
    try {
      const videos = await fetchAllPages(client, {
        keyword: artistName,
        start_date: startDate,
        end_date: endDate,
        max_count: 100,
      });
      allVideos.push(...videos);
    } catch (error) {
      const msg =
        error instanceof Error
          ? error.message
          : `Erreur artiste "${artistName}"`;
      console.error("[Collector] Échec stratégie artiste:", msg);
      errors.push(msg);
    }
  }

  return { videos: allVideos, errors };
}

// ---------------------------------------------------------------------------
// Main Collection Function
// ---------------------------------------------------------------------------

/**
 * Orchestre une collecte complète de vidéos TikTok.
 *
 * 1. Crée un sync_run (status: running)
 * 2. Exécute les 4 stratégies de requête
 * 3. Déduplique par video_id (upsert tiktok_videos)
 * 4. Agrège les métriques par music_id → upsert tiktok_sounds
 * 5. Met à jour le sync_run avec le résultat final
 */
export async function runCollection(params?: {
  start_date?: string;
  end_date?: string;
}): Promise<CollectionResult> {
  const supabase = createAdminClient();
  const startDate = params?.start_date ?? defaultStartDate();
  const endDate = params?.end_date ?? defaultEndDate();

  // -------------------------------------------------------------------------
  // 1. Créer sync_run
  // -------------------------------------------------------------------------
  const { data: syncRun, error: syncError } = await supabase
    .from("sync_runs")
    .insert({
      platform: "tiktok",
      source_key: "tiktok_haiti_global",
      status: "running",
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (syncError || !syncRun) {
    console.error("[Collector] Impossible de créer sync_run:", syncError);
    return {
      ok: false,
      videosCollected: 0,
      videosUpdated: 0,
      newSounds: 0,
      errors: [syncError?.message ?? "Impossible de créer sync_run"],
      syncRunId: "",
    };
  }

  const syncRunId = syncRun.id as string;

  // -------------------------------------------------------------------------
  // 2. Authentifier le client API TikTok
  // -------------------------------------------------------------------------
  let client: TikTokApiClient;
  try {
    client = new TikTokApiClient();
    await client.authenticate();
  } catch (error) {
    const msg =
      error instanceof Error ? error.message : "Échec authentification";
    console.error("[Collector] Auth failed:", msg);

    await supabase
      .from("sync_runs")
      .update({
        status: "error",
        error_details: msg,
        completed_at: new Date().toISOString(),
      })
      .eq("id", syncRunId);

    return {
      ok: false,
      videosCollected: 0,
      videosUpdated: 0,
      newSounds: 0,
      errors: [msg],
      syncRunId,
    };
  }

  // -------------------------------------------------------------------------
  // 3. Exécuter les 4 stratégies
  // -------------------------------------------------------------------------
  const allErrors: string[] = [];
  const allVideos: ValidatedTikTokVideo[] = [];

  const strategies = [
    { name: "region", fn: () => strategyRegion(client, startDate, endDate) },
    { name: "hashtags", fn: () => strategyHashtags(client, startDate, endDate) },
    { name: "keywords", fn: () => strategyKeywords(client, startDate, endDate) },
    { name: "artists", fn: () => strategyArtists(client, startDate, endDate) },
  ];

  let strategiesSucceeded = 0;

  for (const strategy of strategies) {
    const result = await strategy.fn();
    allVideos.push(...result.videos);
    if (result.errors.length > 0) {
      allErrors.push(...result.errors);
    } else {
      strategiesSucceeded++;
    }
  }

  // Si aucune vidéo, marquer comme erreur
  if (allVideos.length === 0) {
    const errorMsg =
      allErrors.length > 0
        ? allErrors.join("; ")
        : "Aucune vidéo collectée";

    await supabase
      .from("sync_runs")
      .update({
        status: "error",
        records_received: 0,
        records_normalized: 0,
        error_details: errorMsg,
        completed_at: new Date().toISOString(),
      })
      .eq("id", syncRunId);

    return {
      ok: false,
      videosCollected: 0,
      videosUpdated: 0,
      newSounds: 0,
      errors: allErrors.length > 0 ? allErrors : [errorMsg],
      syncRunId,
    };
  }

  // -------------------------------------------------------------------------
  // 4. Déduplication par video_id et upsert tiktok_videos
  // -------------------------------------------------------------------------
  const uniqueVideos = new Map<string, ValidatedTikTokVideo>();
  for (const video of allVideos) {
    // Si déjà vu, garder la version la plus récente (dernière rencontrée)
    uniqueVideos.set(video.video_id, video);
  }

  const videosToUpsert = Array.from(uniqueVideos.values()).map((v) => ({
    video_id: v.video_id,
    music_id: v.music_id,
    username: v.username,
    create_time: v.create_time,
    region_code: v.region_code || null,
    view_count: v.view_count,
    like_count: v.like_count,
    comment_count: v.comment_count,
    share_count: v.share_count,
    hashtag_names: v.hashtag_names,
    video_description: v.video_description,
    collected_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }));

  let videosUpdated = 0;
  const videosCollected = videosToUpsert.length;

  // Upsert en lots de 500
  const BATCH_SIZE = 500;
  for (let i = 0; i < videosToUpsert.length; i += BATCH_SIZE) {
    const batch = videosToUpsert.slice(i, i + BATCH_SIZE);
    const { error: upsertError, count } = await supabase
      .from("tiktok_videos")
      .upsert(batch, {
        onConflict: "video_id",
        ignoreDuplicates: false,
      });

    if (upsertError) {
      console.error("[Collector] Erreur upsert vidéos:", upsertError.message);
      allErrors.push(`Upsert vidéos: ${upsertError.message}`);
    } else if (count !== null) {
      videosUpdated += count;
    }
  }

  // -------------------------------------------------------------------------
  // 5. Agrégation par music_id → tiktok_sounds
  // -------------------------------------------------------------------------
  const soundMap = new Map<string, SoundAggregate>();

  const videoEntries = Array.from(uniqueVideos.values());
  for (const video of videoEntries) {
    const existing = soundMap.get(video.music_id);
    if (existing) {
      existing.total_videos += 1;
      existing.total_views += video.view_count;
      existing.total_likes += video.like_count;
      existing.total_comments += video.comment_count;
      existing.total_shares += video.share_count;
      existing.unique_creators.add(video.username);
    } else {
      soundMap.set(video.music_id, {
        music_id: video.music_id,
        sound_title: `Son — ${video.music_id}`,
        sound_author: null,
        total_videos: 1,
        total_views: video.view_count,
        total_likes: video.like_count,
        total_comments: video.comment_count,
        total_shares: video.share_count,
        unique_creators: new Set([video.username]),
      });
    }
  }

  // Déterminer quels music_ids sont nouveaux
  const allMusicIds = Array.from(soundMap.keys());
  const { data: existingSounds } = await supabase
    .from("tiktok_sounds")
    .select("music_id")
    .in("music_id", allMusicIds);

  const existingMusicIds = new Set(
    (existingSounds ?? []).map((s: { music_id: string }) => s.music_id)
  );

  let newSoundsCount = 0;
  const now = new Date().toISOString();

  // Upsert tiktok_sounds
  const soundsToUpsert = Array.from(soundMap.values()).map((s) => {
    const isNew = !existingMusicIds.has(s.music_id);
    if (isNew) newSoundsCount++;

    return {
      music_id: s.music_id,
      sound_title: s.sound_title,
      sound_author: s.sound_author,
      total_videos: s.total_videos,
      total_views: s.total_views,
      total_likes: s.total_likes,
      total_comments: s.total_comments,
      total_shares: s.total_shares,
      unique_creators: s.unique_creators.size,
      last_updated_at: now,
      // Pour les nouveaux sons : validation_status = "a_verifier", first_seen_at = now
      ...(isNew
        ? { validation_status: "a_verifier", first_seen_at: now }
        : {}),
    };
  });

  // Upsert sounds en lots
  for (let i = 0; i < soundsToUpsert.length; i += BATCH_SIZE) {
    const batch = soundsToUpsert.slice(i, i + BATCH_SIZE);
    const { error: soundError } = await supabase
      .from("tiktok_sounds")
      .upsert(batch, {
        onConflict: "music_id",
        ignoreDuplicates: false,
      });

    if (soundError) {
      console.error("[Collector] Erreur upsert sounds:", soundError.message);
      allErrors.push(`Upsert sounds: ${soundError.message}`);
    }
  }

  // -------------------------------------------------------------------------
  // 6. Mettre à jour le sync_run
  // -------------------------------------------------------------------------
  const finalStatus =
    allErrors.length === 0
      ? "success"
      : strategiesSucceeded > 0
        ? "partial_error"
        : "error";

  await supabase
    .from("sync_runs")
    .update({
      status: finalStatus,
      records_received: allVideos.length,
      records_normalized: videosCollected,
      error_details:
        allErrors.length > 0 ? allErrors.join("; ") : null,
      completed_at: new Date().toISOString(),
    })
    .eq("id", syncRunId);

  console.log("[Collector] Collecte terminée", {
    status: finalStatus,
    videosCollected,
    videosUpdated,
    newSounds: newSoundsCount,
    errors: allErrors.length,
  });

  return {
    ok: finalStatus !== "error",
    videosCollected,
    videosUpdated,
    newSounds: newSoundsCount,
    errors: allErrors,
    syncRunId,
  };
}
