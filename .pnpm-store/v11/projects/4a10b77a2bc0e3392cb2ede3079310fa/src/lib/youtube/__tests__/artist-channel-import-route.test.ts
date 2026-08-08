import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  createAdminClient: vi.fn(() => ({ name: "admin-client" })),
  createStorage: vi.fn(() => ({ name: "sync-storage" })),
  syncPage: vi.fn(),
  resolveChannelUrl: vi.fn(),
  logAudit: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/admin-guard", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("@/lib/youtube/artist-channel-sync-storage", () => ({
  createArtistChannelSyncStorage: mocks.createStorage,
}));
vi.mock("@/lib/youtube/artist-channel-sync", () => ({
  synchronizeArtistProfilePage: mocks.syncPage,
}));
vi.mock("@/lib/youtube/api-client", () => ({
  resolveChannelUrl: mocks.resolveChannelUrl,
}));
vi.mock("@/lib/charts/audit", () => ({ logAudit: mocks.logAudit }));

const { POST } = await import(
  "@/app/api/admin/youtube/channels/import-artists/route"
);

function request(body: unknown) {
  return new Request("https://planete-hmi.test/api/admin/youtube/channels/import-artists", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/admin/youtube/channels/import-artists", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({
      ok: true,
      user: { id: "admin-id", email: "admin@example.com" },
    });
    mocks.syncPage.mockResolvedValue({
      profilesScanned: 1,
      urlsDetected: 1,
      created: 1,
      alreadyLinked: 0,
      linkedExisting: 0,
      duplicateProfileUrls: 0,
      conflicts: 0,
      errors: 0,
      details: [],
      nextCursor: null,
    });
  });

  it("refuse un utilisateur non authentifié", async () => {
    mocks.requireAdmin.mockResolvedValue({
      ok: false,
      status: 401,
      error: "Non authentifié.",
    });

    const response = await POST(request({ cursor: null }));

    expect(response.status).toBe(401);
    expect(mocks.syncPage).not.toHaveBeenCalled();
  });

  it("valide strictement le curseur", async () => {
    const response = await POST(request({ cursor: "pas-un-uuid" }));

    expect(response.status).toBe(400);
    expect(mocks.syncPage).not.toHaveBeenCalled();
  });

  it("synchronise une page et journalise uniquement le résumé", async () => {
    const response = await POST(request({ cursor: null }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.created).toBe(1);
    expect(mocks.syncPage).toHaveBeenCalledWith(
      { name: "sync-storage" },
      null,
      25,
      mocks.resolveChannelUrl
    );
    expect(mocks.logAudit).toHaveBeenCalledWith(
      { name: "admin-client" },
      expect.objectContaining({
        action: "youtube_artist_profiles_sync",
        newValue: expect.objectContaining({ created: 1, errors: 0 }),
      })
    );
  });
});
