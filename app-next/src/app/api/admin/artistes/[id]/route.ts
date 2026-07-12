/**
 * POST /api/admin/artistes/[id]
 * Mise à jour complète d'un artiste par l'administrateur.
 */
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const TEXT_FIELDS = [
  "name", "slug", "bio", "city", "label", "primary_genre", "real_name",
  "birth_date", "haitian_status", "image_url", "banner_url",
  "url_spotify", "url_apple_music", "url_youtube_music", "url_audiomack",
  "url_deezer", "url_soundcloud", "url_tidal",
  "url_instagram", "url_tiktok", "url_twitter", "url_facebook",
  "url_youtube", "url_threads", "url_website",
];

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  let body: Record<string, unknown>;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Corps invalide." }, { status: 400 }); }

  const patch: Record<string, unknown> = {};

  for (const field of TEXT_FIELDS) {
    if (field in body) {
      const val = body[field];
      patch[field] = (val === "" || val === null) ? null : String(val).trim();
    }
  }

  if ("career_start_year" in body) {
    const y = parseInt(String(body.career_start_year), 10);
    patch.career_start_year = Number.isFinite(y) ? y : null;
  }

  if ("is_active" in body) {
    patch.is_active = !!body.is_active;
  }

  if ("tags" in body && Array.isArray(body.tags)) {
    patch.tags = body.tags.filter((t: unknown) => typeof t === "string" && t.trim());
  }

  patch.updated_at = new Date().toISOString();

  const supabase = createAdminClient();
  const { error } = await supabase.from("artists").update(patch).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ status: "ok", message: "Artiste mis à jour." });
}
