/**
 * POST /api/artist/profile
 * Permet à un artiste connecté de mettre à jour son profil.
 * L'artiste doit avoir un user_id lié dans la table artists.
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const ALLOWED_FIELDS = [
  "bio", "city", "label", "primary_genre", "real_name",
  "career_start_year", "birth_date",
  "url_spotify", "url_apple_music", "url_youtube_music", "url_audiomack",
  "url_deezer", "url_soundcloud", "url_tidal",
  "url_instagram", "url_tiktok", "url_twitter", "url_facebook",
  "url_youtube", "url_threads", "url_website",
] as const;

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  }

  // Trouver l'artiste lié à ce user
  const { data: artist } = await supabase
    .from("artists")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!artist) {
    return NextResponse.json({ error: "Aucun profil artiste lié à ce compte." }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps invalide." }, { status: 400 });
  }

  // Filtrer et sanitiser les champs
  const patch: Record<string, string | number | null> = {};
  for (const field of ALLOWED_FIELDS) {
    if (field in body) {
      const value = body[field];
      if (value === "" || value === null || value === undefined) {
        patch[field] = null;
      } else if (field === "career_start_year") {
        const year = parseInt(String(value), 10);
        patch[field] = Number.isFinite(year) ? year : null;
      } else {
        patch[field] = String(value).trim().slice(0, 2000);
      }
    }
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Aucun champ à mettre à jour." }, { status: 400 });
  }

  const { error } = await supabase
    .from("artists")
    .update(patch)
    .eq("id", artist.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ status: "ok", message: "Profil mis à jour." });
}
