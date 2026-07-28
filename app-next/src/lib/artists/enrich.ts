/**
 * Enrichissement d'un artiste depuis UNE plateforme spécifique.
 *
 * Chaque collecte est déclenchée individuellement par l'admin en cliquant sur
 * un bouton à côté de l'URL concernée. Aucune donnée n'est récupérée d'une URL
 * que l'admin n'a pas lui-même renseignée dans la fiche.
 *
 * Les résultats (photos, métriques) sont stockés dans
 * `artist_platform_identities.metadata` et proposés à l'admin pour
 * sélection (photo de profil, bannière, etc.).
 */
import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getSpotifyArtistMonthlyListeners,
  isSpotifyConfigured,
  searchSpotifyArtist,
} from "@/lib/spotify/api-client";

// ---------- Types ----------

export interface PlatformData {
  platform: string;
  externalId: string | null;
  externalUrl: string;
  name: string | null;
  images: { url: string; label: string; type: "avatar" | "banner" | "cover" }[];
  monthlyListeners: number | null;
  followers: number | null;
  subscriberCount: number | null;
  totalViews: number | null;
  popularity: number | null;
  genres: string[];
  albumCount: number | null;
  trackCount: number | null;
  method: string;
  error: string | null;
  fetchedAt: string;
}

// ---------- Spotify ----------

