import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ArtistChannelCandidate,
  ArtistChannelSyncStorage,
  ArtistYouTubeProfile,
  StoredYouTubeChannel,
} from "./artist-channel-sync";

const CHANNEL_COLUMNS = "id, channel_id, artist_id, channel_type, status";

function mapStoredChannel(row: Record<string, unknown>): StoredYouTubeChannel {
  return {
    id: row.id as string,
    channelId: row.channel_id as string,
    artistId: (row.artist_id as string | null) ?? null,
    channelType: row.channel_type as string,
    status: row.status as string,
  };
}

export function createArtistChannelSyncStorage(
  supabase: SupabaseClient
): ArtistChannelSyncStorage {
  return {
    async listArtistProfilesPage(
      cursor: string | null,
      limit: number
    ): Promise<ArtistYouTubeProfile[]> {
      let query = supabase
        .from("artists")
        .select("id, name, url_youtube")
        .not("url_youtube", "is", null)
        .order("id", { ascending: true })
        .limit(limit);
      if (cursor) query = query.gt("id", cursor);

      const { data, error } = await query;
      if (error) throw new Error(`read artist YouTube profiles: ${error.message}`);
      return (data ?? []).map((row) => ({
        id: row.id as string,
        name: row.name as string,
        urlYoutube: (row.url_youtube as string | null) ?? null,
        urlYouTubeMusic: null,
      }));
    },

    async getChannelsByYouTubeIds(channelIds: string[]): Promise<StoredYouTubeChannel[]> {
      if (channelIds.length === 0) return [];
      const { data, error } = await supabase
        .from("youtube_channels")
        .select(CHANNEL_COLUMNS)
        .in("channel_id", channelIds);
      if (error) throw new Error(`read YouTube channels: ${error.message}`);
      return (data ?? []).map((row) => mapStoredChannel(row as Record<string, unknown>));
    },

    async createCandidate(candidate: ArtistChannelCandidate): Promise<StoredYouTubeChannel> {
      const { data, error } = await supabase
        .from("youtube_channels")
        .insert({
          channel_id: candidate.channel.channelId,
          channel_title: candidate.channel.title,
          channel_handle: candidate.channel.handle,
          channel_url: candidate.sourceUrl,
          channel_type: "OFFICIAL_ARTIST_CHANNEL",
          uploads_playlist_id: candidate.channel.uploadsPlaylistId,
          thumbnail_url: candidate.channel.thumbnailUrl,
          subscriber_count: candidate.channel.subscriberCount,
          video_count: candidate.channel.videoCount,
          is_youtube_verified: true,
          is_active: false,
          status: "pending_review",
          artist_id: candidate.artistId,
          notes: `Détectée automatiquement depuis la fiche artiste « ${candidate.artistName} ».`,
        })
        .select(CHANNEL_COLUMNS)
        .single();

      if (error) {
        if (error.code === "23505") {
          const { data: existing, error: existingError } = await supabase
            .from("youtube_channels")
            .select(CHANNEL_COLUMNS)
            .eq("channel_id", candidate.channel.channelId)
            .single();
          if (!existingError && existing) {
            return mapStoredChannel(existing as Record<string, unknown>);
          }
        }
        throw new Error(`create YouTube channel candidate: ${error.message}`);
      }
      return mapStoredChannel(data as Record<string, unknown>);
    },

    async linkChannelToArtist(channelId: string, artistId: string): Promise<boolean> {
      const { data, error } = await supabase
        .from("youtube_channels")
        .update({ artist_id: artistId })
        .eq("id", channelId)
        .is("artist_id", null)
        .select("id")
        .maybeSingle();
      if (error) throw new Error(`link YouTube channel to artist: ${error.message}`);
      return Boolean(data);
    },
  };
}
