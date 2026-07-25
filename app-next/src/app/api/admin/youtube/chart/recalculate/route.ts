/**
 * POST /api/admin/youtube/chart/recalculate
 * Recalcule le brouillon du Top YouTube HMI avec un vrai lease K3.
 *
 * Correction K6 v2 :
 * - Même clé advisory que acquire_sync_lease (pas de ::recalc::)
 * - Vérifie chaque retour de fencedUpdate → LeaseLostError si false
 * - Finalise FAILED avec code/message sanitisés si échec pendant lease valide
 * - Finalise CANCELLED si annulation persistée détectée
 * - Ne retourne jamais success:true si l'écriture finale fencée est refusée
 * - Lease libéré dans finally sans masquer l'erreur principale
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/charts/audit";
import { YOUTUBE_HMI_SOURCE_KEY } from "@/lib/youtube/constants";
import { createSnapshotStorage } from "@/lib/youtube/snapshot-supabase-storage";
import { ComputeDraftService } from "@/lib/youtube/snapshot-service";
import { LeaseLostError, CancellationRequestedError } from "@/lib/youtube/orchestrator";
import { createOrchestratorStorage } from "@/lib/youtube/orchestrator-storage";
import { toSafeApiError, sanitizeErrorMessage } from "@/lib/youtube/api-error";
import type { StepContext } from "@/lib/youtube/orchestrator";

export const dynamic = "force-dynamic";

const recalculateSchema = z.object({
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide (YYYY-MM-DD)."),
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide (YYYY-MM-DD)."),
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
    const parsed = recalculateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: "validation_error", message: "Paramètres invalides.", details: parsed.error.flatten() } },
        { status: 400 }
      );
    }

    const { periodStart, periodEnd } = parsed.data;

    if (Date.parse(periodStart) >= Date.parse(periodEnd)) {
      return NextResponse.json(
        { error: { code: "validation_error", message: "La date de fin doit être postérieure à la date de début." } },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();
    const periodKey = `${periodStart}::${periodEnd}`;

    // Récupérer le chart_source_id — vérifier erreur explicitement
    const { data: chartSource, error: sourceError } = await supabase
      .from("chart_sources")
      .select("id")
      .eq("source_key", YOUTUBE_HMI_SOURCE_KEY)
      .maybeSingle();

    if (sourceError) {
      const safe = toSafeApiError(sourceError);
      return NextResponse.json({ error: { code: safe.code, message: safe.message } }, { status: safe.status });
    }
    if (!chartSource) {
      return NextResponse.json(
        { error: { code: "precondition_failed", message: "Source de classement YouTube introuvable." } },
        { status: 412 }
      );
    }

    const chartSourceId = chartSource.id as string;

    // Vérifier qu'il n'y a pas d'édition publiée/archivée
    const { data: existingEdition, error: editionError } = await supabase
      .from("chart_editions")
      .select("id, status")
      .eq("chart_source_id", chartSourceId)
      .eq("period_start", periodStart)
      .eq("period_end", periodEnd)
      .in("status", ["published", "archived"])
      .maybeSingle();

    if (editionError) {
      const safe = toSafeApiError(editionError);
      return NextResponse.json({ error: { code: safe.code, message: safe.message } }, { status: safe.status });
    }
    if (existingEdition) {
      return NextResponse.json(
        { error: { code: "conflict", message: "Impossible de recalculer une édition déjà publiée ou archivée." } },
        { status: 409 }
      );
    }

    // Acquérir un VRAI lease (même clé advisory que collecte normale)
    const ownerToken = randomUUID();
    const { data: leaseData, error: leaseError } = await supabase.rpc("acquire_recalculate_lease", {
      p_source_key: YOUTUBE_HMI_SOURCE_KEY,
      p_period_key: periodKey,
      p_owner_token: ownerToken,
      p_lease_duration_seconds: 120,
      p_chart_source_id: chartSourceId,
    });

    if (leaseError) {
      const safe = toSafeApiError(leaseError);
      return NextResponse.json({ error: { code: safe.code, message: safe.message } }, { status: safe.status });
    }

    const lease = Array.isArray(leaseData) ? leaseData[0] : leaseData;
    if (!lease?.acquired) {
      return NextResponse.json(
        { error: { code: "conflict", message: "Un autre processus détient le verrou pour cette période." } },
        { status: 409 }
      );
    }

    const runId = lease.run_id as string;
    const orchestratorStorage = createOrchestratorStorage();
    let leaseLost = false;

    try {
      const snapshotStorage = createSnapshotStorage();
      const service = new ComputeDraftService(snapshotStorage, { chartSourceId });

      const warnings: string[] = [];
      const ctx: StepContext = {
        runId,
        sourceKey: YOUTUBE_HMI_SOURCE_KEY,
        periodKey,
        periodStart,
        periodEnd,
        ownerToken,
        isCancellationRequested: async () => {
          return orchestratorStorage.readCancellationFlag(YOUTUBE_HMI_SOURCE_KEY, periodKey, ownerToken);
        },
        assertActive: async () => {
          const renewed = await orchestratorStorage.renewLease(
            YOUTUBE_HMI_SOURCE_KEY, periodKey, ownerToken, 120
          );
          if (!renewed) {
            leaseLost = true;
            throw new LeaseLostError("Lease perdu pendant le recalcul.");
          }
          // Check cancellation
          const cancelled = await orchestratorStorage.readCancellationFlag(
            YOUTUBE_HMI_SOURCE_KEY, periodKey, ownerToken
          );
          if (cancelled) {
            throw new CancellationRequestedError();
          }
        },
        addWarning: (msg) => { warnings.push(msg); },
        updateProgress: async (percent, step) => {
          const ok = await orchestratorStorage.fencedUpdate(
            YOUTUBE_HMI_SOURCE_KEY, periodKey, ownerToken, runId,
            { metadata: { sourceKey: YOUTUBE_HMI_SOURCE_KEY, periodStart, periodEnd, progressPercent: percent, currentStep: step, warnings, heartbeatAt: new Date().toISOString(), cancelRequested: false, stepsCompleted: [], counters: { received: 0, normalized: 0, matched: 0, rejected: 0 } } }
          );
          if (!ok) {
            leaseLost = true;
            throw new LeaseLostError("Lease perdu pendant updateProgress.");
          }
        },
      };

      const result = await service.execute(ctx);

      // Finaliser le run — vérifier le retour de fencedUpdate
      const finalStatus = warnings.length > 0 ? "COMPLETED_WITH_WARNINGS" : "COMPLETED";
      const finalOk = await orchestratorStorage.fencedUpdate(
        YOUTUBE_HMI_SOURCE_KEY, periodKey, ownerToken, runId,
        { status: finalStatus, finished_at: new Date().toISOString() }
      );
      if (!finalOk) {
        // Le lease a été perdu juste avant la finalisation — ne pas retourner success
        leaseLost = true;
        return NextResponse.json(
          { error: { code: "precondition_failed", message: "Opération interrompue : le verrou a été perdu avant la finalisation." } },
          { status: 412 }
        );
      }

      await logAudit(supabase, {
        userId: auth.user.id,
        action: "youtube_chart_recalculate",
        entityType: "chart_edition",
        entityId: null,
        newValue: { periodStart, periodEnd, tracksRanked: result.recordsNormalized, runId },
      });

      return NextResponse.json({
        success: true,
        runId,
        periodStart,
        periodEnd,
        tracksRanked: result.recordsNormalized,
        warnings,
      });
    } catch (err) {
      // Si le lease est perdu, l'ancien propriétaire ne finalise rien
      if (leaseLost || err instanceof LeaseLostError) {
        return NextResponse.json(
          { error: { code: "precondition_failed", message: "Opération interrompue : le verrou a été perdu." } },
          { status: 412 }
        );
      }

      // Annulation persistée → CANCELLED
      if (err instanceof CancellationRequestedError) {
        const cancelledOk = await orchestratorStorage.fencedUpdate(
          YOUTUBE_HMI_SOURCE_KEY, periodKey, ownerToken, runId,
          { status: "CANCELLED", finished_at: new Date().toISOString() }
        ).catch(() => false);
        if (!cancelledOk) {
          leaseLost = true;
          return NextResponse.json(
            { error: { code: "precondition_failed", message: "Annulation non persistée : le verrou a été perdu." } },
            { status: 412 }
          );
        }
        return NextResponse.json(
          { error: { code: "precondition_failed", message: "Recalcul annulé." } },
          { status: 412 }
        );
      }

      // Erreur métier pendant que le lease est valide → finaliser FAILED
      const errMsg = err instanceof Error ? sanitizeErrorMessage(err.message) : "Erreur interne";
      const failedOk = await orchestratorStorage.fencedUpdate(
        YOUTUBE_HMI_SOURCE_KEY, periodKey, ownerToken, runId,
        { status: "FAILED", finished_at: new Date().toISOString(), error_code: "recalculate_error", error_message: errMsg }
      ).catch(() => false);
      if (!failedOk) {
        leaseLost = true;
        return NextResponse.json(
          { error: { code: "precondition_failed", message: "Échec non persisté : le verrou a été perdu." } },
          { status: 412 }
        );
      }

      const safe = toSafeApiError(err);
      return NextResponse.json({ error: { code: safe.code, message: safe.message } }, { status: safe.status });
    } finally {
      // Libérer le lease dans tous les cas — ne masque pas l'erreur principale
      if (!leaseLost) {
        await orchestratorStorage.releaseLease(YOUTUBE_HMI_SOURCE_KEY, periodKey, ownerToken).catch(() => {});
      }
    }
  } catch (err) {
    const safe = toSafeApiError(err);
    return NextResponse.json({ error: { code: safe.code, message: safe.message } }, { status: safe.status });
  }
}
