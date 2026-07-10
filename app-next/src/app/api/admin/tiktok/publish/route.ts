/**
 * POST /api/admin/tiktok/publish
 * Publie l'édition TikTok courante dans chart_published_snapshots.
 */
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { publishEdition } from "@/lib/charts/admin/publish";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body: { sourceKey?: string };
  try { body = await request.json(); } catch { body = {}; }

  const sourceKey = body.sourceKey ?? "tiktok_haiti_global";
  const supabase = createAdminClient();

  try {
    const res = await publishEdition(supabase, sourceKey, { changedBy: auth.user.id });
    return NextResponse.json({ status: "published", ...res });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Publication échouée." },
      { status: 500 }
    );
  }
}