export async function enrichSpotify(url: string): Promise<PlatformData> {
  const base = makeBase("spotify", url);

  try {
    let artistId: string | null = null;
    const m = /artist\/([A-Za-z0-9]{22})/.exec(url);
    if (m) artistId = m[1];

    if (!artistId) {
      base.error = "URL Spotify invalide : impossible d'extraire l'identifiant artiste.";
      return base;
    }

    base.externalId = artistId;

    // Monthly listeners via page embed
    const ml = await getSpotifyArtistMonthlyListeners(artistId);
    base.monthlyListeners = ml.monthlyListeners;
    base.followers = ml.followers;
    base.method = ml.method;

    // Profil complet via embed
    const embedRes = await fetch(
      `https://open.spotify.com/embed/artist/${artistId}`,
      { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" }, cache: "no-store" },
    );
    if (embedRes.ok) {
      const html = await embedRes.text();
      const match = /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/.exec(html);
      if (match) {
        const nd = JSON.parse(match[1]);
        const entity = nd?.props?.pageProps?.state?.data?.entity;
        if (entity) {
          base.name = entity.name ?? null;
          const avatar = entity.visuals?.avatarImage?.sources?.[0]?.url ?? entity.images?.[0]?.url;
          if (avatar) base.images.push({ url: avatar, label: "Photo Spotify", type: "avatar" });
          const header = entity.visuals?.headerImage?.sources?.[0]?.url ?? entity.headerImage?.url;
          if (header) base.images.push({ url: header, label: "Bannière Spotify", type: "banner" });
        }
      }
    }

    // Web API si configurée (pour genres et popularité)
    if (isSpotifyConfigured()) {
      const profile = await searchSpotifyArtist(base.name ?? "", 0.9);
      if (profile) {
        base.genres = profile.genres;
        base.followers ??= profile.followers;
        if (profile.imageUrl && !base.images.some((i) => i.type === "avatar")) {
          base.images.push({ url: profile.imageUrl, label: "Photo Spotify (API)", type: "avatar" });
        }
      }
    }
  } catch (err) {
    base.error = err instanceof Error ? err.message : "Erreur Spotify.";
  }

  return base;
}

// ---------- Deezer ----------

export async function enrichDeezer(url: string): Promise<PlatformData> {
  const base = makeBase("deezer", url);

  try {
    const m = /artist\/(\d+)/.exec(url);
    if (!m) { base.error = "URL Deezer invalide : pas d'identifiant artiste trouvé."; return base; }

    const artistId = m[1];
    base.externalId = artistId;

    const res = await fetch(`https://api.deezer.com/artist/${artistId}`, { cache: "no-store" });
    if (!res.ok) { base.error = `Deezer HTTP ${res.status}`; return base; }

    const data = await res.json();
    base.name = data.name ?? null;
    base.followers = data.nb_fan ?? null;
    base.albumCount = data.nb_album ?? null;
    base.method = "public_api";

    if (data.picture_xl) base.images.push({ url: data.picture_xl, label: "Photo Deezer (XL)", type: "avatar" });
    else if (data.picture_big) base.images.push({ url: data.picture_big, label: "Photo Deezer", type: "avatar" });

    // Top tracks count
    const topRes = await fetch(`https://api.deezer.com/artist/${artistId}/top?limit=1`, { cache: "no-store" });
    if (topRes.ok) {
      const topData = await topRes.json();
      base.trackCount = topData.total ?? null;
    }
  } catch (err) {
    base.error = err instanceof Error ? err.message : "Erreur Deezer.";
  }

  return base;
}

// ---------- YouTube ----------

export async function enrichYouTube(url: string): Promise<PlatformData> {
  const base = makeBase("youtube", url);

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) { base.error = "YOUTUBE_API_KEY non configurée."; base.method = "none"; return base; }

  try {
    let channelId: string | null = null;

    // UC... direct
    const ucMatch = /(UC[\w-]{22})/.exec(url);
    if (ucMatch) channelId = ucMatch[1];

    // @handle
    if (!channelId) {
      const handleMatch = /@([\w.-]+)/.exec(url);
      if (handleMatch) {
        const sRes = await fetch(
          `https://www.googleapis.com/youtube/v3/channels?part=id&forHandle=${encodeURIComponent(handleMatch[1])}&key=${apiKey}`,
          { cache: "no-store" },
        );
        if (sRes.ok) {
          const sData = await sRes.json();
          channelId = sData.items?.[0]?.id ?? null;
        }
        // Fallback : search
        if (!channelId) {
          const searchRes = await fetch(
            `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(handleMatch[1])}&maxResults=1&key=${apiKey}`,
            { cache: "no-store" },
          );
          if (searchRes.ok) {
            const searchData = await searchRes.json();
            channelId = searchData.items?.[0]?.id?.channelId ?? null;
          }
        }
      }
    }

    // /channel/UCxxx
    if (!channelId) {
      const chMatch = /channel\/(UC[\w-]{22})/.exec(url);
      if (chMatch) channelId = chMatch[1];
    }

    if (!channelId) { base.error = "Impossible d'identifier la chaîne YouTube depuis cette URL."; return base; }

    base.externalId = channelId;
    base.method = "youtube_data_api";

    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,brandingSettings&id=${channelId}&key=${apiKey}`,
      { cache: "no-store" },
    );
    if (!res.ok) { base.error = `YouTube API HTTP ${res.status}`; return base; }

    const data = await res.json();
    const channel = data.items?.[0];
    if (!channel) { base.error = "Chaîne introuvable."; return base; }

    base.name = channel.snippet?.title ?? null;
    base.subscriberCount = channel.statistics?.subscriberCount ? Number(channel.statistics.subscriberCount) : null;
    base.totalViews = channel.statistics?.viewCount ? Number(channel.statistics.viewCount) : null;
    base.trackCount = channel.statistics?.videoCount ? Number(channel.statistics.videoCount) : null;

    const thumb = channel.snippet?.thumbnails?.high?.url ?? channel.snippet?.thumbnails?.medium?.url;
    if (thumb) base.images.push({ url: thumb, label: "Photo YouTube", type: "avatar" });

    const banner = channel.brandingSettings?.image?.bannerExternalUrl;
    if (banner) base.images.push({ url: banner, label: "Bannière YouTube", type: "banner" });
  } catch (err) {
    base.error = err instanceof Error ? err.message : "Erreur YouTube.";
  }

  return base;
}

// ---------- Audiomack ----------

export async function enrichAudiomack(url: string): Promise<PlatformData> {
  const base = makeBase("audiomack", url);

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; PlaneteHMI-Bot/1.0)" },
      cache: "no-store",
    });
    if (!res.ok) { base.error = `Audiomack HTTP ${res.status}`; return base; }

    const html = await res.text();
    base.method = "scrape";

    const nextData = /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/.exec(html);
    if (nextData) {
      const nd = JSON.parse(nextData[1]);
      const artist = nd?.props?.pageProps?.artist ?? nd?.props?.pageProps?.data?.artist;
      if (artist) {
        base.name = artist.name ?? null;
        base.followers = artist.followers_count ?? artist.total_followers ?? null;
        base.totalViews = artist.total_plays ?? null;
        base.externalId = artist.url_slug ?? null;
        if (artist.image) base.images.push({ url: artist.image, label: "Photo Audiomack", type: "avatar" });
        if (artist.image_banner) base.images.push({ url: artist.image_banner, label: "Bannière Audiomack", type: "banner" });
      }
    }

    if (base.images.length === 0) {
      const imgMatch = /og:image[^>]*content="([^"]+)"/.exec(html);
      if (imgMatch) base.images.push({ url: imgMatch[1], label: "Photo Audiomack (OG)", type: "avatar" });
    }
  } catch (err) {
    base.error = err instanceof Error ? err.message : "Erreur Audiomack.";
  }

  return base;
}

// ---------- Instagram ----------

export async function enrichInstagram(url: string): Promise<PlatformData> {
  const base = makeBase("instagram", url);
  base.method = "oembed";

  try {
    // Instagram oEmbed officiel (endpoint Meta)
    const oembedRes = await fetch(
      `https://graph.facebook.com/v18.0/instagram_oembed?url=${encodeURIComponent(url)}&access_token=public`,
      { cache: "no-store" },
    ).catch(() => null);

    // Fallback : page publique pour la photo de profil
    const pageRes = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; PlaneteHMI-Bot/1.0)" },
      cache: "no-store",
    });

    if (pageRes.ok) {
      const html = await pageRes.text();
      const ogImage = /og:image[^>]*content="([^"]+)"/.exec(html);
      if (ogImage) base.images.push({ url: ogImage[1], label: "Photo Instagram", type: "avatar" });
      const nameMatch = /og:title[^>]*content="([^"]+)"/.exec(html);
      if (nameMatch) base.name = nameMatch[1].split("(")[0].trim();
    }

    if (oembedRes?.ok) {
      const data = await oembedRes.json();
      if (data.thumbnail_url) base.images.push({ url: data.thumbnail_url, label: "Photo Instagram (oEmbed)", type: "avatar" });
      base.name ??= data.author_name ?? null;
    }
  } catch (err) {
    base.error = err instanceof Error ? err.message : "Erreur Instagram.";
  }

  return base;
}

