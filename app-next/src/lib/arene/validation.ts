import { z } from "zod";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ValidationResult =
  | { valid: true }
  | { valid: false; reason: string };

// ---------------------------------------------------------------------------
// Pseudo Validation
// ---------------------------------------------------------------------------

const PSEUDO_MIN_LENGTH = 3;
const PSEUDO_MAX_LENGTH = 30;
const PSEUDO_PATTERN = /^[\p{L}\d\-_]+$/u;

/**
 * Validates a pseudo (username) against community rules.
 *
 * Rules:
 * - Length between 3 and 30 characters (inclusive)
 * - Only Unicode letters, digits, hyphens, and underscores
 * - Must not contain any banned term (case-insensitive substring match)
 */
export function validatePseudo(
  pseudo: string,
  bannedTerms: string[]
): ValidationResult {
  if (pseudo.length < PSEUDO_MIN_LENGTH) {
    return {
      valid: false,
      reason: `Le pseudo doit contenir au moins ${PSEUDO_MIN_LENGTH} caractères.`,
    };
  }

  if (pseudo.length > PSEUDO_MAX_LENGTH) {
    return {
      valid: false,
      reason: `Le pseudo ne doit pas dépasser ${PSEUDO_MAX_LENGTH} caractères.`,
    };
  }

  if (!PSEUDO_PATTERN.test(pseudo)) {
    return {
      valid: false,
      reason:
        "Le pseudo ne peut contenir que des lettres, chiffres, tirets et underscores.",
    };
  }

  const pseudoLower = pseudo.toLowerCase();
  for (const term of bannedTerms) {
    if (term.length > 0 && pseudoLower.includes(term.toLowerCase())) {
      return {
        valid: false,
        reason: "Le pseudo contient un terme interdit.",
      };
    }
  }

  return { valid: true };
}

// ---------------------------------------------------------------------------
// Comment Body Validation
// ---------------------------------------------------------------------------

const COMMENT_MIN_LENGTH = 1;
const COMMENT_MAX_LENGTH = 500;

/**
 * Validates a comment body.
 *
 * Rules:
 * - Trimmed length must be between 1 and 500 characters (inclusive)
 */
export function validateCommentBody(body: string): ValidationResult {
  const trimmed = body.trim();

  if (trimmed.length < COMMENT_MIN_LENGTH) {
    return {
      valid: false,
      reason: "Le commentaire ne peut pas être vide.",
    };
  }

  if (trimmed.length > COMMENT_MAX_LENGTH) {
    return {
      valid: false,
      reason: `Le commentaire ne doit pas dépasser ${COMMENT_MAX_LENGTH} caractères.`,
    };
  }

  return { valid: true };
}

// ---------------------------------------------------------------------------
// Zod Schemas
// ---------------------------------------------------------------------------

/**
 * Zod schema for pseudo validation.
 * Matches: 3-30 chars, Unicode letters/digits/hyphens/underscores.
 */
export const pseudoSchema = z
  .string()
  .min(PSEUDO_MIN_LENGTH, `Le pseudo doit contenir au moins ${PSEUDO_MIN_LENGTH} caractères.`)
  .max(PSEUDO_MAX_LENGTH, `Le pseudo ne doit pas dépasser ${PSEUDO_MAX_LENGTH} caractères.`)
  .regex(
    PSEUDO_PATTERN,
    "Le pseudo ne peut contenir que des lettres, chiffres, tirets et underscores."
  );

/**
 * Zod schema for comment body validation.
 * Trims whitespace, then enforces 1-500 char length.
 */
export const commentBodySchema = z
  .string()
  .transform((s) => s.trim())
  .pipe(
    z
      .string()
      .min(COMMENT_MIN_LENGTH, "Le commentaire ne peut pas être vide.")
      .max(COMMENT_MAX_LENGTH, `Le commentaire ne doit pas dépasser ${COMMENT_MAX_LENGTH} caractères.`)
  );

/**
 * Zod schema for battle creation/validation.
 */
export const battleSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  side_a_type: z.enum(["artist", "song"]),
  side_a_id: z.string().uuid(),
  side_a_label: z.string().min(1).max(200),
  side_b_type: z.enum(["artist", "song"]),
  side_b_id: z.string().uuid(),
  side_b_label: z.string().min(1).max(200),
  duration_hours: z.union([z.literal(24), z.literal(48), z.literal(72)]),
});

/**
 * Zod schema for challenge creation/validation.
 */
export const challengeSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  challenge_type: z.enum([
    "vote_battles",
    "comment_songs",
    "react_contents",
    "consecutive_days",
  ]),
  target_count: z.number().int().min(1).max(100),
  reward_points: z.number().int().min(1).max(10000),
  ends_at: z.iso.datetime(),
});

/**
 * Zod schema for badge creation/validation.
 */
export const badgeSchema = z.object({
  name: z.string().min(3).max(50),
  description: z.string().min(10).max(200),
  icon_url: z.url(),
  badge_type: z
    .enum([
      "first_comment",
      "first_vote",
      "10_battles",
      "50_reactions",
      "7_days_streak",
      "challenge_complete",
      "level_up",
      "special",
    ])
    .optional(),
  is_special: z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// Solitaire de l'Arène — cartes personnalisables par artiste
// ---------------------------------------------------------------------------

/** Clé de carte : rang + enseigne, ex. "KH" (roi de cœur). */
export const solitaireCardKeySchema = z
  .string()
  .regex(/^(A|2|3|4|5|6|7|8|9|10|J|Q|K)(H|D|C|S)$/, "Clé de carte invalide.");

export const SOLITAIRE_RANKS = [
  "ace", "two", "three", "four", "five",
  "six", "seven", "eight", "nine", "ten",
  "jack", "queen", "king",
] as const;

export const solitaireRankSchema = z.enum(SOLITAIRE_RANKS);

export const solitaireMaskTypeSchema = z.enum([
  "circle",
  "square",
  "rounded-square",
]);

/**
 * Personnalisation d'une carte (POST /api/admin/arene/solitaire/cards/[key]).
 * Les overrides de masque/cadrage sont facultatifs (null = suivre le preset du rang).
 */
export const solitaireCardSchema = z.object({
  artist_id: z.string().uuid().nullable(),
  mask_type: solitaireMaskTypeSchema.nullable().optional(),
  mask_scale: z.number().min(0).max(10).nullable().optional(),
  mask_pos_x: z.number().min(0).max(1).nullable().optional(),
  mask_pos_y: z.number().min(0).max(1).nullable().optional(),
  image_zoom: z.number().min(0.1).max(5).nullable().optional(),
  image_pos_x: z.number().min(0).max(1).nullable().optional(),
  image_pos_y: z.number().min(0).max(1).nullable().optional(),
});

/** Géométrie par rang (PUT /api/admin/arene/solitaire/presets/[rank]). */
export const solitairePresetSchema = z.object({
  mask_type: solitaireMaskTypeSchema,
  mask_scale: z.number().min(0).max(10),
  mask_pos_x: z.number().min(0).max(1),
  mask_pos_y: z.number().min(0).max(1),
  image_zoom: z.number().min(0.1).max(5),
  image_pos_x: z.number().min(0).max(1),
  image_pos_y: z.number().min(0).max(1),
});
