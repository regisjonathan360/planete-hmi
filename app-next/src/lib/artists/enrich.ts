/**
 * Enrichissement multi-plateforme d'un artiste.
 *
 * Récupère automatiquement toutes les données publiques disponibles depuis les
 * URLs renseignées dans la fiche artiste : photo, bannière, auditeurs mensuels,
 * abonnés, popularité, genres, etc.
 *
 * Plateformes supportées :
 *  - Spotify  (embed public : monthly listeners, photo, genres, followers)
 *  - Deezer   (API publique : fans, photo, nb albums/tracks)
 *  - YouTube  (Data API v3 si YOUTUBE_API_KEY configurée : subscribers, views, banner)
 *  - Audiomack (page publique : followers, photo)
 *
 * Les résultats sont écrits dans :
 *  - `artist_platform_identities.metadata` (métriques par plateforme)
 *  - `artists.image_url` / `artists.banner_url` (si vides, complétés)
 *  - `artists.primary_genre` (si vide, complété depuis Spotify)
 */
import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getSpotifyArtistMonthlyListeners,
  isSpotifyConfigured,
  searchSpotifyArtist,
} from "@/lib/spotify/api-client";

// ---------- Types ----------

export interface PlatformMetrics {
  platform: string;
  externalId: string | null;
  externalUrl: string | null;
  name: string | null;
  imageUrl: string | null;
  bannerUrl: string | null;
  monthlyListeners: number | null;
  followers: number | null;
  totalViews: number | null;
  popularity: number | null;
  genres: string[];
  albumCount: number | null;
  trackCount: number | null;
  subscriberCount: number | null;
  /** Méthode de lecture : embed, web_api, public_api, scrape */
  method: string;
  /** Erreur éventuelle (non bloquante). */
  error: string | null;
  fetchedAt: string;
}

export interface EnrichmentReport {
  artistId: string;
  artistName: string;
  platforms: PlatformMetrics[];
  applied: {
    imageUrl: boolean;
    bannerUrl: boolean;
    primaryGenre: boolean;
  };
  warnings: string[];
}

// ---------- Spotify ----------

