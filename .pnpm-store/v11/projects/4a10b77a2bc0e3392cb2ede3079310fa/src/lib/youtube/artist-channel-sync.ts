import "server-only";

import { YouTubeApiError, type YouTubeChannelInfo } from "./api-client";
import { sanitizeErrorMessage } from "./api-error";

export interface ArtistYouTubeProfile {
  id: string;
  name: string;
  urlYoutube: string | null;
  urlYouTubeMusic: string | null;
}

export interface StoredYouTubeChannel {
  id: string;
  channelId: string;
  artistId: string | null;
  channelType: string;
  status: string;
}

export interface ArtistChannelCandidate {
  artistId: string;
  artistName: string;
  sourceUrl: string;
  channel: YouTubeChannelInfo;
}

export interface ArtistChannelSyncStorage {
  listArtistProfilesPage(cursor: string | null, limit: number): Promise<ArtistYouTubeProfile[]>;
  getChannelsByYouTubeIds(channelIds: string[]): Promise<StoredYouTubeChannel[]>;
  createCandidate(candidate: ArtistChannelCandidate): Promise<StoredYouTubeChannel>;
  linkChannelToArtist(channelId: string, artistId: string): Promise<boolean>;
}

export type ArtistChannelSyncDetailStatus =
  | "created"
  | "already_linked"
  | "linked_existing"
  | "duplicate_profile_url"
  | "conflict"
  | "error";

export interface ArtistChannelSyncDetail {
  artistId: string;
  artistName: string;
  sourceUrl: string;
  channelId: string | null;
  channelTitle: string | null;
  status: ArtistChannelSyncDetailStatus;
  message: string;
}

export interface ArtistChannelSyncSummary {
  profilesScanned: number;
  urlsDetected: number;
  created: number;
  alreadyLinked: number;
  linkedExisting: number;
  duplicateProfileUrls: number;
  conflicts: number;
  errors: number;
  details: ArtistChannelSyncDetail[];
}

const MULTI_ARTIST_TYPES = new Set([
  "LABEL_CHANNEL",
  "DISTRIBUTOR_CHANNEL",
  "COLLABORATOR_CHANNEL",
]);

function emptySummary(profilesScanned: number): ArtistChannelSyncSummary {
  return {
    profilesScanned,
    urlsDetected: 0,
    created: 0,
    alreadyLinked: 0,
    linkedExisting: 0,
    duplicateProfileUrls: 0,
    conflicts: 0,
    errors: 0,
    details: [],
  };
}

function profileUrls(profile: ArtistYouTubeProfile): string[] {
  return [...new Set(
    [profile.urlYoutube, profile.urlYouTubeMusic]
      .map((value) => value?.trim())
      .filter((value): value is string => Boolean(value))
  )];
}

async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  mapper: (value: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(values.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < values.length) {
      const index = nextIndex++;
      results[index] = await mapper(values[index]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, values.length) }, () => worker())
  );
  return results;
}

