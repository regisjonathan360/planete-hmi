/**
 * GET /api/radio/playlist
 * 
 * Retourne la playlist active pour le lecteur radio
 * Public endpoint (pas d'authentification requise)
 */
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { RadioTrack } from "@/lib/radio/types";
import { resolveAudioUrl } from "@/lib/radio/audio";
import { applyFreshDeezerPreviews, refreshDeezerPreviews } from "@/lib/deezer/previews";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<NextResponse> {
  const searchParams = new URL(request.url).searchParams;
  const forceRefresh = searchParams.get("refresh") === "1";
  const refreshTrackId = searchParams.get("trackId") || undefined;
  try {
    const supabase = createAdminClient();

    // Récupérer la configuration radio active
    const { data: config, error: configError } = await supabase
      .from("radio_config")
      .select("*")
      .limit(1)
      .maybeSingle();

    if (configError) {
      console.error("Error fetching radio config:", configError);
      return NextResponse.json(
        { tracks: [] },
        { status: 200 }
      );
    }

    if (!config) {
      // Aucune configuration, retourner liste vide
      return NextResponse.json(
        { tracks: [] },
        { status: 200 }
      );
    }

    let tracks: RadioTrack[] = [];

    // Cas 1 : Playlist manuelle active
    if (config.active_playlist_id) {
      const { data: playlistTracks, error: playlistError } = await supabase
        .from("radio_playlist_tracks")
        .select(
          `
          track_id,
          radio_tracks(
            id,
            title,
            artist_name,
            artist_id,
            audio_url,
            cover_image_url,
            duration_seconds,
            source,
            is_active,
            play_count,
            created_at,
            updated_at
          )
          `
        )
        .eq("playlist_id", config.active_playlist_id)
        .order("track_position", { ascending: true });

      if (!playlistError && playlistTracks) {
        const radioTrackIds = playlistTracks
          .map((item: any) => item.radio_tracks?.id)
          .filter(Boolean);
        const { data: platformTracks } = radioTrackIds.length
          ? await supabase
              .from("platform_tracks")
              .select("track_id, platform, external_id, preview_url, audio_url")
              .in("track_id", radioTrackIds)
          : { data: [] };
        const platformByTrack = new Map<string, any[]>();
        for (const platformTrack of platformTracks || []) {
          const current = platformByTrack.get(platformTrack.track_id) || [];
          current.push(platformTrack);
          platformByTrack.set(platformTrack.track_id, current);
        }

        const candidates = (platformTracks || []) as Array<{
          track_id: string;
          platform?: string | null;
          external_id?: string | number | null;
          preview_url?: string | null;
          audio_url?: string | null;
        }>;
        const refreshed = await refreshDeezerPreviews(candidates, forceRefresh, refreshTrackId);
        const freshCandidates = applyFreshDeezerPreviews(candidates, refreshed);
        const platformByTrackFresh = new Map<string, any[]>();
        for (const platformTrack of freshCandidates) {
          const current = platformByTrackFresh.get(platformTrack.track_id) || [];
          current.push(platformTrack);
          platformByTrackFresh.set(platformTrack.track_id, current);
        }

        tracks = playlistTracks
          .filter((pt: any) => pt.radio_tracks && pt.radio_tracks.is_active)
          .map((pt: any) => ({
            ...pt.radio_tracks,
            audio_url: resolveAudioUrl(
              pt.radio_tracks.audio_url,
              platformByTrackFresh.get(pt.radio_tracks.id) || platformByTrack.get(pt.radio_tracks.id) || [],
            ),
          }));
      }
    }

    // Cas 2 : Classement auto (si aucune playlist ou playlist vide)
    if (tracks.length === 0 && config.chart_source_key) {
      const { data: chartId, error: chartError } = await supabase
        .from("chart_editions")
        .select("id")
        .eq("status", "published")
        .limit(1)
        .maybeSingle();

      if (!chartError && chartId) {
        const { data: chartEntries, error: entriesError } = await supabase
          .from("chart_entries")
          .select(
            `
            track_id,
            tracks(
              id,
              title,
              duration_ms,
              default_artwork_url,
              track_artists(artist_id, artists(id, name)),
            platform_tracks(external_url, platform, external_id, preview_url, audio_url),
              youtube_videos(id, video_id, is_active, review_status)
            )
            `
          )
          .eq("chart_edition_id", chartId.id)
          .order("filtered_position", { ascending: true });

        if (!entriesError && chartEntries) {
          const chartPlatformTracks = chartEntries.flatMap((entry: any) => entry.tracks?.platform_tracks || []);
          const refreshed = await refreshDeezerPreviews(chartPlatformTracks, forceRefresh);
          tracks = chartEntries
            .filter((entry: any) => entry.tracks)
            .map((entry: any) => {
              const track = entry.tracks;
              
              // Récupérer audio URL
              let audioUrl = "";
              if (track.platform_tracks && track.platform_tracks.length > 0) {
                audioUrl = resolveAudioUrl(
                  "",
                  applyFreshDeezerPreviews(track.platform_tracks, refreshed),
                );
              }
              // Note: YouTube videos ne sont pas directement playables par Howler.js
              // On attend une URL audio depuis platform_tracks

              // Récupérer artiste
              let artistName = "Artiste inconnu";
              let artistId = undefined;
              if (track.track_artists && track.track_artists.length > 0) {
                const primary = track.track_artists.find((ta: any) => ta.role === "primary");
                const artist = (primary || track.track_artists[0])?.artists;
                if (artist) {
                  artistName = artist.name;
                  artistId = artist.id;
                }
              }

              return {
                id: track.id,
                title: track.title,
                artist_name: artistName,
                artist_id: artistId,
                audio_url: audioUrl,
                cover_image_url: track.default_artwork_url,
                duration_seconds: Math.floor((track.duration_ms || 0) / 1000),
                source: "chart",
                is_active: true,
                play_count: 0,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              };
            });
        }
      }
    }

    return NextResponse.json(
      {
        tracks,
        config: {
          preload_count: config.preload_count ?? 3,
          crossfade_duration_ms: config.crossfade_duration_ms ?? 2000,
        },
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("Error:", err);
    return NextResponse.json(
      { tracks: [] },
      { status: 200 }
    );
  }
}
