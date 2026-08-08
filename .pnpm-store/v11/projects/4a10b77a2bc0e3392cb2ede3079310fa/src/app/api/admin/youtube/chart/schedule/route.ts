import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { toSafeApiError } from "@/lib/youtube/api-error";

const scheduleSchema = z.object({
  editionId: z.string().uuid(),
  publishAt: z.string().datetime({ offset: true }),
  timezone: z.string().trim().min(1).max(100),
});
const cancelSchema = z.object({ editionId: z.string().uuid() });

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: { code: "forbidden", message: auth.error } }, { status: auth.status });
  try {
    const parsed = scheduleSchema.safeParse(await request.json());
    if (!parsed.success || Date.parse(parsed.data.publishAt) <= Date.now()) return NextResponse.json({ error: { code: "validation_error", message: "Programmation invalide." } }, { status: 400 });
    const { data, error } = await createAdminClient().rpc("schedule_youtube_chart_publication", {
      p_edition_id: parsed.data.editionId, p_publish_at: parsed.data.publishAt,
      p_timezone: parsed.data.timezone, p_user_id: auth.user.id,
    });
    if (error) throw error;
    if (!data) return NextResponse.json({ error: { code: "precondition_failed", message: "Programmation refusée." } }, { status: 412 });
    return NextResponse.json({ status: "scheduled", publishAt: parsed.data.publishAt, timezone: parsed.data.timezone });
  } catch (error) {
    const safe = toSafeApiError(error);
    return NextResponse.json({ error: { code: safe.code, message: safe.message } }, { status: safe.status });
  }
}

export async function DELETE(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: { code: "forbidden", message: auth.error } }, { status: auth.status });
  try {
    const parsed = cancelSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: { code: "validation_error", message: "Paramètres invalides." } }, { status: 400 });
    const { data, error } = await createAdminClient().rpc("cancel_youtube_chart_publication", {
      p_edition_id: parsed.data.editionId, p_user_id: auth.user.id,
    });
    if (error) throw error;
    if (!data) return NextResponse.json({ error: { code: "precondition_failed", message: "Aucune programmation active." } }, { status: 412 });
    return NextResponse.json({ status: "cancelled" });
  } catch (error) {
    const safe = toSafeApiError(error);
    return NextResponse.json({ error: { code: safe.code, message: safe.message } }, { status: safe.status });
  }
}
