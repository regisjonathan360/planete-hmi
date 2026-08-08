import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/arene/battles
 * Récupère les battles filtrées par statut avec pagination.
 * Utilisé par BattleHistory pour paginer les battles terminées.
 *
 * Query params:
 * - status: "active" | "ended" (optionnel, défaut: toutes)
 * - page: numéro de page (défaut: 1)
 * - pageSize: taille de page (défaut: 20, max: 50)
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get("pageSize") ?? "20", 10)));

  const supabase = await createClient();

  let query = supabase
    .from("battles")
    .select("*", { count: "exact" });

  if (status === "active" || status === "ended") {
    query = query.eq("status", status);
  }

  query = query
    .order("ends_at", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  const { data: battles, count, error } = await query;

  if (error) {
    return NextResponse.json(
      { error: { code: "server_error", message: "Erreur lors du chargement des battles." } },
      { status: 500 }
    );
  }

  return NextResponse.json({
    battles: battles ?? [],
    pagination: {
      page,
      pageSize,
      total: count ?? 0,
      totalPages: Math.ceil((count ?? 0) / pageSize),
      hasNextPage: page * pageSize < (count ?? 0),
      hasPrevPage: page > 1,
    },
  });
}
