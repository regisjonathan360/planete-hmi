/**
 * Orchestrateur de collecte YouTube (K3 v3)
 *
 * Fencing token : chaque écriture passe par fencedUpdate qui valide
 * owner_token + lease non expiré + lease non libéré.
 *
 * Acquisition atomique : le SQL crée le sync_run ET acquiert le lease
 * en une seule transaction. Pas de fenêtre sync_run_id = NULL.
 *
 * Lease-lost detection : si renewLease retourne false → arrêt immédiat.
 * Progression monotone bornée 0-100.
 * Annulation persistée via cancel_requested sur le lease.
 */
import "server-only";

import { randomUUID } from "node:crypto";
import { YOUTUBE_HMI_SOURCE_KEY } from "./constants";
import type { YouTubeCollectionStatus } from "./types";

// ============================================================
// Types
// ============================================================

export interface OrchestratorStep {
  name: string;
  execute: (ctx: StepContext) => Promise<StepResult>;
}

export interface StepContext {
  runId: string;
  sourceKey: string;
  periodStart: string;
  periodEnd: string;
  /** Vérifie l'annulation en relisant la base (async). */
  isCancellationRequested: () => Promise<boolean>;
  addWarning: (msg: string) => void;
  updateProgress: (percent: number, step: string) => Promise<void>;
}

export interface StepResult {
  recordsReceived?: number;
  recordsNormalized?: number;
  recordsMatched?: number;
  recordsRejected?: number;
}

export interface OrchestratorConfig {
  sourceKey?: string;
  periodStart: string;
  periodEnd: string;
  steps: OrchestratorStep[];
  heartbeatIntervalMs?: number;
  leaseDurationSeconds?: number;
}

export interface OrchestratorResult {
  runId: string;
  status: YouTubeCollectionStatus;
  warnings: string[];
  error: string | null;
  startedAt: string;
  finishedAt: string | null;
}

export interface OrchestratorMetadata {
  sourceKey: string;
  periodStart: string;
  periodEnd: string;
  progressPercent: number;
  currentStep: string | null;
  warnings: string[];
  heartbeatAt: string;
  cancelRequested: boolean;
  stepsCompleted: string[];
  counters: { received: number; normalized: number; matched: number; rejected: number };
}

export interface SyncRunPatch {
  status?: string;
  finished_at?: string;
  error_code?: string | null;
  error_message?: string | null;
  records_received?: number;
  records_normalized?: number;
  records_matched?: number;
  records_rejected?: number;
  metadata?: OrchestratorMetadata;
}

export interface LeaseAcquisitionResult {
  acquired: boolean;
  runId: string | null;
  ownerToken: string | null;
  leaseExpiresAt: string | null;
}

/** Abstraction du storage pour tester sans Supabase */
export interface OrchestratorStorage {
  acquireLease(sourceKey: string, periodKey: string, ownerToken: string, leaseDurationSeconds: number, chartSourceId: string | null): Promise<LeaseAcquisitionResult>;
  renewLease(sourceKey: string, periodKey: string, ownerToken: string, leaseDurationSeconds: number): Promise<boolean>;
  releaseLease(sourceKey: string, periodKey: string, ownerToken: string): Promise<boolean>;
  fencedUpdate(sourceKey: string, periodKey: string, ownerToken: string, runId: string, patch: SyncRunPatch): Promise<boolean>;
  requestCancellation(sourceKey: string, periodKey: string): Promise<boolean>;
  readCancellationFlag(sourceKey: string, periodKey: string, ownerToken: string): Promise<boolean>;
  getChartSourceId(sourceKey: string): Promise<string | null>;
}

// ============================================================
// Constants & Validation
// ============================================================

