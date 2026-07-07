import "server-only";

import { AUDIOMACK_HAITI_SOURCE_URL } from "@/lib/charts/audiomack-sources";
import { normalizeAudiomackResponse } from "./normalize";
import {
  extractAudiomackMetaSongTitles,
  extractAudiomackSourceUpdatedAt,
  extractAudiomackTracksFromHtml,
} from "./official-page-parser";
import type { AudiomackNormalizedEntry } from "./types";

export interface AudiomackOfficialPageResult {
  ok: boolean;
  entries: AudiomackNormalizedEntry[];
  sourceUpdatedAt: string | null;
  error?: string;
}

export async function fetchAudiomackOfficialHaitiChart(): Promise<AudiomackOfficialPageResult> {
  try {
    const response = await fetch(AUDIOMACK_HAITI_SOURCE_URL, {
      cache: "no-store",
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "PlaneteHMI/1.0 (+https://planete-hmi-4eqk.vercel.app)",
      },
    });

    if (!response.ok) {
      return {
        ok: false,
        entries: [],
        sourceUpdatedAt: null,
        error: `Audiomack a repondu HTTP ${response.status}.`,
      };
    }

    const html = await response.text();
    const tracks = extractAudiomackTracksFromHtml(html);
    const metaSongCount = extractAudiomackMetaSongTitles(html).length;
    const sourceUpdatedAt = extractAudiomackSourceUpdatedAt(html);

    if (!tracks.length) {
      return {
        ok: false,
        entries: [],
        sourceUpdatedAt,
        error: metaSongCount > 0
          ? "Titres detectes, mais impossible d'extraire les artistes depuis la page Audiomack."
          : "Aucune entree detectee sur la page Audiomack Haiti.",
      };
    }

    const entries = normalizeAudiomackResponse({ tracks }).slice(0, 100);
    return {
      ok: true,
      entries,
      sourceUpdatedAt,
      error: metaSongCount > entries.length
        ? `Extraction partielle : ${entries.length}/${metaSongCount} titres.`
        : undefined,
    };
  } catch (error) {
    return {
      ok: false,
      entries: [],
      sourceUpdatedAt: null,
      error: error instanceof Error ? error.message : "Erreur reseau Audiomack.",
    };
  }
}
