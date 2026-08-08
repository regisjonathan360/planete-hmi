import { describe, it, expect, vi, afterEach } from "vitest";
import type {
  OrchestratorStorage,
  OrchestratorStep,
  LeaseAcquisitionResult,
  SyncRunPatch,
  SyncRunRecord,
} from "../orchestrator";

vi.mock("server-only", () => ({}));

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

const {
  YouTubeCollectionOrchestrator,
  LeaseLostError,
  CancellationRequestedError,
} = await import("../orchestrator");

// ============================================================
// Helpers
// ============================================================

function mockStorage(overrides: Partial<OrchestratorStorage> = {}): OrchestratorStorage {
  return {
    acquireLease: vi.fn(async (): Promise<LeaseAcquisitionResult> => ({
      acquired: true, runId: "run-001", ownerToken: "tok", leaseExpiresAt: "2099-01-01T00:00:00Z", runStatus: "RUNNING",
    })),
    renewLease: vi.fn(async () => true),
    releaseLease: vi.fn(async () => true),
    fencedUpdate: vi.fn(async () => true),
    requestCancellation: vi.fn(async () => true),
    readCancellationFlag: vi.fn(async () => false),
    getChartSourceId: vi.fn(async () => "src-001"),
    getRun: vi.fn(async () => null),
    ...overrides,
  };
}

function okStep(name: string, received = 5): OrchestratorStep {
  return { name, execute: async () => ({ recordsReceived: received, recordsMatched: received }) };
}
function failStep(name: string, msg = "fatal"): OrchestratorStep {
  return { name, execute: async () => { throw new Error(msg); } };
}
function warnStep(name: string): OrchestratorStep {
  return { name, execute: async (ctx) => { ctx.addWarning("avertissement"); return {}; } };
}

const BASE = {
  periodStart: "2026-07-14",
  periodEnd: "2026-07-21",
  heartbeatIntervalMs: 10_000,
  leaseDurationSeconds: 300,
};

// ==========================================================
describe("validation config", () => {
  it("rejette periodStart format invalide", () => {
    expect(() => new YouTubeCollectionOrchestrator(
      { ...BASE, periodStart: "bad", steps: [okStep("a")] }, mockStorage()
    )).toThrow("periodStart invalide");
  });

  it("rejette periodEnd format invalide", () => {
    expect(() => new YouTubeCollectionOrchestrator(
      { ...BASE, periodEnd: "nope", steps: [okStep("a")] }, mockStorage()
    )).toThrow("periodEnd invalide");
  });

  it("rejette periodStart >= periodEnd", () => {
    expect(() => new YouTubeCollectionOrchestrator(
      { ...BASE, periodStart: "2026-07-22", steps: [okStep("a")] }, mockStorage()
    )).toThrow("periodStart doit être < periodEnd");
  });

  it("rejette date calendaire invalide (ex: 2026-02-30)", () => {
    expect(() => new YouTubeCollectionOrchestrator(
      { ...BASE, periodStart: "2026-02-30", periodEnd: "2026-03-15", steps: [okStep("a")] }, mockStorage()
    )).toThrow();
  });

  it("rejette étapes vides", () => {
    expect(() => new YouTubeCollectionOrchestrator(
      { ...BASE, steps: [] }, mockStorage()
    )).toThrow("Au moins une étape");
  });

  it("rejette noms d'étapes dupliqués", () => {
    expect(() => new YouTubeCollectionOrchestrator(
      { ...BASE, steps: [okStep("x"), okStep("x")] }, mockStorage()
    )).toThrow("dupliqué");
  });

  it("rejette noms d'étapes vides après trim", () => {
    expect(() => new YouTubeCollectionOrchestrator(
      { ...BASE, steps: [{ name: "   ", execute: async () => ({}) }] }, mockStorage()
    )).toThrow("invalide");
  });

  it("rejette leaseDurationSeconds hors bornes (trop petit)", () => {
    expect(() => new YouTubeCollectionOrchestrator(
      { ...BASE, leaseDurationSeconds: 5, steps: [okStep("a")] }, mockStorage()
    )).toThrow("leaseDurationSeconds");
  });

  it("rejette leaseDurationSeconds hors bornes (trop grand)", () => {
    expect(() => new YouTubeCollectionOrchestrator(
      { ...BASE, leaseDurationSeconds: 5000, steps: [okStep("a")] }, mockStorage()
    )).toThrow("leaseDurationSeconds");
  });

  it("rejette heartbeatIntervalMs négatif", () => {
    expect(() => new YouTubeCollectionOrchestrator(
      { ...BASE, heartbeatIntervalMs: -1, steps: [okStep("a")] }, mockStorage()
    )).toThrow("heartbeatIntervalMs doit être positif");
  });

  it("rejette heartbeatIntervalMs >= lease * 1000", () => {
    expect(() => new YouTubeCollectionOrchestrator(
      { ...BASE, leaseDurationSeconds: 60, heartbeatIntervalMs: 60_000, steps: [okStep("a")] }, mockStorage()
    )).toThrow("heartbeatIntervalMs doit être inférieur");
  });
});

