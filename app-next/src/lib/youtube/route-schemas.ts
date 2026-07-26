/**
 * Schémas Zod pour les query parameters des routes K6.
 *
 * Correction K6 :
 * - Refuse strictement "10abc", décimaux, signes, espaces, NaN
 * - channelId accepte le channel_id YouTube (texte UC...) stocké dans youtube_videos
 * - Paramètre distinct internalChannelId pour filtrer par UUID interne
 */
import { z } from "zod";
import {
  YOUTUBE_VIDEO_VERIFICATION_STATUSES,
  YOUTUBE_CHANNEL_TYPES,
  YOUTUBE_VIDEO_TYPES,
} from "./constants";

/** Validation stricte d'un entier positif en string — refuse "10abc", "3.5", "+10", " 5 " */
const strictIntRegex = /^\d+$/;

export const paginationSchema = z.object({
  limit: z
    .string()
    .default("50")
    .refine((v) => strictIntRegex.test(v), "Doit être un entier positif.")
    .transform((v) => parseInt(v, 10))
    .pipe(z.number().int().min(1).max(200)),
  offset: z
    .string()
    .default("0")
    .refine((v) => strictIntRegex.test(v), "Doit être un entier non négatif.")
    .transform((v) => parseInt(v, 10))
    .pipe(z.number().int().min(0)),
});

/** Identifiant de chaîne YouTube (texte, ex: UCxxxxx) tel que stocké dans youtube_videos.channel_id */
const youtubeChannelIdParam = z.string().min(1).max(30).regex(
  /^UC[A-Za-z0-9_-]+$/,
  "Identifiant de chaîne YouTube invalide (doit commencer par UC)."
);

export const videoListQuerySchema = paginationSchema.extend({
  status: z
    .enum(YOUTUBE_VIDEO_VERIFICATION_STATUSES)
    .optional(),
  /** Filtre par channel_id YouTube (texte UC...) */
  channelId: youtubeChannelIdParam.optional(),
  /** Filtre par UUID interne de la chaîne */
  internalChannelId: z.string().uuid().optional(),
  eligible: z
    .enum(["true", "false"])
    .optional(),
  videoType: z
    .enum(YOUTUBE_VIDEO_TYPES)
    .optional(),
  search: z.string().max(200).optional(),
});

export const channelListQuerySchema = paginationSchema.extend({
  status: z
    .enum(["active", "paused", "rejected", "pending_review"])
    .optional(),
  channelType: z
    .enum(YOUTUBE_CHANNEL_TYPES)
    .optional(),
  search: z.string().max(200).optional(),
  sort: z
    .enum([
      "subscribers_desc",
      "subscribers_asc",
      "title_asc",
      "title_desc",
      "videos_desc",
      "recently_scanned",
      "recently_added",
    ])
    .default("subscribers_desc"),
});

export type VideoListQuery = z.infer<typeof videoListQuerySchema>;
export type ChannelListQuery = z.infer<typeof channelListQuerySchema>;
