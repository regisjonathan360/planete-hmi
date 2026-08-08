/**
 * Auditeurs mensuels Spotify et reclassement.
 *
 * GET  ?entryId=… — récupère les monthly listeners d'un artiste d'une entrée.
 * POST { sourceKey, editionId } — enrichit toutes les entrées et reclasse par monthly listeners.
 */
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getSpotifyArtistMonthlyListeners,
  searchArtistMonthlyListeners,
} from "@/lib/spotify/api-client";
import { recomputeAdminEdition } from "@/lib/charts/admin/recompute-admin-edition";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET — récupère les monthly listeners pour un artiste lié à une entrée.
 */
export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const url = new URL(request.url);
  const entryId = url.searchParams.get("entryId");
  if (!entryId) return NextResponse.json({ error: "entryId requis." }, { status: 400 });

  const supabase = createAdminClient();

  // Charger l'entrée pour obtenir le nom d'artiste et l'ID Spotify éventuel
  const { data: entry } = await supabase
    .from("chart_entries")
    .select("id, raw_artist_text, track_id, platform_track_id")
    .eq("id", entryId)
    .maybeSingle();

  if (!entry) return NextResponse.json({ error: "Entrée introuvable." }, { status: 404 });

  // Chercher l'identifiant Spotify de l'artiste principal
  let spotifyArtistId: string | null = null;

  if (entry.track_id) {
    const { data: ta } = await supabase
      .from("track_artists")
      .select("artist_id, artists(spotify_producer_id, url_spotify)")
      .eq("track_id", entry.track_id)
      .in("role", ["primary", "co_primary"])
      .order("billing_order", { ascending: true, nullsFirst: false })
      .limit(1)
      .maybeSingle();

    const artist = Array.isArray(ta?.artists) ? ta.artists[0] : ta?.artists;
    if (artist?.url_spotify) {
      const m = /artist\/([A-Za-z0-9]{22})/.exec(artist.url_spotify as string);
      if (m) spotifyArtistId = m[1];
    }
    if (!spotifyArtistId) {
      // Chercher dans artist_platform_identities
      const { data: identity } = await supabase
        .from("artist_platform_identities")
        .select("external_id")
        .eq("artist_id", ta?.artist_id as string)
        .eq("platform", "spotify")
        .maybeSingle();
      if (identity?.external_id) spotifyArtistId = identity.external_id as string;
    }
  }

  // Récupérer les monthly listeners
  let result;
  if (spotifyArtistId) {
    const data = await getSpotifyArtistMonthlyListeners(spotifyArtistId);
    result = { artistId: spotifyArtistId, ...data };
  } else {
    // Fallback : recherche par nom
    const artistName = (entry.raw_artist_text as string) ?? "";
    // Prendre le premier artiste (avant la virgule)
    const firstName = artistName.split(",")[0].split("/")[0].split("&")[0].trim();
    result = await searchArtistMonthlyListeners(firstName);
  }

  return NextResponse.json({
    ok: true,
    entryId,
    artistName: entry.raw_artist_text,
    ...result,
  });
}

/**
 * POST — enrichit toutes les entrées visibles d'une édition et reclasse
 * par nombre d'auditeurs mensuels décroissant.
 */
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json().catch(() => ({}));
  const sourceKey = String((body as Record<string, unknown>)?.sourceKey ?? "");
  const editionId = String((body as Record<string, unknown>)?.editionId ?? "");

  if (!editionId) return NextResponse.json({ error: "editionId requis." }, { status: 400 });

  const supabase = createAdminClient();

  // Charger toutes les entrées de l'édition
  const { data: entries, error: loadErr } = await supabase
    .from("chart_entries")
    .select("id, raw_artist_text, track_id, is_hidden, is_excluded, metric_value")
    .eq("chart_edition_id", editionId);

  if (loadErr) return NextResponse.json({ error: loadErr.message }, { status: 500 });

  const visibleEntries = (entries ?? []).filter((e) => !e.is_hidden && !e.is_excluded);
  const results: { entryId: string; artistName: string; monthlyListeners: number | null }[] = [];

  // Enrichir chaque entrée avec les monthly listeners
  for (const entry of visibleEntries) {
    let spotifyArtistId: string | null = null;
    const artistName = (entry.raw_artist_text as string) ?? "Artiste";

    if (entry.track_id) {
      const { data: ta } = await supabase
        .from("track_artists")
        .select("artist_id")
        .eq("track_id", entry.track_id)
        .in("role", ["primary", "co_primary"])
        .limit(1)
        .maybeSingle();

      if (ta?.artist_id) {
        const { data: identity } = await supabase
          .from("artist_platform_identities")
          .select("external_id")
          .eq("artist_id", ta.artist_id as string)
          .eq("platform", "spotify")
          .maybeSingle();
        if (identity?.external_id) spotifyArtistId = identity.external_id as string;
      }
    }

    let monthlyListeners: number | null = null;

    try {
      if (spotifyArtistId) {
        const data = await getSpotifyArtistMonthlyListeners(spotifyArtistId);
        monthlyListeners = data.monthlyListeners ?? data.followers;
      } else {
        const firstName = artistName.split(",")[0].split("/")[0].split("&")[0].trim();
        const data = await searchArtistMonthlyListeners(firstName);
        monthlyListeners = data.monthlyListeners ?? data.followers;
      }
    } catch {
      // On continue avec les autres artistes
    }

    // Stocker la valeur dans metric_value de l'entrée
    if (monthlyListeners !== null) {
      await supabase
        .from("chart_entries")
        .update({ metric_value: monthlyListeners, metric_unit: "monthly_listeners" })
        .eq("id", entry.id);
    }

    results.push({ entryId: entry.id as string, artistName, monthlyListeners });

    // Pause entre les requêtes pour éviter le rate limiting
    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  // Reclasser par monthly_listeners décroissant
  const sorted = results
    .filter((r) => r.monthlyListeners !== null)
    .sort((a, b) => (b.monthlyListeners ?? 0) - (a.monthlyListeners ?? 0));

  // Les entrées sans listeners restent à la fin
  const withoutListeners = results.filter((r) => r.monthlyListeners === null);
  const finalOrder = [...sorted, ...withoutListeners];

  // Appliquer les positions admin
  for (let i = 0; i < finalOrder.length; i++) {
    await supabase
      .from("chart_entries")
      .update({ admin_position: i + 1 })
      .eq("id", finalOrder[i].entryId);
  }

  // Recomputer les positions filtrées
  await recomputeAdminEdition(supabase, editionId, {
    action: "reorder",
    source: sourceKey || "spotify",
    changedBy: auth.user.id,
  });

  const enriched = results.filter((r) => r.monthlyListeners !== null).length;

  return NextResponse.json({
    ok: true,
    message: `${enriched}/${results.length} artiste(s) enrichi(s). Classement réordonné par auditeurs mensuels.`,
    results,
  });
}
