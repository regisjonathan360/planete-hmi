import { describe, expect, it } from "vitest";
import {
  defaultYouTubePeriod,
  formatNumber,
  isRunTerminal,
  readApiError,
} from "./utils";

describe("YouTube admin utils", () => {
  it("calcule une période hebdomadaire stable en UTC", () => {
    expect(defaultYouTubePeriod(new Date("2026-07-25T18:00:00.000Z"))).toEqual({
      periodStart: "2026-07-18",
      periodEnd: "2026-07-25",
    });
  });

  it("lit les erreurs structurées sans exposer un objet brut", () => {
    expect(readApiError({ error: { message: "Action refusée." } }, "Erreur")).toBe(
      "Action refusée."
    );
    expect(readApiError({ error: "Connexion refusée." }, "Erreur")).toBe(
      "Connexion refusée."
    );
    expect(readApiError(null, "Erreur contrôlée.")).toBe("Erreur contrôlée.");
  });

  it("reconnaît uniquement les statuts terminaux", () => {
    expect(isRunTerminal("COMPLETED")).toBe(true);
    expect(isRunTerminal("COMPLETED_WITH_WARNINGS")).toBe(true);
    expect(isRunTerminal("FAILED")).toBe(true);
    expect(isRunTerminal("CANCELLED")).toBe(true);
    expect(isRunTerminal("RUNNING")).toBe(false);
  });

  it("borne les compteurs affichés à zéro", () => {
    expect(formatNumber(-4)).toBe("0");
  });
});
