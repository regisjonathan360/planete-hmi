import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const trackSchema = z.object({
  title: z.string().trim().min(1).max(200),
  artist_name: z.string().trim().min(1).max(200),
  audio_url: z.string().url().refine((value) => !/youtube\.com|youtu\.be|spotify\.com|audiomack\.com|deezer\.com/.test(new URL(value).hostname), "Utilisez une URL de fichier audio directe"),
  cover_image_url: z.string().url().optional().or(z.literal("")),
  duration_seconds: z.number().int().min(0).max(60 * 60).default(0),
  genre: z.string().max(80).optional(),
});

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const parsed = trackSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Titre, artiste et lien audio valide requis" }, { status: 400 });
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("radio_tracks").insert({
    ...parsed.data,
    source: "manual",
    is_active: true,
  }).select("*").single();
  if (error) return NextResponse.json({ error: "Impossible d'ajouter la piste" }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
