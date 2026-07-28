/**
 * Synchronisation des producteurs / beatmakers.
 *
 * Parcourt le catalogue de chansons, lit les crédits de production publiés dans
 * les titres, crée le profil du producteur s'il n'existe pas encore, l'enrichit
 * via la Web API Spotify (portrait, lien, identifiant) et enregistre le lien
 * producteur → chanson dans `artist_productions`.
 *
 * Les profils créés ici portent `is_auto_generated = true` : ils restent
 * cantonnés à la page Producteurs / Beatmakers jusqu'à validation en admin.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  extractProductionCredits,
  producerKey,
  type ExtractedCredit,
  type ProductionRole,
} from "./extract-credits";
import { isSpotifyConfigured, searchSpotifyArtist } from "@/lib/spotify/api-client";

export interface ProducerSyncProgress {
  phase: string;
  percent: number;
  message: string;
  [key: string]: unknown;
}

export interface ProducerSyncOptions {
  /** Nombre maximum de chansons analysées sur une passe. */
  trackLimit?: number;
  /** Enrichir chaque nouveau producteur via la Web API Spotify. */
  enrichWithSpotify?: boolean;
  onProgress?: (progress: ProducerSyncProgress) => void;
}

export interface ProducerSyncReport {
  tracksScanned: number;
  creditsFound: number;
  producersCreated: number;
  producersEnriched: number;
  productionsLinked: number;
  warnings: string[];
}

interface TrackRow {
  id: string;
  title: string;
  /** Titres alternatifs (plateformes, classements) où la mention peut survivre. */
  alternates: string[];
}

function slugify(value: string): string {
  const slug = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return slug || "producteur-a-verifier";
}

/** Type de fiche attribué à un producteur selon le rôle détecté. */
export function artistTypeForRole(role: ProductionRole): "producer" | "beatmaker" {
  return role === "beatmaker" ? "beatmaker" : "producer";
}

/**
 * Réunit, pour chaque chanson, tous les libellés où une mention « Prod. » peut
 * apparaître : le titre interne, le titre publié sur les plateformes et le
 * titre brut relevé dans les classements.
 */
