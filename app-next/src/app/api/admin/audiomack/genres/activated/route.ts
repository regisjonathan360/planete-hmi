/**
 * GET /api/admin/audiomack/genres/activated
 *
 * Retourne la liste des genres où is_enabled = true.
 * Optionnel: ?automatic=true filtre aussi is_automatic = true.
 *
 * Protégé par ADMIN_SECRET (pas de session utilisateur — utilisé par les scripts).
 */
import "server-only";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  // --- Auth par ADMIN_SECRET header (pour scripts/CI) ---
  const authHeader = request.headers.get("authorization");
  const adminSecret = process.env.ADMIN_SECRET;

  if (!adminSecret) {
    return NextResponse.json(
      { error: "ADMIN_SECRET non configuré sur le serveur." },
      { status: 500 }
    );
  }

  if (authHeader !== `Bearer ${adminSecret}`) {
    return NextResponse.json(
      { error: "Non autorisé. Header Authorization manquant ou invalide." },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const automaticOnly = searchParams.get("automatic") === "true";

  const supabase = createAdminClient();

  let query = supabase
    .from("chart_sources")
    .select("id, source_key, genre_id, display_name, is_enabled, is_automatic, weight, display_order")
    .eq("platform", "audiomack")
    .eq("is_enabled", true)
    .eq("is_composite_source", false)
    .order("display_order", { ascending: true });

  if (automaticOnly) {
    query = query.eq("is_automatic", true);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json(
      { error: `Erreur lors de la récupération des genres activés: ${error.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ genres: data ?? [] });
}
