/**
 * POST /api/admin/tiktok/restore
 * Restaure la dernière version publiée (annule les modifications non publiées).
 */
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { restoreLastPublished } from "@/lib/charts/admin/publish";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body: { sourceKey?: string };
  try { body = await request.json(); } catch { body = {}; }

  const sourceKey = body.sourceKey ?? "tiktok_haiti_global";
  const supabase = createAdminClient();

  try {
    const res = await restoreLastPublished(supabase, sourceKey, { changedBy: auth.user.id });
    return NextResponse.json({
      status: "restored",
      message: `Version publiée restaurée (${res.restored} entrées).`,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Restauration échouée." },
      { status: 500 }
    );
  }
}
