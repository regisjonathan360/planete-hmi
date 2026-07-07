import { describe, it, expect } from "vitest";

import { normalizeTitle } from "../../src/lib/charts/normalization/normalize-title";
import { normalizeArtists } from "../../src/lib/charts/normalization/normalize-artists";
import {
  estAdmissiblePrincipal,
  estCollaborationHaitienne,
} from "../../src/lib/charts/matching/match-artist";
import { scoreConfiance, classerConfiance } from "../../src/lib/charts/matching/confidence";
import { trouverCorrespondance } from "../../src/lib/charts/matching/match-track";
import { calculerPositionsFiltrees } from "../../src/lib/charts/ranking/calculate-filtered-positions";
import { calculerMouvement } from "../../src/lib/charts/ranking/calculate-movement";
import { calculerHistorique } from "../../src/lib/charts/ranking/calculate-chart-history";
import { validerEdition } from "../../src/lib/charts/validation/validate-edition";
import {
  AUDIOMACK_HAITI_CHART_SOURCES,
  getAudiomackHaitiChartSource,
} from "../../src/lib/charts/audiomack-sources";
import type { CreditArtiste } from "../../src/lib/charts/types";

describe("normalizeTitle", () => {
  it("retire les mentions décoratives (exemple du cahier)", () => {
    expect(normalizeTitle("4 Kampé (Official Music Video)")).toBe("4 kampe");
  });
  it("conserve les marqueurs significatifs", () => {
    expect(normalizeTitle("4 Kampé — Remix")).toBe("4 kampe remix");
  });
  it("Property 6: idempotence", () => {
    const echantillons = [
      "4 Kampé (Official Music Video)",
      "Titre Live",
      "Some Song feat. X [Audio] Sped Up",
      "",
    ];
    for (const s of echantillons) {
      expect(normalizeTitle(normalizeTitle(s))).toBe(normalizeTitle(s));
    }
  });
  it("Property 7: préserve un marqueur présent", () => {
    expect(normalizeTitle("Chanson (Acoustic)").includes("acoustic")).toBe(true);
    expect(normalizeTitle("Chanson slowed version").includes("slowed")).toBe(true);
  });
});

describe("normalizeArtists", () => {
  it("découpe principaux et featured", () => {
    const res = normalizeArtists("Artiste A & Artiste B feat. Artiste C");
    expect(res.map((a) => a.role)).toEqual(["primary", "co_primary", "featured"]);
    expect(res[0].nomCle).toBe("artiste a");
  });
});

describe("éligibilité haïtienne", () => {
  const primaryHaitien: CreditArtiste[] = [
    { role: "primary", haitianStatus: "verified_haitian" },
  ];
  const featuredSeulement: CreditArtiste[] = [
    { role: "primary", haitianStatus: "rejected" },
    { role: "featured", haitianStatus: "verified_haitian" },
  ];

  it("Property 4: primary haïtien vérifié => admissible", () => {
    expect(estAdmissiblePrincipal(primaryHaitien)).toBe(true);
  });
  it("featured seulement => non admissible mais collaboration", () => {
    expect(estAdmissiblePrincipal(featuredSeulement)).toBe(false);
    expect(estCollaborationHaitienne(featuredSeulement)).toBe(true);
  });
});

describe("confiance de correspondance", () => {
  it("ISRC identique => 1", () => {
    expect(
      scoreConfiance(
        { isrc: "X", normalizedTitle: "a" },
        { isrc: "X", normalizedTitle: "b" }
      )
    ).toBe(1);
  });
  it("identifiant plateforme déjà associé => 1", () => {
    expect(
      scoreConfiance(
        { platformIdDejaAssocie: true, normalizedTitle: "a" },
        { normalizedTitle: "z" }
      )
    ).toBe(1);
  });
  it("Property 8: score borné [0,1]", () => {
    const s = scoreConfiance(
      { normalizedTitle: "meme titre", primaryArtistKey: "a", durationMs: 1000, releaseDate: "2026-05-01", albumTitle: "Alb" },
      { normalizedTitle: "meme titre", primaryArtistKey: "a", durationMs: 1000, releaseDate: "2026-05-15", albumTitle: "Alb" }
    );
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThanOrEqual(1);
    expect(classerConfiance(s)).toBe("auto");
  });
  it("titre+artiste => 0.9, confiance faible => revue obligatoire", () => {
    const s = scoreConfiance(
      { normalizedTitle: "abc", primaryArtistKey: "x" },
      { normalizedTitle: "def", primaryArtistKey: "y" }
    );
    expect(classerConfiance(s)).toBe("revue_obligatoire");
  });
});

