"use server";

import { requireAdmin } from "@/lib/auth/require-admin";
import { validerLignesImport } from "@/lib/charts/validation/schemas";
import { normalizeTitle } from "@/lib/charts/normalization/normalize-title";
import { normalizeArtists, normalizeArtistName } from "@/lib/charts/normalization/normalize-artists";
import { trouverCorrespondance, CandidatPiste } from "@/lib/charts/matching/match-track";
import { estAdmissiblePrincipal } from "@/lib/charts/matching/match-artist";
import type { CreditArtiste } from "@/lib/charts/types";

export interface LignePreview {
  sourcePosition: number;
  titreSource: string;
  artisteSource: string;
  trackIdPropose: string | null;
  titrePropose: string | null;
  confidence: number;
  resolution: "auto" | "revue_recommandee" | "revue_obligatoire";
  admissible: boolean;
  doublon: boolean;
  erreurs: string[];
}

export interface ResultatPreview {
  ok: boolean;
  message?: string;
  lignesValides: number;
  lignesInvalides: number;
  invalides: { index: number; erreurs: string[] }[];
  preview: LignePreview[];
}

/** Prévisualise un import (aucune écriture) : validation + correspondance + éligibilité. */
export async function previsualiserImport(
  sourceKey: string,
  rowsBrutes: unknown[]
): Promise<ResultatPreview> {
  const { supabase } = await requireAdmin();

  const { valides, invalides } = validerLignesImport(rowsBrutes);
  if (valides.length === 0) {
    return { ok: false, message: "Aucune ligne valide.", lignesValides: 0, lignesInvalides: invalides.length, invalides, preview: [] };
  }

  // Clés de recherche des candidats.
  const titres = [...new Set(valides.map((r) => normalizeTitle(r.track_title)))];
  const isrcs = [...new Set(valides.map((r) => r.isrc).filter((x): x is string => !!x))];

  // Candidats par titre normalisé ou ISRC.
  const { data: parTitre } = await supabase
    .from("tracks")
    .select("id, title, normalized_title, isrc, duration_ms, release_date")
    .in("normalized_title", titres.length ? titres : ["__none__"]);
  const { data: parIsrc } = isrcs.length
    ? await supabase
        .from("tracks")
        .select("id, title, normalized_title, isrc, duration_ms, release_date")
        .in("isrc", isrcs)
    : { data: [] as NonNullable<typeof parTitre> };

  const candidats = new Map<string, NonNullable<typeof parTitre>[number]>();
  [...(parTitre ?? []), ...(parIsrc ?? [])].forEach((t) => candidats.set(t.id, t));

  // Crédits (rôles + statut haïtien) des candidats.
  const ids = [...candidats.keys()];
  const creditsParTrack = new Map<string, CreditArtiste[]>();
  const artistKeyParTrack = new Map<string, string | null>();
  if (ids.length) {
    const { data: credits } = await supabase
      .from("track_artists")
      .select("track_id, role, billing_order, artists(name, haitian_status)")
      .in("track_id", ids);
    (credits ?? []).forEach((c: unknown) => {
      const row = c as {
        track_id: string; role: string; billing_order: number | null;
        artists: { name: string; haitian_status: string } | null;
      };
      const liste = creditsParTrack.get(row.track_id) ?? [];
      liste.push({ role: row.role as CreditArtiste["role"], haitianStatus: (row.artists?.haitian_status ?? "pending_review") as CreditArtiste["haitianStatus"] });
      creditsParTrack.set(row.track_id, liste);
      if ((row.role === "primary" || row.billing_order === 0) && row.artists?.name && !artistKeyParTrack.get(row.track_id)) {
        artistKeyParTrack.set(row.track_id, normalizeArtistName(row.artists.name));
      }
    });
  }

  const vus = new Set<string>();
  const preview: LignePreview[] = valides.map((r) => {
    const nt = normalizeTitle(r.track_title);
    const artistes = normalizeArtists(r.artist_names);
    const cleArtiste = artistes[0]?.nomCle ?? null;

    const listeCandidats: CandidatPiste[] = ids
      .map((id) => candidats.get(id)!)
      .filter((t) => t.normalized_title === nt || (r.isrc && t.isrc === r.isrc))
      .map((t) => ({
        trackId: t.id,
        normalizedTitle: t.normalized_title,
        primaryArtistKey: artistKeyParTrack.get(t.id) ?? null,
        isrc: t.isrc,
        durationMs: t.duration_ms,
        releaseDate: t.release_date,
      }));

    const corr = trouverCorrespondance(
      { normalizedTitle: nt, primaryArtistKey: cleArtiste, isrc: r.isrc },
      listeCandidats
    );

    const credits = corr.trackId ? creditsParTrack.get(corr.trackId) ?? [] : [];
    const admissible = corr.trackId ? estAdmissiblePrincipal(credits) : false;

    const cleDoublon = corr.trackId ?? `${nt}|${cleArtiste}`;
    const doublon = vus.has(cleDoublon);
    vus.add(cleDoublon);

    return {
      sourcePosition: r.source_position,
      titreSource: r.track_title,
      artisteSource: r.artist_names,
      trackIdPropose: corr.trackId,
      titrePropose: corr.trackId ? candidats.get(corr.trackId)?.title ?? null : null,
      confidence: corr.confidence,
      resolution: corr.resolution,
      admissible,
      doublon,
      erreurs: [],
    };
  });

  return {
    ok: true,
    lignesValides: valides.length,
    lignesInvalides: invalides.length,
    invalides,
    preview,
  };
}
