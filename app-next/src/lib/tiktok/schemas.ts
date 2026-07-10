/**
 * Schémas Zod de validation pour le module TikTok Charts.
 *
 * Valide les réponses de l'API TikTok Research, les paramètres de collecte,
 * et les entrées administratives.
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// 1. TikTokVideoSchema — Vidéo individuelle issue de l'API TikTok Research
// ---------------------------------------------------------------------------

/**
 * Schéma de validation pour une vidéo TikTok brute retournée par l'API.
 * Coerce create_time (number epoch ou string ISO) vers une date ISO string.
 * Applique des valeurs par défaut pour les compteurs et les tableaux.
 */
export const TikTokVideoSchema = z.object({
  video_id: z.string().min(1),
  music_id: z.string().min(1),
  username: z.string().min(1),
  create_time: z
    .union([z.number(), z.string()])
    .transform((val) => {
      if (typeof val === "number") {
        // TikTok Research API retourne un epoch en secondes
        return new Date(val * 1000).toISOString();
      }
      // Si c'est déjà une string (ISO ou autre), tenter de la parser
      const parsed = new Date(val);
      if (isNaN(parsed.getTime())) {
        throw new Error(`Invalid date string: ${val}`);
      }
      return parsed.toISOString();
    }),
  region_code: z.string().optional().default(""),
  view_count: z.number().int().nonnegative().default(0),
  like_count: z.number().int().nonnegative().default(0),
  comment_count: z.number().int().nonnegative().default(0),
  share_count: z.number().int().nonnegative().default(0),
  hashtag_names: z.array(z.string()).default([]),
  video_description: z.string().nullable().optional().default(null),
});

/** Type inféré d'une vidéo TikTok validée */
export type ValidatedTikTokVideo = z.infer<typeof TikTokVideoSchema>;

// ---------------------------------------------------------------------------
// 2. TikTokVideoResponseSchema — Réponse complète de l'API TikTok Research
// ---------------------------------------------------------------------------

/**
 * Schéma pour la réponse paginée de l'endpoint POST /v2/video/query/.
 * Adapté à la structure réelle de l'API TikTok Research.
 */
export const TikTokVideoResponseSchema = z.object({
  data: z.object({
    videos: z.array(TikTokVideoSchema).default([]),
    cursor: z.number().int().nonnegative().default(0),
    has_more: z.boolean().default(false),
    search_id: z.string().optional(),
  }),
  error: z
    .object({
      code: z.string().optional(),
      message: z.string().optional(),
      log_id: z.string().optional(),
    })
    .optional(),
});

/** Type inféré de la réponse API TikTok */
export type ValidatedTikTokVideoResponse = z.infer<typeof TikTokVideoResponseSchema>;

// ---------------------------------------------------------------------------
// 3. CollectionParamsSchema — Paramètres de déclenchement de la collecte
// ---------------------------------------------------------------------------

/**
 * Schéma pour les paramètres optionnels lors du déclenchement d'une collecte
 * (depuis le cron ou le bouton admin).
 */
export const CollectionParamsSchema = z.object({
  /** Date de début (format YYYYMMDD) — par défaut 7 jours avant aujourd'hui */
  start_date: z.string().regex(/^\d{8}$/, "Format attendu : YYYYMMDD").optional(),
  /** Date de fin (format YYYYMMDD) — par défaut aujourd'hui */
  end_date: z.string().regex(/^\d{8}$/, "Format attendu : YYYYMMDD").optional(),
  /** Filtrer par sources spécifiques (region, hashtags, keywords, artists) */
  sources: z
    .array(z.enum(["region", "hashtags", "keywords", "artists"]))
    .optional(),
});

/** Type inféré des paramètres de collecte */
export type ValidatedCollectionParams = z.infer<typeof CollectionParamsSchema>;

// ---------------------------------------------------------------------------
// 4. ValidationActionSchema — Action de validation admin sur un son
// ---------------------------------------------------------------------------

/**
 * Schéma pour la requête POST de validation/refus d'un son depuis le panneau admin.
 */
export const ValidationActionSchema = z.object({
  music_id: z.string().min(1, "music_id est requis"),
  status: z.enum(["valide", "refuse"], {
    error: "Le statut doit être 'valide' ou 'refuse'",
  }),
});

/** Type inféré de l'action de validation */
export type ValidatedValidationAction = z.infer<typeof ValidationActionSchema>;

// ---------------------------------------------------------------------------
// 5. ShortsSelectionSchema — Sélection de vidéo pour HMI Shorts
// ---------------------------------------------------------------------------

/**
 * Schéma pour la sélection d'une vidéo dans la section HMI Shorts de la homepage.
 */
export const ShortsSelectionSchema = z.object({
  video_id: z.string().min(1, "video_id est requis"),
  music_id: z.string().min(1, "music_id est requis"),
  display_order: z
    .number()
    .int()
    .nonnegative("display_order doit être un entier positif ou zéro"),
});

/** Type inféré de la sélection HMI Shorts */
export type ValidatedShortsSelection = z.infer<typeof ShortsSelectionSchema>;

// ---------------------------------------------------------------------------
// normalizeVideo — Fonction de normalisation pour Property 1 testing
// ---------------------------------------------------------------------------

/**
 * Normalise un objet vidéo brut provenant de l'API TikTok en un objet validé
 * contenant tous les champs requis (video_id, music_id, username, create_time,
 * region_code, view_count, like_count, comment_count, share_count,
 * hashtag_names, video_description).
 *
 * Utilise TikTokVideoSchema.parse() en interne pour la validation et la
 * transformation (coercion des dates, valeurs par défaut des compteurs).
 *
 * @throws {ZodError} si l'objet brut ne respecte pas le schéma minimal requis
 */
export function normalizeVideo(raw: unknown): ValidatedTikTokVideo {
  return TikTokVideoSchema.parse(raw);
}
