import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { toSafeApiError } from "@/lib/youtube/api-error";

const schema = z.object({ editionId: z.string().uuid(), reason: z.string().trim().min(3).max(500) });

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: { code: "forbidden", message: auth.error } }, { status: auth.status });
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: { code: "validation_error", message: "Paramètres invalides." } }, { status: 400 });
    const { data, error } = await createAdminClient().rpc("create_youtube_chart_revision", {
      p_edition_id: parsed.data.editionId, p_user_id: auth.user.id, p_reason: parsed.data.reason,
    });
    if (error) throw error;
    if (!data) return NextResponse.json({ error: { code: "precondition_failed", message: "La révision ne peut pas être créée." } }, { status: 412 });
    return NextResponse.json({ status: "draft", editionId: parsed.data.editionId });
  } catch (error) {
    const safe = toSafeApiError(error);
    return NextResponse.json({ error: { code: safe.code, message: safe.message } }, { status: safe.status });
  }
}

