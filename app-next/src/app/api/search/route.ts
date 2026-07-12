/**
 * GET /api/search?q=...
 * Recherche combinée : artistes Planète HMI + résultats Deezer.
 * Publique, sans authentification.
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface SearchResult {
  type: "artist" | "track";
  source: "planete-hmi" | "deezer";
  name: string;
  artist?: string;
  imageUrl: string | null;
  url: string;
  previewUrl?: string | null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();
  if (!q || q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const results: SearchResult[] = [];

  // 1) Recherche dans la base Planète HMI (artistes)
  try {
    const supabase = await createClient();
    const { data: artists } = await supabase
      .from("artists")
      .select("id, name, slug, image_url, tags")
      .eq("is_active", true)
      .ilike("name", `%${q}%`)
      .limit(5);

    for (const a of artists ?? []) {
      results.push({
        type: "artist",
        source: "planete-hmi",
        name: a.name as string,
        imageUrl: (a.image_url as string) ?? null,
        url: `/artistes/${a.slug}`,
      });
    }
  } catch { /* ignore */ }

  // 2) Recherche Deezer (tracks avec extraits 30s)
  try {
    const deezerRes = await fetch(
      `https://api.deezer.com/search?q=${encodeURIComponent(q)}&limit=8`,
      { next: { revalidate: 60 } }
    );
    const deezerData = await deezerRes.json();
    for (const track of deezerData.data ?? []) {
      results.push({
        type: "track",
        source: "deezer",
        name: track.title,
        artist: track.artist?.name,
        imageUrl: track.album?.cover_small ?? null,
        url: track.link,
        previewUrl: track.preview ?? null,
      });
    }
  } catch { /* ignore */ }

  return NextResponse.json({ results });
}