describe("trouverCorrespondance", () => {
  it("choisit le meilleur candidat et n'est publiable qu'en auto", () => {
    const r = trouverCorrespondance(
      { isrc: "ISRC1", normalizedTitle: "t" },
      [
        { trackId: "t1", normalizedTitle: "autre" },
        { trackId: "t2", isrc: "ISRC1", normalizedTitle: "t" },
      ]
    );
    expect(r.trackId).toBe("t2");
    expect(r.publiable).toBe(true);
  });
});

describe("positions filtrées", () => {
  const src = [
    { sourcePosition: 1, eligible: false, data: "etranger" },
    { sourcePosition: 3, eligible: true, data: "A" },
    { sourcePosition: 5, eligible: true, data: "B" },
    { sourcePosition: 2, eligible: true, data: "C" },
  ];
  const res = calculerPositionsFiltrees(src);

  it("Property 1: positions contiguës 1..N", () => {
    expect(res.map((r) => r.filteredPosition)).toEqual([1, 2, 3]);
  });
  it("Property 2: monotonie source -> filtrée", () => {
    // triées par sourcePosition croissante : C(2), A(3), B(5)
    expect(res.map((r) => r.data)).toEqual(["C", "A", "B"]);
  });
  it("Property 5: pas de remplissage (N = admissibles)", () => {
    expect(res.length).toBe(3);
  });
  it("plafonne à 20", () => {
    const gros = Array.from({ length: 30 }, (_, i) => ({
      sourcePosition: i + 1,
      eligible: true,
    }));
    expect(calculerPositionsFiltrees(gros).length).toBe(20);
  });
});

describe("mouvement", () => {
  it("Property 10: up/down/stable", () => {
    expect(calculerMouvement(1, { previousFilteredPosition: 3, aDejaFigure: true }).entryStatus).toBe("up");
    expect(calculerMouvement(4, { previousFilteredPosition: 2, aDejaFigure: true }).entryStatus).toBe("down");
    expect(calculerMouvement(2, { previousFilteredPosition: 2, aDejaFigure: true }).entryStatus).toBe("stable");
    expect(calculerMouvement(1, { previousFilteredPosition: 3, aDejaFigure: true }).movement).toBe(2);
  });
  it("Property 11: new vs reentry", () => {
    expect(calculerMouvement(1, { previousFilteredPosition: null, aDejaFigure: false }).entryStatus).toBe("new");
    expect(calculerMouvement(1, { previousFilteredPosition: null, aDejaFigure: true }).entryStatus).toBe("reentry");
  });
});

describe("historique", () => {
  it("Property 12: peak <= position et compte des semaines", () => {
    const h = calculerHistorique(4, [2, null, 3]);
    expect(h.peakFilteredPosition).toBe(2);
    expect(h.peakFilteredPosition).toBeLessThanOrEqual(4);
    expect(h.weeksOnChart).toBe(3); // 2 présences passées + actuelle
    expect(h.consecutiveWeeks).toBe(2); // dernière passée (3) + actuelle
  });
});

describe("validerEdition", () => {
  const base = {
    sourceKey: "spotify_haiti_popular",
    periodStart: "2026-07-03T00:00:00Z",
    periodEnd: "2026-07-09T23:59:59Z",
  };
  const entreeOk = {
    trackId: "t1",
    filteredPosition: 1,
    sourcePosition: 2,
    artisteVerifie: true,
    periodStart: "2026-07-03T00:00:00Z",
  };

  it("Property 15: édition propre => valide", () => {
    expect(validerEdition({ ...base, entries: [entreeOk] }).valid).toBe(true);
  });
  it("positions dupliquées => invalide", () => {
    const r = validerEdition({ ...base, entries: [entreeOk, { ...entreeOk, trackId: "t2" }] });
    expect(r.valid).toBe(false);
    expect(r.erreurs).toContain("Positions filtrées dupliquées.");
  });
  it("artiste non vérifié / sans correspondance / autre semaine => invalide", () => {
    expect(validerEdition({ ...base, entries: [{ ...entreeOk, artisteVerifie: false }] }).valid).toBe(false);
    expect(validerEdition({ ...base, entries: [{ ...entreeOk, trackId: null }] }).valid).toBe(false);
    expect(
      validerEdition({ ...base, entries: [{ ...entreeOk, periodStart: "2026-06-01T00:00:00Z" }] }).valid
    ).toBe(false);
  });
});

describe("sources Audiomack Haiti", () => {
  it("inclut tous les genres publics suivis, dont Gospel", () => {
    expect(AUDIOMACK_HAITI_CHART_SOURCES.map((source) => source.genreId)).toEqual([
      "all",
      "afrosounds",
      "hip-hop-rap",
      "latin",
      "jazz-blues",
      "caribbean",
      "pop",
      "r-b",
      "gospel",
      "electronic",
      "rock",
      "punjabi",
      "country",
      "instrumental",
      "podcast",
    ]);
    expect(getAudiomackHaitiChartSource("gospel").sourceKey).toBe("audiomack_haiti_top_songs_gospel");
  });
});
