import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { YOUTUBE_HMI_SOURCE_KEY } from "@/lib/youtube/constants";
import { toSafeApiError } from "@/lib/youtube/api-error";

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: { code: "forbidden", message: auth.error } }, { status: auth.status });
  try {
    const supabase = createAdminClient();
    const { data: source, error: sourceError } = await supabase
      .from("chart_sources").select("id").eq("source_key", YOUTUBE_HMI_SOURCE_KEY).maybeSingle();
    if (sourceError) throw sourceError;
    if (!source) return NextResponse.json({ publications: [] });
    const { data, error } = await supabase
      .from("youtube_chart_publications")
      .select("id, chart_edition_id, version, period_start, period_end, methodology, entry_count, published_by, published_at, replaces_publication_id, restored_from_publication_id")
      .eq("chart_source_id", source.id)
      .order("version", { ascending: false });
    if (error) throw error;
    return NextResponse.json({ publications: data ?? [] });
  } catch (error) {
    const safe = toSafeApiError(error);
    return NextResponse.json({ error: { code: safe.code, message: safe.message } }, { status: safe.status });
  }
}

