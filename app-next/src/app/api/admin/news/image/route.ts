/**
 * POST /api/admin/news/image — Téléverse une image depuis l'appareil
 * de l'administrateur et renvoie son URL publique (bucket artist-media,
 * préfixe news/ — bucket public déjà en place côté cloud).
 */
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"]);
const MAX_SIZE = 10 * 1024 * 1024; // 10 Mo (limite du bucket artist-media)

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Aucun fichier reçu." }, { status: 400 });
  }
  if (!allowedTypes.has(file.type)) {
    return NextResponse.json({ error: "Format d'image non accepté (JPEG, PNG, WebP, GIF, AVIF)." }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "Image trop lourde (10 Mo maximum)." }, { status: 400 });
  }

  const supabase = createAdminClient();
  const safeName = file.name.replace(/[^a-z0-9._-]/gi, "-").toLowerCase();
  const path = `news/${crypto.randomUUID()}-${safeName}`;

  const upload = await supabase.storage
    .from("artist-media")
    .upload(path, file, { contentType: file.type, upsert: false });

  if (upload.error) {
    return NextResponse.json({ error: "Impossible de téléverser l'image." }, { status: 500 });
  }

  const { data: publicUrl } = supabase.storage.from("artist-media").getPublicUrl(path);
  return NextResponse.json({ url: publicUrl.publicUrl }, { status: 201 });
}
