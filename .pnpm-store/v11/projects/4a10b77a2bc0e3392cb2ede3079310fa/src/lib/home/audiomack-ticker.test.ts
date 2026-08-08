import { describe, expect, it } from "vitest";
import {
  buildAudiomackTickerHtml,
  type AudiomackTickerEntry,
} from "./audiomack-ticker";

function entry(
  overrides: Partial<AudiomackTickerEntry> = {}
): AudiomackTickerEntry {
  return {
    rank: 1,
    title: "Nou se limyè",
    artistName: "Atis HMI",
    rankChange: 2,
    isNew: false,
    ...overrides,
  };
}

describe("buildAudiomackTickerHtml", () => {
  it("affiche le rang, le mouvement, l’artiste et le titre", () => {
    const html = buildAudiomackTickerHtml([entry()]);

    expect(html).toContain("#1");
    expect(html).toContain("▲ 2");
    expect(html).toContain("Atis HMI");
    expect(html).toContain("Nou se limyè");
    expect(html).toContain('aria-label="Top Audiomack Haïti"');
  });

  it("duplique le groupe pour assurer un défilement continu", () => {
    const html = buildAudiomackTickerHtml([entry()]);

    expect(html.match(/Atis HMI/g)).toHaveLength(2);
    expect(html).toContain('aria-hidden="true"');
  });

  it("échappe les données provenant de la base", () => {
    const html = buildAudiomackTickerHtml([
      entry({
        artistName: '<script>alert("artiste")</script>',
        title: "<img src=x onerror=alert(1)>",
      }),
    ]);

    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&lt;img");
  });

  it("gère les nouveautés, les reculs et une liste vide", () => {
    expect(buildAudiomackTickerHtml([entry({ isNew: true })])).toContain(
      'aria-label="Nouveau"'
    );
    expect(
      buildAudiomackTickerHtml([entry({ rankChange: -4 })])
    ).toContain("▼ 4");
    expect(buildAudiomackTickerHtml([])).toContain(
      "Le classement Audiomack est en cours de mise à jour."
    );
  });
});
