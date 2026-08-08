import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatRelativeDate } from "./date-utils";

describe("formatRelativeDate", () => {
  const NOW = new Date("2024-06-15T12:00:00Z").getTime();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // --- Cas limites : futur et < 1 min ---

  describe("timestamp dans le futur ou < 1 min", () => {
    it("retourne 'il y a 1 min' pour un timestamp dans le futur", () => {
      const future = new Date(NOW + 60_000).toISOString();
      expect(formatRelativeDate(future)).toBe("il y a 1 min");
    });

    it("retourne 'il y a 1 min' pour un timestamp identique à maintenant", () => {
      const now = new Date(NOW).toISOString();
      expect(formatRelativeDate(now)).toBe("il y a 1 min");
    });

    it("retourne 'il y a 1 min' pour 30 secondes dans le passé", () => {
      const recent = new Date(NOW - 30_000).toISOString();
      expect(formatRelativeDate(recent)).toBe("il y a 1 min");
    });

    it("retourne 'il y a 1 min' pour exactement 59 secondes dans le passé", () => {
      const recent = new Date(NOW - 59_999).toISOString();
      expect(formatRelativeDate(recent)).toBe("il y a 1 min");
    });
  });

  // --- Minutes (1 min ≤ diff < 60 min) ---

  describe("il y a X min (< 60 minutes)", () => {
    it("retourne 'il y a 1 min' pour exactement 1 minute", () => {
      const ts = new Date(NOW - 60_000).toISOString();
      expect(formatRelativeDate(ts)).toBe("il y a 1 min");
    });

    it("retourne 'il y a 5 min' pour 5 minutes", () => {
      const ts = new Date(NOW - 5 * 60_000).toISOString();
      expect(formatRelativeDate(ts)).toBe("il y a 5 min");
    });

    it("retourne 'il y a 30 min' pour 30 minutes", () => {
      const ts = new Date(NOW - 30 * 60_000).toISOString();
      expect(formatRelativeDate(ts)).toBe("il y a 30 min");
    });

    it("retourne 'il y a 59 min' pour 59 minutes", () => {
      const ts = new Date(NOW - 59 * 60_000).toISOString();
      expect(formatRelativeDate(ts)).toBe("il y a 59 min");
    });
  });

  // --- Heures (60 min ≤ diff < 24 h) ---

  describe("il y a X h (< 24 heures)", () => {
    it("retourne 'il y a 1 h' pour exactement 60 minutes", () => {
      const ts = new Date(NOW - 60 * 60_000).toISOString();
      expect(formatRelativeDate(ts)).toBe("il y a 1 h");
    });

    it("retourne 'il y a 1 h' pour 90 minutes (arrondi bas)", () => {
      const ts = new Date(NOW - 90 * 60_000).toISOString();
      expect(formatRelativeDate(ts)).toBe("il y a 1 h");
    });

    it("retourne 'il y a 12 h' pour 12 heures", () => {
      const ts = new Date(NOW - 12 * 3_600_000).toISOString();
      expect(formatRelativeDate(ts)).toBe("il y a 12 h");
    });

    it("retourne 'il y a 23 h' pour 23 heures", () => {
      const ts = new Date(NOW - 23 * 3_600_000).toISOString();
      expect(formatRelativeDate(ts)).toBe("il y a 23 h");
    });

    it("retourne 'il y a 23 h' pour 23h59m (juste avant 24h)", () => {
      const ts = new Date(NOW - (23 * 3_600_000 + 59 * 60_000)).toISOString();
      expect(formatRelativeDate(ts)).toBe("il y a 23 h");
    });
  });

  // --- Jours (24 h ≤ diff < 7 j) ---

  describe("il y a X j (< 7 jours)", () => {
    it("retourne 'il y a 1 j' pour exactement 24 heures", () => {
      const ts = new Date(NOW - 24 * 3_600_000).toISOString();
      expect(formatRelativeDate(ts)).toBe("il y a 1 j");
    });

    it("retourne 'il y a 1 j' pour 36 heures (arrondi bas)", () => {
      const ts = new Date(NOW - 36 * 3_600_000).toISOString();
      expect(formatRelativeDate(ts)).toBe("il y a 1 j");
    });

    it("retourne 'il y a 3 j' pour 3 jours", () => {
      const ts = new Date(NOW - 3 * 86_400_000).toISOString();
      expect(formatRelativeDate(ts)).toBe("il y a 3 j");
    });

    it("retourne 'il y a 6 j' pour 6 jours", () => {
      const ts = new Date(NOW - 6 * 86_400_000).toISOString();
      expect(formatRelativeDate(ts)).toBe("il y a 6 j");
    });

    it("retourne 'il y a 6 j' pour 6 jours et 23 heures (juste avant 7j)", () => {
      const ts = new Date(NOW - (6 * 86_400_000 + 23 * 3_600_000)).toISOString();
      expect(formatRelativeDate(ts)).toBe("il y a 6 j");
    });
  });

  // --- Format absolu DD/MM/YYYY (≥ 7 jours) ---

  describe("DD/MM/YYYY (≥ 7 jours)", () => {
    it("retourne le format DD/MM/YYYY pour exactement 7 jours", () => {
      const ts = new Date(NOW - 7 * 86_400_000).toISOString();
      // 7 jours avant 2024-06-15 = 2024-06-08
      expect(formatRelativeDate(ts)).toBe("08/06/2024");
    });

    it("retourne le format DD/MM/YYYY pour 30 jours", () => {
      const ts = new Date(NOW - 30 * 86_400_000).toISOString();
      // 30 jours avant 2024-06-15 = 2024-05-16
      expect(formatRelativeDate(ts)).toBe("16/05/2024");
    });

    it("retourne le format DD/MM/YYYY pour une date d'une autre année", () => {
      const ts = "2023-01-05T10:00:00Z";
      expect(formatRelativeDate(ts)).toBe("05/01/2023");
    });

    it("affiche les zéros initiaux pour jour et mois", () => {
      const ts = "2024-01-03T08:00:00Z";
      expect(formatRelativeDate(ts)).toBe("03/01/2024");
    });

    it("gère le dernier jour de décembre", () => {
      const ts = "2023-12-31T23:59:00Z";
      expect(formatRelativeDate(ts)).toBe("31/12/2023");
    });
  });
});