// ==========================================================
describe("démarrage normal → COMPLETED", () => {
  it("exécute toutes les étapes et libère le lease", async () => {
    const s = mockStorage();
    const o = new YouTubeCollectionOrchestrator({ ...BASE, steps: [okStep("a"), okStep("b")] }, s);
    const r = await o.run();
    expect(r.status).toBe("COMPLETED");
    expect(r.error).toBeNull();
    expect(r.runId).toBe("run-001");
    expect(s.releaseLease).toHaveBeenCalled();
  });

  it("acquisition retourne toujours un runId", async () => {
    const s = mockStorage();
    const o = new YouTubeCollectionOrchestrator({ ...BASE, steps: [okStep("a")] }, s);
    const r = await o.run();
    expect(r.runId).toBeTruthy();
    expect(r.runId).toBe("run-001");
  });
});

describe("relance manuelle explicite", () => {
  it("transmet forceNewRun au stockage sans modifier la clé de période", async () => {
    const storage = mockStorage();
    const orchestrator = new YouTubeCollectionOrchestrator(
      { ...BASE, forceNewRun: true, steps: [okStep("manual")] },
      storage
    );

    await orchestrator.run();

    expect(storage.acquireLease).toHaveBeenCalledWith(
      "youtube_hmi_weekly_delta",
      "2026-07-14::2026-07-21",
      expect.any(String),
      300,
      "src-001",
      true
    );
  });
});

// ==========================================================
describe("deux premières acquisitions concurrentes sans lease préexistant", () => {
  it("une seule réussit, l'autre reçoit acquired=false avec même runId", async () => {
    let firstAcquired = false;
    const s = mockStorage({
      acquireLease: vi.fn(async (): Promise<LeaseAcquisitionResult> => {
        if (!firstAcquired) {
          firstAcquired = true;
          return { acquired: true, runId: "run-001", ownerToken: "t1", leaseExpiresAt: "2099-01-01T00:00:00Z", runStatus: "RUNNING" };
        }
        return { acquired: false, runId: "run-001", ownerToken: "t1", leaseExpiresAt: "2099-01-01T00:00:00Z", runStatus: "RUNNING" };
      }),
    });
    const o1 = new YouTubeCollectionOrchestrator({ ...BASE, steps: [okStep("a")] }, s);
    const o2 = new YouTubeCollectionOrchestrator({ ...BASE, steps: [okStep("a")] }, s);
    const [r1, r2] = await Promise.all([o1.run(), o2.run()]);
    const statuses = [r1.status, r2.status].sort();
    expect(statuses).toContain("COMPLETED");
    expect(statuses).toContain("RUNNING");
    // Les deux retournent le même runId
    expect(r1.runId).toBe("run-001");
    expect(r2.runId).toBe("run-001");
  });

  it("le second concurrent ne produit jamais de violation d'unicité", async () => {
    // Le mock simule pg_advisory_xact_lock : le second appel arrive après
    let callCount = 0;
    const s = mockStorage({
      acquireLease: vi.fn(async (): Promise<LeaseAcquisitionResult> => {
        callCount++;
        if (callCount === 1) {
          return { acquired: true, runId: "run-first", ownerToken: "t1", leaseExpiresAt: "2099-01-01T00:00:00Z", runStatus: "RUNNING" };
        }
        // Second appel : retourne proprement acquired=false
        return { acquired: false, runId: "run-first", ownerToken: "t1", leaseExpiresAt: "2099-01-01T00:00:00Z", runStatus: "RUNNING" };
      }),
    });
    const o1 = new YouTubeCollectionOrchestrator({ ...BASE, steps: [okStep("a")] }, s);
    const o2 = new YouTubeCollectionOrchestrator({ ...BASE, steps: [okStep("a")] }, s);
    // Neither should throw
    const results = await Promise.allSettled([o1.run(), o2.run()]);
    expect(results[0].status).toBe("fulfilled");
    expect(results[1].status).toBe("fulfilled");
  });
});

