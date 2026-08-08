import { describe, expect, it } from "vitest";
import {
  extractProductionCredits,
  producerKey,
} from "../extract-credits";

describe("extractProductionCredits", () => {
  it("lit une mention « Prod. by » en fin de titre", () => {
    const { credits, cleanTitle } = extractProductionCredits("Bèl Ti Fanm (Prod. by Michael Brun)");
    expect(credits).toHaveLength(1);
    expect(credits[0].name).toBe("Michael Brun");
    expect(credits[0].role).toBe("producer");
    expect(cleanTitle).toBe("Bèl Ti Fanm");
  });

  it("accepte les crochets et l'absence de « by »", () => {
    const { credits } = extractProductionCredits("Anmwey [Prod Tonymix]");
    expect(credits.map((c) => c.name)).toEqual(["Tonymix"]);
  });

  it("sépare plusieurs producteurs", () => {
    const { credits } = extractProductionCredits("Kite M Pale (Prod. Tonymix x Dj Bullet)");
    expect(credits.map((c) => c.name)).toEqual(["Tonymix", "Dj Bullet"]);
  });

  it("gère « & » et les virgules", () => {
    const { credits } = extractProductionCredits("Lakay (Produced by Fresh Izzo & Zoe Ken, Mikaben)");
    expect(credits.map((c) => c.name)).toEqual(["Fresh Izzo", "Zoe Ken", "Mikaben"]);
  });

  it("reconnaît le rôle beatmaker", () => {
    const { credits } = extractProductionCredits("Vibes (Beat by Sanders)");
    expect(credits[0].role).toBe("beatmaker");
    expect(credits[0].name).toBe("Sanders");
  });

  it("reconnaît le co-producteur", () => {
    const { credits } = extractProductionCredits("Soley (Co-prod. Baky)");
    expect(credits[0].role).toBe("co-producer");
  });

  it("reconnaît le producteur exécutif", () => {
    const { credits } = extractProductionCredits("Album Intro (Executive producer: Wanito)");
    expect(credits[0].role).toBe("executive_producer");
    expect(credits[0].name).toBe("Wanito");
  });

  it("accepte la variante française « prod par »", () => {
    const { credits } = extractProductionCredits("Renmen - prod par Kdilak");
    expect(credits.map((c) => c.name)).toEqual(["Kdilak"]);
  });

  it("lit une mention au milieu du titre en gardant le reste", () => {
    const { credits, cleanTitle } = extractProductionCredits(
      "Mizik (Prod. by Tonymix) feat. Rutshelle",
    );
    expect(credits.map((c) => c.name)).toEqual(["Tonymix"]);
    expect(cleanTitle).toBe("Mizik feat. Rutshelle");
  });

  it("ne renvoie aucun crédit sans mention explicite", () => {
    for (const title of [
      "Bèl Ti Fanm",
      "Mizik feat. Rutshelle Guillaume",
      "Konpa Live (Remix)",
      "Ann Ale (Official Video)",
    ]) {
      expect(extractProductionCredits(title).credits).toEqual([]);
    }
  });

  it("écarte les faux noms", () => {
    expect(extractProductionCredits("Titre (Prod. by unknown)").credits).toEqual([]);
    expect(extractProductionCredits("Titre (Prod. by 123)").credits).toEqual([]);
    expect(extractProductionCredits("Titre (Prod. by https://beats.example)").credits).toEqual([]);
    expect(extractProductionCredits("Titre (Prod. by X)").credits).toEqual([]);
  });

  it("déduplique un même producteur mentionné deux fois", () => {
    const { credits } = extractProductionCredits("Titre (Prod. Tonymix) [prod tonymix]");
    expect(credits).toHaveLength(1);
  });

  it("retire l'arobase des pseudos", () => {
    const { credits } = extractProductionCredits("Titre (Prod. @tonymix)");
    expect(credits[0].name).toBe("tonymix");
  });

  it("tolère les entrées vides", () => {
    expect(extractProductionCredits(null)).toEqual({ cleanTitle: "", credits: [] });
    expect(extractProductionCredits("   ")).toEqual({ cleanTitle: "", credits: [] });
  });

  it("ne renvoie jamais un titre nettoyé vide", () => {
    const { cleanTitle } = extractProductionCredits("(Prod. by Tonymix)");
    expect(cleanTitle.length).toBeGreaterThan(0);
  });
});

describe("producerKey", () => {
  it("ignore casse, accents et ponctuation", () => {
    expect(producerKey("Michaël BRUN")).toBe(producerKey("michael brun"));
    expect(producerKey("Dj  Bullet!")).toBe(producerKey("djbullet"));
  });

  it("renvoie une chaîne vide pour une entrée non alphanumérique", () => {
    expect(producerKey("!!!")).toBe("");
  });
});
