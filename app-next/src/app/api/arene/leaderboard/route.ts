/**
 * GET /api/arene/leaderboard — Classement des membres par Points Cosmiques
 *
 * Endpoint public (pas d'auth requise) retournant les 50 meilleurs membres
 * triés par points_cosmiques DESC, départagés par created_at ASC (plus ancien en premier).
 * Utilise la vue matérialisée `leaderboard_cache` pour les performances.
 *
 * Requirements: 7.3, 13.4
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** ISR revalidation: cache for 60 seconds (Next.js Incremental Static Regeneration) */
export const revalidate = 60;

// ---------------------------------------------------------------------------
// GET /api/arene/leaderboard
// ---------------------------------------------------------------------------

export async function GET() {
  const supabase = await createClient();

  // Query the materialized view — already contains top 50 sorted correctly
  const { data, error } = await supabase
    .from("leaderboard_cache")
    .select("rank, pseudo, avatar_url, niveau, points_cosmiques")
    .order("rank", { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: { code: "server_error", message: "Erreur lors de la récupération du classement." } },
      { status: 500 }
    );
  }

  return NextResponse.json({
    items: data ?? [],
  });
}
