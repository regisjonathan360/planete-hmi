import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  createAdminClient: vi.fn(() => ({ name: "admin-client" })),
  enrichArtistFromField: vi.fn(),
  enrichArtistFromAllFields: vi.fn(),
  applyCollectedImage: vi.fn(),
  getStoredEnrichment: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/admin-guard", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("@/lib/artists/enrich", () => ({
  ENRICHABLE_FIELDS: ["url_spotify", "url_youtube", "url_website"],
  enrichArtistFromField: mocks.enrichArtistFromField,
  enrichArtistFromAllFields: mocks.enrichArtistFromAllFields,
  applyCollectedImage: mocks.applyCollectedImage,
  getStoredEnrichment: mocks.getStoredEnrichment,
}));

const { GET, POST, PATCH } = await import(
  "@/app/api/admin/artistes/[id]/enrich/route"
);

const params = { params: Promise.resolve({ id: "artist-id" }) };

function request(method: string, body?: unknown) {
  return new Request("https://planete-hmi.test/api/admin/artistes/artist-id/enrich", {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function result(platform: string, error: string | null = null) {
  return {
    platform,
    field: `url_${platform}`,
    externalId: "external-id",
    externalUrl: `https://${platform}.example/artist`,
    name: "Artiste",
    description: null,
    images: [],
    monthlyListeners: null,
    followers: null,
    subscriberCount: null,
    totalViews: null,
    popularity: null,
    genres: [],
    albumCount: null,
    trackCount: null,
    details: {},
    method: "test",
    warnings: [],
    error,
    fetchedAt: "2026-07-28T00:00:00.000Z",
  };
}

describe("routes d'enrichissement artiste", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({
      ok: true,
      user: { id: "admin-id", email: "admin@example.com" },
    });
  });

  it("protège aussi la lecture de l'historique", async () => {
    mocks.requireAdmin.mockResolvedValue({
      ok: false,
      status: 403,
      error: "Interdit.",
    });

    const response = await GET(request("GET"), params);

    expect(response.status).toBe(403);
    expect(mocks.getStoredEnrichment).not.toHaveBeenCalled();
  });

  it("retourne les collectes persistées", async () => {
    mocks.getStoredEnrichment.mockResolvedValue({
      results: { url_spotify: result("spotify") },
      availableFields: ["url_spotify"],
    });

    const response = await GET(request("GET"), params);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.availableFields).toEqual(["url_spotify"]);
    expect(mocks.getStoredEnrichment).toHaveBeenCalledWith(
      { name: "admin-client" },
      "artist-id",
    );
  });

  it("refuse un champ non autorisé", async () => {
    const response = await POST(request("POST", { field: "url_secret" }), params);

    expect(response.status).toBe(400);
    expect(mocks.enrichArtistFromField).not.toHaveBeenCalled();
  });

  it("collecte une URL fraîchement saisie", async () => {
    mocks.enrichArtistFromField.mockResolvedValue(result("spotify"));

    const response = await POST(
      request("POST", {
        field: "url_spotify",
        url: "https://open.spotify.com/artist/1234567890123456789012",
      }),
      params,
    );

    expect(response.status).toBe(200);
    expect(mocks.enrichArtistFromField).toHaveBeenCalledWith(
      { name: "admin-client" },
      "artist-id",
      "url_spotify",
      "https://open.spotify.com/artist/1234567890123456789012",
    );
  });

  it("collecte toutes les URL et compte les limitations", async () => {
    mocks.enrichArtistFromAllFields.mockResolvedValue({
      url_spotify: result("spotify"),
      url_youtube: result("youtube", "Quota indisponible."),
    });

    const response = await POST(
      request("POST", {
        field: "all",
        urls: {
          url_spotify: "https://open.spotify.com/artist/1234567890123456789012",
          url_youtube: "https://youtube.com/@artiste",
          url_inconnue: "https://example.com",
        },
      }),
      params,
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.failures).toBe(1);
    expect(mocks.enrichArtistFromAllFields).toHaveBeenCalledWith(
      { name: "admin-client" },
      "artist-id",
      {
        url_spotify: "https://open.spotify.com/artist/1234567890123456789012",
        url_youtube: "https://youtube.com/@artiste",
      },
    );
  });

  it("archive uniquement une image collectée avant de l'appliquer", async () => {
    mocks.applyCollectedImage.mockResolvedValue({
      url: "https://storage.example/artist-id/image.jpg",
      archived: true,
    });

    const response = await PATCH(
      request("PATCH", {
        imageUrl: "https://cdn.example/photo.jpg",
        target: "banner_url",
      }),
      params,
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.archived).toBe(true);
    expect(mocks.applyCollectedImage).toHaveBeenCalledWith(
      { name: "admin-client" },
      "artist-id",
      "https://cdn.example/photo.jpg",
      "banner_url",
    );
  });
});
