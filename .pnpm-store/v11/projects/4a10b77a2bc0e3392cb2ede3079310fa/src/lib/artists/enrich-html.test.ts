import { describe, expect, it } from "vitest";
import { extractPageMetadata, mergeImages } from "./enrich-html";

describe("extractPageMetadata", () => {
  it("collecte les métadonnées Open Graph quel que soit l'ordre des attributs", () => {
    const result = extractPageMetadata(`
      <html><head>
        <meta content="Artiste Exemple" property="og:title">
        <meta property="og:description" content="Biographie publique">
        <meta content="/images/profile.jpg" property="og:image">
      </head></html>
    `, "https://example.com/artiste", "Site web");

    expect(result.name).toBe("Artiste Exemple");
    expect(result.description).toBe("Biographie publique");
    expect(result.images[0]?.url).toBe("https://example.com/images/profile.jpg");
  });

  it("collecte les images et liens JSON-LD sans doublons", () => {
    const result = extractPageMetadata(`
      <script type="application/ld+json">
        {"@type":"Person","name":"Mika","image":"https://cdn.test/mika.jpg","sameAs":["https://x.com/mika"]}
      </script>
      <meta property="og:image" content="https://cdn.test/mika.jpg">
    `, "https://mika.test", "Site web");

    expect(result.name).toBe("Mika");
    expect(result.images).toHaveLength(1);
    expect(result.details.related_urls).toEqual(["https://x.com/mika"]);
  });

  it("ignore un JSON-LD invalide et conserve les autres données", () => {
    const result = extractPageMetadata(`
      <title>Profil officiel</title>
      <script type="application/ld+json">{invalide}</script>
    `, "https://example.com", "Site web");

    expect(result.name).toBe("Profil officiel");
  });
});

describe("mergeImages", () => {
  it("préserve l'ordre tout en supprimant les URL en double", () => {
    const image = { url: "https://cdn.test/a.jpg", label: "A", type: "avatar" as const };
    expect(mergeImages([image], [{ ...image, label: "Copie" }])).toEqual([image]);
  });
});
