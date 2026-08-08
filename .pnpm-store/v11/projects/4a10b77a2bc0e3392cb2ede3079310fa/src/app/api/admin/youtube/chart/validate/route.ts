import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { YOUTUBE_HMI_SOURCE_KEY } from "@/lib/youtube/constants";
import { toSafeApiError } from "@/lib/youtube/api-error";

export const dynamic = "force-dynamic";

const validateSchema = z.object({
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide."),
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide."),
});

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json(
      { error: { code: auth.status === 401 ? "unauthorized" : "forbidden", message: auth.error } },
      { status: auth.status }
    );
  }

  try {
    const parsed = validateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: "validation_error", message: "Paramètres invalides." } },
        { status: 400 }
      );
    }

    const { periodStart, periodEnd } = parsed.data;
    const supabase = createAdminClient();
    const { data: chartSource, error: sourceError } = await supabase
      .from("chart_sources")
      .select("id")
      .eq("source_key", YOUTUBE_HMI_SOURCE_KEY)
      .maybeSingle();
    if (sourceError) throw sourceError;
    if (!chartSource) {
      return NextResponse.json(
        { error: { code: "precondition_failed", message: "Source de classement YouTube introuvable." } },
        { status: 412 }
      );
    }

    const { data: edition, error: editionError } = await supabase
      .from("chart_editions")
      .select("id, status")
      .eq("chart_source_id", chartSource.id)
      .eq("period_start", periodStart)
      .eq("period_end", periodEnd)
      .maybeSingle();
    if (editionError) throw editionError;
    if (!edition) {
      return NextResponse.json(
        { error: { code: "not_found", message: "Aucune édition trouvée pour cette période." } },
        { status: 404 }
      );
    }

    const { data: entries, error: entriesError } = await supabase
      .from("chart_entries")
      .select("youtube_video_id, raw_track_title, delta_views, is_hidden, is_excluded, youtube_videos(id, video_id, published_at, review_status, is_eligible, is_active)")
      .eq("chart_edition_id", edition.id)
      .order("source_position", { ascending: true });
    if (entriesError) throw entriesError;
    if (!entries?.length) {
      return NextResponse.json(
        { error: { code: "not_found", message: "Aucune vidéo dans ce brouillon." } },
        { status: 404 }
      );
    }

    const visibleEntries = entries.filter((entry) => !entry.is_hidden && !entry.is_excluded);
    const videoIds = visibleEntries
      .map((entry) => entry.youtube_video_id as string | null)
      .filter((id): id is string => Boolean(id));
    const { data: endSnapshots, error: snapshotError } = videoIds.length
      ? await supabase.rpc("get_latest_snapshots_before", {
          p_video_ids: videoIds,
          p_before_or_at: periodEnd,
        })
      : { data: [], error: null };
    if (snapshotError) throw snapshotError;
    const endSnapshotIds = new Set((endSnapshots ?? []).map((item: { youtube_video_id: string }) => item.youtube_video_id));

    const blockingErrors: string[] = [];
    const warnings: string[] = [];
    for (const entry of visibleEntries) {
      const video = (Array.isArray(entry.youtube_videos) ? entry.youtube_videos[0] : entry.youtube_videos) as {
        id?: string;
        video_id?: string;
        review_status?: string;
        is_eligible?: boolean;
        is_active?: boolean;
      } | null;
      const label = entry.raw_track_title || video?.video_id || "Vidéo sans titre";
      if (!entry.youtube_video_id || !video) {
        blockingErrors.push(`${label} : vidéo source introuvable.`);
        continue;
      }
      if (video.review_status !== "APPROVED") blockingErrors.push(`${label} : vidéo non approuvée.`);
      if (!video.is_eligible) blockingErrors.push(`${label} : vidéo retirée du calcul.`);
      if (!video.is_active) blockingErrors.push(`${label} : vidéo inactive.`);
      if (!endSnapshotIds.has(entry.youtube_video_id as string)) blockingErrors.push(`${label} : relevé de fin manquant.`);
      if (entry.delta_views == null) blockingErrors.push(`${label} : vues hebdomadaires manquantes.`);
    }

    if (visibleEntries.length > 20) blockingErrors.push("Le brouillon contient plus de 20 vidéos visibles.");
    if (visibleEntries.length === 0) blockingErrors.push("Le brouillon ne contient aucune vidéo visible.");

    return NextResponse.json({
      valid: blockingErrors.length === 0,
      blockingErrors,
      warnings,
      editionId: edition.id,
      editionStatus: edition.status,
      entryCount: visibleEntries.length,
    });
  } catch (error) {
    const safe = toSafeApiError(error);
    return NextResponse.json({ error: { code: safe.code, message: safe.message } }, { status: safe.status });
  }
}
