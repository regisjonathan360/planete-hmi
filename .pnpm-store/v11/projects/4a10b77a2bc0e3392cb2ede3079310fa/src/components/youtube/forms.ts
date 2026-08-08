import { z } from "zod";
import {
  ELIGIBLE_YOUTUBE_VIDEO_TYPE_SET,
  YOUTUBE_VIDEO_TYPES,
  YOUTUBE_VIDEO_VERIFICATION_STATUSES,
} from "../../lib/youtube/constants";
import {
  youtubeCollectionParamsSchema,
} from "../../lib/youtube/schemas";

const optionalUuidSchema = z
  .string()
  .trim()
  .refine(
    (value) => value === "" || z.uuid().safeParse(value).success,
    "Sélectionnez une chanson valide."
  )
  .transform((value) => value || null);

const optionalUrlSchema = z
  .string()
  .trim()
  .max(2048)
  .refine(
    (value) => value === "" || z.url().safeParse(value).success,
    "Saisissez une URL valide."
  )
  .transform((value) => value || null);

export const youtubeVideoEditorialInputSchema = z
  .object({
    displayTitle: z
      .string()
      .trim()
      .min(1, "Le titre public est obligatoire.")
      .max(200),
    displayThumbnailUrl: optionalUrlSchema,
    reviewStatus: z.enum(YOUTUBE_VIDEO_VERIFICATION_STATUSES),
    videoType: z.enum(YOUTUBE_VIDEO_TYPES),
    isEligible: z.boolean(),
    trackId: optionalUuidSchema,
    exclusionReason: z.string().trim().max(1000),
    reviewReason: z
      .string()
      .trim()
      .min(10, "La justification doit contenir au moins 10 caractères.")
      .max(1000),
  })
  .superRefine((value, ctx) => {
    if (
      value.reviewStatus === "EXCLUDED" &&
      value.exclusionReason.length === 0
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["exclusionReason"],
        message: "Indiquez pourquoi cette vidéo est exclue.",
      });
    }

    if (value.reviewStatus !== "APPROVED" && value.isEligible) {
      ctx.addIssue({
        code: "custom",
        path: ["isEligible"],
        message: "Seule une vidéo approuvée peut être éligible au classement.",
      });
    }

    if (value.isEligible && !ELIGIBLE_YOUTUBE_VIDEO_TYPE_SET.has(value.videoType)) {
      ctx.addIssue({
        code: "custom",
        path: ["isEligible"],
        message: "Ce type de vidéo n’est pas admissible au classement principal.",
      });
    }

  });

export type YouTubeVideoEditorialInput = z.infer<
  typeof youtubeVideoEditorialInputSchema
>;

export { youtubeCollectionParamsSchema };

export function splitUuidList(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(/[\s,;]+/)
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );
}

export function joinUuidList(values: string[]): string {
  return values.join("\n");
}

export function getZodFieldErrors(
  error: z.ZodError
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = issue.path[0];
    if (typeof field === "string" && errors[field] === undefined) {
      errors[field] = issue.message;
    }
  }
  return errors;
}
