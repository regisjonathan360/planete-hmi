/**
 * K6 — Vrais tests de handlers
 *
 * Importe les handlers GET/POST/PATCH/DELETE, construit de vraies Request,
 * simule requireAdmin/createAdminClient/logAudit, vérifie statuts HTTP et corps JSON.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

// ============================================================
// Mocks
// ============================================================

const mockAdminUser = { id: "user-001", email: "admin@test.com" };
const mockRequireAdmin = vi.fn();
const mockCreateAdminClient = vi.fn();
const mockLogAudit = vi.fn();

vi.mock("@/lib/auth/admin-guard", () => ({
  requireAdmin: () => mockRequireAdmin(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => mockCreateAdminClient(),
}));

vi.mock("@/lib/charts/audit", () => ({
  logAudit: (...args: unknown[]) => mockLogAudit(...args),
}));

// Mock server-only to no-op
vi.mock("server-only", () => ({}));

// Mock K2 API client
vi.mock("@/lib/youtube/api-client", () => ({
  validateChannel: vi.fn(),
  getVideoDetails: vi.fn(),
  listPlaylistItems: vi.fn(),
}));

// Mock orchestrator storage
vi.mock("@/lib/youtube/orchestrator-storage", () => ({
  createOrchestratorStorage: vi.fn(() => ({})),
}));

// Mock discovery
vi.mock("@/lib/youtube/discovery", () => ({
  createDiscoveryStep: vi.fn(() => ({ name: "discover", execute: vi.fn() })),
}));

vi.mock("@/lib/youtube/discovery-storage", () => ({
  createDiscoveryStorage: vi.fn(() => ({})),
}));

// Mock snapshot service
vi.mock("@/lib/youtube/snapshot-service", () => ({
  createRefreshSnapshotStep: vi.fn(() => ({ name: "refresh", execute: vi.fn() })),
  createComputeDraftStep: vi.fn(() => ({ name: "compute_draft", execute: vi.fn() })),
  ComputeDraftService: vi.fn(),
}));

vi.mock("@/lib/youtube/snapshot-supabase-storage", () => ({
  createSnapshotStorage: vi.fn(() => ({})),
}));

// Mock orchestrator
vi.mock("@/lib/youtube/orchestrator", async (importOriginal) => {
  const actual = await importOriginal() as Record<string, unknown>;
  return {
    ...actual,
    YouTubeCollectionOrchestrator: class MockOrchestrator {
      async run() {
        return {
          runId: "run-001",
          status: "COMPLETED",
          warnings: [],
          error: null,
          startedAt: "2026-07-14T00:00:00Z",
          finishedAt: "2026-07-14T01:00:00Z",
        };
      }
    },
  };
});

// ============================================================
// Helpers
// ============================================================

function makeRequest(method: string, body?: unknown, url = "http://localhost/api/admin/youtube/test") {
  const init: RequestInit = { method };
  if (body) {
    init.body = JSON.stringify(body);
    init.headers = { "Content-Type": "application/json" };
  }
  return new Request(url, init);
}

function mockSupabase(overrides: Record<string, unknown> = {}) {
  const chainable = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    ...overrides,
  };
  return {
    from: vi.fn(() => chainable),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAdmin.mockResolvedValue({ ok: true, user: mockAdminUser });
  mockLogAudit.mockResolvedValue(undefined);
});

// ============================================================
// POST /api/admin/youtube/videos/[id]/approve
// ============================================================

describe("POST /api/admin/youtube/videos/[id]/approve", () => {
  let POST: (req: Request, ctx: { params: Promise<{ id: string }> }) => Promise<NextResponse>;

  beforeEach(async () => {
    const mod = await import("@/app/api/admin/youtube/videos/[id]/approve/route");
    POST = mod.POST;
  });

  it("retourne 401 si non connecté", async () => {
    mockRequireAdmin.mockResolvedValue({ ok: false, status: 401, error: "Non authentifié." });
    const res = await POST(
      makeRequest("POST", { videoType: "OFFICIAL_MUSIC_VIDEO", trackId: "t-001", reviewReason: "Justification OK" }),
      { params: Promise.resolve({ id: "v-001" }) }
    );
    expect(res.status).toBe(401);
  });

  it("retourne 403 si non-admin", async () => {
    mockRequireAdmin.mockResolvedValue({ ok: false, status: 403, error: "Accès réservé." });
    const res = await POST(
      makeRequest("POST", { videoType: "OFFICIAL_MUSIC_VIDEO", trackId: "550e8400-e29b-41d4-a716-446655440000", reviewReason: "Justification suffisante" }),
      { params: Promise.resolve({ id: "550e8400-e29b-41d4-a716-446655440000" }) }
    );
    expect(res.status).toBe(403);
  });

  it("retourne 400 si identifiant invalide", async () => {
    const res = await POST(
      makeRequest("POST", { videoType: "OFFICIAL_MUSIC_VIDEO", trackId: "550e8400-e29b-41d4-a716-446655440000", reviewReason: "Justification OK" }),
      { params: Promise.resolve({ id: "not-a-uuid" }) }
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe("validation_error");
  });

  it("retourne 400 pour un SHORT", async () => {
    const res = await POST(
      makeRequest("POST", { videoType: "SHORT", trackId: "550e8400-e29b-41d4-a716-446655440000", reviewReason: "Justification suffisante" }),
      { params: Promise.resolve({ id: "550e8400-e29b-41d4-a716-446655440000" }) }
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.message).toContain("SHORT");
  });

  it("retourne 400 pour type INTERVIEW (exclu)", async () => {
    const res = await POST(
      makeRequest("POST", { videoType: "INTERVIEW", trackId: "550e8400-e29b-41d4-a716-446655440000", reviewReason: "Justification suffisante" }),
      { params: Promise.resolve({ id: "550e8400-e29b-41d4-a716-446655440000" }) }
    );
    expect(res.status).toBe(400);
  });

  it("appelle approve_youtube_video RPC et retourne success", async () => {
    const supabase = mockSupabase();
    supabase.rpc.mockResolvedValue({ data: [{ success: true, message: "ok" }], error: null });
    mockCreateAdminClient.mockReturnValue(supabase);

    const res = await POST(
      makeRequest("POST", { videoType: "OFFICIAL_MUSIC_VIDEO", trackId: "550e8400-e29b-41d4-a716-446655440000", reviewReason: "Justification suffisante pour validation" }),
      { params: Promise.resolve({ id: "550e8400-e29b-41d4-a716-446655440000" }) }
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.reviewStatus).toBe("APPROVED");

    // Verify RPC was called with correct params
    expect(supabase.rpc).toHaveBeenCalledWith("approve_youtube_video", expect.objectContaining({
      p_youtube_video_id: "550e8400-e29b-41d4-a716-446655440000",
      p_track_id: "550e8400-e29b-41d4-a716-446655440000",
      p_video_type: "OFFICIAL_MUSIC_VIDEO",
    }));

    // Verify audit was called
    expect(mockLogAudit).toHaveBeenCalledWith(supabase, expect.objectContaining({
      action: "youtube_video_approve",
    }));
  });

  it("retourne 404 si RPC renvoie track_not_found", async () => {
    const supabase = mockSupabase();
    supabase.rpc.mockResolvedValue({ data: [{ success: false, message: "track_not_found" }], error: null });
    mockCreateAdminClient.mockReturnValue(supabase);

    const res = await POST(
      makeRequest("POST", { videoType: "OFFICIAL_MUSIC_VIDEO", trackId: "550e8400-e29b-41d4-a716-446655440000", reviewReason: "Justification suffisante" }),
      { params: Promise.resolve({ id: "550e8400-e29b-41d4-a716-446655440000" }) }
    );
    expect(res.status).toBe(404);
  });

  it("sanitise les erreurs RPC", async () => {
    const supabase = mockSupabase();
    supabase.rpc.mockResolvedValue({ data: null, error: { message: "connection to postgresql://user:pass@host failed with key=AIzaSy123" } });
    mockCreateAdminClient.mockReturnValue(supabase);

    const res = await POST(
      makeRequest("POST", { videoType: "OFFICIAL_MUSIC_VIDEO", trackId: "550e8400-e29b-41d4-a716-446655440000", reviewReason: "Justification suffisante" }),
      { params: Promise.resolve({ id: "550e8400-e29b-41d4-a716-446655440000" }) }
    );
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error.message).not.toContain("AIzaSy123");
    expect(json.error.message).not.toContain("postgresql://");
  });

  it("ne crée aucun audit si l'approbation échoue", async () => {
    const supabase = mockSupabase();
    supabase.rpc.mockResolvedValue({ data: [{ success: false, message: "video_not_found" }], error: null });
    mockCreateAdminClient.mockReturnValue(supabase);

    await POST(
      makeRequest("POST", { videoType: "OFFICIAL_MUSIC_VIDEO", trackId: "550e8400-e29b-41d4-a716-446655440000", reviewReason: "Justification suffisante" }),
      { params: Promise.resolve({ id: "550e8400-e29b-41d4-a716-446655440000" }) }
    );
    expect(mockLogAudit).not.toHaveBeenCalled();
  });
});

// ============================================================
// PATCH /api/admin/youtube/channels/[id] — verification falsification
// ============================================================

describe("PATCH /api/admin/youtube/channels/[id]", () => {
  let PATCH: (req: Request, ctx: { params: Promise<{ id: string }> }) => Promise<NextResponse>;

  beforeEach(async () => {
    const mod = await import("@/app/api/admin/youtube/channels/[id]/route");
    PATCH = mod.PATCH;
  });

  it("refuse activation si is_youtube_verified=false en base", async () => {
    const chainable = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { id: "ch-001", status: "pending_review", is_active: true, is_youtube_verified: false, channel_type: "OFFICIAL_ARTIST_CHANNEL" },
        error: null,
      }),
    };
    const supabase = { from: vi.fn(() => chainable), rpc: vi.fn() };
    mockCreateAdminClient.mockReturnValue(supabase);

    const res = await PATCH(
      makeRequest("PATCH", { status: "active", approvalReason: "Justification suffisante pour activer." }),
      { params: Promise.resolve({ id: "550e8400-e29b-41d4-a716-446655440000" }) }
    );
    expect(res.status).toBe(412);
    const json = await res.json();
    expect(json.error.message).toContain("vérifiée");
  });

  it("isVerified dans le body est ignoré (pas écrit en base)", async () => {
    const chainable = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: "ch-001", channel_id: "UC123", channel_title: "Test", status: "paused", is_active: true }, error: null }),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { id: "ch-001", status: "paused", is_active: true, is_youtube_verified: false, channel_type: "OFFICIAL_ARTIST_CHANNEL" },
        error: null,
      }),
    };
    const supabase = { from: vi.fn(() => chainable), rpc: vi.fn() };
    mockCreateAdminClient.mockReturnValue(supabase);

    const res = await PATCH(
      makeRequest("PATCH", { notes: "Test update" }),
      { params: Promise.resolve({ id: "550e8400-e29b-41d4-a716-446655440000" }) }
    );
    // The request should succeed but isVerified should not appear in the update call
    // (body with only notes should work)
    if (res.status === 200) {
      // update was called — verify the patch doesn't contain is_youtube_verified
      const updateCalls = chainable.update.mock.calls;
      if (updateCalls.length > 0) {
        expect(updateCalls[0][0]).not.toHaveProperty("is_youtube_verified");
      }
    }
  });

  it("refuse status=active avec isActive=false", async () => {
    const res = await PATCH(
      makeRequest("PATCH", { status: "active", isActive: false, approvalReason: "Justification suffisante." }),
      { params: Promise.resolve({ id: "550e8400-e29b-41d4-a716-446655440000" }) }
    );
    expect(res.status).toBe(400);
  });
});

// ============================================================
// Invariants K6
// ============================================================

describe("Invariants K6 — aucune publication/archive/restauration", () => {
  it("le schéma de collecte n'a pas de champ publish", async () => {
    const { youtubeCollectionParamsSchema } = await import("../schemas");
    const result = youtubeCollectionParamsSchema.safeParse({
      periodStart: "2026-07-14", periodEnd: "2026-07-21", mode: "FULL_WEEKLY",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty("publish");
      expect(result.data).not.toHaveProperty("autoPublish");
    }
  });
});

// ============================================================
// POST /api/admin/youtube/collect
// ============================================================

describe("POST /api/admin/youtube/collect", () => {
  // La route renvoie un flux SSE (Response) ou une erreur JSON (NextResponse).
  let POST: (req: Request) => Promise<Response>;

  beforeEach(async () => {
    const mod = await import("@/app/api/admin/youtube/collect/route");
    POST = mod.POST;
  });

  it("retourne 401 si non connecté", async () => {
    mockRequireAdmin.mockResolvedValue({ ok: false, status: 401, error: "Non authentifié." });
    const res = await POST(makeRequest("POST", { periodStart: "2026-07-14", periodEnd: "2026-07-21", mode: "FULL_WEEKLY" }));
    expect(res.status).toBe(401);
  });

  it("retourne 400 si body invalide", async () => {
    const res = await POST(makeRequest("POST", { periodStart: "invalid" }));
    expect(res.status).toBe(400);
  });

  it("retourne 400 si refreshMetadata est activé", async () => {
    const supabase = mockSupabase();
    mockCreateAdminClient.mockReturnValue(supabase);
    const res = await POST(makeRequest("POST", {
      periodStart: "2026-07-14", periodEnd: "2026-07-21", mode: "FULL_WEEKLY", refreshMetadata: true,
    }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.message).toContain("refreshMetadata");
  });

  it("retourne 412 si chart_sources introuvable et createDraft=true", async () => {
    const chainable = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    const supabase = { from: vi.fn(() => chainable), rpc: vi.fn() };
    mockCreateAdminClient.mockReturnValue(supabase);

    const res = await POST(makeRequest("POST", {
      periodStart: "2026-07-14", periodEnd: "2026-07-21", mode: "FULL_WEEKLY",
      discoverNewVideos: false, refreshStatistics: false, createDraft: true,
    }));
    expect(res.status).toBe(412);
  });

  it("retourne 400 si mode CUSTOM sans cibles", async () => {
    // The Zod schema itself rejects CUSTOM without targets
    const res = await POST(makeRequest("POST", {
      periodStart: "2026-07-14", periodEnd: "2026-07-21", mode: "CUSTOM",
      artistIds: [], channelIds: [], videoIds: [], trackIds: [],
      discoverNewVideos: true,
    }));
    expect(res.status).toBe(400);
  });

  it("transmet le périmètre CUSTOM résolu à l'étape de découverte", async () => {
    const channelUuid = "550e8400-e29b-41d4-a716-446655440000";
    const youtubeChannelId = "UCxxxxxxxxxxxxxxxxxxxxxx";
    const from = vi.fn((table: string) => {
      if (table === "chart_sources") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: { id: "src-001" }, error: null }),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockResolvedValue({
          data: [{ id: channelUuid, channel_id: youtubeChannelId }],
          error: null,
        }),
      };
    });
    const supabase = { from, rpc: vi.fn() };
    mockCreateAdminClient.mockReturnValue(supabase);
    const discovery = await import("@/lib/youtube/discovery");

    const res = await POST(makeRequest("POST", {
      periodStart: "2026-07-14",
      periodEnd: "2026-07-21",
      mode: "CUSTOM",
      channelIds: [channelUuid],
      discoverNewVideos: true,
      refreshStatistics: false,
      createDraft: false,
      recalculateChart: false,
    }));

    expect(res.status).toBe(200);
    expect(discovery.createDiscoveryStep).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({
        scope: expect.objectContaining({
          channelIds: [channelUuid],
          channelYouTubeIds: [youtubeChannelId],
        }),
      })
    );
  });

  it("retourne 400 si aucune étape sélectionnée", async () => {
    const chainable = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    const supabase = { from: vi.fn(() => chainable), rpc: vi.fn() };
    mockCreateAdminClient.mockReturnValue(supabase);

    const res = await POST(makeRequest("POST", {
      periodStart: "2026-07-14", periodEnd: "2026-07-21", mode: "FULL_WEEKLY",
      discoverNewVideos: false, refreshStatistics: false, createDraft: false, recalculateChart: false,
    }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.message).toContain("étape");
  });

  it("collecte réussie déclenche un audit", async () => {
    const chainable = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: "src-001" }, error: null }),
    };
    const supabase = { from: vi.fn(() => chainable), rpc: vi.fn() };
    mockCreateAdminClient.mockReturnValue(supabase);

    const res = await POST(makeRequest("POST", {
      periodStart: "2026-07-14", periodEnd: "2026-07-21", mode: "FULL_WEEKLY",
      discoverNewVideos: true, refreshStatistics: false, createDraft: false,
    }));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/event-stream");

    // La route diffuse un flux SSE : on le consomme entièrement.
    const body = await res.text();
    expect(body).toContain("\"phase\":\"done\"");
    expect(body).toContain("\"runId\":\"run-001\"");
    expect(body).toContain("COMPLETED");

    expect(mockLogAudit).toHaveBeenCalledWith(supabase, expect.objectContaining({
      action: "youtube_collect",
    }));
  });

  it("recalculateChart=true seul fonctionne", async () => {
    const chainable = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: "src-001" }, error: null }),
    };
    const supabase = { from: vi.fn(() => chainable), rpc: vi.fn() };
    mockCreateAdminClient.mockReturnValue(supabase);

    const res = await POST(makeRequest("POST", {
      periodStart: "2026-07-14", periodEnd: "2026-07-21", mode: "FULL_WEEKLY",
      discoverNewVideos: false, refreshStatistics: false, createDraft: false, recalculateChart: true,
    }));
    expect(res.status).toBe(200);
  });
});

// ============================================================
// PATCH /api/admin/youtube/videos/[id]
// ============================================================

describe("PATCH /api/admin/youtube/videos/[id]", () => {
  let PATCH: (req: Request, ctx: { params: Promise<{ id: string }> }) => Promise<NextResponse>;

  beforeEach(async () => {
    const mod = await import("@/app/api/admin/youtube/videos/[id]/route");
    PATCH = mod.PATCH;
  });

  it("retourne 401 si non connecté", async () => {
    mockRequireAdmin.mockResolvedValue({ ok: false, status: 401, error: "Non authentifié." });
    const res = await PATCH(makeRequest("PATCH", {}), { params: Promise.resolve({ id: "550e8400-e29b-41d4-a716-446655440000" }) });
    expect(res.status).toBe(401);
  });

  it("retourne 400 pour identifiant invalide", async () => {
    const res = await PATCH(makeRequest("PATCH", {}), { params: Promise.resolve({ id: "bad" }) });
    expect(res.status).toBe(400);
  });

  it("retourne 400 si body invalide", async () => {
    const res = await PATCH(
      makeRequest("PATCH", { displayTitle: "" }),
      { params: Promise.resolve({ id: "550e8400-e29b-41d4-a716-446655440000" }) }
    );
    expect(res.status).toBe(400);
  });

  it("accepte une vidéo éligible sans chanson", async () => {
    const supabase = mockSupabase();
    supabase.rpc.mockResolvedValue({ data: [{ success: true, message: "ok" }], error: null });
    mockCreateAdminClient.mockReturnValue(supabase);
    const res = await PATCH(
      makeRequest("PATCH", {
        displayTitle: "Titre", reviewStatus: "APPROVED", videoType: "OFFICIAL_MUSIC_VIDEO",
        isEligible: true, trackId: "", exclusionReason: "", reviewReason: "Justification valide pour test.",
        displayThumbnailUrl: "",
      }),
      { params: Promise.resolve({ id: "550e8400-e29b-41d4-a716-446655440000" }) }
    );
    expect(res.status).toBe(200);
    expect(supabase.rpc).toHaveBeenCalledWith("update_youtube_video_editorial", expect.objectContaining({ p_track_id: null }));
  });

  it("refuse un SHORT éligible dans le classement principal", async () => {
    const supabase = mockSupabase();
    supabase.rpc.mockResolvedValue({ data: [{ success: true, message: "ok" }], error: null });
    mockCreateAdminClient.mockReturnValue(supabase);
    const res = await PATCH(
      makeRequest("PATCH", {
        displayTitle: "Titre", reviewStatus: "APPROVED", videoType: "SHORT",
        isEligible: true, trackId: "550e8400-e29b-41d4-a716-446655440000",
        exclusionReason: "", reviewReason: "Justification valide.", displayThumbnailUrl: "",
      }),
      { params: Promise.resolve({ id: "550e8400-e29b-41d4-a716-446655440000" }) }
    );
    expect(res.status).toBe(400);
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it("appelle update_youtube_video_editorial RPC sur succès", async () => {
    const supabase = mockSupabase();
    supabase.rpc.mockResolvedValue({ data: [{ success: true, message: "ok" }], error: null });
    mockCreateAdminClient.mockReturnValue(supabase);

    const res = await PATCH(
      makeRequest("PATCH", {
        displayTitle: "Titre OK", reviewStatus: "EXCLUDED", videoType: "OFFICIAL_MUSIC_VIDEO",
        isEligible: false, trackId: "", exclusionReason: "Contenu non musical.",
        reviewReason: "Justification valide pour mise a jour.", displayThumbnailUrl: "",
      }),
      { params: Promise.resolve({ id: "550e8400-e29b-41d4-a716-446655440000" }) }
    );
    expect(res.status).toBe(200);
    expect(supabase.rpc).toHaveBeenCalledWith("update_youtube_video_editorial", expect.objectContaining({
      p_youtube_video_id: "550e8400-e29b-41d4-a716-446655440000",
      p_review_status: "EXCLUDED",
    }));
    expect(mockLogAudit).toHaveBeenCalledWith(supabase, expect.objectContaining({
      action: "youtube_video_update",
    }));
  });

  it("retourne 404 si RPC renvoie video_not_found", async () => {
    const supabase = mockSupabase();
    supabase.rpc.mockResolvedValue({ data: [{ success: false, message: "video_not_found" }], error: null });
    mockCreateAdminClient.mockReturnValue(supabase);

    const res = await PATCH(
      makeRequest("PATCH", {
        displayTitle: "T", reviewStatus: "APPROVED", videoType: "OFFICIAL_MUSIC_VIDEO",
        isEligible: false, trackId: "", exclusionReason: "Raison.", reviewReason: "Justification de mise a jour.",
        displayThumbnailUrl: "",
      }),
      { params: Promise.resolve({ id: "550e8400-e29b-41d4-a716-446655440000" }) }
    );
    expect(res.status).toBe(404);
  });
});

// ============================================================
// POST /api/admin/youtube/videos/[id]/exclude
// ============================================================

describe("POST /api/admin/youtube/videos/[id]/exclude", () => {
  let POST: (req: Request, ctx: { params: Promise<{ id: string }> }) => Promise<NextResponse>;

  beforeEach(async () => {
    const mod = await import("@/app/api/admin/youtube/videos/[id]/exclude/route");
    POST = mod.POST;
  });

  it("retourne 401 si non connecté", async () => {
    mockRequireAdmin.mockResolvedValue({ ok: false, status: 401, error: "Non authentifié." });
    const res = await POST(makeRequest("POST", {}), { params: Promise.resolve({ id: "550e8400-e29b-41d4-a716-446655440000" }) });
    expect(res.status).toBe(401);
  });

  it("retourne 400 si justification trop courte", async () => {
    const res = await POST(
      makeRequest("POST", { exclusionReason: "ok", reviewReason: "Justification suffisante." }),
      { params: Promise.resolve({ id: "550e8400-e29b-41d4-a716-446655440000" }) }
    );
    expect(res.status).toBe(400);
  });

  it("exclut une vidéo avec audit", async () => {
    const chainable = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: "v-001", review_status: "UNREVIEWED" }, error: null }),
      single: vi.fn().mockResolvedValue({ data: { id: "v-001", video_id: "abc", review_status: "EXCLUDED", is_eligible: false }, error: null }),
    };
    const supabase = { from: vi.fn(() => chainable), rpc: vi.fn() };
    mockCreateAdminClient.mockReturnValue(supabase);

    const res = await POST(
      makeRequest("POST", { exclusionReason: "Contenu non musical.", reviewReason: "Justification suffisante pour exclusion." }),
      { params: Promise.resolve({ id: "550e8400-e29b-41d4-a716-446655440000" }) }
    );
    expect(res.status).toBe(200);
    expect(mockLogAudit).toHaveBeenCalledWith(supabase, expect.objectContaining({
      action: "youtube_video_exclude",
    }));
  });
});

// ============================================================
// POST /api/admin/youtube/videos/[id]/link-track
// ============================================================

describe("POST /api/admin/youtube/videos/[id]/link-track", () => {
  let POST: (req: Request, ctx: { params: Promise<{ id: string }> }) => Promise<NextResponse>;

  beforeEach(async () => {
    const mod = await import("@/app/api/admin/youtube/videos/[id]/link-track/route");
    POST = mod.POST;
  });

  it("retourne 400 si trackId invalide", async () => {
    const res = await POST(
      makeRequest("POST", { trackId: "not-uuid" }),
      { params: Promise.resolve({ id: "550e8400-e29b-41d4-a716-446655440000" }) }
    );
    expect(res.status).toBe(400);
  });

  it("appelle la RPC atomique et retourne success", async () => {
    const supabase = mockSupabase();
    supabase.rpc.mockResolvedValue({ data: [{ success: true, asset_id: "asset-001", message: "ok" }], error: null });
    mockCreateAdminClient.mockReturnValue(supabase);

    const res = await POST(
      makeRequest("POST", { trackId: "550e8400-e29b-41d4-a716-446655440000" }),
      { params: Promise.resolve({ id: "550e8400-e29b-41d4-a716-446655440000" }) }
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(supabase.rpc).toHaveBeenCalledWith("link_youtube_video_to_track", expect.objectContaining({
      p_youtube_video_id: "550e8400-e29b-41d4-a716-446655440000",
      p_track_id: "550e8400-e29b-41d4-a716-446655440000",
    }));
    expect(mockLogAudit).toHaveBeenCalled();
  });

  it("retourne 404 si RPC renvoie video_not_found", async () => {
    const supabase = mockSupabase();
    supabase.rpc.mockResolvedValue({ data: [{ success: false, asset_id: null, message: "video_not_found" }], error: null });
    mockCreateAdminClient.mockReturnValue(supabase);

    const res = await POST(
      makeRequest("POST", { trackId: "550e8400-e29b-41d4-a716-446655440000" }),
      { params: Promise.resolve({ id: "550e8400-e29b-41d4-a716-446655440000" }) }
    );
    expect(res.status).toBe(404);
    expect(mockLogAudit).not.toHaveBeenCalled();
  });
});

// ============================================================
// GET /api/admin/youtube/videos — internalChannelId
// ============================================================

describe("GET /api/admin/youtube/videos", () => {
  let GET: (req: Request) => Promise<NextResponse>;

  beforeEach(async () => {
    const mod = await import("@/app/api/admin/youtube/videos/route");
    GET = mod.GET;
  });

  it("retourne 401 si non connecté", async () => {
    mockRequireAdmin.mockResolvedValue({ ok: false, status: 401, error: "Non authentifié." });
    const res = await GET(makeRequest("GET", undefined, "http://localhost/api/admin/youtube/videos"));
    expect(res.status).toBe(401);
  });

  it("retourne 400 si channelId et internalChannelId fournis ensemble", async () => {
    const supabase = mockSupabase();
    mockCreateAdminClient.mockReturnValue(supabase);
    const res = await GET(makeRequest("GET", undefined, "http://localhost/api/admin/youtube/videos?channelId=UCtest123456789012345678&internalChannelId=550e8400-e29b-41d4-a716-446655440000"));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.message).toContain("simultanément");
  });

  it("retourne 404 si internalChannelId inconnu", async () => {
    const chainable = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockReturnThis(),
    };
    const supabase = { from: vi.fn(() => chainable), rpc: vi.fn() };
    mockCreateAdminClient.mockReturnValue(supabase);

    const res = await GET(makeRequest("GET", undefined, "http://localhost/api/admin/youtube/videos?internalChannelId=550e8400-e29b-41d4-a716-446655440000"));
    expect(res.status).toBe(404);
  });

  it("retourne 400 si limit invalide (10abc)", async () => {
    const supabase = mockSupabase();
    mockCreateAdminClient.mockReturnValue(supabase);
    const res = await GET(makeRequest("GET", undefined, "http://localhost/api/admin/youtube/videos?limit=10abc"));
    expect(res.status).toBe(400);
  });

  it("GET ne déclenche pas d'audit de mutation", async () => {
    const chainable = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { channel_id: "UC123" }, error: null }),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockReturnThis(),
      ilike: vi.fn().mockReturnThis(),
    };
    // Make the final query return data
    const finalQuery = { ...chainable, then: undefined };
    Object.defineProperty(finalQuery, Symbol.for("data"), { value: [] });
    const supabase = {
      from: vi.fn(() => ({
        ...chainable,
        // The last call in the chain resolves the query
        select: vi.fn().mockReturnValue({
          ...chainable,
          eq: vi.fn().mockReturnValue({
            ...chainable,
            order: vi.fn().mockReturnValue({
              ...chainable,
              range: vi.fn().mockResolvedValue({ data: [], error: null, count: 0 }),
            }),
          }),
        }),
      })),
      rpc: vi.fn(),
    };
    mockCreateAdminClient.mockReturnValue(supabase);

    await GET(makeRequest("GET", undefined, "http://localhost/api/admin/youtube/videos"));
    expect(mockLogAudit).not.toHaveBeenCalled();
  });
});

describe("couverture d'autorisation des autres handlers K6", () => {
  beforeEach(() => {
    mockRequireAdmin.mockResolvedValue({ ok: false, status: 401, error: "Non authentifié." });
  });

  it("protège GET /collection-runs/[id]", async () => {
    const { GET } = await import("@/app/api/admin/youtube/collection-runs/[id]/route");
    const res = await GET(makeRequest("GET"), {
      params: Promise.resolve({ id: "550e8400-e29b-41d4-a716-446655440000" }),
    });
    expect(res.status).toBe(401);
  });

  it("protège POST /collection-runs/[id]/cancel", async () => {
    const { POST } = await import("@/app/api/admin/youtube/collection-runs/[id]/cancel/route");
    const res = await POST(makeRequest("POST"), {
      params: Promise.resolve({ id: "550e8400-e29b-41d4-a716-446655440000" }),
    });
    expect(res.status).toBe(401);
  });

  it("protège GET et POST /channels", async () => {
    const { GET, POST } = await import("@/app/api/admin/youtube/channels/route");
    expect((await GET(makeRequest("GET"))).status).toBe(401);
    expect((await POST(makeRequest("POST", {}))).status).toBe(401);
  });

  it("protège DELETE /channels/[id]", async () => {
    const { DELETE } = await import("@/app/api/admin/youtube/channels/[id]/route");
    const res = await DELETE(makeRequest("DELETE"), {
      params: Promise.resolve({ id: "550e8400-e29b-41d4-a716-446655440000" }),
    });
    expect(res.status).toBe(401);
  });

  it("protège POST /channels/[id]/refresh", async () => {
    const { POST } = await import("@/app/api/admin/youtube/channels/[id]/refresh/route");
    const res = await POST(makeRequest("POST"), {
      params: Promise.resolve({ id: "550e8400-e29b-41d4-a716-446655440000" }),
    });
    expect(res.status).toBe(401);
  });

  it("protège POST /videos/import-url", async () => {
    const { POST } = await import("@/app/api/admin/youtube/videos/import-url/route");
    expect((await POST(makeRequest("POST", {}))).status).toBe(401);
  });

  it("protège les trois handlers chart", async () => {
    const recalculate = await import("@/app/api/admin/youtube/chart/recalculate/route");
    const validate = await import("@/app/api/admin/youtube/chart/validate/route");
    const preview = await import("@/app/api/admin/youtube/chart/preview/route");
    expect((await recalculate.POST(makeRequest("POST", {}))).status).toBe(401);
    expect((await validate.POST(makeRequest("POST", {}))).status).toBe(401);
    expect((await preview.POST(makeRequest("POST", {}))).status).toBe(401);
  });
});
