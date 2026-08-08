/**
 * GET /api/admin/arene/battles/search
 * Recherche d'artistes et chansons pour la création de battles.
 * 
 * Query params:
 * - q: terme de recherche (min 2 chars)
 * - type: "artist" | "song" | "all" (défaut: "all")
 * 
 * Retourne artistes (avec image) et chansons (avec artwork) du site.
 */
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("q") ?? "").trim();
  const type = searchParams.get("type") ?? "all";

  if (query.length < 2) {
    return NextResponse.json({ artists: [], tracks: [] });
  }

  const supabase = createAdminClient();
  const results: { artists: unknown[]; tracks: unknown[] } = { artists: [], tracks: [] };

  // Recherche artistes
  if (type === "all" || type === "artist") {
    const { data: artists } = await supabase
      .from("artists")
      .select("id, name, slug, image_url")
      .eq("is_active", true)
      .ilike("name", `%${query}%`)
      .order("name")
      .limit(10);

    results.artists = (artists ?? []).map((a) => ({
      id: a.id,
      name: a.name,
      slug: a.slug,
      imageUrl: a.image_url,
      type: "artist",
    }));
  }

  // Recherche chansons (tracks)
  if (type === "all" || type === "song") {
    const { data: tracks } = await supabase
      .from("tracks")
      .select("id, title, default_artwork_url, track_artists(artists(name))")
      .ilike("title", `%${query}%`)
      .eq("status", "active")
      .order("title")
      .limit(10);

    results.tracks = (tracks ?? []).map((t) => {
      const artistNames = ((t.track_artists as unknown as Array<{ artists: { name: string } | null }>) ?? [])
        .map((ta) => ta.artists?.name)
        .filter(Boolean)
        .join(", ");
      return {
        id: t.id,
        title: t.title,
        artistName: artistNames || "Artiste inconnu",
        artworkUrl: t.default_artwork_url,
        type: "song",
      };
    });
  }

  return NextResponse.json(results);
}