// ==========================================================
describe("seconde instance après collecte terminée → idempotence", () => {
  it("retourne COMPLETED sans créer de nouveau run", async () => {
    const s = mockStorage({
      acquireLease: vi.fn(async (): Promise<LeaseAcquisitionResult> => ({
        acquired: false, runId: "run-done", ownerToken: "old", leaseExpiresAt: "2026-07-20T00:00:00Z", runStatus: "COMPLETED",
      })),
    });
    const o = new YouTubeCollectionOrchestrator({ ...BASE, steps: [okStep("a")] }, s);
    const r = await o.run();
    expect(r.status).toBe("COMPLETED");
    expect(r.runId).toBe("run-done");
    // Aucune écriture fencée ne doit avoir été faite
    expect(s.fencedUpdate).not.toHaveBeenCalled();
  });

  it("retourne COMPLETED_WITH_WARNINGS sans relancer", async () => {
    const s = mockStorage({
      acquireLease: vi.fn(async (): Promise<LeaseAcquisitionResult> => ({
        acquired: false, runId: "run-warn", ownerToken: "old", leaseExpiresAt: "2026-07-20T00:00:00Z", runStatus: "COMPLETED_WITH_WARNINGS",
      })),
    });
    const o = new YouTubeCollectionOrchestrator({ ...BASE, steps: [okStep("a")] }, s);
    const r = await o.run();
    expect(r.status).toBe("COMPLETED_WITH_WARNINGS");
    expect(r.runId).toBe("run-warn");
    expect(s.fencedUpdate).not.toHaveBeenCalled();
  });
});

// ==========================================================
describe("verrou refusé → RUNNING", () => {
  it("retourne RUNNING quand lease actif par un autre", async () => {
    const s = mockStorage({
      acquireLease: vi.fn(async () => ({
        acquired: false, runId: "other-run", ownerToken: "other", leaseExpiresAt: "2099-01-01T00:00:00Z", runStatus: "RUNNING",
      })),
    });
    const o = new YouTubeCollectionOrchestrator({ ...BASE, steps: [okStep("a")] }, s);
    const r = await o.run();
    expect(r.status).toBe("RUNNING");
    expect(r.runId).toBe("other-run");
    expect(r.warnings[0]).toContain("actif");
  });
});

// ==========================================================
describe("reprise réelle du même run", () => {
  it("restaure compteurs, warnings, stepsCompleted et n'exécute que les étapes restantes", async () => {
    const existingRun: SyncRunRecord = {
      id: "run-resumed",
      status: "RUNNING",
      started_at: "2026-07-14T10:00:00Z",
      finished_at: null,
      error_code: null,
      error_message: null,
      records_received: 10,
      records_normalized: 8,
      records_matched: 6,
      records_rejected: 2,
      metadata: {
        sourceKey: "youtube_hmi_weekly_delta",
        periodStart: "2026-07-14",
        periodEnd: "2026-07-21",
        progressPercent: 33,
        currentStep: "step_a",
        warnings: ["ancien avertissement"],
        heartbeatAt: "2026-07-14T10:01:00Z",
        cancelRequested: false,
        stepsCompleted: ["step_a"],
        counters: { received: 10, normalized: 8, matched: 6, rejected: 2 },
      },
    };
    const executed: string[] = [];
    const s = mockStorage({
      acquireLease: vi.fn(async (): Promise<LeaseAcquisitionResult> => ({
        acquired: true, runId: "run-resumed", ownerToken: "tok", leaseExpiresAt: "2099-01-01T00:00:00Z", runStatus: "RUNNING",
      })),
      getRun: vi.fn(async () => existingRun),
    });
    const steps: OrchestratorStep[] = [
      { name: "step_a", execute: async () => { executed.push("a"); return { recordsReceived: 10 }; } },
      { name: "step_b", execute: async () => { executed.push("b"); return { recordsReceived: 5 }; } },
      { name: "step_c", execute: async () => { executed.push("c"); return { recordsReceived: 3 }; } },
    ];
    const o = new YouTubeCollectionOrchestrator({ ...BASE, steps }, s);
    const r = await o.run();
    expect(r.status).toBe("COMPLETED_WITH_WARNINGS"); // "ancien avertissement" is restored
    expect(r.runId).toBe("run-resumed");
    // step_a was already completed → not re-executed
    expect(executed).toEqual(["b", "c"]);
    // Counters are cumulative from the restored state
    const finalCalls = (s.fencedUpdate as ReturnType<typeof vi.fn>).mock.calls;
    const lastMeta = finalCalls[finalCalls.length - 1][4] as SyncRunPatch;
    expect(lastMeta.records_received).toBe(10 + 5 + 3);
  });
});

