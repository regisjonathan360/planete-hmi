/**
 * GET /api/favorites — Liste des artistes favoris du visiteur connecté
 * POST /api/favorites — Ajouter un favori { artistId }
 * DELETE /api/favorites — Retirer un favori { artistId }
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ favorites: [] });

  const { data } = await supabase
    .from("user_favorites")
    .select("artist_id, created_at, artists(id, name, slug, image_url, tags)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const favorites = (data ?? []).map((f: unknown) => {
    const row = f as { artist_id: string; artists: { id: string; name: string; slug: string; image_url: string | null; tags: string[] } | null };
    return {
      artistId: row.artist_id,
      name: row.artists?.name ?? "Artiste",
      slug: row.artists?.slug ?? "",
      imageUrl: row.artists?.image_url ?? null,
      tags: row.artists?.tags ?? [],
    };
  });

  return NextResponse.json({ favorites });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non connecté." }, { status: 401 });

  const { artistId } = await request.json();
  if (!artistId) return NextResponse.json({ error: "artistId requis." }, { status: 400 });

  const { error } = await supabase
    .from("user_favorites")
    .upsert({ user_id: user.id, artist_id: artistId }, { onConflict: "user_id,artist_id" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ status: "ok", message: "Ajouté aux favoris." });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non connecté." }, { status: 401 });

  const { artistId } = await request.json();
  if (!artistId) return NextResponse.json({ error: "artistId requis." }, { status: 400 });

  await supabase
    .from("user_favorites")
    .delete()
    .eq("user_id", user.id)
    .eq("artist_id", artistId);

  return NextResponse.json({ status: "ok", message: "Retiré des favoris." });
}