const DEFAULT_HEARTBEAT_MS = 30_000;
const DEFAULT_LEASE_SECONDS = 300;
const MIN_LEASE_SECONDS = 10;
const MAX_LEASE_SECONDS = 3600;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function validateConfig(config: OrchestratorConfig): void {
  if (!ISO_DATE_RE.test(config.periodStart)) throw new Error("periodStart invalide (YYYY-MM-DD).");
  if (!ISO_DATE_RE.test(config.periodEnd)) throw new Error("periodEnd invalide (YYYY-MM-DD).");

  // Real calendar date validation (check roundtrip)
  const start = new Date(config.periodStart + "T00:00:00Z");
  const end = new Date(config.periodEnd + "T00:00:00Z");
  if (isNaN(start.getTime()) || start.toISOString().slice(0, 10) !== config.periodStart) {
    throw new Error("periodStart n'est pas une date calendaire valide.");
  }
  if (isNaN(end.getTime()) || end.toISOString().slice(0, 10) !== config.periodEnd) {
    throw new Error("periodEnd n'est pas une date calendaire valide.");
  }
  if (start >= end) throw new Error("periodStart doit être < periodEnd.");

  if (config.steps.length === 0) throw new Error("Au moins une étape requise.");

  const names = new Set<string>();
  for (const step of config.steps) {
    const trimmed = step.name.trim();
    if (!trimmed || trimmed.length > 100) throw new Error(`Nom d'étape invalide : "${step.name}".`);
    if (names.has(trimmed)) throw new Error(`Nom d'étape dupliqué : "${trimmed}".`);
    names.add(trimmed);
  }

  const lease = config.leaseDurationSeconds ?? DEFAULT_LEASE_SECONDS;
  if (lease < MIN_LEASE_SECONDS || lease > MAX_LEASE_SECONDS) {
    throw new Error(`leaseDurationSeconds doit être entre ${MIN_LEASE_SECONDS} et ${MAX_LEASE_SECONDS}.`);
  }

  const heartbeat = config.heartbeatIntervalMs ?? DEFAULT_HEARTBEAT_MS;
  if (heartbeat <= 0) throw new Error("heartbeatIntervalMs doit être positif.");
  if (heartbeat >= lease * 1000) throw new Error("heartbeatIntervalMs doit être inférieur à leaseDurationSeconds * 1000.");
}

// ============================================================
// Orchestrator
// ============================================================

export class YouTubeCollectionOrchestrator {
  private readonly ownerToken = randomUUID();
  private warnings: string[] = [];
  private progressPercent = 0;
  private currentStep: string | null = null;
  private stepsCompleted: string[] = [];
  private counters = { received: 0, normalized: 0, matched: 0, rejected: 0 };
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private cancelled = false;
  private leaseLost = false;

  constructor(
    private readonly config: OrchestratorConfig,
    private readonly storage: OrchestratorStorage
  ) {
    validateConfig(config);
  }

  get sourceKey(): string { return this.config.sourceKey ?? YOUTUBE_HMI_SOURCE_KEY; }
  get periodKey(): string { return `${this.config.periodStart}::${this.config.periodEnd}`; }
  get leaseDuration(): number { return this.config.leaseDurationSeconds ?? DEFAULT_LEASE_SECONDS; }

  /** Demande annulation locale (utile dans les tests). */
  requestCancel(): void { this.cancelled = true; }

  /** Exécute le cycle complet. */
  async run(): Promise<OrchestratorResult> {
    // 1. Résoudre le chart_source_id
    const chartSourceId = await this.storage.getChartSourceId(this.sourceKey);

    // 2. Acquisition atomique (crée le sync_run + lease)
    const leaseResult = await this.storage.acquireLease(
      this.sourceKey, this.periodKey, this.ownerToken, this.leaseDuration, chartSourceId
    );

    if (!leaseResult.acquired) {
      return {
        runId: leaseResult.runId ?? "",
        status: "RUNNING" as YouTubeCollectionStatus,
        warnings: ["Verrou de collecte actif par un autre processus."],
        error: null,
        startedAt: new Date().toISOString(),
        finishedAt: null,
      };
    }

    // Acquisition réussie → le runId est garanti
    const runId = leaseResult.runId!;
    const startedAt = new Date().toISOString();

    // try/finally : en cas d'erreur inattendue, libérer le lease
    try {
      return await this.executeRun(runId, startedAt);
    } catch (err) {
      // Erreur inattendue avant/pendant l'exécution
      const errMsg = err instanceof Error ? err.message : "Erreur interne inattendue";
      // Tenter une écriture fencée pour marquer FAILED
      await this.safeFencedUpdate(runId, {
        status: "FAILED",
        finished_at: new Date().toISOString(),
        error_code: "internal_error",
        error_message: errMsg,
        metadata: this.buildMetadata(),
      });
      return {
        runId,
        status: "FAILED" as YouTubeCollectionStatus,
        warnings: [...this.warnings],
        error: errMsg,
        startedAt,
        finishedAt: new Date().toISOString(),
      };
    } finally {
      this.stopHeartbeat();
      await this.safeRelease();
    }
  }