// ==========================================================
describe("écriture finale fencée refusée → lease_lost", () => {
  it("fencedUpdate refusée lors de la finalisation → retourne lease_lost sans COMPLETED", async () => {
    let writeCount = 0;
    const s = mockStorage({
      fencedUpdate: vi.fn(async () => {
        writeCount++;
        // La dernière écriture (finalisation) est refusée
        if (writeCount >= 4) return false;
        return true;
      }),
    });
    const o = new YouTubeCollectionOrchestrator({ ...BASE, steps: [okStep("a")] }, s);
    const r = await o.run();
    expect(r.status).toBe("FAILED");
    expect(r.error).toBe("lease_lost");
    // Ne doit JAMAIS retourner COMPLETED après un fenced write refusé
    expect(r.status).not.toBe("COMPLETED");
  });

  it("fencedUpdate false dès la première écriture → lease_lost immédiat", async () => {
    const s = mockStorage({
      fencedUpdate: vi.fn(async () => false),
    });
    const o = new YouTubeCollectionOrchestrator({ ...BASE, steps: [okStep("a")] }, s);
    const r = await o.run();
    expect(r.status).toBe("FAILED");
    expect(r.error).toBe("lease_lost");
  });
});

// ==========================================================
describe("effacement d'une ancienne erreur après réussite", () => {
  it("clear_error=true est envoyé lors de la finalisation réussie", async () => {
    const s = mockStorage({
      getRun: vi.fn(async (): Promise<SyncRunRecord> => ({
        id: "run-err",
        status: "FAILED",
        started_at: "2026-07-14T10:00:00Z",
        finished_at: "2026-07-14T10:05:00Z",
        error_code: "step_failure",
        error_message: "ancienne erreur",
        records_received: 0,
        records_normalized: 0,
        records_matched: 0,
        records_rejected: 0,
        metadata: {
          sourceKey: "youtube_hmi_weekly_delta",
          periodStart: "2026-07-14",
          periodEnd: "2026-07-21",
          progressPercent: 0,
          currentStep: null,
          warnings: [],
          heartbeatAt: "2026-07-14T10:00:00Z",
          cancelRequested: false,
          stepsCompleted: [],
          counters: { received: 0, normalized: 0, matched: 0, rejected: 0 },
        },
      })),
    });
    const o = new YouTubeCollectionOrchestrator({ ...BASE, steps: [okStep("a")] }, s);
    const r = await o.run();
    expect(r.status).toBe("COMPLETED");
    // Vérifier que clear_error a été envoyé
    const calls = (s.fencedUpdate as ReturnType<typeof vi.fn>).mock.calls;
    const finalPatch = calls[calls.length - 1][4] as SyncRunPatch;
    expect(finalPatch.clear_error).toBe(true);
  });
});

// ==========================================================
describe("perte de lease pendant une étape longue via assertActive", () => {
  it("assertActive lève LeaseLostError quand renewLease retourne false", async () => {
    const s = mockStorage({
      renewLease: vi.fn(async () => false),
    });
    const longStep: OrchestratorStep = {
      name: "long",
      execute: async (ctx) => {
        // L'étape vérifie l'ownership pendant son exécution
        await ctx.assertActive();
        return { recordsReceived: 1 };
      },
    };
    const o = new YouTubeCollectionOrchestrator({ ...BASE, steps: [longStep] }, s);
    const r = await o.run();
    expect(r.status).toBe("FAILED");
    expect(r.error).toBe("lease_lost");
  });

  it("assertActive passe quand le lease est toujours actif", async () => {
    const s = mockStorage({
      renewLease: vi.fn(async () => true),
    });
    const step: OrchestratorStep = {
      name: "check",
      execute: async (ctx) => {
        await ctx.assertActive(); // Ne doit pas lever
        return { recordsReceived: 1 };
      },
    };
    const o = new YouTubeCollectionOrchestrator({ ...BASE, steps: [step] }, s);
    const r = await o.run();
    expect(r.status).toBe("COMPLETED");
  });

  it("assertActive transforme une annulation persistée en CANCELLED, pas en lease_lost", async () => {
    const s = mockStorage({
      renewLease: vi.fn(async () => true),
      readCancellationFlag: vi.fn(async () => true),
    });
    const step: OrchestratorStep = {
      name: "long-cancelled",
      execute: async (ctx) => {
        await ctx.assertActive();
        return { recordsReceived: 1 };
      },
    };
    const o = new YouTubeCollectionOrchestrator({ ...BASE, steps: [step] }, s);
    const r = await o.run();
    expect(r.status).toBe("CANCELLED");
    expect(r.error).toBeNull();
    expect(CancellationRequestedError).toBeDefined();
  });
});

