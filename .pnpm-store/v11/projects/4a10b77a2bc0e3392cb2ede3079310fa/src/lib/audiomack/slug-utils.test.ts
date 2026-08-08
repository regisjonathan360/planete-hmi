import { describe, it, expect } from "vitest";
import {
  extractSlugsFromUrl,
  generateFallbackSlug,
  buildEmbedUrl,
  validateEmbedUrl,
} from "./slug-utils";

describe("extractSlugsFromUrl", () => {
  it("extrait les slugs d'une URL valide", () => {
    const result = extractSlugsFromUrl(
      "https://audiomack.com/artist-a/song/konpa-love"
    );
    expect(result).toEqual({ artistSlug: "artist-a", trackSlug: "konpa-love" });
  });

  it("extrait les slugs avec www.", () => {
    const result = extractSlugsFromUrl(
      "https://www.audiomack.com/dj-flex/song/summer-hit"
    );
    expect(result).toEqual({ artistSlug: "dj-flex", trackSlug: "summer-hit" });
  });

  it("gère les slugs avec des points et underscores", () => {
    const result = extractSlugsFromUrl(
      "https://audiomack.com/artist_name.123/song/track.name_1"
    );
    expect(result).toEqual({
      artistSlug: "artist_name.123",
      trackSlug: "track.name_1",
    });
  });

  it("ignore les query params et fragments", () => {
    const result = extractSlugsFromUrl(
      "https://audiomack.com/artist-b/song/raboday-fire?ref=share#top"
    );
    expect(result).toEqual({
      artistSlug: "artist-b",
      trackSlug: "raboday-fire",
    });
  });

  it("retourne null pour une URL invalide (mauvais format)", () => {
    expect(extractSlugsFromUrl("https://audiomack.com/artist/album/track")).toBe(
      null
    );
    expect(extractSlugsFromUrl("https://spotify.com/track/123")).toBe(null);
    expect(extractSlugsFromUrl("not-a-url")).toBe(null);
  });

  it("retourne null pour une chaîne vide", () => {
    expect(extractSlugsFromUrl("")).toBe(null);
  });

  it("retourne les slugs en lowercase", () => {
    const result = extractSlugsFromUrl(
      "https://audiomack.com/ArtistName/song/TrackTitle"
    );
    expect(result).toEqual({
      artistSlug: "artistname",
      trackSlug: "tracktitle",
    });
  });
});

describe("generateFallbackSlug", () => {
  it("convertit un nom simple en slug", () => {
    expect(generateFallbackSlug("Artist Name")).toBe("artist-name");
  });

  it("supprime les accents", () => {
    expect(generateFallbackSlug("Étoile Créole")).toBe("etoile-creole");
  });

  it("supprime les caractères spéciaux", () => {
    expect(generateFallbackSlug("DJ $pecial (feat. MC)")).toBe(
      "dj-pecial-feat-mc"
    );
  });

  it("collapse les hyphens consécutifs", () => {
    expect(generateFallbackSlug("hello---world")).toBe("hello-world");
  });

  it("supprime les hyphens en début/fin", () => {
    expect(generateFallbackSlug("--test--")).toBe("test");
  });

  it("retourne 'unknown' pour une chaîne vide", () => {
    expect(generateFallbackSlug("")).toBe("unknown");
  });

  it("retourne 'unknown' pour des caractères non-alphanumériques uniquement", () => {
    expect(generateFallbackSlug("!@#$%")).toBe("unknown");
  });

  it("gère les nombres", () => {
    expect(generateFallbackSlug("Track 123")).toBe("track-123");
  });
});

describe("buildEmbedUrl", () => {
  it("construit l'URL d'embed correctement", () => {
    expect(buildEmbedUrl("artist-a", "konpa-love")).toBe(
      "https://audiomack.com/embed/song/artist-a/konpa-love"
    );
  });

  it("fonctionne avec des slugs numériques", () => {
    expect(buildEmbedUrl("dj123", "track456")).toBe(
      "https://audiomack.com/embed/song/dj123/track456"
    );
  });
});

describe("validateEmbedUrl", () => {
  it("valide une URL d'embed correcte", () => {
    expect(
      validateEmbedUrl("https://audiomack.com/embed/song/artist-a/konpa-love")
    ).toBe(true);
  });

  it("valide avec des points et underscores dans les slugs", () => {
    expect(
      validateEmbedUrl(
        "https://audiomack.com/embed/song/artist.name/track_1"
      )
    ).toBe(true);
  });

  it("rejette une URL sans le préfixe embed/song", () => {
    expect(
      validateEmbedUrl("https://audiomack.com/artist-a/song/konpa-love")
    ).toBe(false);
  });

  it("rejette une URL vide", () => {
    expect(validateEmbedUrl("")).toBe(false);
  });

  it("rejette une URL http (non https)", () => {
    expect(
      validateEmbedUrl("http://audiomack.com/embed/song/artist-a/konpa-love")
    ).toBe(false);
  });

  it("rejette une URL avec un domaine différent", () => {
    expect(
      validateEmbedUrl("https://spotify.com/embed/song/artist-a/konpa-love")
    ).toBe(false);
  });

  it("rejette un slug commençant par un tiret", () => {
    expect(
      validateEmbedUrl("https://audiomack.com/embed/song/-invalid/track")
    ).toBe(false);
  });
});
