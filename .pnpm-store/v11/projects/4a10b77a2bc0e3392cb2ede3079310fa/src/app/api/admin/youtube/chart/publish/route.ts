import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { toSafeApiError } from "@/lib/youtube/api-error";
import { buildYouTubePublication, YOUTUBE_CHART_METHODOLOGY } from "@/lib/youtube/publication";

const schema = z.object({
  editionId: z.string().uuid(),
  methodology: z.string().trim().min(10).max(2000).optional(),
});

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: { code: "forbidden", message: auth.error } }, { status: auth.status });
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: { code: "validation_error", message: "Paramètres invalides." } }, { status: 400 });
    const supabase = createAdminClient();
    const material = await buildYouTubePublication(supabase, parsed.data.editionId);
    const { data, error } = await supabase.rpc("publish_youtube_chart", {
      p_edition_id: parsed.data.editionId,
      p_payload: material.payload,
      p_editable_state: material.editableState,
      p_methodology: parsed.data.methodology ?? YOUTUBE_CHART_METHODOLOGY,
      p_published_by: auth.user.id,
      p_restored_from_publication_id: null,
    });
    if (error) throw error;
    const result = Array.isArray(data) ? data[0] : data;
    if (!result?.success) return NextResponse.json({ error: { code: result?.message ?? "publication_failed", message: "La publication a été refusée." } }, { status: 412 });
    revalidatePath("/charts");
    revalidatePath("/charts/youtube");
    return NextResponse.json({ status: "published", publicationId: result.publication_id, version: result.version });
  } catch (error) {
    const safe = toSafeApiError(error);
    return NextResponse.json({ error: { code: safe.code, message: safe.message } }, { status: safe.status });
  }
}
