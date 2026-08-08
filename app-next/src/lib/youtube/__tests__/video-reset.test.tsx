import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { BoutiqueDevelopmentOverlay } from "@/components/BoutiqueDevelopmentOverlay";
import {
  YOUTUBE_VIDEO_RESET_CONFIRMATIONS,
  youtubeVideoResetSchema,
} from "@/lib/youtube/video-reset";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  createAdminClient: vi.fn(),
  logAudit: vi.fn(),
}));

vi.mock("@/lib/auth/admin-guard", () => ({
  requireAdmin: () => mocks.requireAdmin(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => mocks.createAdminClient(),
}));

vi.mock("@/lib/charts/audit", () => ({
  logAudit: (...args: unknown[]) => mocks.logAudit(...args),
}));

vi.mock("server-only", () => ({}));

describe("youtubeVideoResetSchema", () => {
  it.each([
    ["pending", "VIDER LA FILE"],
    ["rejected", "NETTOYER LES ECARTEES"],
    ["all", "REINITIALISER YOUTUBE"],
  ] as const)("accepte la confirmation exacte pour %s", (scope, confirmation) => {
    expect(youtubeVideoResetSchema.safeParse({ scope, confirmation }).success).toBe(
      true
    );
  });

  it("refuse une confirmation approximative", () => {
    const result = youtubeVideoResetSchema.safeParse({
      scope: "all",
      confirmation: "reinitialiser youtube",
    });
    expect(result.success).toBe(false);
  });
});

describe("BoutiqueDevelopmentOverlay", () => {
  it("annonce clairement la fermeture temporaire et le mouvement mobile", () => {
    const markup = renderToStaticMarkup(<BoutiqueDevelopmentOverlay />);
    expect(markup).toContain("La boutique arrive bientôt");
    expect(markup).toContain("BOUTIQUE EN PRÉPARATION");
    expect(markup).toContain("Retour à l’accueil");
  });
});

describe("POST /api/admin/youtube/videos/reset", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({
      ok: true,
      user: { id: "admin-001", email: "admin@test.com" },
    });
    mocks.logAudit.mockResolvedValue(undefined);
  });

  it("protège la route par le rôle administrateur", async () => {
    mocks.requireAdmin.mockResolvedValue({
      ok: false,
      status: 403,
      error: "Accès refusé.",
    });
    const { POST } = await import(
      "@/app/api/admin/youtube/videos/reset/route"
    );
    const response = await POST(
      new Request("http://localhost/api/admin/youtube/videos/reset", {
        method: "POST",
        body: JSON.stringify({
          scope: "pending",
          confirmation: YOUTUBE_VIDEO_RESET_CONFIRMATIONS.pending,
        }),
      })
    );
    expect(response.status).toBe(403);
  });

  it("refuse une phrase de confirmation incorrecte", async () => {
    const { POST } = await import(
      "@/app/api/admin/youtube/videos/reset/route"
    );
    const response = await POST(
      new Request("http://localhost/api/admin/youtube/videos/reset", {
        method: "POST",
        body: JSON.stringify({ scope: "all", confirmation: "OUI" }),
      })
    );
    expect(response.status).toBe(400);
  });

  it("appelle la RPC et journalise la réinitialisation", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          success: true,
          message: "ok",
          affected_count: 8,
          deleted_count: 6,
          archived_count: 2,
        },
      ],
      error: null,
    });
    const supabase = { rpc, from: vi.fn() };
    mocks.createAdminClient.mockReturnValue(supabase);

    const { POST } = await import(
      "@/app/api/admin/youtube/videos/reset/route"
    );
    const response = await POST(
      new Request("http://localhost/api/admin/youtube/videos/reset", {
        method: "POST",
        body: JSON.stringify({
          scope: "all",
          confirmation: YOUTUBE_VIDEO_RESET_CONFIRMATIONS.all,
        }),
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      affectedCount: 8,
      deletedCount: 6,
      archivedCount: 2,
    });
    expect(rpc).toHaveBeenCalledWith("reset_youtube_collected_videos", {
      p_scope: "all",
      p_confirmation: YOUTUBE_VIDEO_RESET_CONFIRMATIONS.all,
    });
    expect(mocks.logAudit).toHaveBeenCalledWith(
      supabase,
      expect.objectContaining({ action: "youtube_videos_reset" })
    );
  });

  it("refuse la réinitialisation pendant une collecte active", async () => {
    const supabase = {
      rpc: vi.fn().mockResolvedValue({
        data: [
          {
            success: false,
            message: "collection_in_progress",
            affected_count: 0,
            deleted_count: 0,
            archived_count: 0,
          },
        ],
        error: null,
      }),
      from: vi.fn(),
    };
    mocks.createAdminClient.mockReturnValue(supabase);

    const { POST } = await import(
      "@/app/api/admin/youtube/videos/reset/route"
    );
    const response = await POST(
      new Request("http://localhost/api/admin/youtube/videos/reset", {
        method: "POST",
        body: JSON.stringify({
          scope: "pending",
          confirmation: YOUTUBE_VIDEO_RESET_CONFIRMATIONS.pending,
        }),
      })
    );
    expect(response.status).toBe(409);
    expect(mocks.logAudit).not.toHaveBeenCalled();
  });
});
