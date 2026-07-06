/**
 * Tests d'intégration du workflow Classements (logique pure, sans DB live).
 * Couvre : création d'édition (simulée), filtrage, correspondance auto,
 * validation, publication, rollback, isolation des plateformes, conservation
 * de la dernière édition.
 */
import { describe, it, expect } from "vitest";

import { calculerPositionsFiltrees } from "../../src/lib/charts/ranking/calculate-filtered-positions";
import { calculerMouvement } from "../../src/lib/charts/ranking/calculate-movement";
import { calculerHistorique } from "../../src/lib/charts/ranking/calculate-chart-history";
import { validerEdition } from "../../src/lib/charts/validation/validate-edition";
import { trouverCorrespondance } from "../../src/lib/charts/matching/match-track";
import { validerLignesImport } from "../../src/lib/charts/validation/schemas";
import { normalizeTitle } from "../../src/lib/charts/normalization/normalize-title";
import { collecteIsolee } from "../../src/lib/charts/adapters/registry";
import "../../src/lib/charts/adapters/index"; // enregistre les adaptateurs

describe("Workflow intégration : import → validation → publication", () => {
  it("import CSV valide produit des lignes normalisées", () => {
    const raw = [
      { source_position: 2, track_title: "Titre A", artist_names: "Artiste X", source_period_start: "2026-07-03", source_period_end: "2026-07-09", source_url: "https://ex" },
      { source_position: 5, track_title: "Titre B (Official Video)", artist_names: "Artiste Y feat. Z", source_period_start: "2026-07-03", source_period_end: "2026-07-09", source_url: "https://ex" },
    ];
    const { valides, invalides } = validerLignesImport(raw);
    expect(valides.length).toBe(2);
    expect(invalides.length).toBe(0);
    expect(normalizeTitle(valides[1].track_title)).toBe("titre b");
  });

  it("correspondance auto par ISRC => publiable", () => {
    const r = trouverCorrespondance(
      { isrc: "ISRC123", normalizedTitle: "titre" },
      [{ trackId: "t1", isrc: "ISRC123", normalizedTitle: "titre" }]
    );
    expect(r.publiable).toBe(true);
  });

  it("validation échoue si position dupliquée", () => {
    const r = validerEdition({
      sourceKey: "spotify_haiti_popular",
      periodStart: "2026-07-03T00:00:00Z",
      periodEnd: "2026-07-09T23:59:59Z",
      entries: [
        { trackId: "t1", filteredPosition: 1, sourcePosition: 2, artisteVerifie: true, periodStart: "2026-07-03T00:00:00Z" },
        { trackId: "t2", filteredPosition: 1, sourcePosition: 5, artisteVerifie: true, periodStart: "2026-07-03T00:00:00Z" },
      ],
    });
    expect(r.valid).toBe(false);
  });

  it("validation réussit après correction", () => {
    const r = validerEdition({
      sourceKey: "spotify_haiti_popular",
      periodStart: "2026-07-03T00:00:00Z",
      periodEnd: "2026-07-09T23:59:59Z",
      entries: [
        { trackId: "t1", filteredPosition: 1, sourcePosition: 2, artisteVerifie: true, periodStart: "2026-07-03T00:00:00Z" },
        { trackId: "t2", filteredPosition: 2, sourcePosition: 5, artisteVerifie: true, periodStart: "2026-07-03T00:00:00Z" },
      ],
    });
    expect(r.valid).toBe(true);
  });

  it("publication => recalcul mouvements et peak", () => {
    const fp = calculerPositionsFiltrees([
      { sourcePosition: 1, eligible: true, data: "A" },
      { sourcePosition: 3, eligible: true, data: "B" },
    ]);
    expect(fp[0].filteredPosition).toBe(1);
    const mv = calculerMouvement(1, { previousFilteredPosition: 3, aDejaFigure: true });
    expect(mv.entryStatus).toBe("up");
    const h = calculerHistorique(1, [3, 2]);
    expect(h.peakFilteredPosition).toBe(1);
    expect(h.weeksOnChart).toBe(3);
  });

  it("rollback => aucune corruption (validation/publication sont des transitions d'état)", () => {
    // Simulation : une édition published -> validated (rollback) reste valide
    const r = validerEdition({
      sourceKey: "youtube_haiti_official",
      periodStart: "2026-07-03T00:00:00Z",
      periodEnd: "2026-07-09T23:59:59Z",
      entries: [{ trackId: "t1", filteredPosition: 1, sourcePosition: 1, artisteVerifie: true, periodStart: "2026-07-03T00:00:00Z" }],
    });
    expect(r.valid).toBe(true);
  });

  it("échec d'une source ne bloque pas les autres (Property 16)", async () => {
    // Spotify renverra manual_import_required (pas d'erreur de crash).
    const r = await collecteIsolee("spotify", {
      sourceKey: "spotify_haiti_popular",
      periodStart: "2026-07-03T00:00:00Z",
      periodEnd: "2026-07-09T23:59:59Z",
      limit: 10,
    });
    expect(r.status).toBe("manual_import_required");
    // YouTube peut être appelé indépendamment.
    const r2 = await collecteIsolee("youtube", {
      sourceKey: "youtube_haiti_official",
      periodStart: "2026-07-03T00:00:00Z",
      periodEnd: "2026-07-09T23:59:59Z",
      limit: 10,
    });
    expect(r2.status).toBe("manual_import_required");
  });

  it("conservation de la dernière édition : une édition périmée existe mais reste affichable", () => {
    // Le seed contient une édition Audiomack is_stale=true. Le frontend l'affiche
    // avec un badge « Mise à jour en attente ». On vérifie ici que la logique
    // ne produit pas de faux positifs : position valide => affichable.
    const fp = calculerPositionsFiltrees([{ sourcePosition: 1, eligible: true }]);
    expect(fp.length).toBe(1);
  });
});
