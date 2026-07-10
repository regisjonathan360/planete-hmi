/**
 * POST /api/admin/tiktok/cancel
 * Annule les modifications admin non publiées (rétablit l'ordre source).
 */
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { cancelChanges } from "@/lib/charts/admin/publish";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body: { sourceKey?: string };
  try { body = await request.json(); } catch { body = {}; }

  const sourceKey = body.sourceKey ?? "tiktok_haiti_global";
  const supabase = createAdminClient();

  try {
    const res = await cancelChanges(supabase, sourceKey, { changedBy: auth.user.id });
    return NextResponse.json({
      status: "cancelled",
      message: `Modifications annulées, ordre source rétabli (${res.reset} entrées).`,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Annulation échouée." },
      { status: 500 }
    );
  }
}
