import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  createAdminClient: vi.fn(() => ({ name: "admin-client" })),
  scanAdvancedDuplicates: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/admin-guard", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("@/lib/artists/detect-duplicates", () => ({
  scanAdvancedDuplicates: mocks.scanAdvancedDuplicates,
}));

const { POST } = await import("@/app/api/admin/doublons/scan/route");

function request(body: unknown) {
  return new Request("https://planete-hmi.test/api/admin/doublons/scan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/admin/doublons/scan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({
      ok: true,
      user: { id: "admin-id", email: "admin@example.com" },
    });
    mocks.scanAdvancedDuplicates.mockResolvedValue({
      artistsScanned: 500,
      pairsCompared: 124750,
      matchesFound: 12,
      created: 8,
      updated: 2,
      alreadyReviewed: 2,
      threshold: 0.4,
      sensitivity: "broad",
    });
  });

  it("refuse les utilisateurs non administrateurs", async () => {
    mocks.requireAdmin.mockResolvedValue({
      ok: false,
      status: 403,
      error: "Interdit.",
    });

    const response = await POST(request({ sensitivity: "broad" }));

    expect(response.status).toBe(403);
    expect(mocks.scanAdvancedDuplicates).not.toHaveBeenCalled();
  });

  it("valide strictement le niveau de sensibilité", async () => {
    const response = await POST(request({ sensitivity: "extrême" }));

    expect(response.status).toBe(400);
    expect(mocks.scanAdvancedDuplicates).not.toHaveBeenCalled();
  });

  it("lance une recherche très large", async () => {
    const response = await POST(request({ sensitivity: "broad" }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.pairsCompared).toBe(124750);
    expect(mocks.scanAdvancedDuplicates).toHaveBeenCalledWith(
      { name: "admin-client" },
      "broad",
    );
  });
});
