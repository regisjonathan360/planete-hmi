/**
 * POST /api/admin/youtube/collection-runs/[id]/cancel
 * Demande l'annulation d'un run YouTube en cours.
 * Valide l'UUID, vérifie que le run appartient à la source YouTube.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/charts/audit";
import { YOUTUBE_HMI_SOURCE_KEY } from "@/lib/youtube/constants";
import { createOrchestratorStorage } from "@/lib/youtube/orchestrator-storage";
import { toSafeApiError } from "@/lib/youtube/api-error";

export const dynamic = "force-dynamic";

const uuidSchema = z.string().uuid("Identifiant invalide.");

export async function POST(
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

    // Récupérer le run
    const { data: run, error: runError } = await supabase
      .from("sync_runs")
      .select("id, status, chart_source_id, metadata")
      .eq("id", idParsed.data)
      .maybeSingle();

    if (runError) {
      const safe = toSafeApiError(runError);
      return NextResponse.json({ error: { code: safe.code, message: safe.message } }, { status: safe.status });
    }
    if (!run) {
      return NextResponse.json(
        { error: { code: "not_found", message: "Run introuvable." } },
        { status: 404 }
      );
    }

    // Vérifier que le run appartient à la source YouTube
    const { data: source } = await supabase
      .from("chart_sources")
      .select("source_key")
      .eq("id", run.chart_source_id)
      .maybeSingle();

    if (!source || source.source_key !== YOUTUBE_HMI_SOURCE_KEY) {
      return NextResponse.json(
        { error: { code: "forbidden", message: "Impossible d'annuler un run d'une autre source." } },
        { status: 403 }
      );
    }

    if (run.status !== "RUNNING" && run.status !== "PENDING") {
      return NextResponse.json(
        { error: { code: "conflict", message: "Seul un run en cours ou en attente peut être annulé." } },
        { status: 409 }
      );
    }

    // Extraire le sourceKey et periodKey depuis les métadonnées
    const meta = run.metadata as { sourceKey?: string; periodStart?: string; periodEnd?: string; periodKey?: string } | null;
    const sourceKey = meta?.sourceKey ?? YOUTUBE_HMI_SOURCE_KEY;
    const periodKey = meta?.periodKey ??
      (meta?.periodStart && meta?.periodEnd ? `${meta.periodStart}::${meta.periodEnd}` : null);

    if (!periodKey) {
      return NextResponse.json(
        { error: { code: "internal_error", message: "Impossible de déterminer la période du run." } },
        { status: 500 }
      );
    }

    const orchestratorStorage = createOrchestratorStorage();
    const cancelled = await orchestratorStorage.requestCancellation(sourceKey, periodKey);

    await logAudit(supabase, {
      userId: auth.user.id,
      action: "youtube_cancel_run",
      entityType: "sync_run",
      entityId: idParsed.data,
      newValue: { cancelled },
    });

    return NextResponse.json({ success: cancelled, runId: idParsed.data });
  } catch (err) {
    const safe = toSafeApiError(err);
    return NextResponse.json({ error: { code: safe.code, message: safe.message } }, { status: safe.status });
  }
}
