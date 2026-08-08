import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { YOUTUBE_HMI_SOURCE_KEY } from "@/lib/youtube/constants";
import { buildYouTubePublication, YOUTUBE_CHART_METHODOLOGY } from "@/lib/youtube/publication";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data: source, error: sourceError } = await supabase
    .from("chart_sources").select("id").eq("source_key", YOUTUBE_HMI_SOURCE_KEY).maybeSingle();
  if (sourceError) throw sourceError;
  if (!source) return NextResponse.json({ published: 0, failed: 0 });

  const { data: editions, error } = await supabase
    .from("chart_editions")
    .select("id, scheduled_by")
    .eq("chart_source_id", source.id)
    .lte("scheduled_publish_at", new Date().toISOString())
    .in("status", ["draft", "validated", "ready"]);
  if (error) throw error;

  let published = 0;
  let failed = 0;
  for (const edition of editions ?? []) {
    try {
      if (!edition.scheduled_by) throw new Error("missing_scheduled_by");
      const material = await buildYouTubePublication(supabase, edition.id);
      const { data, error: publishError } = await supabase.rpc("publish_youtube_chart", {
        p_edition_id: edition.id,
        p_payload: material.payload,
        p_editable_state: material.editableState,
        p_methodology: YOUTUBE_CHART_METHODOLOGY,
        p_published_by: edition.scheduled_by,
        p_restored_from_publication_id: null,
      });
      if (publishError) throw publishError;
      const result = Array.isArray(data) ? data[0] : data;
      if (!result?.success) throw new Error(result?.message ?? "publication_failed");
      published++;
    } catch {
      failed++;
    }
  }
  if (published > 0) {
    revalidatePath("/charts");
    revalidatePath("/charts/youtube");
  }
  return NextResponse.json({ published, failed });
}
