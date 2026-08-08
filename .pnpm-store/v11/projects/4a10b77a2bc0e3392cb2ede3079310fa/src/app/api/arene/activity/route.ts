/**
 * GET /api/arene/activity — Mur d'activité paginé avec regroupement
 *
 * Endpoint public (pas d'auth requise) retournant le flux d'activités récentes
 * de l'arène, groupées par type et cible dans une fenêtre de 60 minutes.
 *
 * Requirements: 9.1, 9.3, 9.4, 9.5
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { groupActivities } from "@/lib/arene/activity-grouping";
import { formatRelativeDate } from "@/lib/arene/date-utils";
import { parsePagination, buildPaginationMeta } from "@/lib/arene/pagination";

export const dynamic = "force-dynamic";

/** Default page size for the activity feed (Requirement 9.3: 30 items) */
const DEFAULT_ACTIVITY_PAGE_SIZE = 30;

// ---------------------------------------------------------------------------
// GET /api/arene/activity
// ---------------------------------------------------------------------------

export async function GET(request: Request) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);

  // Parse pagination — override default to 30 for the activity feed
  const { page, pageSize: rawPageSize } = parsePagination(searchParams);
  const pageSize = searchParams.get("pageSize")
    ? rawPageSize
    : DEFAULT_ACTIVITY_PAGE_SIZE;
  // Ensure max is still respected
  const effectivePageSize = Math.min(pageSize, 50);

  const offset = (page - 1) * effectivePageSize;

  // Count total activity items for pagination meta
  const { count, error: countError } = await supabase
    .from("activity_feed")
    .select("*", { count: "exact", head: true });

  if (countError) {
    return NextResponse.json(
      { error: { code: "server_error", message: "Erreur lors du comptage des activités." } },
      { status: 500 }
    );
  }

  const total = count ?? 0;

  // Fetch activity items joined with community_profiles for actor info
  const { data: rawItems, error: fetchError } = await supabase
    .from("activity_feed")
    .select(`
      id,
      actor_id,
      activity_type,
      target_type,
      target_id,
      target_label,
      metadata,
      created_at,
      community_profiles!activity_feed_actor_id_fkey (
        pseudo,
        niveau
      )
    `)
    .order("created_at", { ascending: false })
    .range(offset, offset + effectivePageSize - 1);

  if (fetchError) {
    return NextResponse.json(
      { error: { code: "server_error", message: "Erreur lors de la récupération des activités." } },
      { status: 500 }
    );
  }

  // Transform raw DB rows into ActivityItem format for grouping
  const activityItems = (rawItems ?? []).map((row) => {
    const profile = row.community_profiles as unknown as
      | { pseudo: string; niveau: string }
      | null;

    return {
      id: row.id as string,
      type: row.activity_type as string,
      actorPseudo: profile?.pseudo ?? "Anonyme",
      actorNiveau: profile?.niveau ?? "etoile",
      targetType: (row.target_type as string) ?? undefined,
      targetId: (row.target_id as string) ?? undefined,
      targetLabel: (row.target_label as string) ?? "",
      targetUrl: (row.metadata as Record<string, unknown>)?.targetUrl as string | undefined,
      createdAt: row.created_at as string,
    };
  });

  // Apply activity grouping (same type + same target within 60-min window)
  const groupedItems = groupActivities(activityItems);

  // Format relative dates for display
  const itemsWithFormattedDate = groupedItems.map((item) => ({
    ...item,
    formattedDate: formatRelativeDate(item.createdAt),
  }));

  // Build pagination metadata
  const pagination = buildPaginationMeta(total, page, effectivePageSize);

  return NextResponse.json({
    items: itemsWithFormattedDate,
    pagination,
  });
}
