/**
 * POST /api/admin/charts/publish
 * Publication / restauration / annulation d'un classement.
 *
 * Body: { sourceKey?: string, mode: "publish" | "restore" | "cancel" }
 */
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { publishEdition, restoreLastPublished, cancelChanges } from "@/lib/charts/admin/publish";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body: { sourceKey?: string; mode?: "publish" | "restore" | "cancel" };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 });
  }

  const sourceKey = body.sourceKey ?? "audiomack_haiti_weekly100";
  const mode = body.mode ?? "publish";
  const supabase = createAdminClient();

  try {
    if (mode === "publish") {
      const res = await publishEdition(supabase, sourceKey, { changedBy: auth.user.id });
      return NextResponse.json({ status: "published", ...res });
    }
    if (mode === "restore") {
      const res = await restoreLastPublished(supabase, sourceKey, { changedBy: auth.user.id });
      return NextResponse.json({
        status: "restored",
        message: `Version publiée restaurée (${res.restored} entrées).`,
      });
    }
    if (mode === "cancel") {
      const res = await cancelChanges(supabase, sourceKey, { changedBy: auth.user.id });
      return NextResponse.json({
        status: "cancelled",
        message: `Modifications annulées, ordre source rétabli (${res.reset} entrées).`,
      });
    }
    return NextResponse.json({ error: "Mode inconnu." }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Opération échouée." },
      { status: 500 }
    );
  }
}