  private async executeRun(runId: string, startedAt: string): Promise<OrchestratorResult> {
    // Marquer RUNNING via fenced update
    await this.fencedWrite(runId, { status: "RUNNING", metadata: this.buildMetadata() });

    // Démarrer heartbeat
    this.startHeartbeat();

    // Exécuter les étapes
    const totalSteps = this.config.steps.length;

    for (let i = 0; i < totalSteps; i++) {
      const step = this.config.steps[i];

      // Vérifier lease_lost
      if (this.leaseLost) {
        return {
          runId,
          status: "FAILED" as YouTubeCollectionStatus,
          warnings: [...this.warnings],
          error: "lease_lost",
          startedAt,
          finishedAt: new Date().toISOString(),
        };
      }

      // Vérifier annulation (locale + persistée)
      if (await this.checkCancelled()) {
        return await this.finalize(runId, "CANCELLED", null, startedAt);
      }

      // Skip étapes déjà complétées (reprise)
      if (this.stepsCompleted.includes(step.name)) continue;

      // Progression monotone
      const targetPercent = Math.round((i / totalSteps) * 100);
      this.setProgress(targetPercent, step.name);
      await this.fencedWrite(runId, {
        records_received: this.counters.received,
        records_normalized: this.counters.normalized,
        records_matched: this.counters.matched,
        records_rejected: this.counters.rejected,
        metadata: this.buildMetadata(),
      });

      // Exécuter l'étape
      const ctx: StepContext = {
        runId,
        sourceKey: this.sourceKey,
        periodStart: this.config.periodStart,
        periodEnd: this.config.periodEnd,
        isCancellationRequested: async () => {
          return await this.checkCancelled();
        },
        addWarning: (msg) => { this.warnings.push(msg); },
        updateProgress: async (p, s) => {
          this.setProgress(p, s);
          if (this.leaseLost) return;
          await this.fencedWrite(runId, {
            records_received: this.counters.received,
            records_normalized: this.counters.normalized,
            records_matched: this.counters.matched,
            records_rejected: this.counters.rejected,
            metadata: this.buildMetadata(),
          });
        },
      };

      try {
        const result = await step.execute(ctx);
        if (this.leaseLost) {
          return {
            runId,
            status: "FAILED" as YouTubeCollectionStatus,
            warnings: [...this.warnings],
            error: "lease_lost",
            startedAt,
            finishedAt: new Date().toISOString(),
          };
        }
        this.counters.received += result.recordsReceived ?? 0;
        this.counters.normalized += result.recordsNormalized ?? 0;
        this.counters.matched += result.recordsMatched ?? 0;
        this.counters.rejected += result.recordsRejected ?? 0;
        this.stepsCompleted.push(step.name);
        await this.fencedWrite(runId, {
          records_received: this.counters.received,
          records_normalized: this.counters.normalized,
          records_matched: this.counters.matched,
          records_rejected: this.counters.rejected,
          metadata: this.buildMetadata(),
        });
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : "Erreur inconnue";
        return await this.finalize(runId, "FAILED", errMsg, startedAt);
      }
    }

    // Succès
    this.setProgress(100, null);
    const finalStatus: YouTubeCollectionStatus = this.warnings.length > 0
      ? "COMPLETED_WITH_WARNINGS" : "COMPLETED";
    return await this.finalize(runId, finalStatus, null, startedAt);
  }

