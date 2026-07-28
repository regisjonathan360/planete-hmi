import { describe, expect, it } from "vitest";
import { getHmiShortEmbedUrl, parseHmiShortUrl } from "./hmi-shorts";

describe("parseHmiShortUrl", () => {
  it("normalise un YouTube Short", () => {
    const result = parseHmiShortUrl("https://youtube.com/shorts/AbCd_12345?feature=share");
    expect(result.platform).toBe("youtube");
    expect(result.canonicalUrl).toBe("https://www.youtube.com/shorts/AbCd_12345");
  });

  it("accepte une URL YouTube courte", () => {
    expect(parseHmiShortUrl("https://youtu.be/AbCd_12345").externalId).toBe("AbCd_12345");
  });

  it("normalise un Reel Instagram", () => {
    const result = parseHmiShortUrl("https://www.instagram.com/reel/C7abc_123/");
    expect(result.platform).toBe("instagram");
    expect(result.embedUrl).toContain("/C7abc_123/embed/");
  });

  it("extrait l’identifiant d’une vidéo TikTok", () => {
    const result = parseHmiShortUrl(
      "https://www.tiktok.com/@planetehmi/video/7390123456789012345",
    );
    expect(result.platform).toBe("tiktok");
    expect(result.externalId).toBe("7390123456789012345");
  });

  it("accepte un lien TikTok raccourci sans inventer d’identifiant", () => {
    const result = parseHmiShortUrl("https://vm.tiktok.com/ZMshortCode/");
    expect(result.externalId).toBeNull();
    expect(result.embedUrl).toBeNull();
  });

  it("refuse les domaines inconnus", () => {
    expect(() => parseHmiShortUrl("https://example.com/video/123")).toThrow(
      "Plateforme non prise en charge",
    );
  });
});

describe("getHmiShortEmbedUrl", () => {
  it("utilise youtube-nocookie", () => {
    expect(getHmiShortEmbedUrl("youtube", "abc123")).toBe(
      "https://www.youtube-nocookie.com/embed/abc123",
    );
  });
});