// ---------- Dispatch ----------

const ENRICHERS: Record<string, (url: string) => Promise<PlatformData>> = {
  url_spotify: enrichSpotify,
  url_deezer: enrichDeezer,
  url_youtube: enrichYouTube,
  url_youtube_music: enrichYouTube,
  url_audiomack: enrichAudiomack,
  url_instagram: enrichInstagram,
};

/** Champs URL reconnus comme enrichissables. */
export const ENRICHABLE_FIELDS = Object.keys(ENRICHERS);

/**
 * Enrichit un artiste depuis UNE seule URL spécifique, choisie par l'admin.
 * Ne touche à rien d'autre : les champs image_url / banner_url ne sont PAS
 * modifiés automatiquement. L'admin choisit ensuite quelles images utiliser.
 */
export async function enrichArtistFromField(
  supabase: SupabaseClient,
  artistId: string,
  field: string,
): Promise<PlatformData> {
  const enricher = ENRICHERS[field];
  if (!enricher) throw new Error(`Champ « ${field} » non enrichissable.`);

  // Lire l'URL depuis la fiche artiste
  const { data: artist, error } = await supabase
    .from("artists")
    .select("id, name, url_spotify, url_deezer, url_youtube, url_youtube_music, url_audiomack, url_instagram")
    .eq("id", artistId)
    .single();

  if (error || !artist) throw new Error("Artiste introuvable.");
  const artistRecord = artist as Record<string, unknown>;
  const url = (artistRecord[field] as string)?.trim();
  if (!url) throw new Error(`Le champ « ${field} » est vide. Renseignez l'URL avant de collecter.`);

  const result = await enricher(url);

  // Stocker dans artist_platform_identities.metadata
  const platform = field.replace("url_", "").replace("_music", "");
  const metadata = {
    monthly_listeners: result.monthlyListeners,
    followers: result.followers,
    subscriber_count: result.subscriberCount,
    total_views: result.totalViews,
    popularity: result.popularity,
    genres: result.genres,
    album_count: result.albumCount,
    track_count: result.trackCount,
    images: result.images,
    fetched_at: result.fetchedAt,
    method: result.method,
  };

  await supabase.from("artist_platform_identities").upsert(
    {
      artist_id: artistId,
      platform,
      external_id: result.externalId ?? `manual_${platform}`,
      external_url: url,
      platform_name: result.name,
      platform_image_url: result.images.find((i) => i.type === "avatar")?.url ?? null,
      metadata,
      match_method: "manual_admin",
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: "platform,external_id" },
  );

  return result;
}

/**
 * Applique une image collectée (avatar ou bannière) à la fiche de l'artiste.
 */
export async function applyCollectedImage(
  supabase: SupabaseClient,
  artistId: string,
  imageUrl: string,
  target: "image_url" | "banner_url",
): Promise<void> {
  await supabase
    .from("artists")
    .update({ [target]: imageUrl, updated_at: new Date().toISOString() })
    .eq("id", artistId);
}

// ---------- Helpers ----------

function makeBase(platform: string, url: string): PlatformData {
  return {
    platform,
    externalId: null,
    externalUrl: url,
    name: null,
    images: [],
    monthlyListeners: null,
    followers: null,
    subscriberCount: null,
    totalViews: null,
    popularity: null,
    genres: [],
    albumCount: null,
    trackCount: null,
    method: "none",
    error: null,
    fetchedAt: new Date().toISOString(),
  };
}