async function loadTracks(supabase: SupabaseClient, limit: number): Promise<TrackRow[]> {
  const { data: tracks, error } = await supabase
    .from("tracks")
    .select("id, title")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Lecture des chansons impossible : ${error.message}`);
  const rows = tracks ?? [];
  if (rows.length === 0) return [];

  const ids = rows.map((t) => t.id as string);

  const [platformTitles, chartTitles] = await Promise.all([
    supabase.from("platform_tracks").select("track_id, platform_title").in("track_id", ids),
    supabase.from("chart_entries").select("track_id, raw_track_title").in("track_id", ids),
  ]);

  const alternates = new Map<string, Set<string>>();
  const addAlternate = (trackId: unknown, title: unknown) => {
    if (typeof trackId !== "string" || typeof title !== "string" || !title.trim()) return;
    const set = alternates.get(trackId);
    if (set) set.add(title);
    else alternates.set(trackId, new Set([title]));
  };

  for (const row of platformTitles.data ?? []) addAlternate(row.track_id, row.platform_title);
  for (const row of chartTitles.data ?? []) addAlternate(row.track_id, row.raw_track_title);

  return rows.map((t) => ({
    id: t.id as string,
    title: (t.title as string) ?? "",
    alternates: [...(alternates.get(t.id as string) ?? [])],
  }));
}

/** Meilleur crédit par producteur pour une chanson, tous libellés confondus. */
function creditsForTrack(track: TrackRow): ExtractedCredit[] {
  const best = new Map<string, ExtractedCredit>();
  for (const label of [track.title, ...track.alternates]) {
    for (const credit of extractProductionCredits(label).credits) {
      const key = producerKey(credit.name);
      const existing = best.get(key);
      if (!existing || credit.confidence > existing.confidence) best.set(key, credit);
    }
  }
  return [...best.values()];
}

/** Index nom normalisé → artiste existant, pour éviter les doublons. */
async function loadArtistIndex(supabase: SupabaseClient): Promise<Map<string, string>> {
  const index = new Map<string, string>();
  const pageSize = 1000;

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("artists")
      .select("id, name")
      .range(from, from + pageSize - 1);

    if (error) throw new Error(`Lecture des artistes impossible : ${error.message}`);
    for (const row of data ?? []) {
      const key = producerKey(row.name as string);
      if (key && !index.has(key)) index.set(key, row.id as string);
    }
    if (!data || data.length < pageSize) break;
  }

  return index;
}

async function insertProducer(
  supabase: SupabaseClient,
  name: string,
  role: ProductionRole,
  attempt = 0,
): Promise<string> {
  const base = slugify(name);
  const { data, error } = await supabase
    .from("artists")
    .insert({
      name,
      slug: attempt === 0 ? base : `${base}-${attempt}`,
      artist_type: artistTypeForRole(role),
      haitian_status: "pending_review",
      is_auto_generated: true,
      is_active: true,
      tags: [role === "beatmaker" ? "Beatmaker" : "Producteur"],
    })
    .select("id")
    .single();

  if (error || !data) {
    // Slug déjà pris : on suffixe, comme le fait la collecte Audiomack.
    if (error?.code === "23505" && attempt < 20) {
      return insertProducer(supabase, name, role, attempt + 1);
    }
    throw new Error(`Création du producteur « ${name} » échouée : ${error?.message ?? "aucune donnée"}`);
  }

  return data.id as string;
}

/**
 * Complète la fiche d'un producteur avec son profil Spotify.
 * @returns true si au moins un champ a été enrichi.
 */
async function enrichFromSpotify(
  supabase: SupabaseClient,
  artistId: string,
  name: string,
): Promise<boolean> {
  const profile = await searchSpotifyArtist(name);
  if (!profile) return false;

  const patch: Record<string, unknown> = {
    spotify_producer_id: profile.id,
    url_spotify: profile.url,
    updated_at: new Date().toISOString(),
  };
  if (profile.imageUrl) patch.image_url = profile.imageUrl;
  if (profile.genres.length > 0) patch.primary_genre = profile.genres[0];

  const { error } = await supabase.from("artists").update(patch).eq("id", artistId);
  if (error) return false;

  // L'identité plateforme alimente aussi la photo de secours des autres fiches.
  await supabase.from("artist_platform_identities").upsert(
    {
      artist_id: artistId,
      platform: "spotify",
      external_id: profile.id,
      external_url: profile.url,
      platform_name: profile.name,
      platform_image_url: profile.imageUrl,
      match_confidence: profile.matchConfidence,
      match_method: "auto_collect",
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: "platform,external_id" },
  );

  return true;
}

/**
 * Lance une passe de synchronisation.
 * Ne lève que sur erreur bloquante ; les incidents unitaires sont rapportés
 * dans `warnings` pour ne pas interrompre la collecte.
 */
export async function syncProducers(
  supabase: SupabaseClient,
  options: ProducerSyncOptions = {},
): Promise<ProducerSyncReport> {
  const trackLimit = Math.min(Math.max(options.trackLimit ?? 500, 1), 5000);
  const enrich = options.enrichWithSpotify !== false && isSpotifyConfigured();
  const report: ProducerSyncReport = {
    tracksScanned: 0,
    creditsFound: 0,
    producersCreated: 0,
    producersEnriched: 0,
    productionsLinked: 0,
    warnings: [],
  };

  const emit = (progress: ProducerSyncProgress) => options.onProgress?.(progress);

  emit({ phase: "init", percent: 2, message: "Préparation de la synchronisation..." });

  if (options.enrichWithSpotify !== false && !isSpotifyConfigured()) {
    report.warnings.push(
      "Enrichissement Spotify ignoré : SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET absents.",
    );
  }

  emit({ phase: "loading", percent: 8, message: "Chargement du catalogue de chansons..." });
  const tracks = await loadTracks(supabase, trackLimit);
  report.tracksScanned = tracks.length;

  if (tracks.length === 0) {
    emit({ phase: "done", percent: 100, message: "Aucune chanson à analyser." });
    return report;
  }

  emit({ phase: "loading", percent: 14, message: "Indexation des artistes existants..." });
  const artistIndex = await loadArtistIndex(supabase);

  emit({
    phase: "scanning",
    percent: 18,
    message: `Analyse des crédits sur ${tracks.length} chanson(s)...`,
  });

  for (let i = 0; i < tracks.length; i++) {
    const track = tracks[i];
    const credits = creditsForTrack(track);
    const percent = 18 + Math.round(((i + 1) / tracks.length) * 78);

    if (credits.length === 0) {
      if (i % 25 === 0 || i === tracks.length - 1) {
        emit({
          phase: "scanning",
          percent,
          message: `Analyse ${i + 1}/${tracks.length} — aucun crédit`,
          current: i + 1,
          total: tracks.length,
        });
      }
      continue;
    }

    for (const credit of credits) {
      report.creditsFound++;
      const key = producerKey(credit.name);

      try {
        let artistId = artistIndex.get(key);

        if (!artistId) {
          artistId = await insertProducer(supabase, credit.name, credit.role);
          artistIndex.set(key, artistId);
          report.producersCreated++;

          if (enrich) {
            try {
              if (await enrichFromSpotify(supabase, artistId, credit.name)) {
                report.producersEnriched++;
              }
            } catch (err) {
              report.warnings.push(
                `Enrichissement Spotify impossible pour « ${credit.name} » : ${
                  err instanceof Error ? err.message : "erreur inconnue"
                }`,
              );
            }
          }
        }

        const { data: linked, error } = await supabase.rpc("link_artist_production", {
          p_producer_id: artistId,
          p_track_id: track.id,
          p_role: credit.role,
          p_credit_source: "title_credit",
          p_credit_note: credit.rawMention,
          p_confidence: credit.confidence,
          p_is_verified: false,
          p_created_by: null,
        });

        const result = Array.isArray(linked) ? linked[0] : linked;
        if (error) {
          report.warnings.push(`Lien production refusé (${credit.name}) : ${error.message}`);
        } else if (result && result.success === false) {
          report.warnings.push(`Lien production refusé (${credit.name}) : ${result.message}`);
        } else {
          report.productionsLinked++;
        }
      } catch (err) {
        report.warnings.push(
          `Producteur « ${credit.name} » ignoré : ${
            err instanceof Error ? err.message : "erreur inconnue"
          }`,
        );
      }
    }

    emit({
      phase: "scanning",
      percent,
      message: `Analyse ${i + 1}/${tracks.length} — ${credits.length} crédit(s) sur « ${track.title.slice(0, 40)} »`,
      current: i + 1,
      total: tracks.length,
      producersCreated: report.producersCreated,
      productionsLinked: report.productionsLinked,
    });
  }

  emit({
    phase: "done",
    percent: 100,
    message: `Synchronisation terminée — ${report.productionsLinked} production(s) rattachée(s), ${report.producersCreated} profil(s) créé(s).`,
    ...report,
  });

  return report;
}
