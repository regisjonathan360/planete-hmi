/**
 * GET /api/admin/arene/moderation — File de modération (commentaires masqués)
 *
 * Retourne la liste paginée des commentaires avec status='hidden',
 * enrichis des informations auteur et du nombre de signalements.
 *
 * Requirements: 10.5, 15.2
 */
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { parsePagination, buildPaginationMeta } from "@/lib/arene/pagination";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// GET — List hidden comments (moderation queue)
// ---------------------------------------------------------------------------

export async function GET(request: Request) {
  // 1. Admin guard
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json(
      { error: { code: auth.status === 401 ? "unauthorized" : "forbidden", message: auth.error } },
      { status: auth.status }
    );
  }

  const { searchParams } = new URL(request.url);
  const { page, pageSize } = parsePagination(searchParams);

  const supabase = createAdminClient();

  // 2. Count total hidden comments
  const { count } = await supabase
    .from("comments")
    .select("id", { count: "exact", head: true })
    .eq("status", "hidden");

  const total = count ?? 0;

  // 3. Fetch paginated hidden comments with author info
  const offset = (page - 1) * pageSize;
  const { data: comments, error } = await supabase
    .from("comments")
    .select(
      `
      id,
      member_id,
      thread_type,
      thread_id,
      body,
      status,
      report_count,
      created_at,
      community_profiles!inner(pseudo, niveau, avatar_url)
    `
    )
    .eq("status", "hidden")
    .order("report_count", { ascending: false })
    .order("created_at", { ascending: false })
    .range(offset, offset + pageSize - 1);

  if (error) {
    return NextResponse.json(
      { error: { code: "server_error", message: error.message } },
      { status: 500 }
    );
  }

  // 4. Fetch report details for these comments
  const commentIds = (comments ?? []).map((c: { id: string }) => c.id);
  let reports: { comment_id: string; reason: string; created_at: string }[] = [];

  if (commentIds.length > 0) {
    const { data: reportData } = await supabase
      .from("moderation_reports")
      .select("comment_id, reason, created_at")
      .in("comment_id", commentIds)
      .order("created_at", { ascending: false });

    reports = reportData ?? [];
  }

  // Group reports by comment_id
  const reportsByComment: Record<string, { reason: string; created_at: string }[]> = {};
  for (const report of reports) {
    if (!reportsByComment[report.comment_id]) {
      reportsByComment[report.comment_id] = [];
    }
    reportsByComment[report.comment_id].push({
      reason: report.reason,
      created_at: report.created_at,
    });
  }

  // 5. Build response
  const enrichedComments = (comments ?? []).map((comment: Record<string, unknown>) => ({
    ...comment,
    reports: reportsByComment[comment.id as string] ?? [],
  }));

  const pagination = buildPaginationMeta(total, page, pageSize);

  return NextResponse.json({
    comments: enrichedComments,
    pagination,
  });
}
