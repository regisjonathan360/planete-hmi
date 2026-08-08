import { describe, expect, it } from "vitest";
import {
  hasCollectedData,
  validateCollectedIdentity,
  type PlatformData,
} from "@/lib/artists/enrich";

function result(overrides: Partial<PlatformData> = {}): PlatformData {
  return {
    platform: "youtube",
    field: "url_youtube",
    externalId: "UC1234567890123456789012",
    externalUrl: "https://youtube.com/@artiste",
    name: null,
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
    method: "youtube_data_api",
    warnings: [],
    error: null,
    fetchedAt: "2026-07-28T00:00:00.000Z",
    ...overrides,
  };
}

describe("validation d'identité des collectes artiste", () => {
  it("ne considère pas une méthode seule comme une collecte réussie", () => {
    const empty = result({ field: "url_instagram", method: "page_metadata" });

    expect(hasCollectedData(empty)).toBe(false);
    expect(validateCollectedIdentity(empty, "Baky").error).toContain(
      "aucune donnée exploitable",
    );
  });

  it("ne considère pas la coquille générique Instagram comme un profil collecté", () => {
    const shell = result({
      platform: "instagram",
      field: "url_instagram",
      name: "Instagram",
      method: "page_metadata",
    });

    expect(hasCollectedData(shell)).toBe(false);
  });

  it("refuse une chaîne YouTube appartenant clairement à un autre artiste", () => {
    const mismatch = validateCollectedIdentity(
      result({ name: "TROUBLEBOY HITMAKER", subscriberCount: 658_000 }),
      "Baky",
    );

    expect(mismatch.error).toContain("ne correspond pas");
    expect(mismatch.error).toContain("Baky");
  });

  it("accepte le nom étendu de la chaîne officielle de l'artiste", () => {
    const matching = validateCollectedIdentity(
      result({ name: "Baky Popile Official", subscriberCount: 809_000 }),
      "Baky",
    );

    expect(matching.error).toBeNull();
    expect(hasCollectedData(matching)).toBe(true);
  });

  it("fait confiance à une chaîne déjà approuvée et liée en base", () => {
    const trusted = validateCollectedIdentity(
      result({ name: "Chaîne éditoriale approuvée", subscriberCount: 10 }),
      "Artiste",
      true,
    );

    expect(trusted.error).toBeNull();
  });
});
