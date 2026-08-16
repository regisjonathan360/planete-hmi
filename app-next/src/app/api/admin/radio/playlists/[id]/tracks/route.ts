import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";

const bodySchema = z.object({ trackIds: z.array(z.string().uuid()).min(1) });
const reorderSchema = z.object({ orderedTrackIds: z.array(z.string().uuid()).min(1) });

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id } = await context.params;
  const { data, error } = await createAdminClient()
    .from("radio_playlist_tracks")
    .select("id, track_id, track_position, radio_tracks(*)")
    .eq("playlist_id", id)
    .order("track_position", { ascending: true });
  if (error) return NextResponse.json({ error: "Impossible de charger la playlist" }, { status: 500 });
  return NextResponse.json(data || []);
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id: playlistId } = await context.params;
  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "trackIds requis" }, { status: 400 });
  const supabase = createAdminClient();
  const { data: last } = await supabase.from("radio_playlist_tracks").select("track_position").eq("playlist_id", playlistId).order("track_position", { ascending: false }).limit(1).maybeSingle();
  const rows = parsed.data.trackIds.map((trackId, index) => ({ playlist_id: playlistId, track_id: trackId, track_position: (last?.track_position || 0) + index + 1 }));
  const { error } = await supabase.from("radio_playlist_tracks").upsert(rows, { onConflict: "playlist_id,track_id", ignoreDuplicates: true });
  if (error) return NextResponse.json({ error: "Impossible d'ajouter les pistes" }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id: playlistId } = await context.params;
  const { trackId } = await request.json();
  if (!trackId) return NextResponse.json({ error: "trackId requis" }, { status: 400 });
  const { error } = await createAdminClient().from("radio_playlist_tracks").delete().eq("playlist_id", playlistId).eq("track_id", trackId);
  if (error) return NextResponse.json({ error: "Impossible de retirer la piste" }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id: playlistId } = await context.params;
  const parsed = reorderSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "orderedTrackIds requis" }, { status: 400 });
  const supabase = createAdminClient();
  const results = await Promise.all(parsed.data.orderedTrackIds.map((trackId, index) =>
    supabase.from("radio_playlist_tracks").update({ track_position: index + 1 }).eq("playlist_id", playlistId).eq("track_id", trackId)
  ));
  const error = results.find((result) => result.error)?.error;
  if (error) return NextResponse.json({ error: "Impossible de réordonner la playlist" }, { status: 500 });
  return NextResponse.json({ success: true });
}
