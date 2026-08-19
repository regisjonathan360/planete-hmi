/**
 * Importe une playlist publique Audiomack dans la radio.
 *
 * Les morceaux ne sont ni téléchargés ni réhébergés : seules les URLs audio
 * directes retournées par Audiomack sont inscrites dans la playlist radio.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { collectAudiomackPlaylist, parseAudiomackPlaylistUrl } from "@/lib/audiomack/playlist";
import { isPlayableAudioUrl } from "@/lib/radio/audio";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const importSchema = z.object({
  playlistUrl: z.string().url().max(2048),
  name: z.string().trim().min(1).max(140).optional(),
  activate: z.boolean().default(true),
});

interface ImportedTrackRow {
  source_id: string;
  title: string;
  artist_name: string;
  audio_url: string;
  cover_image_url: string | null;
  duration_seconds: number;
  genre: string | null;
  source: "audiomack";
  is_active: boolean;
}

function sourceIdFor(sourceKey: string, trackId: string) {
  return `audiomack-playlist:${sourceKey}:${trackId}`;
}

export async function POST(request: Request): Promise<NextResponse> {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const parsedBody = importSchema.safeParse(await request.json().catch(() => null));
  if (!parsedBody.success) {
    return NextResponse.json({ error: "URL de playlist Audiomack invalide." }, { status: 400 });
  }

  const source = parseAudiomackPlaylistUrl(parsedBody.data.playlistUrl);
  if (!source) {
    return NextResponse.json(
      { error: "Utilisez une URL publique Audiomack au format audiomack.com/artiste/playlist/nom-de-playlist." },
      { status: 400 },
    );
  }

  try {
    const collected = await collectAudiomackPlaylist(source);
    const seenSourceIds = new Set<string>();
    const playableTracks: ImportedTrackRow[] = [];

    for (const entry of collected.entries) {
      const fallbackTrackId = entry.artistSlug && entry.trackSlug
        ? `${entry.artistSlug}/${entry.trackSlug}`
        : String(entry.rank);
      const externalTrackId = entry.platformTrackId || fallbackTrackId;
      const sourceId = sourceIdFor(source.key, externalTrackId);
      const audioUrl = entry.previewUrl?.trim();

      if (!audioUrl || !isPlayableAudioUrl(audioUrl) || seenSourceIds.has(sourceId)) continue;
      seenSourceIds.add(sourceId);
      playableTracks.push({
        source_id: sourceId,
        title: entry.title,
        artist_name: entry.artistName,
        audio_url: audioUrl,
        cover_image_url: entry.artworkUrl,
        duration_seconds: 0,
        genre: entry.genre || collected.genre,
        source: "audiomack",
        is_active: true,
      });
    }

    if (!playableTracks.length) {
      return NextResponse.json({
        error: "Audiomack a retourné la playlist, mais aucune piste avec une source audio directe lisible. Les titres premium ou sans flux public ne peuvent pas être diffusés.",
        detectedTracks: collected.entries.length,
      }, { status: 422 });
    }

    const supabase = createAdminClient();
    const sourcePrefix = `audiomack-playlist:${source.key}:`;
    const { data: existingRows, error: existingError } = await supabase
      .from("radio_tracks")
      .select("id, source_id")
      .eq("source", "audiomack")
      .like("source_id", `${sourcePrefix}%`);
    if (existingError) throw new Error("Impossible de vérifier les pistes déjà importées.");

    const existingBySourceId = new Map(
      (existingRows || []).map((row: { id: string; source_id: string | null }) => [row.source_id || "", row.id]),
    );
    const importedPlaylistTrackIds = (existingRows || []).map((row: { id: string }) => row.id);
    const existingPlaylistId = importedPlaylistTrackIds.length
      ? (await supabase
          .from("radio_playlist_tracks")
          .select("playlist_id")
          .in("track_id", importedPlaylistTrackIds)
          .limit(1)
          .maybeSingle()).data?.playlist_id as string | undefined
      : undefined;

    const recordsBySourceId = new Map<string, { id: string; source_id: string }>();
    const updates = playableTracks.filter((track) => existingBySourceId.has(track.source_id));
    const inserts = playableTracks.filter((track) => !existingBySourceId.has(track.source_id));

    const updateResults = await Promise.all(
      updates.map(async (track) => {
        const id = existingBySourceId.get(track.source_id);
        if (!id) return null;
        const { data, error } = await supabase
          .from("radio_tracks")
          .update({ ...track, updated_at: new Date().toISOString() })
          .eq("id", id)
          .select("id, source_id")
          .single();
        if (error) throw new Error(`Impossible de mettre à jour « ${track.title} ».`);
        return data as { id: string; source_id: string };
      }),
    );
    for (const row of updateResults) if (row) recordsBySourceId.set(row.source_id, row);

    if (inserts.length) {
      const { data, error } = await supabase
        .from("radio_tracks")
        .insert(inserts)
        .select("id, source_id");
      if (error) throw new Error("Impossible d'ajouter les pistes Audiomack à la bibliothèque radio.");
      for (const row of data || []) {
        const typedRow = row as { id: string; source_id: string };
        recordsBySourceId.set(typedRow.source_id, typedRow);
      }
    }

    const radioTracks = playableTracks
      .map((track) => recordsBySourceId.get(track.source_id))
      .filter((track): track is { id: string; source_id: string } => Boolean(track));
    if (!radioTracks.length) throw new Error("Aucune piste radio n'a pu être enregistrée.");

    const playlistName = parsedBody.data.name || `Audiomack · ${collected.title}`;
    const description = [
      "Importée depuis une playlist publique Audiomack.",
      source.sourceUrl,
      collected.description,
    ].filter(Boolean).join("\n\n");

    let playlistId = existingPlaylistId;
    if (playlistId) {
      const { error } = await supabase
        .from("radio_playlists")
        .update({ name: playlistName, description, is_active: true, updated_at: new Date().toISOString() })
        .eq("id", playlistId);
      if (error) throw new Error("Impossible de mettre à jour la playlist radio.");
    } else {
      const { data, error } = await supabase
        .from("radio_playlists")
        .insert({
          name: playlistName,
          description,
          is_active: true,
          shuffle_enabled: false,
          repeat_enabled: true,
        })
        .select("id")
        .single();
      if (error || !data) throw new Error("Impossible de créer la playlist radio.");
      playlistId = data.id as string;
    }

    const { error: removeError } = await supabase
      .from("radio_playlist_tracks")
      .delete()
      .eq("playlist_id", playlistId);
    if (removeError) throw new Error("Impossible de remplacer le contenu de la playlist radio.");

    const { error: linkError } = await supabase
      .from("radio_playlist_tracks")
      .insert(radioTracks.map((track, index) => ({
        playlist_id: playlistId,
        track_id: track.id,
        track_position: index + 1,
      })));
    if (linkError) throw new Error("Impossible de composer la playlist radio.");

    if (parsedBody.data.activate) {
      const { data: config } = await supabase.from("radio_config").select("id").limit(1).maybeSingle();
      const configData = {
        active_playlist_id: playlistId,
        auto_switch_to_chart: false,
        chart_source_key: null,
        is_live: true,
        updated_at: new Date().toISOString(),
        updated_by: auth.user.id,
      };
      const { error } = config
        ? await supabase.from("radio_config").update(configData).eq("id", config.id)
        : await supabase.from("radio_config").insert(configData);
      if (error) throw new Error("La playlist a été importée, mais la radio n'a pas pu être activée.");
    }

    const { data: playlist, error: playlistError } = await supabase
      .from("radio_playlists")
      .select("*")
      .eq("id", playlistId)
      .single();
    if (playlistError || !playlist) throw new Error("Playlist créée mais impossible à relire.");

    return NextResponse.json({
      success: true,
      playlist: { ...playlist, track_count: radioTracks.length },
      importedTracks: radioTracks.length,
      skippedTracks: collected.entries.length - playableTracks.length,
      activated: parsedBody.data.activate,
      sourceUrl: source.sourceUrl,
      message: `${radioTracks.length} piste(s) Audiomack ajoutée(s)${parsedBody.data.activate ? " et mise(s) en ligne sur la radio" : " à la playlist"}.`,
    });
  } catch (error) {
    console.error("Audiomack playlist import failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Impossible d'importer la playlist Audiomack." },
      { status: 500 },
    );
  }
}
