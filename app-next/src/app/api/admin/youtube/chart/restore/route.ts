import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { YOUTUBE_HMI_SOURCE_KEY } from "@/lib/youtube/constants";
import { toSafeApiError } from "@/lib/youtube/api-error";

const schema = z.object({ publicationId: z.string().uuid() });

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: { code: "forbidden", message: auth.error } }, { status: auth.status });
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: { code: "validation_error", message: "Paramètres invalides." } }, { status: 400 });
    const supabase = createAdminClient();
    const { data: publication, error: loadError } = await supabase
      .from("youtube_chart_publications")
      .select("id, chart_edition_id, payload, editable_state, methodology, chart_sources!inner(source_key)")
      .eq("id", parsed.data.publicationId)
      .eq("chart_sources.source_key", YOUTUBE_HMI_SOURCE_KEY)
      .maybeSingle();
    if (loadError) throw loadError;
    if (!publication) return NextResponse.json({ error: { code: "not_found", message: "Publication introuvable." } }, { status: 404 });
    const { data, error } = await supabase.rpc("publish_youtube_chart", {
      p_edition_id: publication.chart_edition_id,
      p_payload: publication.payload,
      p_editable_state: publication.editable_state,
      p_methodology: publication.methodology,
      p_published_by: auth.user.id,
      p_restored_from_publication_id: publication.id,
    });
    if (error) throw error;
    const result = Array.isArray(data) ? data[0] : data;
    if (!result?.success) return NextResponse.json({ error: { code: result?.message ?? "restore_failed", message: "La restauration a été refusée." } }, { status: 412 });
    revalidatePath("/charts");
    revalidatePath("/charts/youtube");
    return NextResponse.json({ status: "restored", publicationId: result.publication_id, version: result.version });
  } catch (error) {
    const safe = toSafeApiError(error);
    return NextResponse.json({ error: { code: safe.code, message: safe.message } }, { status: safe.status });
  }
}