  // ============================================================
  // Private
  // ============================================================

  private setProgress(percent: number, step: string | null): void {
    const clamped = Math.max(0, Math.min(100, percent));
    // Monotone : ne jamais descendre
    if (clamped > this.progressPercent) this.progressPercent = clamped;
    if (step !== null) this.currentStep = step;
  }

  private buildMetadata(): OrchestratorMetadata {
    return {
      sourceKey: this.sourceKey,
      periodStart: this.config.periodStart,
      periodEnd: this.config.periodEnd,
      progressPercent: this.progressPercent,
      currentStep: this.currentStep,
      warnings: [...this.warnings],
      heartbeatAt: new Date().toISOString(),
      cancelRequested: this.cancelled,
      stepsCompleted: [...this.stepsCompleted],
      counters: { ...this.counters },
    };
  }

  /** Écriture fencée – lance une erreur si le lease est perdu */
  private async fencedWrite(runId: string, patch: SyncRunPatch): Promise<void> {
    if (this.leaseLost) return; // Ne pas tenter d'écrire si on sait déjà
    const ok = await this.storage.fencedUpdate(
      this.sourceKey, this.periodKey, this.ownerToken, runId, patch
    );
    if (!ok) {
      this.leaseLost = true;
    }
  }

  /** Écriture fencée safe (ne lance pas) */
  private async safeFencedUpdate(runId: string, patch: SyncRunPatch): Promise<void> {
    try {
      await this.storage.fencedUpdate(
        this.sourceKey, this.periodKey, this.ownerToken, runId, patch
      );
    } catch { /* non-fatal */ }
  }

  private async checkCancelled(): Promise<boolean> {
    if (this.cancelled) return true;
    if (this.leaseLost) return false; // Ne pas lire si lease perdu
    try {
      const persisted = await this.storage.readCancellationFlag(
        this.sourceKey, this.periodKey, this.ownerToken
      );
      if (persisted) this.cancelled = true;
    } catch { /* non-fatal */ }
    return this.cancelled;
  }

  private async finalize(
    runId: string, status: string, error: string | null, startedAt: string
  ): Promise<OrchestratorResult> {
    if (this.leaseLost) {
      // Ne pas finaliser si le lease est perdu
      return {
        runId,
        status: "FAILED" as YouTubeCollectionStatus,
        warnings: [...this.warnings],
        error: "lease_lost",
        startedAt,
        finishedAt: new Date().toISOString(),
      };
    }
    this.currentStep = null;
    if (status === "COMPLETED" || status === "COMPLETED_WITH_WARNINGS") this.progressPercent = 100;
    await this.fencedWrite(runId, {
      status,
      finished_at: new Date().toISOString(),
      error_message: error,
      error_code: error ? "step_failure" : null,
      records_received: this.counters.received,
      records_normalized: this.counters.normalized,
      records_matched: this.counters.matched,
      records_rejected: this.counters.rejected,
      metadata: this.buildMetadata(),
    });
    return {
      runId,
      status: status as YouTubeCollectionStatus,
      warnings: [...this.warnings],
      error,
      startedAt,
      finishedAt: new Date().toISOString(),
    };
  }

  private startHeartbeat(): void {
    const ms = this.config.heartbeatIntervalMs ?? DEFAULT_HEARTBEAT_MS;
    this.heartbeatTimer = setInterval(async () => {
      try {
        const renewed = await this.storage.renewLease(
          this.sourceKey, this.periodKey, this.ownerToken, this.leaseDuration
        );
        if (!renewed) {
          this.leaseLost = true;
        }
      } catch { /* non-fatal */ }
    }, ms);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private async safeRelease(): Promise<void> {
    try {
      await this.storage.releaseLease(this.sourceKey, this.periodKey, this.ownerToken);
    } catch { /* non-fatal, résultat déjà finalisé */ }
  }
}