async function enrichFromSpotify(
  artistName: string,
  urlSpotify: string | null,
): Promise<PlatformMetrics> {
  const base: PlatformMetrics = {
    platform: "spotify",
    externalId: null,
    externalUrl: urlSpotify,
    name: null,
    imageUrl: null,
    bannerUrl: null,
    monthlyListeners: null,
    followers: null,
    totalViews: null,
    popularity: null,
    genres: [],
    albumCount: null,
    trackCount: null,
    subscriberCount: null,
    method: "none",
    error: null,
    fetchedAt: new Date().toISOString(),
  };

  try {
    // Extraire l'ID depuis l'URL si disponible
    let artistId: string | null = null;
    if (urlSpotify) {
      const m = /artist\/([A-Za-z0-9]{22})/.exec(urlSpotify);
      if (m) artistId = m[1];
    }

    // Sinon, rechercher par nom
    if (!artistId) {
      const profile = isSpotifyConfigured()
        ? await searchSpotifyArtist(artistName, 0.65)
        : null;
      if (profile) {
        artistId = profile.id;
        base.externalUrl = profile.url;
        base.name = profile.name;
        base.imageUrl = profile.imageUrl;
        base.followers = profile.followers;
        base.genres = profile.genres;
      }
    }

    if (!artistId) {
      // Tentative de recherche via embed sans API
      const searchRes = await fetch(
        `https://open.spotify.com/search/${encodeURIComponent(artistName)}`,
        { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store" },
      ).catch(() => null);
      if (searchRes?.ok) {
        const html = await searchRes.text();
        const idMatch = /artist\/([A-Za-z0-9]{22})/.exec(html);
        if (idMatch) artistId = idMatch[1];
      }
    }

    if (!artistId) {
      base.error = "Artiste non trouvé sur Spotify.";
      return base;
    }

    base.externalId = artistId;
    base.externalUrl ??= `https://open.spotify.com/artist/${artistId}`;

    // Monthly listeners via la page embed
    const ml = await getSpotifyArtistMonthlyListeners(artistId);
    base.monthlyListeners = ml.monthlyListeners;
    base.followers ??= ml.followers;
    base.method = ml.method;

    // Détails supplémentaires via la page embed
    try {
      const embedRes = await fetch(
        `https://open.spotify.com/embed/artist/${artistId}`,
        {
          headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
          cache: "no-store",
        },
      );
      if (embedRes.ok) {
        const html = await embedRes.text();
        const match = /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/.exec(html);
        if (match) {
          const nd = JSON.parse(match[1]);
          const entity = nd?.props?.pageProps?.state?.data?.entity;
          if (entity) {
            base.name ??= entity.name ?? null;
            base.imageUrl ??= entity.headerImage?.url ?? entity.visuals?.headerImage?.sources?.[0]?.url ?? null;
            // L'image d'en-tête Spotify sert de bannière
            const header = entity.headerImage?.url ?? entity.visuals?.headerImage?.sources?.[0]?.url;
            if (header) base.bannerUrl = header;
            // L'avatar Spotify
            const avatar = entity.visuals?.avatarImage?.sources?.[0]?.url ?? entity.images?.[0]?.url;
            if (avatar) base.imageUrl = avatar;
          }
        }
      }
    } catch {
      // Non bloquant
    }
  } catch (err) {
    base.error = err instanceof Error ? err.message : "Erreur Spotify.";
  }

  return base;
}

// ---------- Deezer ----------

interface DeezerArtistResponse {
  id?: number;
  name?: string;
  picture_xl?: string;
  picture_big?: string;
  picture_medium?: string;
  nb_album?: number;
  nb_fan?: number;
  link?: string;
}

async function enrichFromDeezer(
  artistName: string,
  urlDeezer: string | null,
): Promise<PlatformMetrics> {
  const base: PlatformMetrics = {
    platform: "deezer",
    externalId: null,
    externalUrl: urlDeezer,
    name: null,
    imageUrl: null,
    bannerUrl: null,
    monthlyListeners: null,
    followers: null,
    totalViews: null,
    popularity: null,
    genres: [],
    albumCount: null,
    trackCount: null,
    subscriberCount: null,
    method: "public_api",
    error: null,
    fetchedAt: new Date().toISOString(),
  };

  try {
    let artistId: string | null = null;
    if (urlDeezer) {
      const m = /artist\/(\d+)/.exec(urlDeezer);
      if (m) artistId = m[1];
    }

    if (!artistId) {
      const searchRes = await fetch(
        `https://api.deezer.com/search/artist?q=${encodeURIComponent(artistName)}&limit=3`,
        { cache: "no-store" },
      );
      if (searchRes.ok) {
        const searchData = (await searchRes.json()) as { data?: DeezerArtistResponse[] };
        const best = searchData.data?.[0];
        if (best?.id) artistId = String(best.id);
      }
    }

    if (!artistId) {
      base.error = "Artiste non trouvé sur Deezer.";
      return base;
    }

    base.externalId = artistId;
    const res = await fetch(`https://api.deezer.com/artist/${artistId}`, { cache: "no-store" });
    if (!res.ok) { base.error = `Deezer HTTP ${res.status}`; return base; }

    const data = (await res.json()) as DeezerArtistResponse;
    base.name = data.name ?? null;
    base.imageUrl = data.picture_xl ?? data.picture_big ?? data.picture_medium ?? null;
    base.followers = data.nb_fan ?? null;
    base.albumCount = data.nb_album ?? null;
    base.externalUrl ??= data.link ?? `https://www.deezer.com/artist/${artistId}`;

    // Nombre de tracks
    const topRes = await fetch(`https://api.deezer.com/artist/${artistId}/top?limit=1`, { cache: "no-store" });
    if (topRes.ok) {
      const topData = (await topRes.json()) as { total?: number };
      base.trackCount = topData.total ?? null;
    }
  } catch (err) {
    base.error = err instanceof Error ? err.message : "Erreur Deezer.";
  }

  return base;
}

// ---------- YouTube ----------

interface YouTubeChannelSnippet {
  title?: string;
  thumbnails?: { high?: { url?: string } };
}
interface YouTubeChannelBranding {
  image?: { bannerExternalUrl?: string };
}
interface YouTubeChannelStats {
  viewCount?: string;
  subscriberCount?: string;
  videoCount?: string;
}
interface YouTubeChannelItem {
  id?: string;
  snippet?: YouTubeChannelSnippet;
  brandingSettings?: YouTubeChannelBranding;
  statistics?: YouTubeChannelStats;
}

async function enrichFromYouTube(
  artistName: string,
  urlYoutube: string | null,
): Promise<PlatformMetrics> {
  const base: PlatformMetrics = {
    platform: "youtube",
    externalId: null,
    externalUrl: urlYoutube,
    name: null,
    imageUrl: null,
    bannerUrl: null,
    monthlyListeners: null,
    followers: null,
    totalViews: null,
    popularity: null,
    genres: [],
    albumCount: null,
    trackCount: null,
    subscriberCount: null,
    method: "youtube_data_api",
    error: null,
    fetchedAt: new Date().toISOString(),
  };

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) { base.error = "YOUTUBE_API_KEY non configurée."; base.method = "none"; return base; }

  try {
    let channelId: string | null = null;

    if (urlYoutube) {
      // Extraire l'ID de la chaîne depuis l'URL
      const ucMatch = /(UC[\w-]{22})/.exec(urlYoutube);
      if (ucMatch) channelId = ucMatch[1];

      // Handle @handle ou /c/name
      if (!channelId) {
        const handleMatch = /@([\w.-]+)/.exec(urlYoutube);
        if (handleMatch) {
          const searchRes = await fetch(
            `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(handleMatch[1])}&maxResults=1&key=${apiKey}`,
            { cache: "no-store" },
          );
          if (searchRes.ok) {
            const searchData = (await searchRes.json()) as { items?: { id?: { channelId?: string } }[] };
            channelId = searchData.items?.[0]?.id?.channelId ?? null;
          }
        }
      }
    }

    if (!channelId) {
      // Recherche par nom
      const searchRes = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(artistName)}&maxResults=1&key=${apiKey}`,
        { cache: "no-store" },
      );
      if (searchRes.ok) {
        const searchData = (await searchRes.json()) as { items?: { id?: { channelId?: string } }[] };
        channelId = searchData.items?.[0]?.id?.channelId ?? null;
      }
    }

    if (!channelId) { base.error = "Chaîne YouTube non trouvée."; return base; }

    base.externalId = channelId;

    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,brandingSettings&id=${channelId}&key=${apiKey}`,
      { cache: "no-store" },
    );
    if (!res.ok) { base.error = `YouTube API HTTP ${res.status}`; return base; }

    const data = (await res.json()) as { items?: YouTubeChannelItem[] };
    const channel = data.items?.[0];
    if (!channel) { base.error = "Chaîne introuvable dans la réponse."; return base; }

    base.name = channel.snippet?.title ?? null;
    base.imageUrl = channel.snippet?.thumbnails?.high?.url ?? null;
    base.bannerUrl = channel.brandingSettings?.image?.bannerExternalUrl ?? null;
    base.subscriberCount = channel.statistics?.subscriberCount
      ? Number(channel.statistics.subscriberCount)
      : null;
    base.totalViews = channel.statistics?.viewCount
      ? Number(channel.statistics.viewCount)
      : null;
    base.trackCount = channel.statistics?.videoCount
      ? Number(channel.statistics.videoCount)
      : null;
    base.externalUrl ??= `https://www.youtube.com/channel/${channelId}`;
  } catch (err) {
    base.error = err instanceof Error ? err.message : "Erreur YouTube.";
  }

  return base;
}