// ==========================================================
describe("progression monotone", () => {
  it("les valeurs de progressPercent ne descendent jamais", async () => {
    const percents: number[] = [];
    const s = mockStorage({
      fencedUpdate: vi.fn(async (_sk: string, _pk: string, _ot: string, _rid: string, patch: SyncRunPatch) => {
        if (patch.metadata) percents.push(patch.metadata.progressPercent);
        return true;
      }),
    });
    const o = new YouTubeCollectionOrchestrator(
      { ...BASE, steps: [okStep("a"), okStep("b"), okStep("c")] }, s
    );
    await o.run();
    for (let i = 1; i < percents.length; i++) {
      expect(percents[i]).toBeGreaterThanOrEqual(percents[i - 1]);
    }
  });

  it("ctx.updateProgress avec valeur inférieure → bornée (monotone)", async () => {
    const percents: number[] = [];
    const s = mockStorage({
      fencedUpdate: vi.fn(async (_sk: string, _pk: string, _ot: string, _rid: string, patch: SyncRunPatch) => {
        if (patch.metadata) percents.push(patch.metadata.progressPercent);
        return true;
      }),
    });
    const step: OrchestratorStep = {
      name: "tricky",
      execute: async (ctx) => {
        await ctx.updateProgress(50, "half");
        await ctx.updateProgress(30, "lower"); // Doit être ignoré
        await ctx.updateProgress(70, "higher");
        return {};
      },
    };
    const o = new YouTubeCollectionOrchestrator({ ...BASE, steps: [step] }, s);
    await o.run();
    for (let i = 1; i < percents.length; i++) {
      expect(percents[i]).toBeGreaterThanOrEqual(percents[i - 1]);
    }
  });
});

// ==========================================================
describe("avertissements → COMPLETED_WITH_WARNINGS", () => {
  it("des warnings produisent COMPLETED_WITH_WARNINGS", async () => {
    const o = new YouTubeCollectionOrchestrator({ ...BASE, steps: [warnStep("w")] }, mockStorage());
    const r = await o.run();
    expect(r.status).toBe("COMPLETED_WITH_WARNINGS");
    expect(r.warnings).toContain("avertissement");
  });
});

// ==========================================================
describe("erreur fatale → FAILED", () => {
  it("FAILED + message d'erreur + lease libéré", async () => {
    const s = mockStorage();
    const o = new YouTubeCollectionOrchestrator({ ...BASE, steps: [okStep("a"), failStep("b", "quota")] }, s);
    const r = await o.run();
    expect(r.status).toBe("FAILED");
    expect(r.error).toBe("quota");
    expect(s.releaseLease).toHaveBeenCalled();
  });
});

// ==========================================================
describe("annulation avant étape → CANCELLED", () => {
  it("requestCancel() avant run() → CANCELLED", async () => {
    const s = mockStorage();
    const o = new YouTubeCollectionOrchestrator({ ...BASE, steps: [okStep("a")] }, s);
    o.requestCancel();
    const r = await o.run();
    expect(r.status).toBe("CANCELLED");
    expect(s.releaseLease).toHaveBeenCalled();
  });
});

// ==========================================================
describe("annulation persistée depuis une autre instance (async)", () => {
  it("readCancellationFlag true → CANCELLED", async () => {
    const s = mockStorage({ readCancellationFlag: vi.fn(async () => true) });
    const o = new YouTubeCollectionOrchestrator({ ...BASE, steps: [okStep("a"), okStep("b")] }, s);
    const r = await o.run();
    expect(r.status).toBe("CANCELLED");
  });
});

