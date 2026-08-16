import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const allowedTypes = new Set(["audio/mpeg", "audio/wav", "audio/ogg", "audio/mp4", "audio/aac", "audio/webm"]);

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const form = await request.formData();
  const file = form.get("file");
  const title = String(form.get("title") || "").trim();
  const artistName = String(form.get("artist_name") || "").trim();
  if (!(file instanceof File) || !allowedTypes.has(file.type) || file.size > 100 * 1024 * 1024) {
    return NextResponse.json({ error: "Fichier audio invalide (100 Mo maximum)" }, { status: 400 });
  }
  if (!title || !artistName) return NextResponse.json({ error: "Titre et artiste requis" }, { status: 400 });
  const supabase = createAdminClient();
  const safeName = file.name.replace(/[^a-z0-9._-]/gi, "-").toLowerCase();
  const path = `${crypto.randomUUID()}-${safeName}`;
  const upload = await supabase.storage.from("radio-audio").upload(path, file, { contentType: file.type, upsert: false });
  if (upload.error) return NextResponse.json({ error: "Impossible de téléverser le fichier" }, { status: 500 });
  const { data: publicUrl } = supabase.storage.from("radio-audio").getPublicUrl(path);
  const { data, error } = await supabase.from("radio_tracks").insert({
    title, artist_name: artistName, audio_url: publicUrl.publicUrl,
    source: "manual", is_active: true, duration_seconds: 0,
  }).select("*").single();
  if (error) return NextResponse.json({ error: "Fichier envoyé mais piste non créée" }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