export async function synchronizeArtistProfiles(
  storage: ArtistChannelSyncStorage,
  profiles: ArtistYouTubeProfile[],
  resolveChannelUrl: (url: string) => Promise<YouTubeChannelInfo>
): Promise<ArtistChannelSyncSummary> {
  const summary = emptySummary(profiles.length);
  const references = profiles.flatMap((profile) =>
    profileUrls(profile).map((sourceUrl) => ({ profile, sourceUrl }))
  );
  summary.urlsDetected = references.length;
  if (references.length === 0) return summary;

  const resolutionCache = new Map<string, Promise<YouTubeChannelInfo>>();
  const resolved = await mapWithConcurrency(references, 4, async (reference) => {
    try {
      let resolution = resolutionCache.get(reference.sourceUrl);
      if (!resolution) {
        resolution = resolveChannelUrl(reference.sourceUrl);
        resolutionCache.set(reference.sourceUrl, resolution);
      }
      return { ...reference, channel: await resolution, error: null };
    } catch (error) {
      if (
        error instanceof YouTubeApiError &&
        (error.isQuotaExhausted ||
          error.isInvalidKey ||
          error.code === "config_missing")
      ) {
        throw error;
      }
      return {
        ...reference,
        channel: null,
        error: sanitizeErrorMessage(
          error instanceof Error ? error.message : "Lien YouTube impossible à vérifier."
        ),
      };
    }
  });

  const channelIds = [...new Set(
    resolved
      .map((entry) => entry.channel?.channelId)
      .filter((value): value is string => Boolean(value))
  )];
  const stored = await storage.getChannelsByYouTubeIds(channelIds);
  const storedByChannelId = new Map(stored.map((channel) => [channel.channelId, channel]));
  const seenInBatch = new Map<string, string>();

  for (const entry of resolved) {
    const { profile, sourceUrl, channel, error } = entry;
    if (!channel) {
      summary.errors++;
      summary.details.push({
        artistId: profile.id,
        artistName: profile.name,
        sourceUrl,
        channelId: null,
        channelTitle: null,
        status: "error",
        message: error ?? "Lien YouTube impossible à vérifier.",
      });
      continue;
    }

    const firstArtistId = seenInBatch.get(channel.channelId);
    if (firstArtistId) {
      if (firstArtistId === profile.id) {
        summary.duplicateProfileUrls++;
        summary.details.push({
          artistId: profile.id,
          artistName: profile.name,
          sourceUrl,
          channelId: channel.channelId,
          channelTitle: channel.title,
          status: "duplicate_profile_url",
          message: "Cette même chaîne figure déjà dans un autre champ du profil.",
        });
      } else {
        summary.conflicts++;
        summary.details.push({
          artistId: profile.id,
          artistName: profile.name,
          sourceUrl,
          channelId: channel.channelId,
          channelTitle: channel.title,
          status: "conflict",
          message: "Cette chaîne est également renseignée sur une autre fiche artiste.",
        });
      }
      continue;
    }
    seenInBatch.set(channel.channelId, profile.id);

    const existing = storedByChannelId.get(channel.channelId);
    if (!existing) {
      const created = await storage.createCandidate({
        artistId: profile.id,
        artistName: profile.name,
        sourceUrl,
        channel,
      });
      storedByChannelId.set(channel.channelId, created);
      summary.created++;
      summary.details.push({
        artistId: profile.id,
        artistName: profile.name,
        sourceUrl,
        channelId: channel.channelId,
        channelTitle: channel.title,
        status: "created",
        message: "Chaîne ajoutée à la file de vérification.",
      });
      continue;
    }

    if (existing.artistId === profile.id) {
      summary.alreadyLinked++;
      summary.details.push({
        artistId: profile.id,
        artistName: profile.name,
        sourceUrl,
        channelId: channel.channelId,
        channelTitle: channel.title,
        status: "already_linked",
        message: "Chaîne déjà enregistrée et associée à cet artiste.",
      });
      continue;
    }

    if (!existing.artistId && !MULTI_ARTIST_TYPES.has(existing.channelType)) {
      const linked = await storage.linkChannelToArtist(existing.id, profile.id);
      if (linked) {
        existing.artistId = profile.id;
        summary.linkedExisting++;
        summary.details.push({
          artistId: profile.id,
          artistName: profile.name,
          sourceUrl,
          channelId: channel.channelId,
          channelTitle: channel.title,
          status: "linked_existing",
          message: "Chaîne existante désormais associée à cet artiste.",
        });
        continue;
      }
    }

    summary.conflicts++;
    summary.details.push({
      artistId: profile.id,
      artistName: profile.name,
      sourceUrl,
      channelId: channel.channelId,
      channelTitle: channel.title,
      status: "conflict",
      message: existing.artistId
        ? "Cette chaîne est déjà associée à un autre artiste."
        : "Cette chaîne multi-artistes doit être associée manuellement.",
    });
  }

  return summary;
}

export async function synchronizeArtistProfilePage(
  storage: ArtistChannelSyncStorage,
  cursor: string | null,
  limit: number,
  resolveChannelUrl: (url: string) => Promise<YouTubeChannelInfo>
): Promise<ArtistChannelSyncSummary & { nextCursor: string | null }> {
  const profiles = await storage.listArtistProfilesPage(cursor, limit);
  const summary = await synchronizeArtistProfiles(storage, profiles, resolveChannelUrl);
  return {
    ...summary,
    nextCursor: profiles.length === limit ? profiles.at(-1)?.id ?? null : null,
  };
}