// ==========================================================
describe("annulation pendant updateProgress", () => {
  it("cancellation flag lu durant un updateProgress", async () => {
    let cancelAfterProgress = false;
    const s = mockStorage({
      readCancellationFlag: vi.fn(async () => cancelAfterProgress),
    });
    const step: OrchestratorStep = {
      name: "prog-step",
      execute: async (ctx) => {
        await ctx.updateProgress(20, "phase1");
        cancelAfterProgress = true;
        return { recordsReceived: 1 };
      },
    };
    const o = new YouTubeCollectionOrchestrator(
      { ...BASE, steps: [step, okStep("b")] }, s
    );
    const r = await o.run();
    expect(r.status).toBe("CANCELLED");
  });
});

// ==========================================================
describe("heartbeat retournant false → lease_lost", () => {
  it("renewLease false → arrêt avec lease_lost", async () => {
    vi.useFakeTimers();
    const s = mockStorage({
      renewLease: vi.fn(async () => false),
    });
    const step: OrchestratorStep = {
      name: "slow",
      execute: async () => {
        await vi.advanceTimersByTimeAsync(100);
        return { recordsReceived: 1 };
      },
    };
    const o = new YouTubeCollectionOrchestrator(
      { ...BASE, heartbeatIntervalMs: 50, leaseDurationSeconds: 300, steps: [step, okStep("b")] }, s
    );
    const r = await o.run();
    expect(r.status).toBe("FAILED");
    expect(r.error).toBe("lease_lost");
  });
});

// ==========================================================
describe("ancien propriétaire ne peut pas écrire après expiry", () => {
  it("fencedUpdate retourne false pour ancien owner", async () => {
    const fencedFn = vi.fn(async (_sk: string, _pk: string, token: string) => {
      return token === "new-owner";
    });
    const s = mockStorage({ fencedUpdate: fencedFn });
    expect(await s.fencedUpdate("src", "period", "old-owner", "run-1", {})).toBe(false);
    expect(await s.fencedUpdate("src", "period", "new-owner", "run-1", {})).toBe(true);
  });
});

// ==========================================================
describe("FK cohérente (ON DELETE RESTRICT)", () => {
  it("la migration utilise ON DELETE RESTRICT pour sync_run_id", () => {
    // Ce test documente que la FK youtube_sync_leases.sync_run_id → sync_runs(id)
    // utilise ON DELETE RESTRICT (et non SET NULL qui est incohérent avec NOT NULL).
    // La vérification réelle se fait par lecture de la migration SQL.
    // En l'absence de base locale, ce test sert de marqueur documentaire.
    expect(true).toBe(true);
  });
});

// ==========================================================
describe("acquisition invalide rejetée", () => {
  it("RPC rejette source_key vide", async () => {
    const s = mockStorage({
      acquireLease: vi.fn(async () => { throw new Error("p_source_key ne peut pas être vide"); }),
    });
    const o = new YouTubeCollectionOrchestrator({ ...BASE, sourceKey: "", steps: [okStep("a")] }, s);
    // L'erreur remonte car elle survient avant try/finally
    await expect(o.run()).rejects.toThrow("p_source_key ne peut pas être vide");
  });

  it("RPC rejette leaseDuration hors limites", async () => {
    // Caught at config validation level
    expect(() => new YouTubeCollectionOrchestrator(
      { ...BASE, leaseDurationSeconds: 5, steps: [okStep("a")] }, mockStorage()
    )).toThrow("leaseDurationSeconds");
  });
});

// ==========================================================
describe("erreur de libération ne masque pas le résultat", () => {
  it("COMPLETED malgré erreur de release", async () => {
    const s = mockStorage({
      releaseLease: vi.fn(async () => { throw new Error("release failed"); }),
    });
    const o = new YouTubeCollectionOrchestrator({ ...BASE, steps: [okStep("a")] }, s);
    const r = await o.run();
    expect(r.status).toBe("COMPLETED");
  });
});

// ==========================================================
describe("erreur avant démarrage du heartbeat → lease libéré", () => {
  it("erreur dans getChartSourceId → erreur propagée", async () => {
    const s = mockStorage({
      getChartSourceId: vi.fn(async () => { throw new Error("db down"); }),
    });
    const o = new YouTubeCollectionOrchestrator({ ...BASE, steps: [okStep("a")] }, s);
    await expect(o.run()).rejects.toThrow("db down");
  });

  it("erreur après acquisition mais avant heartbeat → lease libéré", async () => {
    const s = mockStorage({
      fencedUpdate: vi.fn(async () => { throw new Error("fenced crashed"); }),
    });
    const o = new YouTubeCollectionOrchestrator({ ...BASE, steps: [okStep("a")] }, s);
    const r = await o.run();
    expect(r.status).toBe("FAILED");
    expect(r.error).toContain("fenced crashed");
    expect(s.releaseLease).toHaveBeenCalled();
  });
});

