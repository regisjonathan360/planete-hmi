import { z } from "zod";
import {
  YOUTUBE_CHANNEL_TYPES,
  YOUTUBE_COLLECTION_MODES,
  YOUTUBE_ELIGIBILITY_STATUSES,
  YOUTUBE_VIDEO_TYPES,
  YOUTUBE_VIDEO_VERIFICATION_STATUSES,
} from "./constants";

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const NON_NEGATIVE_INTEGER_STRING = /^\d+$/;

function isValidIsoDate(value: string): boolean {
  if (!ISO_DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

export const youtubeVideoIdSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{11}$/, "Identifiant vidéo YouTube invalide.");

export const youtubeChannelIdSchema = z
  .string()
  .regex(/^UC[A-Za-z0-9_-]{22}$/, "Identifiant de chaîne YouTube invalide.");

export const youtubePlaylistIdSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{10,64}$/, "Identifiant de playlist YouTube invalide.");

export const youtubeUrlSchema = z
  .string()
  .url()
  .refine((value) => {
    const hostname = new URL(value).hostname.toLowerCase();
    return (
      hostname === "youtube.com" ||
      hostname.endsWith(".youtube.com") ||
      hostname === "youtu.be"
    );
  }, "L’URL doit appartenir à youtube.com ou youtu.be.");

export const youtubeVideoTypeSchema = z.enum(YOUTUBE_VIDEO_TYPES);
export const youtubeChannelTypeSchema = z.enum(YOUTUBE_CHANNEL_TYPES);
export const youtubeVerificationStatusSchema = z.enum(
  YOUTUBE_VIDEO_VERIFICATION_STATUSES
);
export const youtubeEligibilityStatusSchema = z.enum(
  YOUTUBE_ELIGIBILITY_STATUSES
);

export const youtubeChannelInputSchema = z.object({
  artistId: z.string().uuid().nullable(),
  channelId: youtubeChannelIdSchema,
  channelTitle: z.string().trim().min(1).max(200),
  channelType: youtubeChannelTypeSchema,
  uploadsPlaylistId: youtubePlaylistIdSchema.nullable(),
  channelUrl: youtubeUrlSchema,
  isVerified: z.boolean(),
  isActive: z.boolean(),
  notes: z.string().trim().max(2000).nullable(),
});

export const youtubeCollectionParamsSchema = z
  .object({
    periodStart: z.string().refine(isValidIsoDate, "Date de début invalide."),
    periodEnd: z.string().refine(isValidIsoDate, "Date de fin invalide."),
    mode: z.enum(YOUTUBE_COLLECTION_MODES),
    artistIds: z.array(z.string().uuid()).default([]),
    channelIds: z.array(z.string().uuid()).default([]),
    videoIds: z.array(z.string().uuid()).default([]),
    trackIds: z.array(z.string().uuid()).default([]),
    discoverNewVideos: z.boolean().default(true),
    refreshStatistics: z.boolean().default(true),
    refreshMetadata: z.boolean().default(false),
    createDraft: z.boolean().default(true),
    recalculateChart: z.boolean().default(true),
  })
  .superRefine((value, ctx) => {
    const start = Date.parse(`${value.periodStart}T00:00:00.000Z`);
    const end = Date.parse(`${value.periodEnd}T00:00:00.000Z`);
    if (start >= end) {
      ctx.addIssue({
        code: "custom",
        path: ["periodEnd"],
        message: "La date de fin doit être postérieure à la date de début.",
      });
    }
    if (
      value.mode === "CUSTOM" &&
      value.artistIds.length === 0 &&
      value.channelIds.length === 0 &&
      value.videoIds.length === 0 &&
      value.trackIds.length === 0
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["mode"],
        message: "Une collecte personnalisée doit cibler au moins un élément.",
      });
    }
  });

const youtubeStatisticsSchema = z.object({
  viewCount: z.string().regex(NON_NEGATIVE_INTEGER_STRING),
  likeCount: z.string().regex(NON_NEGATIVE_INTEGER_STRING).optional(),
  commentCount: z.string().regex(NON_NEGATIVE_INTEGER_STRING).optional(),
});

export const youtubeVideoListResponseSchema = z.object({
  items: z.array(
    z.object({
      id: youtubeVideoIdSchema,
      snippet: z.object({
        channelId: youtubeChannelIdSchema,
        channelTitle: z.string(),
        title: z.string(),
        description: z.string(),
        publishedAt: z.string().datetime({ offset: true }),
        tags: z.array(z.string()).optional(),
        categoryId: z.string(),
        thumbnails: z.record(
          z.string(),
          z.object({
            url: z.string().url(),
            width: z.number().int().positive().optional(),
            height: z.number().int().positive().optional(),
          })
        ),
      }),
      contentDetails: z.object({
        duration: z.string().regex(/^P(?:\d+D)?T(?:\d+H)?(?:\d+M)?(?:\d+S)?$/),
      }),
      status: z.object({
        privacyStatus: z.enum(["public", "private", "unlisted"]),
        embeddable: z.boolean(),
      }),
      statistics: youtubeStatisticsSchema,
    })
  ),
  pageInfo: z
    .object({
      totalResults: z.number().int().nonnegative(),
      resultsPerPage: z.number().int().nonnegative(),
    })
    .optional(),
});

export type YouTubeChannelInput = z.infer<typeof youtubeChannelInputSchema>;
export type YouTubeCollectionParams = z.infer<
  typeof youtubeCollectionParamsSchema
>;
export type YouTubeVideoListResponse = z.infer<
  typeof youtubeVideoListResponseSchema
>;
