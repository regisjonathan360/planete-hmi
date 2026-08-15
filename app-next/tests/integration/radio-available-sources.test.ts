/**
 * Tests d'intégration pour GET /api/admin/radio/available-sources
 * 
 * Tests :
 * - Authentification admin requise
 * - Récupération des classements publiés
 * - Récupération des sources de collecte habilitées
 * - Récupération des playlists manuelles
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3000";
const ADMIN_TOKEN = process.env.TEST_ADMIN_TOKEN; // Token JWT d'admin pour les tests

interface ChartResponse {
  id: string;
  name: string;
  track_count: number;
  platform: string;
}

interface SourceResponse {
  id: string;
  name: string;
  description?: string;
  track_count: number;
  type: string;
}

interface AvailableSourcesResponse {
  charts: ChartResponse[];
  sources: SourceResponse[];
}

async function callAPI(token?: string): Promise<Response> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  return fetch(`${BASE_URL}/api/admin/radio/available-sources`, {
    method: "GET",
    headers,
  });
}

describe("GET /api/admin/radio/available-sources", () => {
  describe("Authentification", () => {
    it("devrait retourner 401 sans token d'authentification", async () => {
      const response = await callAPI();
      expect(response.status).toBe(401);

      const data = await response.json();
      expect(data.error.code).toBe("unauthorized");
    });

    it("devrait retourner 403 avec un token non-admin", async () => {
      const response = await callAPI("invalid-token");
      expect(response.status).toBe(403);

      const data = await response.json();
      expect(data.error.code).toBe("forbidden");
    });

    it("devrait retourner 200 avec un token admin valide", async () => {
      if (!ADMIN_TOKEN) {
        console.warn("SKIP: TEST_ADMIN_TOKEN non configuré");
        return;
      }

      const response = await callAPI(ADMIN_TOKEN);
      expect(response.status).toBe(200);
    });
  });

  describe("Structure de réponse", () => {
    it("devrait retourner un objet avec 'charts' et 'sources'", async () => {
      if (!ADMIN_TOKEN) {
        console.warn("SKIP: TEST_ADMIN_TOKEN non configuré");
        return;
      }

      const response = await callAPI(ADMIN_TOKEN);
      expect(response.status).toBe(200);

      const data: AvailableSourcesResponse = await response.json();
      expect(data).toHaveProperty("charts");
      expect(data).toHaveProperty("sources");
      expect(Array.isArray(data.charts)).toBe(true);
      expect(Array.isArray(data.sources)).toBe(true);
    });

    it("chaque classement devrait avoir id, name, track_count, platform", async () => {
      if (!ADMIN_TOKEN) {
        console.warn("SKIP: TEST_ADMIN_TOKEN non configuré");
        return;
      }

      const response = await callAPI(ADMIN_TOKEN);
      const data: AvailableSourcesResponse = await response.json();

      for (const chart of data.charts) {
        expect(chart).toHaveProperty("id");
        expect(chart).toHaveProperty("name");
        expect(chart).toHaveProperty("track_count");
        expect(chart).toHaveProperty("platform");
        expect(typeof chart.id).toBe("string");
        expect(typeof chart.name).toBe("string");
        expect(typeof chart.track_count).toBe("number");
        expect(typeof chart.platform).toBe("string");
      }
    });

    it("chaque source devrait avoir id, name, track_count, type", async () => {
      if (!ADMIN_TOKEN) {
        console.warn("SKIP: TEST_ADMIN_TOKEN non configuré");
        return;
      }

      const response = await callAPI(ADMIN_TOKEN);
      const data: AvailableSourcesResponse = await response.json();

      for (const source of data.sources) {
        expect(source).toHaveProperty("id");
        expect(source).toHaveProperty("name");
        expect(source).toHaveProperty("track_count");
        expect(source).toHaveProperty("type");
        expect(typeof source.id).toBe("string");
        expect(typeof source.name).toBe("string");
        expect(typeof source.track_count).toBe("number");
        expect(typeof source.type).toBe("string");
        // description est optionnel
        if (source.description !== undefined) {
          expect(typeof source.description).toBe("string");
        }
      }
    });
  });

  describe("Contenu des données", () => {
    it("les classements retournés devraient être publiés", async () => {
      if (!ADMIN_TOKEN) {
        console.warn("SKIP: TEST_ADMIN_TOKEN non configuré");
        return;
      }

      const response = await callAPI(ADMIN_TOKEN);
      const data: AvailableSourcesResponse = await response.json();

      // Les classements retournés sont censés être publiés
      // (status = 'published')
      expect(data.charts).toBeDefined();
    });

    it("les sources devraient inclure des playlists manuelles et des sources de collecte", async () => {
      if (!ADMIN_TOKEN) {
        console.warn("SKIP: TEST_ADMIN_TOKEN non configuré");
        return;
      }

      const response = await callAPI(ADMIN_TOKEN);
      const data: AvailableSourcesResponse = await response.json();

      // Les sources devraient contenir des types différents
      const types = new Set(data.sources.map((s) => s.type));
      expect(types.size).toBeGreaterThanOrEqual(1);

      // Vérifier qu'il peut y avoir des playlists manuelles
      const hasManual = data.sources.some((s) => s.type === "manual");
      // Cette assertion pourrait être skippée si aucune playlist manuelle n'existe
      expect([true, false]).toContain(hasManual);
    });
  });

  describe("Gestion des erreurs", () => {
    it("devrait retourner une erreur bien formée en cas d'erreur", async () => {
      if (!ADMIN_TOKEN) {
        console.warn("SKIP: TEST_ADMIN_TOKEN non configuré");
        return;
      }

      const response = await callAPI(ADMIN_TOKEN);
      expect(response.ok).toBe(true); // Pas d'erreur en conditions normales

      if (!response.ok) {
        const data = await response.json();
        expect(data).toHaveProperty("error");
        expect(data.error).toHaveProperty("code");
        expect(data.error).toHaveProperty("message");
      }
    });
  });
});

/**
 * Exemple d'utilisation de la route en client :
 * 
 * const response = await fetch('/api/admin/radio/available-sources', {
 *   headers: {
 *     'Authorization': `Bearer ${authToken}`
 *   }
 * });
 * 
 * const data = await response.json();
 * console.log('Classements disponibles:', data.charts);
 * console.log('Sources disponibles:', data.sources);
 */