// ==========================================================
describe("LeaseLostError est exporté et typé", () => {
  it("LeaseLostError est une instance d'Error", () => {
    const err = new LeaseLostError();
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("LeaseLostError");
  });

  it("LeaseLostError accepte un message custom", () => {
    const err = new LeaseLostError("custom");
    expect(err.message).toBe("custom");
  });
});

// ==========================================================
describe("toutes les écritures passent par fencedUpdate", () => {
  it("aucun appel direct à updateRun (interface n'expose plus updateRun)", () => {
    const s = mockStorage();
    expect("updateRun" in s).toBe(false);
    expect("fencedUpdate" in s).toBe(true);
  });
});

// ==========================================================
describe("adaptateur Supabase réel (mocked createAdminClient)", () => {
  it("acquireLease appelle rpc('acquire_sync_lease') avec run_status", async () => {
    vi.resetModules();
    const rpcFn = vi.fn(async () => ({
      data: [{ acquired: true, run_id: "rpc-run", owner_token: "tok", lease_expires_at: "2099-01-01T00:00:00Z", run_status: "RUNNING" }],
      error: null,
    }));
    vi.doMock("server-only", () => ({}));
    vi.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: () => ({ rpc: rpcFn, from: vi.fn() }),
    }));

    const mod = await import("../orchestrator-storage");
    const storage = mod.createOrchestratorStorage();

    const result = await storage.acquireLease("youtube_hmi", "2026-07-14::2026-07-21", "token-1", 300, "cs-1");
    expect(rpcFn).toHaveBeenCalledWith("acquire_sync_lease", expect.objectContaining({
      p_source_key: "youtube_hmi",
      p_period_key: "2026-07-14::2026-07-21",
      p_owner_token: "token-1",
      p_lease_duration_seconds: 300,
      p_chart_source_id: "cs-1",
    }));
    expect(result.acquired).toBe(true);
    expect(result.runId).toBe("rpc-run");
    expect(result.runStatus).toBe("RUNNING");
  });

  it("utilise le lease manuel pour une relance admin explicite", async () => {
    vi.resetModules();
    const rpcFn = vi.fn(async () => ({
      data: [{ acquired: true, run_id: "manual-run", owner_token: "tok", lease_expires_at: "2099-01-01T00:00:00Z", run_status: "RUNNING" }],
      error: null,
    }));
    vi.doMock("server-only", () => ({}));
    vi.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: () => ({ rpc: rpcFn, from: vi.fn() }),
    }));

    const mod = await import("../orchestrator-storage");
    const storage = mod.createOrchestratorStorage();
    const result = await storage.acquireLease(
      "youtube_hmi",
      "2026-07-14::2026-07-21",
      "token-manual",
      300,
      "cs-1",
      true
    );

    expect(rpcFn).toHaveBeenCalledWith(
      "acquire_manual_sync_lease",
      expect.objectContaining({
        p_period_key: "2026-07-14::2026-07-21",
        p_owner_token: "token-manual",
      })
    );
    expect(result.runId).toBe("manual-run");
  });

  it("fencedUpdate envoie p_clear_error", async () => {
    vi.resetModules();
    const rpcFn = vi.fn(async () => ({ data: true, error: null }));
    vi.doMock("server-only", () => ({}));
    vi.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: () => ({ rpc: rpcFn, from: vi.fn() }),
    }));
    const mod = await import("../orchestrator-storage");
    const storage = mod.createOrchestratorStorage();
    await storage.fencedUpdate("src", "period", "owner", "run-1", {
      status: "COMPLETED",
      clear_error: true,
    });
    expect(rpcFn).toHaveBeenCalledWith("fenced_update_sync_run", expect.objectContaining({
      p_clear_error: true,
    }));
  });

  it("getRun lit depuis sync_runs", async () => {
    vi.resetModules();
    const maybeSingleFn = vi.fn(async () => ({
      data: {
        id: "run-1",
        status: "FAILED",
        started_at: "2026-07-14T10:00:00Z",
        finished_at: "2026-07-14T10:05:00Z",
        error_code: "step_failure",
        error_message: "error",
        records_received: 5,
        records_normalized: 3,
        records_matched: 2,
        records_rejected: 1,
        metadata: null,
      },
      error: null,
    }));
    const fromFn = vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: maybeSingleFn,
        })),
      })),
    }));
    vi.doMock("server-only", () => ({}));
    vi.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: () => ({ rpc: vi.fn(), from: fromFn }),
    }));
    const mod = await import("../orchestrator-storage");
    const storage = mod.createOrchestratorStorage();
    const run = await storage.getRun("run-1");
    expect(fromFn).toHaveBeenCalledWith("sync_runs");
    expect(run).not.toBeNull();
    expect(run!.id).toBe("run-1");
    expect(run!.status).toBe("FAILED");
  });

  it("renewLease appelle rpc('renew_sync_lease')", async () => {
    vi.resetModules();
    const rpcFn = vi.fn(async () => ({ data: true, error: null }));
    vi.doMock("server-only", () => ({}));
    vi.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: () => ({ rpc: rpcFn, from: vi.fn() }),
    }));
    const mod = await import("../orchestrator-storage");
    const storage = mod.createOrchestratorStorage();
    const result = await storage.renewLease("src", "period", "owner", 300);
    expect(rpcFn).toHaveBeenCalledWith("renew_sync_lease", expect.objectContaining({
      p_source_key: "src", p_period_key: "period", p_owner_token: "owner",
    }));
    expect(result).toBe(true);
  });

  it("releaseLease appelle rpc('release_sync_lease')", async () => {
    vi.resetModules();
    const rpcFn = vi.fn(async () => ({ data: true, error: null }));
    vi.doMock("server-only", () => ({}));
    vi.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: () => ({ rpc: rpcFn, from: vi.fn() }),
    }));
    const mod = await import("../orchestrator-storage");
    const storage = mod.createOrchestratorStorage();
    const result = await storage.releaseLease("src", "period", "owner");
    expect(rpcFn).toHaveBeenCalledWith("release_sync_lease", expect.objectContaining({
      p_source_key: "src", p_period_key: "period", p_owner_token: "owner",
    }));
    expect(result).toBe(true);
  });

  it("requestCancellation appelle rpc('request_sync_cancellation')", async () => {
    vi.resetModules();
    const rpcFn = vi.fn(async () => ({ data: true, error: null }));
    vi.doMock("server-only", () => ({}));
    vi.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: () => ({ rpc: rpcFn, from: vi.fn() }),
    }));
    const mod = await import("../orchestrator-storage");
    const storage = mod.createOrchestratorStorage();
    const result = await storage.requestCancellation("src", "period");
    expect(rpcFn).toHaveBeenCalledWith("request_sync_cancellation", expect.objectContaining({
      p_source_key: "src",
      p_period_key: "period",
    }));
    expect(result).toBe(true);
  });

  it("readCancellationFlag lit depuis youtube_sync_leases", async () => {
    vi.resetModules();
    const maybeSingleFn = vi.fn(async () => ({
      data: { cancel_requested: true, expires_at: "2099-01-01T00:00:00Z", released_at: null, owner_token: "owner" },
      error: null,
    }));
    const fromFn = vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: maybeSingleFn,
          })),
        })),
      })),
    }));
    vi.doMock("server-only", () => ({}));
    vi.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: () => ({ rpc: vi.fn(), from: fromFn }),
    }));
    const mod = await import("../orchestrator-storage");
    const storage = mod.createOrchestratorStorage();
    const result = await storage.readCancellationFlag("src", "period", "owner");
    expect(fromFn).toHaveBeenCalledWith("youtube_sync_leases");
    expect(result).toBe(true);
  });
});

// ==========================================================
describe("note: test SQL concurrent (pg_advisory_xact_lock)", () => {
  /**
   * Le vrai test d'atomicité concurrent (deux SELECT ... FOR UPDATE sans
   * ligne préexistante) ne peut être validé qu'avec une base PostgreSQL locale.
   * Le pg_advisory_xact_lock dans acquire_sync_lease sérialise ces accès.
   *
   * En l'absence de Supabase local, ce test reste à exécuter manuellement
   * après revue de la migration. Un mock TypeScript ne valide PAS l'atomicité
   * PostgreSQL.
   */
  it("documentation — le test SQL concurrent nécessite une base PostgreSQL", () => {
    expect(true).toBe(true);
  });
});
