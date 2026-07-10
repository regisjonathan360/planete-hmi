/**
 * Lecture des données d'administration pour une source de classement.
 * Charge la copie de travail (brouillon) : entrées enrichies, artistes à
 * valider, et agrégations dérivées (Top artistes / Top albums).
 */
import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { HaitianStatus } from "../types";
import {
  estStatutVerifie,
  type AdminChartData,
  type AdminChartEntry,
  type AdminArtistToValidate,
  type AdminDerivedArtist,
  type AdminDerivedAlbum,
  type AdminEdition,
} from "./types";

interface SourceRow {
  id: string;
  source_key: string;
  platform: string;
  display_name: string;
}

/** Retourne l'édition de travail la plus récente d'une source (toutes sauf archivées). */
async function getWorkingEdition(
  supabase: SupabaseClient,
  sourceId: string
): Promise<Record<string, unknown> | null> {
  const { data } = await supabase
    .from("chart_editions")
    .select(
      "id, chart_source_id, period_start, period_end, status, collected_at, published_at, last_published_at, source_updated_at, has_unpublished_changes, is_stale"
    )
    .eq("chart_source_id", sourceId)
    .neq("status", "archived")
    .order("collected_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

/**
 * Charge l'ensemble des données admin pour une source (par défaut Audiomack).
 */
export async function getAdminChartData(
  supabase: SupabaseClient,
  sourceKey: string
): Promise<AdminChartData> {
  const empty: AdminChartData = {
    edition: null,
    entries: [],
    artistsToValidate: [],
    derivedArtists: [],
    derivedAlbums: [],
    summary: {
      totalEntries: 0,
      visibleEntries: 0,
      hiddenEntries: 0,
      excludedEntries: 0,
      eligibleEntries: 0,
      distinctArtists: 0,
      distinctAlbums: 0,
      pendingArtists: 0,
    },
    isPublished: false,
  };

  const { data: sourceData } = await supabase
    .from("chart_sources")
    .select("id, source_key, platform, display_name")
    .eq("source_key", sourceKey)
    .maybeSingle();
  const source = sourceData as SourceRow | null;
  if (!source) return empty;

  const editionRow = await getWorkingEdition(supabase, source.id);
  if (!editionRow) {
    return { ...empty };
  }

  const editionId = editionRow.id as string;

  const edition: AdminEdition = {
    editionId,
    sourceId: source.id,
    sourceKey: source.source_key,
    platform: source.platform as AdminEdition["platform"],
    displayName: source.display_name,
    periodStart: editionRow.period_start as string,
    periodEnd: editionRow.period_end as string,
    status: editionRow.status as string,
    collectedAt: (editionRow.collected_at as string) ?? null,
    publishedAt: (editionRow.published_at as string) ?? null,
    lastPublishedAt: (editionRow.last_published_at as string) ?? null,
    sourceUpdatedAt: (editionRow.source_updated_at as string) ?? null,
    hasUnpublishedChanges: !!editionRow.has_unpublished_changes,
    isStale: !!editionRow.is_stale,
  };

  // Entrées de l'édition
  const { data: entryRows } = await supabase
    .from("chart_entries")
    .select(
      "id, track_id, platform_track_id, source_position, filtered_position, admin_position, is_hidden, is_excluded, exclusion_reason, display_title, display_artist, display_artwork_url, display_url, genre, raw_track_title, raw_artist_text"
    )
    .eq("chart_edition_id", editionId);

  const rows = entryRows ?? [];
  const trackIds = rows.map((r) => r.track_id).filter((t): t is string => !!t);
  const platformTrackIds = rows
    .map((r) => r.platform_track_id)
    .filter((t): t is string => !!t);

  // Métadonnées tracks
  const trackMap = new Map<string, { title: string; artwork: string | null }>();
  if (trackIds.length) {
    const { data: tracks } = await supabase
      .from("tracks")
      .select("id, title, default_artwork_url")
      .in("id", trackIds);
    (tracks ?? []).forEach((t) =>
      trackMap.set(t.id as string, {
        title: t.title as string,
        artwork: (t.default_artwork_url as string) ?? null,
      })
    );
  }

  // Correspondances plateforme (lien + cover)
  const platformMap = new Map<string, { url: string | null; artwork: string | null }>();
  if (platformTrackIds.length) {
    const { data: pts } = await supabase
      .from("platform_tracks")
      .select("id, external_url, artwork_url")
      .in("id", platformTrackIds);
    (pts ?? []).forEach((p) =>
      platformMap.set(p.id as string, {
        url: (p.external_url as string) ?? null,
        artwork: (p.artwork_url as string) ?? null,
      })
    );
  }

  // Artiste principal + statut haïtien par track
  const primaryByTrack = new Map<
    string,
    { artistId: string; name: string; status: HaitianStatus; isActive: boolean; imageUrl: string | null }
  >();
  if (trackIds.length) {
    const { data: credits } = await supabase
      .from("track_artists")
      .select("track_id, role, billing_order, artists(id, name, haitian_status, is_active, image_url)")
      .in("track_id", trackIds)
      .in("role", ["primary", "co_primary"])
      .order("billing_order", { ascending: true });
    (credits ?? []).forEach((c: unknown) => {
      const row = c as {
        track_id: string;
        artists: { id: string; name: string; haitian_status: HaitianStatus; is_active: boolean; image_url: string | null } | null;
      };
      if (!row.artists) return;
      if (!primaryByTrack.has(row.track_id)) {
        primaryByTrack.set(row.track_id, {
          artistId: row.artists.id,
          name: row.artists.name,
          status: row.artists.haitian_status,
          isActive: row.artists.is_active,
          imageUrl: row.artists.image_url ?? null,
        });
      }
    });
  }

  // Album par track (depuis le dernier snapshot Audiomack)
  const albumByTrackTitle = new Map<string, string>();
  {
    const { data: snap } = await supabase
      .from("chart_snapshots")
      .select("id")
      .eq("platform", edition.platform)
      .eq("status", "success")
      .order("collected_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (snap?.id) {
      const { data: snapEntries } = await supabase
        .from("chart_snapshot_entries")
        .select("title, artist_name, album_name")
        .eq("snapshot_id", snap.id);
      (snapEntries ?? []).forEach((s) => {
        if (s.album_name) {
          albumByTrackTitle.set(
            `${(s.title as string).toLowerCase()}|${(s.artist_name as string).toLowerCase()}`,
            s.album_name as string
          );
        }
      });
    }
  }

  const entries: AdminChartEntry[] = rows
    .map((r): AdminChartEntry => {
      const track = r.track_id ? trackMap.get(r.track_id as string) : undefined;
      const pt = r.platform_track_id ? platformMap.get(r.platform_track_id as string) : undefined;
      const primary = r.track_id ? primaryByTrack.get(r.track_id as string) : undefined;

      const title =
        (r.display_title as string) ?? track?.title ?? (r.raw_track_title as string) ?? "Sans titre";
      const artist =
        (r.display_artist as string) ??
        primary?.name ??
        (r.raw_artist_text as string) ??
        "Artiste inconnu";
      const artwork =
        (r.display_artwork_url as string) ?? pt?.artwork ?? track?.artwork ?? null;
      const url = (r.display_url as string) ?? pt?.url ?? null;

      const albumKey = `${title.toLowerCase()}|${artist.toLowerCase()}`;
      const album = albumByTrackTitle.get(albumKey) ?? null;

      const eligible =
        !!primary && estStatutVerifie(primary.status) && primary.isActive;

      return {
        entryId: r.id as string,
        trackId: (r.track_id as string) ?? null,
        platformTrackId: (r.platform_track_id as string) ?? null,
        sourcePosition: r.source_position as number,
        filteredPosition: (r.filtered_position as number) ?? null,
        adminPosition: (r.admin_position as number) ?? null,
        isHidden: !!r.is_hidden,
        isExcluded: !!r.is_excluded,
        exclusionReason: (r.exclusion_reason as string) ?? null,
        title,
        artist,
        artworkUrl: artwork,
        audiomackUrl: url,
        albumName: album,
        genre: (r.genre as string) ?? null,
        displayTitle: (r.display_title as string) ?? null,
        displayArtist: (r.display_artist as string) ?? null,
        displayArtworkUrl: (r.display_artwork_url as string) ?? null,
        displayUrl: (r.display_url as string) ?? null,
        primaryArtistId: primary?.artistId ?? null,
        primaryArtistName: primary?.name ?? null,
        primaryArtistImageUrl: primary?.imageUrl ?? null,
        haitianStatus: primary?.status ?? null,
        artistIsActive: primary?.isActive ?? true,
        isEligible: eligible,
      };
    })
    .sort((a, b) => {
      const pa = a.adminPosition ?? a.sourcePosition;
      const pb = b.adminPosition ?? b.sourcePosition;
      if (pa !== pb) return pa - pb;
      return a.sourcePosition - b.sourcePosition;
    });

  // Artistes à valider (uniques, présents dans l'édition)
  const artistAgg = new Map<string, AdminArtistToValidate>();
  const artistIds = [
    ...new Set(entries.map((e) => e.primaryArtistId).filter((x): x is string => !!x)),
  ];
  if (artistIds.length) {
    const { data: artistRows } = await supabase
      .from("artists")
      .select("id, name, slug, haitian_status, is_active, confidence_score, image_url, tags")
      .in("id", artistIds);
    const countByArtist = new Map<string, number>();
    entries.forEach((e) => {
      if (e.primaryArtistId)
        countByArtist.set(e.primaryArtistId, (countByArtist.get(e.primaryArtistId) ?? 0) + 1);
    });
    (artistRows ?? []).forEach((a) => {
      artistAgg.set(a.id as string, {
        artistId: a.id as string,
        name: a.name as string,
        slug: a.slug as string,
        imageUrl: (a.image_url as string) ?? null,
        haitianStatus: a.haitian_status as HaitianStatus,
        isActive: !!a.is_active,
        confidenceScore: (a.confidence_score as number) ?? null,
        trackCount: countByArtist.get(a.id as string) ?? 0,
        tags: (a.tags as string[]) ?? [],
      });
    });
  }
  const artistsToValidate = [...artistAgg.values()].sort((a, b) => a.name.localeCompare(b.name));

  // Top artistes dérivé (entrées visibles)
  const visibles = entries.filter((e) => !e.isHidden && !e.isExcluded);
  const derivedArtistMap = new Map<string, AdminDerivedArtist>();
  visibles.forEach((e) => {
    const key = e.artist;
    const pos = e.filteredPosition ?? e.sourcePosition;
    const existing = derivedArtistMap.get(key);
    if (existing) {
      existing.trackCount++;
      existing.bestPosition = Math.min(existing.bestPosition, pos);
      existing.eligible = existing.eligible || e.isEligible;
    } else {
      derivedArtistMap.set(key, {
        name: key,
        bestPosition: pos,
        trackCount: 1,
        eligible: e.isEligible,
      });
    }
  });
  const derivedArtists = [...derivedArtistMap.values()].sort(
    (a, b) => a.bestPosition - b.bestPosition
  );

  // Top albums dérivé (entrées visibles avec album connu)
  const derivedAlbumMap = new Map<string, AdminDerivedAlbum>();
  visibles.forEach((e) => {
    if (!e.albumName) return;
    const key = `${e.albumName}|${e.artist}`;
    const pos = e.filteredPosition ?? e.sourcePosition;
    const existing = derivedAlbumMap.get(key);
    if (existing) {
      existing.trackCount++;
      existing.bestPosition = Math.min(existing.bestPosition, pos);
    } else {
      derivedAlbumMap.set(key, {
        name: e.albumName,
        artist: e.artist,
        bestPosition: pos,
        trackCount: 1,
        artworkUrl: e.artworkUrl,
      });
    }
  });
  const derivedAlbums = [...derivedAlbumMap.values()].sort(
    (a, b) => a.bestPosition - b.bestPosition
  );

  return {
    edition,
    entries,
    artistsToValidate,
    derivedArtists,
    derivedAlbums,
    summary: {
      totalEntries: entries.length,
      visibleEntries: visibles.length,
      hiddenEntries: entries.filter((e) => e.isHidden).length,
      excludedEntries: entries.filter((e) => e.isExcluded).length,
      eligibleEntries: visibles.filter((e) => e.isEligible).length,
      distinctArtists: derivedArtists.length,
      distinctAlbums: derivedAlbums.length,
      pendingArtists: artistsToValidate.filter((a) => a.haitianStatus === "pending_review").length,
    },
    isPublished: !!edition.lastPublishedAt && !edition.hasUnpublishedChanges,
  };
}
