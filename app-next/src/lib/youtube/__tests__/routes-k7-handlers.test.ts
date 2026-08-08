import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAdmin = vi.fn();
const createAdminClient = vi.fn();
const revalidatePath = vi.fn();
const buildYouTubePublication = vi.fn();

vi.mock("@/lib/auth/admin-guard", () => ({ requireAdmin: () => requireAdmin() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => createAdminClient() }));
vi.mock("next/cache", () => ({ revalidatePath: (...args: unknown[]) => revalidatePath(...args) }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/youtube/publication", () => ({
  YOUTUBE_CHART_METHODOLOGY: "Méthodologie YouTube de test suffisamment longue",
  buildYouTubePublication: (...args: unknown[]) => buildYouTubePublication(...args),
}));

function request(method: string, body?: unknown, url = "http://localhost/test") {
  return new Request(url, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: body === undefined ? undefined : { "content-type": "application/json" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  requireAdmin.mockResolvedValue({ ok: true, user: { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" } });
  buildYouTubePublication.mockResolvedValue({ payload: { entries: [{}] }, editableState: [] });
});

describe("handlers K7", () => {
  it("refuse la publication sans administrateur", async () => {
    requireAdmin.mockResolvedValue({ ok: false, status: 403, error: "Interdit" });
    const { POST } = await import("@/app/api/admin/youtube/chart/publish/route");
    expect((await POST(request("POST", {}))).status).toBe(403);
  });

  it("publie via la RPC atomique et invalide le cache", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{ success: true, publication_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", version: 1 }],
      error: null,
    });
    createAdminClient.mockReturnValue({ rpc });
    const { POST } = await import("@/app/api/admin/youtube/chart/publish/route");
    const response = await POST(request("POST", { editionId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc" }));
    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("publish_youtube_chart", expect.objectContaining({
      p_edition_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      p_published_by: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    }));
    expect(revalidatePath).toHaveBeenCalledWith("/charts");
  });

  it("refuse une programmation passée", async () => {
    const { POST } = await import("@/app/api/admin/youtube/chart/schedule/route");
    const response = await POST(request("POST", {
      editionId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      publishAt: "2020-01-01T00:00:00Z",
      timezone: "America/Port-au-Prince",
    }));
    expect(response.status).toBe(400);
  });

  it("annule une programmation via la RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
    createAdminClient.mockReturnValue({ rpc });
    const { DELETE } = await import("@/app/api/admin/youtube/chart/schedule/route");
    const response = await DELETE(request("DELETE", {
      editionId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    }));
    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("cancel_youtube_chart_publication", expect.any(Object));
  });

  it("crée une révision avec justification", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
    createAdminClient.mockReturnValue({ rpc });
    const { POST } = await import("@/app/api/admin/youtube/chart/revision/route");
    const response = await POST(request("POST", {
      editionId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      reason: "Correction éditoriale",
    }));
    expect(response.status).toBe(200);
  });

  it("refuse le cron sans secret", async () => {
    const previous = process.env.CRON_SECRET;
    process.env.CRON_SECRET = "cron-test";
    const { GET } = await import("@/app/api/cron/youtube-publish/route");
    const response = await GET(request("GET"));
    expect(response.status).toBe(401);
    process.env.CRON_SECRET = previous;
  });
});
