import { z } from "zod";

export const YOUTUBE_VIDEO_RESET_SCOPES = [
  "pending",
  "rejected",
  "all",
] as const;

export type YouTubeVideoResetScope =
  (typeof YOUTUBE_VIDEO_RESET_SCOPES)[number];

export const YOUTUBE_VIDEO_RESET_CONFIRMATIONS: Record<
  YouTubeVideoResetScope,
  string
> = {
  pending: "VIDER LA FILE",
  rejected: "NETTOYER LES ECARTEES",
  all: "REINITIALISER YOUTUBE",
};

export const youtubeVideoResetSchema = z
  .object({
    scope: z.enum(YOUTUBE_VIDEO_RESET_SCOPES),
    confirmation: z.string().trim().max(80),
  })
  .superRefine((value, context) => {
    if (
      value.confirmation !==
      YOUTUBE_VIDEO_RESET_CONFIRMATIONS[value.scope]
    ) {
      context.addIssue({
        code: "custom",
        path: ["confirmation"],
        message: "La phrase de confirmation ne correspond pas.",
      });
    }
  });

export type YouTubeVideoResetInput = z.infer<
  typeof youtubeVideoResetSchema
>;
