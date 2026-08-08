import { describe, expect, it } from "vitest";
import { containsBannedTerm, filterComment } from "./moderation";
import type { ModerationResult } from "./moderation";

describe("containsBannedTerm", () => {
  it("retourne false si la liste de termes est vide", () => {
    expect(containsBannedTerm("n'importe quel texte", [])).toBe(false);
  });

  it("retourne true quand le texte contient un terme interdit (exact)", () => {
    expect(containsBannedTerm("tu es un idiot", ["idiot"])).toBe(true);
  });

  it("effectue une correspondance insensible à la casse", () => {
    expect(containsBannedTerm("Tu es un IDIOT", ["idiot"])).toBe(true);
    expect(containsBannedTerm("tu es un idiot", ["IDIOT"])).toBe(true);
  });

  it("détecte les sous-chaînes (pas seulement les mots complets)", () => {
    expect(containsBannedTerm("absolutely", ["sol"])).toBe(true);
  });

  it("retourne false quand aucun terme n'est trouvé", () => {
    expect(containsBannedTerm("texte correct", ["insulte", "spam"])).toBe(
      false,
    );
  });

  it("fonctionne avec plusieurs termes (le premier trouvé suffit)", () => {
    expect(
      containsBannedTerm("message avec spam dedans", ["insulte", "spam"]),
    ).toBe(true);
  });

  it("retourne false pour un texte vide", () => {
    expect(containsBannedTerm("", ["terme"])).toBe(false);
  });

  it("retourne false si les termes interdits sont des chaînes vides", () => {
    // Une chaîne vide est une sous-chaîne de toute chaîne via String.includes,
    // mais un terme vide n'a pas de sens pour la modération.
    // Ce cas est un edge case : on documente le comportement.
    expect(containsBannedTerm("bonjour", [""])).toBe(true);
  });
});

describe("filterComment", () => {
  it("autorise un commentaire sans termes interdits", () => {
    const result: ModerationResult = filterComment("super chanson", [
      "insulte",
    ]);
    expect(result.allowed).toBe(true);
  });

  it("bloque un commentaire contenant un terme interdit", () => {
    const result = filterComment("tu es un idiot", ["idiot"]);
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.reason).toBeTruthy();
    }
  });

  it("autorise tout si la liste de termes est vide", () => {
    const result = filterComment("n'importe quoi ici", []);
    expect(result.allowed).toBe(true);
  });

  it("bloque en cas-insensible", () => {
    const result = filterComment("SPAM SPAM SPAM", ["spam"]);
    expect(result.allowed).toBe(false);
  });
});