// ---------- Audiomack ----------

async function enrichFromAudiomack(
  artistName: string,
  urlAudiomack: string | null,
): Promise<PlatformMetrics> {
  const base: PlatformMetrics = {
    platform: "audiomack",
    externalId: null,
    externalUrl: urlAudiomack,
    name: null,
    imageUrl: null,
    bannerUrl: null,
    monthlyListeners: null,
    followers: null,
    totalViews: null,
    popularity: null,
    genres: [],
    albumCount: null,
    trackCount: null,
    subscriberCount: null,
    method: "scrape",
    error: null,
    fetchedAt: new Date().toISOString(),
  };

  try {
    let slug: string | null = null;
    if (urlAudiomack) {
      const m = /audiomack\.com\/([^/?#]+)/.exec(urlAudiomack);
      if (m) slug = m[1];
    }

    const pageUrl = slug
      ? `https://audiomack.com/${slug}`
      : `https://audiomack.com/${encodeURIComponent(artistName.toLowerCase().replace(/\s+/g, "-"))}`;

    base.externalUrl ??= pageUrl;

    const res = await fetch(pageUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; PlaneteHMI-Bot/1.0)" },
      cache: "no-store",
    });

    if (!res.ok) { base.error = `Audiomack HTTP ${res.status}`; return base; }

    const html = await res.text();

    // Extraire les données de __NEXT_DATA__ ou du JSON-LD
    const nextData = /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/.exec(html);
    if (nextData) {
      try {
        const nd = JSON.parse(nextData[1]);
        const artist = nd?.props?.pageProps?.artist ?? nd?.props?.pageProps?.data?.artist;
        if (artist) {
          base.name = artist.name ?? null;
          base.imageUrl = artist.image ?? artist.image_base ?? null;
          base.followers = artist.followers_count ?? artist.total_followers ?? null;
          base.totalViews = artist.total_plays ?? null;
          base.externalId = artist.url_slug ?? slug;
        }
      } catch {
        // parsing échoué — on continue avec le HTML brut
      }
    }

    if (!base.imageUrl) {
      const imgMatch = /og:image[^>]*content="([^"]+)"/.exec(html);
      if (imgMatch) base.imageUrl = imgMatch[1];
    }
  } catch (err) {
    base.error = err instanceof Error ? err.message : "Erreur Audiomack.";
  }

  return base;
}

