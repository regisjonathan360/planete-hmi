/**
 * Détection de doublons d'artistes.
 *
 * Le scan automatique après collecte reste volontairement strict. Le scan
 * manuel de l'administration peut être élargi et compare aussi les variantes
 * de noms collectées sur les plateformes.
 */
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  compareArtistNames,
  DUPLICATE_THRESHOLDS,
  normalizeArtistName,
  type DuplicateSensitivity,
} from "./duplicate-similarity";

interface ArtistForDuplicateScan {
  id: string;
  name: string;
  slug: string;
}

interface IdentityName {
  artist_id: string;
  platform_name: string | null;
}

interface ExistingCandidate {
  id: string;
  artist_a_id: string;
  artist_b_id: string;
  confidence: number;
  status: string;
}

interface RankedCandidate {
  artistAId: string;
  artistBId: string;
  score: number;
  reasons: string[];
  matchedA: string;
  matchedB: string;
}

export interface AdvancedDuplicateScanResult {
  artistsScanned: number;
  pairsCompared: number;
  matchesFound: number;
  created: number;
  updated: number;
  alreadyReviewed: number;
  threshold: number;
  sensitivity: DuplicateSensitivity;
}

function pairKey(left: string, right: string): string {
  return left < right ? `${left}:${right}` : `${right}:${left}`;
}

function orderedPair(left: string, right: string): [string, string] {
  return left < right ? [left, right] : [right, left];
}

function displaySlug(slug: string): string {
  return slug.replace(/[-_]+/g, " ");
}

function uniqueNames(names: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const rawName of names) {
    const name = rawName?.trim();
    if (!name) continue;
    const key = normalizeArtistName(name);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(name);
  }
  return result.slice(0, 8);
}

