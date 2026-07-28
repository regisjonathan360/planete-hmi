/**
 * GET /api/search?q=...
 * Recherche combinée : tous les profils artistes publics Planète HMI
 * (is_active = true, comme la page de profil publique) + résultats Deezer.
 * Publique, sans authentification.
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const MAX_QUERY_LENGTH = 80;
const MAX_ARTIST_RESULTS = 50;

interface SearchResult {
  type: "artist" | "track";
  source: "planete-hmi" | "deezer";
  name: string;
  artist?: string;
  imageUrl: string | null;
  url: string;
  previewUrl?: string | null;
}

interface ArtistSearchRow {
  id: string;
  name: string;
  slug: string;
  image_url: string | null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim().slice(0, MAX_QUERY_LENGTH);
  if (!q || q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const results: SearchResult[] = [];

  // La politique publique de la table et la page de profil utilisent toutes
  // deux is_active=true. Aucun profil désactivé ou administratif n'est exposé.
  try {
    const supabase = await createClient();
    const safePattern = q.replace(/[\\%_]/g, "\\$&");
    const slugPattern = q
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    const nameQuery = supabase
      .from("artists")
      .select("id, name, slug, image_url")
      .eq("is_active", true)
      .ilike("name", `%${safePattern}%`)
      .order("name")
      .limit(MAX_ARTIST_RESULTS);

    const slugQuery = slugPattern
      ? supabase
          .from("artists")
          .select("id, name, slug, image_url")
          .eq("is_active", true)
          .ilike("slug", `%${slugPattern}%`)
          .order("name")
          .limit(MAX_ARTIST_RESULTS)
      : null;

    const [nameResponse, slugResponse] = await Promise.all([
      nameQuery,
      slugQuery,
    ]);

    const artistsById = new Map<string, ArtistSearchRow>();
    for (const artist of [
      ...(nameResponse.data ?? []),
      ...(slugResponse?.data ?? []),
    ]) {
      artistsById.set(artist.id as string, artist as ArtistSearchRow);
    }

    const normalizedQuery = normalizeSearchText(q);
    const artists = [...artistsById.values()]
      .sort((a, b) => {
        const rankDifference =
          artistMatchRank(a.name, normalizedQuery) -
          artistMatchRank(b.name, normalizedQuery);
        return rankDifference || a.name.localeCompare(b.name, "fr");
      })
      .slice(0, MAX_ARTIST_RESULTS);

    for (const artist of artists) {
      results.push({
        type: "artist",
        source: "planete-hmi",
        name: artist.name,
        imageUrl: artist.image_url,
        url: `/artistes/${artist.slug}`,
      });
    }
  } catch {
    // Deezer reste disponible si Supabase rencontre une erreur temporaire.
  }

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
  } catch {
    // Les profils Planète HMI restent disponibles si Deezer est indisponible.
  }

  return NextResponse.json(
    { results },
    {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    }
  );
}

export function normalizeSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("fr")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function artistMatchRank(name: string, normalizedQuery: string) {
  const normalizedName = normalizeSearchText(name);
  if (normalizedName === normalizedQuery) return 0;
  if (normalizedName.startsWith(normalizedQuery)) return 1;
  if (normalizedName.split(" ").some((part) => part.startsWith(normalizedQuery))) {
    return 2;
  }
  return 3;
}
