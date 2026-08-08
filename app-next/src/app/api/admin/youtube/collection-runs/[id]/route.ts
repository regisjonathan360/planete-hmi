/**
 * GET /api/admin/youtube/collection-runs/[id]
 * Récupère le détail d'un sync_run YouTube.
 * Valide l'UUID, vérifie que le run appartient à la source youtube_hmi_weekly_delta.
 * Ne renvoie jamais owner_token ni metadata sensible.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { YOUTUBE_HMI_SOURCE_KEY } from "@/lib/youtube/constants";
import { toSafeApiError } from "@/lib/youtube/api-error";

export const dynamic = "force-dynamic";

const uuidSchema = z.string().uuid("Identifiant invalide.");

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json(
      { error: { code: auth.status === 401 ? "unauthorized" : "forbidden", message: auth.error } },
      { status: auth.status }
    );
  }

  const { id } = await params;
  const idParsed = uuidSchema.safeParse(id);
  if (!idParsed.success) {
    return NextResponse.json(
      { error: { code: "validation_error", message: "Identifiant de run invalide." } },
      { status: 400 }
    );
  }

  try {
    const supabase = createAdminClient();

    // Récupérer uniquement les colonnes nécessaires
    const { data, error } = await supabase
      .from("sync_runs")
      .select("id, chart_source_id, run_type, status, started_at, finished_at, records_received, records_normalized, records_matched, records_rejected, metadata")
      .eq("id", idParsed.data)
      .maybeSingle();

    if (error) {
      const safe = toSafeApiError(error);
      return NextResponse.json({ error: { code: safe.code, message: safe.message } }, { status: safe.status });
    }
    if (!data) {
      return NextResponse.json(
        { error: { code: "not_found", message: "Run introuvable." } },
        { status: 404 }
      );
    }

    // Vérifier que le run appartient à la source YouTube
    const { data: source } = await supabase
      .from("chart_sources")
      .select("source_key")
      .eq("id", data.chart_source_id)
      .maybeSingle();

    if (!source || (source.source_key !== YOUTUBE_HMI_SOURCE_KEY)) {
      return NextResponse.json(
        { error: { code: "not_found", message: "Run introuvable pour la source YouTube." } },
        { status: 404 }
      );
    }

    // Sanitize metadata: remove sensitive fields
    const metadata = data.metadata as Record<string, unknown> | null;
    const safeMetadata = metadata ? {
      progressPercent: metadata.progressPercent,
      currentStep: metadata.currentStep,
      stepsCompleted: metadata.stepsCompleted,
      counters: metadata.counters,
      cancelRequested: metadata.cancelRequested,
      periodStart: metadata.periodStart,
      periodEnd: metadata.periodEnd,
      warningsCount: Array.isArray(metadata.warnings) ? metadata.warnings.length : 0,
    } : null;

    return NextResponse.json({
      id: data.id,
      status: data.status,
      startedAt: data.started_at,
      finishedAt: data.finished_at,
      recordsReceived: data.records_received,
      recordsNormalized: data.records_normalized,
      recordsMatched: data.records_matched,
      recordsRejected: data.records_rejected,
      metadata: safeMetadata,
    });
  } catch (err) {
    const safe = toSafeApiError(err);
    return NextResponse.json({ error: { code: safe.code, message: safe.message } }, { status: safe.status });
  }
}