async function loadAllArtists(supabase: SupabaseClient): Promise<ArtistForDuplicateScan[]> {
  const rows: ArtistForDuplicateScan[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("artists")
      .select("id, name, slug")
      .eq("is_active", true)
      .order("id")
      .range(from, from + pageSize - 1);
    if (error) throw new Error("Impossible de charger les artistes.");
    const page = (data ?? []) as ArtistForDuplicateScan[];
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return rows;
}

async function loadIdentityNames(supabase: SupabaseClient): Promise<IdentityName[]> {
  const rows: IdentityName[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("artist_platform_identities")
      .select("artist_id, platform_name")
      .not("platform_name", "is", null)
      .order("artist_id")
      .range(from, from + pageSize - 1);
    if (error) throw new Error("Impossible de charger les noms des plateformes.");
    const page = (data ?? []) as IdentityName[];
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return rows;
}

async function loadExistingCandidates(supabase: SupabaseClient): Promise<ExistingCandidate[]> {
  const rows: ExistingCandidate[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("artist_merge_candidates")
      .select("id, artist_a_id, artist_b_id, confidence, status")
      .order("id")
      .range(from, from + pageSize - 1);
    if (error) throw new Error("Impossible de charger les doublons déjà examinés.");
    const page = (data ?? []) as ExistingCandidate[];
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return rows;
}

function findBestNameMatch(namesA: string[], namesB: string[]): RankedCandidate | null {
  let best: RankedCandidate | null = null;
  for (const nameA of namesA) {
    for (const nameB of namesB) {
      const comparison = compareArtistNames(nameA, nameB);
      if (!best || comparison.score > best.score) {
        best = {
          artistAId: "",
          artistBId: "",
          score: comparison.score,
          reasons: comparison.reasons,
          matchedA: nameA,
          matchedB: nameB,
        };
      }
    }
  }
  return best;
}

function selectUsefulCandidates(candidates: RankedCandidate[], limit: number): RankedCandidate[] {
  const perArtist = new Map<string, number>();
  const selected: RankedCandidate[] = [];
  for (const candidate of candidates.sort((a, b) => b.score - a.score)) {
    if ((perArtist.get(candidate.artistAId) ?? 0) >= 10) continue;
    if ((perArtist.get(candidate.artistBId) ?? 0) >= 10) continue;
    selected.push(candidate);
    perArtist.set(candidate.artistAId, (perArtist.get(candidate.artistAId) ?? 0) + 1);
    perArtist.set(candidate.artistBId, (perArtist.get(candidate.artistBId) ?? 0) + 1);
    if (selected.length >= limit) break;
  }
  return selected;
}

export async function scanAdvancedDuplicates(
  supabase: SupabaseClient,
  sensitivity: DuplicateSensitivity = "broad",
  maxCandidates = 500,
): Promise<AdvancedDuplicateScanResult> {
  const [artists, identityNames, existingCandidates] = await Promise.all([
    loadAllArtists(supabase),
    loadIdentityNames(supabase),
    loadExistingCandidates(supabase),
  ]);
  const threshold = DUPLICATE_THRESHOLDS[sensitivity];
  const aliasesByArtist = new Map<string, string[]>();
  for (const identity of identityNames) {
    if (!identity.platform_name) continue;
    const list = aliasesByArtist.get(identity.artist_id) ?? [];
    list.push(identity.platform_name);
    aliasesByArtist.set(identity.artist_id, list);
  }
  const namesByArtist = new Map(
    artists.map((artist) => [
      artist.id,
      uniqueNames([
        artist.name,
        displaySlug(artist.slug),
        ...(aliasesByArtist.get(artist.id) ?? []),
      ]),
    ]),
  );
  const existingByPair = new Map(
    existingCandidates.map((candidate) => [
      pairKey(candidate.artist_a_id, candidate.artist_b_id),
      candidate,
    ]),
  );

  let pairsCompared = 0;
  const matches: RankedCandidate[] = [];
  for (let i = 0; i < artists.length; i++) {
    for (let j = i + 1; j < artists.length; j++) {
      pairsCompared++;
      const artistA = artists[i];
      const artistB = artists[j];
      const match = findBestNameMatch(
        namesByArtist.get(artistA.id) ?? [artistA.name],
        namesByArtist.get(artistB.id) ?? [artistB.name],
      );
      if (!match || match.score < threshold) continue;
      match.artistAId = artistA.id;
      match.artistBId = artistB.id;
      matches.push(match);
    }
  }

  const selected = selectUsefulCandidates(matches, Math.max(1, Math.min(maxCandidates, 1000)));
  const inserts: Array<Record<string, unknown>> = [];
  const updates: Array<PromiseLike<unknown>> = [];
  let alreadyReviewed = 0;

  for (const candidate of selected) {
    const key = pairKey(candidate.artistAId, candidate.artistBId);
    const existing = existingByPair.get(key);
    const [artistAId, artistBId] = orderedPair(candidate.artistAId, candidate.artistBId);
    const reasonParts = candidate.reasons.length
      ? candidate.reasons
      : ["Ressemblance statistique du nom"];
    const variant = candidate.matchedA !== candidate.matchedB
      ? `Variantes comparées : « ${candidate.matchedA} » / « ${candidate.matchedB} »`
      : null;
    const reason = [
      "Recherche avancée",
      ...reasonParts,
      variant,
    ].filter(Boolean).join(" · ").slice(0, 500);

    if (existing) {
      if (
        existing.status === "pending" &&
        candidate.score > Number(existing.confidence)
      ) {
        updates.push(
          supabase
            .from("artist_merge_candidates")
            .update({ confidence: candidate.score, reason })
            .eq("id", existing.id),
        );
      } else {
        alreadyReviewed++;
      }
      continue;
    }
    inserts.push({
      artist_a_id: artistAId,
      artist_b_id: artistBId,
      confidence: candidate.score,
      reason,
    });
  }

  let created = 0;
  for (let start = 0; start < inserts.length; start += 100) {
    const batch = inserts.slice(start, start + 100);
    const { error } = await supabase.from("artist_merge_candidates").upsert(batch, {
      onConflict: "artist_a_id,artist_b_id",
      ignoreDuplicates: true,
    });
    if (error) throw new Error("Impossible d'enregistrer certains doublons détectés.");
    created += batch.length;
  }
  const updateResults = await Promise.all(updates);
  const updateError = updateResults.find((result) => {
    return Boolean((result as { error?: unknown } | null)?.error);
  });
  if (updateError) throw new Error("Impossible de mettre à jour certains scores de doublons.");

  return {
    artistsScanned: artists.length,
    pairsCompared,
    matchesFound: matches.length,
    created,
    updated: updates.length,
    alreadyReviewed,
    threshold,
    sensitivity,
  };
}

/**
 * Scan automatique conservateur exécuté après les collectes.
 */
export async function detectDuplicates(supabase: SupabaseClient): Promise<number> {
  const [artists, existingCandidates] = await Promise.all([
    loadAllArtists(supabase),
    loadExistingCandidates(supabase),
  ]);
  const existingPairs = new Set(
    existingCandidates.map((candidate) => pairKey(candidate.artist_a_id, candidate.artist_b_id)),
  );
  const groups = new Map<string, ArtistForDuplicateScan[]>();
  for (const artist of artists) {
    const key = normalizeArtistName(artist.name).replace(/\s/g, "");
    if (!key) continue;
    const group = groups.get(key) ?? [];
    group.push(artist);
    groups.set(key, group);
  }

  const inserts: Array<Record<string, unknown>> = [];
  for (const group of groups.values()) {
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const key = pairKey(group[i].id, group[j].id);
        if (existingPairs.has(key)) continue;
        const [artistAId, artistBId] = orderedPair(group[i].id, group[j].id);
        inserts.push({
          artist_a_id: artistAId,
          artist_b_id: artistBId,
          confidence: 0.99,
          reason: "Nom identique après normalisation automatique",
        });
        existingPairs.add(key);
      }
    }
  }
  if (!inserts.length) return 0;
  const { error } = await supabase.from("artist_merge_candidates").upsert(inserts, {
    onConflict: "artist_a_id,artist_b_id",
    ignoreDuplicates: true,
  });
  if (error) throw new Error("Impossible d'enregistrer les doublons automatiques.");
  return inserts.length;
}
