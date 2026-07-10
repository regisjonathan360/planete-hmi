/**
 * Enrichissement des photos de profil des artistes Audiomack.
 *
 * Après collecte, les artistes n'ont pas de photo (le HTML du chart ne
 * contient pas cette info). Ce service fetche la page profil Audiomack
 * de chaque artiste pour en extraire l'og:image.
 *
 * Utilise le artist_slug Audiomack réel (depuis chart_snapshot_entries)
 * plutôt que le slug local (qui est un simple kebab-case du nom).
 */
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

const USER_AGENT = "PlaneteHMI/1.0 (+https://planete-hmi.vercel.app)";
const MAX_BATCH = 20;
const FETCH_DELAY_MS = 400;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Extraire l'og:image d'une page artiste Audiomack.
 * Retourne null si la page ne retourne pas une image de profil spécifique.
 */
async function fetchArtistImage(audiomackSlug: string): Promise<string | null> {
  try {
    const res = await fetch(`https://audiomack.com/${audiomackSlug}`, {
      headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const html = await res.text();
    const match = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i);
    const url = match?.[1] ?? null;
    if (!url) return null;
    // Ignorer les images génériques Audiomack.
    if (url.includes("/images/og-image.png")) return null;
    if (url.includes("default-artist-image")) return null;
    return url;
  } catch {
    return null;
  }
}

/**
 * Enrichit les artistes sans image_url en fetchant leurs profils Audiomack.
 * Approche directe : requête SQL pour trouver les artistes matchables.
 */
export async function enrichArtistImages(
  supabase: SupabaseClient,
  editionId: string
): Promise<{ enriched: number; total: number }> {
  // 1. Trouver le dernier snapshot pour avoir les slugs Audiomack réels.
  const { data: snap } = await supabase
    .from("chart_snapshots")
    .select("id")
    .eq("platform", "audiomack")
    .eq("status", "success")
    .order("collected_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!snap?.id) return { enriched: 0, total: 0 };

  // 2. Construire un mapping nom_artiste → slug_audiomack.
  const { data: snapEntries } = await supabase
    .from("chart_snapshot_entries")
    .select("artist_name, artist_slug")
    .eq("snapshot_id", snap.id);

  const slugByName = new Map<string, string>();
  for (const e of snapEntries ?? []) {
    if (e.artist_slug && e.artist_name) {
      slugByName.set((e.artist_name as string).toLowerCase().trim(), e.artist_slug as string);
    }
  }

  // 3. Artistes sans image dans la base.
  const { data: artists } = await supabase
    .from("artists")
    .select("id, name")
    .is("image_url", null);

  // 4. Matcher chaque artiste avec son slug Audiomack.
  const toEnrich: { id: string; audiomackSlug: string }[] = [];
  for (const a of artists ?? []) {
    const key = (a.name as string).toLowerCase().trim();
    const slug = slugByName.get(key);
    if (slug) {
      toEnrich.push({ id: a.id as string, audiomackSlug: slug });
    }
  }

  if (!toEnrich.length) return { enriched: 0, total: 0 };

  // 5. Fetch les images en batch.
  const batch = toEnrich.slice(0, MAX_BATCH);
  let enriched = 0;

  for (const artist of batch) {
    const imageUrl = await fetchArtistImage(artist.audiomackSlug);
    if (imageUrl) {
      await supabase
        .from("artists")
        .update({ image_url: imageUrl })
        .eq("id", artist.id);
      enriched++;
    }
    await sleep(FETCH_DELAY_MS);
  }

  return { enriched, total: toEnrich.length };
}
