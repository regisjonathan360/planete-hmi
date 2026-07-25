/**
 * POST /api/admin/youtube/chart/preview
 * Aperçu du classement brouillon.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { YOUTUBE_HMI_SOURCE_KEY } from "@/lib/youtube/constants";
import { toSafeApiError } from "@/lib/youtube/api-error";

export const dynamic = "force-dynamic";

const previewSchema = z.object({
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
    const body = await request.json();
    const parsed = previewSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: "validation_error", message: "Paramètres invalides.", details: parsed.error.flatten() } },
        { status: 400 }
      );
    }

    const { periodStart, periodEnd } = parsed.data;
    const supabase = createAdminClient();

    // Trouver la source
    const { data: chartSource } = await supabase
      .from("chart_sources")
      .select("id")
      .eq("source_key", YOUTUBE_HMI_SOURCE_KEY)
      .maybeSingle();

    if (!chartSource) {
      return NextResponse.json(
        { error: { code: "precondition_failed", message: "Source de classement YouTube introuvable." } },
        { status: 412 }
      );
    }

    // Trouver l'édition
    const { data: edition, error: editionError } = await supabase
      .from("chart_editions")
      .select("id, status, period_label, validation_notes")
      .eq("chart_source_id", chartSource.id)
      .eq("period_start", periodStart)
      .eq("period_end", periodEnd)
      .maybeSingle();

    if (editionError) {
      const safe = toSafeApiError(editionError);
      return NextResponse.json({ error: { code: safe.code, message: safe.message } }, { status: safe.status });
    }
    if (!edition) {
      return NextResponse.json(
        { error: { code: "not_found", message: "Aucune édition trouvée pour cette période." } },
        { status: 404 }
      );
    }

    // Récupérer les entrées
    const { data: entries, error: entriesError } = await supabase
      .from("chart_entries")
      .select("source_position, track_id, metric_value, delta_views, delta_likes, delta_comments, total_views, eligible_video_count, raw_artist_text, raw_track_title")
      .eq("chart_edition_id", edition.id)
      .order("source_position", { ascending: true });

    if (entriesError) {
      const safe = toSafeApiError(entriesError);
      return NextResponse.json({ error: { code: safe.code, message: safe.message } }, { status: safe.status });
    }

    // Enrichir avec le titre et les artistes depuis la base
    const trackIds = (entries ?? []).map(e => e.track_id as string).filter(Boolean);
    const trackMeta = new Map<string, { title: string; artists: string }>();

    if (trackIds.length > 0) {
      const { data: tracks } = await supabase
        .from("tracks")
        .select("id, title, track_artists(artists(name))")
        .in("id", trackIds);

      if (tracks) {
        for (const t of tracks) {
          const trackArtists = (t.track_artists as Array<{ artists: unknown }>) ?? [];
          const artists = trackArtists
            .map(ta => ((ta.artists as { name: string } | null)?.name))
            .filter(Boolean)
            .join(", ");
          trackMeta.set(t.id as string, { title: t.title as string, artists: artists || "Inconnu" });
        }
      }
    }

    const preview = (entries ?? []).map((entry) => {
      const meta = trackMeta.get(entry.track_id as string);
      return {
        rank: entry.source_position,
        trackId: entry.track_id,
        title: meta?.title ?? entry.raw_track_title ?? "",
        artists: meta?.artists ?? entry.raw_artist_text ?? "",
        weeklyViews: entry.delta_views ?? entry.metric_value,
        weeklyLikes: entry.delta_likes,
        weeklyComments: entry.delta_comments,
        totalViews: entry.total_views,
        eligibleVideoCount: entry.eligible_video_count,
      };
    });

    return NextResponse.json({
      editionId: edition.id,
      editionStatus: edition.status,
      periodLabel: edition.period_label,
      validationNotes: edition.validation_notes,
      entries: preview,
    });
  } catch (err) {
    const safe = toSafeApiError(err);
    return NextResponse.json({ error: { code: safe.code, message: safe.message } }, { status: safe.status });
  }
}
