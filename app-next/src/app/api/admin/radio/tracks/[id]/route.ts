import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const trackUpdateSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  artist_name: z.string().trim().min(1).max(200).optional(),
  audio_url: z.string().url().refine((value) => !/youtube\.com|youtu\.be|spotify\.com|audiomack\.com|deezer\.com/.test(new URL(value).hostname), "Utilisez une URL de fichier audio directe").optional(),
  cover_image_url: z.string().url().optional().or(z.literal("")),
  duration_seconds: z.number().int().min(0).max(60 * 60).optional(),
  genre: z.string().max(80).optional(),
  is_active: z.boolean().optional(),
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const parsed = trackUpdateSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Données de piste invalides" }, { status: 400 });
  const { id } = await context.params;
  const { data, error } = await createAdminClient().from("radio_tracks").update({ ...parsed.data, updated_at: new Date().toISOString() }).eq("id", id).select("*").single();
  if (error) return NextResponse.json({ error: "Impossible de modifier la piste" }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id } = await context.params;
  const supabase = createAdminClient();
  const { data: track } = await supabase.from("radio_tracks").select("audio_url").eq("id", id).maybeSingle();
  const { error } = await supabase.from("radio_tracks").delete().eq("id", id);
  if (error) return NextResponse.json({ error: "Impossible de supprimer la piste" }, { status: 500 });
  if (track?.audio_url?.includes("/storage/v1/object/public/radio-audio/")) {
    const path = track.audio_url.split("/storage/v1/object/public/radio-audio/")[1];
    if (path) await supabase.storage.from("radio-audio").remove([decodeURIComponent(path)]);
  }
  return NextResponse.json({ success: true });
}