// ---------- Orchestration ----------

/**
 * Enrichit un artiste depuis toutes les plateformes disponibles dans sa fiche.
 * Met à jour sa photo, sa bannière et son genre si vides.
 */
export async function enrichArtist(
  supabase: SupabaseClient,
  artistId: string,
): Promise<EnrichmentReport> {
  const { data: artist, error } = await supabase
    .from("artists")
    .select("id, name, image_url, banner_url, primary_genre, url_spotify, url_deezer, url_audiomack, url_youtube, url_youtube_music")
    .eq("id", artistId)
    .single();

  if (error || !artist) throw new Error("Artiste introuvable.");

  const name = artist.name as string;
  const warnings: string[] = [];
  const platforms: PlatformMetrics[] = [];

  // Lancer les enrichissements en parallèle
  const [spotify, deezer, youtube, audiomack] = await Promise.allSettled([
    enrichFromSpotify(name, (artist.url_spotify as string) ?? null),
    enrichFromDeezer(name, (artist.url_deezer as string) ?? null),
    enrichFromYouTube(name, (artist.url_youtube as string) ?? (artist.url_youtube_music as string) ?? null),
    enrichFromAudiomack(name, (artist.url_audiomack as string) ?? null),
  ]);

  for (const result of [spotify, deezer, youtube, audiomack]) {
    if (result.status === "fulfilled") {
      platforms.push(result.value);
      if (result.value.error) warnings.push(`${result.value.platform}: ${result.value.error}`);
    } else {
      warnings.push(`Enrichissement échoué : ${result.reason}`);
    }
  }

  // Appliquer les données récupérées
  const patch: Record<string, unknown> = {};
  const applied = { imageUrl: false, bannerUrl: false, primaryGenre: false };

  // Photo de profil : premier résultat exploitable (Spotify > Deezer > YouTube > Audiomack)
  if (!artist.image_url || (artist.image_url as string).trim() === "") {
    const img = platforms.find((p) => p.imageUrl)?.imageUrl;
    if (img) { patch.image_url = img; applied.imageUrl = true; }
  }

  // Bannière : YouTube ou Spotify
  if (!artist.banner_url || (artist.banner_url as string).trim() === "") {
    const banner = platforms.find((p) => p.bannerUrl)?.bannerUrl;
    if (banner) { patch.banner_url = banner; applied.bannerUrl = true; }
  }

  // Genre principal : Spotify
  if (!artist.primary_genre || (artist.primary_genre as string).trim() === "") {
    const spotifyResult = platforms.find((p) => p.platform === "spotify");
    if (spotifyResult?.genres.length) {
      patch.primary_genre = spotifyResult.genres[0];
      applied.primaryGenre = true;
    }
  }

  if (Object.keys(patch).length > 0) {
    patch.updated_at = new Date().toISOString();
    await supabase.from("artists").update(patch).eq("id", artistId);
  }

  // Sauvegarder les métriques dans artist_platform_identities.metadata
  for (const pm of platforms) {
    if (!pm.externalId && !pm.externalUrl) continue;

    const metadata = {
      monthly_listeners: pm.monthlyListeners,
      followers: pm.followers,
      subscriber_count: pm.subscriberCount,
      total_views: pm.totalViews,
      popularity: pm.popularity,
      genres: pm.genres,
      album_count: pm.albumCount,
      track_count: pm.trackCount,
      banner_url: pm.bannerUrl,
      fetched_at: pm.fetchedAt,
      method: pm.method,
    };

    await supabase.from("artist_platform_identities").upsert(
      {
        artist_id: artistId,
        platform: pm.platform,
        external_id: pm.externalId ?? `manual_${pm.platform}`,
        external_url: pm.externalUrl,
        platform_name: pm.name,
        platform_image_url: pm.imageUrl,
        metadata,
        match_method: "auto_collect",
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "platform,external_id" },
    );
  }

  return { artistId, artistName: name, platforms, applied, warnings };
}
