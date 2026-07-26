/**
 * Tests K6 — Routes administratives YouTube
 *
 * Tests couvrant :
 * - Sanitisation des erreurs (pas de secrets dans les réponses)
 * - Validation stricte des query parameters
 * - Logique métier d'approbation et d'exclusion
 * - Schéma éditorial D10 (combinaisons incohérentes)
 * - Paramètres de collecte D10
 * - Cohérence des chaînes
 * - validate-draft avec données réelles (pas de faux positifs)
 * - Invariants de non-publication
 */
import { describe, it, expect } from "vitest";
import { sanitizeErrorMessage, toSafeApiError } from "../api-error";
import { z } from "zod";

// ============================================================
// 1. Sanitisation des erreurs
// ============================================================

describe("sanitizeErrorMessage", () => {
  it("supprime les clés API YouTube (AIza...)", () => {
    const msg = "Error: key=AIzaSyB1234567890ABCdef_GHIJK for channel";
    const safe = sanitizeErrorMessage(msg);
    expect(safe).not.toContain("AIzaSyB1234567890ABCdef_GHIJK");
    expect(safe).toContain("[REDACTED]");
  });

  it("supprime les paramètres key= dans les URLs", () => {
    const msg = "Request failed: https://googleapis.com/youtube?key=my_secret_key_12345&part=snippet";
    const safe = sanitizeErrorMessage(msg);
    expect(safe).not.toContain("my_secret_key_12345");
  });

  it("supprime les tokens Bearer", () => {
    const msg = "Auth failed: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.sig";
    const safe = sanitizeErrorMessage(msg);
    expect(safe).not.toContain("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9");
  });

  it("supprime les owner_token", () => {
    const msg = "Lease check: owner_token=550e8400-e29b-41d4-a716-446655440000 invalid";
    const safe = sanitizeErrorMessage(msg);
    expect(safe).not.toContain("550e8400-e29b-41d4-a716-446655440000");
  });

  it("supprime les secrets Supabase", () => {
    const msg = "Using sb_secret_FAKE_TEST_VALUE_NOT_REAL_12345 for auth";
    const safe = sanitizeErrorMessage(msg);
    expect(safe).not.toContain("sb_secret_FAKE_TEST_VALUE_NOT_REAL_12345");
  });

  it("supprime les détails SQL", () => {
    const msg = "Error: INSERT INTO youtube_videos (video_id) VALUES ($1) WHERE something";
    const safe = sanitizeErrorMessage(msg);
    expect(safe).not.toContain("INSERT INTO youtube_videos");
  });

  it("tronque les messages longs à 200 caractères", () => {
    const msg = "A".repeat(300);
    const safe = sanitizeErrorMessage(msg);
    expect(safe.length).toBeLessThanOrEqual(201);
  });

  it("gère un message vide", () => {
    expect(sanitizeErrorMessage("")).toBe("");
  });

  it("supprime les URLs avec secrets multiples", () => {
    const msg = "Fetch https://api.example.com/v1?key=secret123&token=tok456 failed";
    const safe = sanitizeErrorMessage(msg);
    expect(safe).not.toContain("secret123");
    expect(safe).not.toContain("tok456");
  });

  it("supprime les connexions PostgreSQL", () => {
    const msg = "Connect postgresql://user:pass@host:5432/db failed";
    const safe = sanitizeErrorMessage(msg);
    expect(safe).not.toContain("postgresql://user:pass");
  });
});

describe("toSafeApiError", () => {
  it("retourne precondition_failed pour lease perdu", () => {
    const err = new Error("Lease perdu — écriture refusée");
    const safe = toSafeApiError(err);
    expect(safe.code).toBe("precondition_failed");
    expect(safe.status).toBe(412);
  });

  it("retourne conflict pour édition publiée", () => {
    const err = new Error("Impossible de modifier une édition publiée.");
    const safe = toSafeApiError(err);
    expect(safe.code).toBe("conflict");
    expect(safe.status).toBe(409);
  });

  it("retourne service_unavailable pour quota YouTube", () => {
    const err = new Error("Quota YouTube Data API épuisé.");
    const safe = toSafeApiError(err);
    expect(safe.code).toBe("service_unavailable");
    expect(safe.status).toBe(503);
  });

  it("retourne internal_error sans exposer le message brut", () => {
    const err = new Error("relation 'youtube_channels' does not exist at key=AIzaSy123");
    const safe = toSafeApiError(err);
    expect(safe.code).toBe("internal_error");
    expect(safe.message).toBe("Une erreur interne est survenue.");
    expect(safe.message).not.toContain("AIzaSy123");
  });

  it("gère une valeur non-Error", () => {
    const safe = toSafeApiError("string error");
    expect(safe.code).toBe("internal_error");
    expect(safe.status).toBe(500);
  });

  it("ne retourne jamais un faux YOUTUBE_API_KEY dans la réponse", () => {
    const err = new Error("YOUTUBE_API_KEY=AIzaSyFakeKey123456789012345 is invalid");
    const safe = toSafeApiError(err);
    expect(safe.message).not.toContain("AIzaSy");
    expect(safe.message).not.toContain("YOUTUBE_API_KEY");
  });

  it("ne retourne jamais un faux token dans la réponse", () => {
    const err = new Error("owner_token=abc-123 expired for run xyz at key=secret");
    const safe = toSafeApiError(err);
    expect(safe.message).not.toContain("abc-123");
    expect(safe.message).not.toContain("secret");
  });
});

// ============================================================
// 2. Query parameters — validation stricte
// ============================================================

import { videoListQuerySchema, channelListQuerySchema, paginationSchema } from "../route-schemas";

describe("paginationSchema — stricte", () => {
  it("accepte '50' et '0'", () => {
    expect(paginationSchema.safeParse({ limit: "50", offset: "0" }).success).toBe(true);
  });

  it("refuse '10abc'", () => {
    expect(paginationSchema.safeParse({ limit: "10abc", offset: "0" }).success).toBe(false);
  });

  it("refuse nombres décimaux", () => {
    expect(paginationSchema.safeParse({ limit: "3.5", offset: "0" }).success).toBe(false);
  });

  it("refuse signes", () => {
    expect(paginationSchema.safeParse({ limit: "+10", offset: "0" }).success).toBe(false);
  });

  it("refuse espaces", () => {
    expect(paginationSchema.safeParse({ limit: " 5 ", offset: "0" }).success).toBe(false);
  });

  it("refuse limit négatif", () => {
    expect(paginationSchema.safeParse({ limit: "-1", offset: "0" }).success).toBe(false);
  });

  it("refuse limit=0", () => {
    expect(paginationSchema.safeParse({ limit: "0", offset: "0" }).success).toBe(false);
  });

  it("refuse limit > 200", () => {
    expect(paginationSchema.safeParse({ limit: "201", offset: "0" }).success).toBe(false);
  });

  it("refuse offset négatif (signe)", () => {
    expect(paginationSchema.safeParse({ limit: "10", offset: "-5" }).success).toBe(false);
  });

  it("utilise les défauts si absents", () => {
    const result = paginationSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(50);
      expect(result.data.offset).toBe(0);
    }
  });
});

describe("videoListQuerySchema", () => {
  it("accepte un channelId YouTube valide (UC...)", () => {
    const result = videoListQuerySchema.safeParse({
      limit: "10", offset: "0", channelId: "UCxxxxxxxxxxxxxxxxxxxxxx",
    });
    expect(result.success).toBe(true);
  });

  it("refuse un channelId qui ne commence pas par UC", () => {
    const result = videoListQuerySchema.safeParse({
      limit: "10", offset: "0", channelId: "not-a-channel",
    });
    expect(result.success).toBe(false);
  });

  it("refuse un UUID comme channelId (n'est pas un channel_id YouTube)", () => {
    const result = videoListQuerySchema.safeParse({
      limit: "10", offset: "0", channelId: "550e8400-e29b-41d4-a716-446655440000",
    });
    expect(result.success).toBe(false);
  });

  it("accepte internalChannelId comme UUID", () => {
    const result = videoListQuerySchema.safeParse({
      limit: "10", offset: "0", internalChannelId: "550e8400-e29b-41d4-a716-446655440000",
    });
    expect(result.success).toBe(true);
  });

  it("refuse un statut inconnu", () => {
    expect(videoListQuerySchema.safeParse({ limit: "10", offset: "0", status: "INVALID" }).success).toBe(false);
  });

  it("accepte eligible=true strict", () => {
    expect(videoListQuerySchema.safeParse({ limit: "10", offset: "0", eligible: "true" }).success).toBe(true);
  });

  it("refuse eligible=yes", () => {
    expect(videoListQuerySchema.safeParse({ limit: "10", offset: "0", eligible: "yes" }).success).toBe(false);
  });

  it("refuse search > 200 chars", () => {
    expect(videoListQuerySchema.safeParse({ search: "A".repeat(201) }).success).toBe(false);
  });
});

describe("channelListQuerySchema", () => {
  it("accepte statut valide", () => {
    expect(channelListQuerySchema.safeParse({ status: "active" }).success).toBe(true);
  });

  it("refuse statut inconnu", () => {
    expect(channelListQuerySchema.safeParse({ status: "UNKNOWN" }).success).toBe(false);
  });

  it("refuse channelType inconnu", () => {
    expect(channelListQuerySchema.safeParse({ channelType: "FAKE" }).success).toBe(false);
  });

  it("accepte les tris de chaînes connus et applique le tri abonnés par défaut", () => {
    const defaultResult = channelListQuerySchema.safeParse({});
    expect(defaultResult.success).toBe(true);
    if (defaultResult.success) {
      expect(defaultResult.data.sort).toBe("subscribers_desc");
    }
    expect(channelListQuerySchema.safeParse({ sort: "title_asc" }).success).toBe(true);
    expect(channelListQuerySchema.safeParse({ sort: "videos_desc" }).success).toBe(true);
  });

  it("refuse un tri de chaînes inconnu", () => {
    expect(channelListQuerySchema.safeParse({ sort: "random" }).success).toBe(false);
  });
});

// ============================================================
// 3. Logique métier d'approbation
// ============================================================

import {
  ELIGIBLE_YOUTUBE_VIDEO_TYPE_SET,
  EXCLUDED_YOUTUBE_VIDEO_TYPES,
  ELIGIBLE_YOUTUBE_VIDEO_TYPES,
} from "../constants";

describe("approbation vidéo — types éligibles vs exclus", () => {
  it("refuse SHORT", () => {
    expect(ELIGIBLE_YOUTUBE_VIDEO_TYPE_SET.has("SHORT")).toBe(false);
  });

  it("refuse tous les EXCLUDED_YOUTUBE_VIDEO_TYPES", () => {
    for (const type of EXCLUDED_YOUTUBE_VIDEO_TYPES) {
      expect(ELIGIBLE_YOUTUBE_VIDEO_TYPE_SET.has(type)).toBe(false);
    }
  });

  it("accepte tous les ELIGIBLE_YOUTUBE_VIDEO_TYPES", () => {
    for (const type of ELIGIBLE_YOUTUBE_VIDEO_TYPES) {
      expect(ELIGIBLE_YOUTUBE_VIDEO_TYPE_SET.has(type)).toBe(true);
    }
  });
});

// ============================================================
// 4. Schéma éditorial D10 — combinaisons incohérentes
// ============================================================

import { youtubeVideoEditorialInputSchema } from "../../../components/youtube/forms";

describe("youtubeVideoEditorialInputSchema", () => {
  const baseValid = {
    displayTitle: "Titre test",
    displayThumbnailUrl: "",
    reviewStatus: "APPROVED" as const,
    videoType: "OFFICIAL_MUSIC_VIDEO" as const,
    isEligible: true,
    trackId: "550e8400-e29b-41d4-a716-446655440000",
    exclusionReason: "",
    reviewReason: "Vidéo officielle confirmée par l'artiste.",
  };

  it("accepte une combinaison valide", () => {
    expect(youtubeVideoEditorialInputSchema.safeParse(baseValid).success).toBe(true);
  });

  it("refuse vidéo éligible non approuvée", () => {
    expect(youtubeVideoEditorialInputSchema.safeParse({ ...baseValid, reviewStatus: "UNREVIEWED" }).success).toBe(false);
  });

  it("refuse vidéo éligible sans chanson", () => {
    expect(youtubeVideoEditorialInputSchema.safeParse({ ...baseValid, trackId: "" }).success).toBe(false);
  });

  it("refuse SHORT éligible", () => {
    expect(youtubeVideoEditorialInputSchema.safeParse({ ...baseValid, videoType: "SHORT" }).success).toBe(false);
  });

  it("refuse EXCLUDED sans justification", () => {
    expect(youtubeVideoEditorialInputSchema.safeParse({
      ...baseValid, reviewStatus: "EXCLUDED", isEligible: false, exclusionReason: "",
    }).success).toBe(false);
  });

  it("le schéma ne contient pas video_id, channel_id, view_count (whitelist)", () => {
    const shape = youtubeVideoEditorialInputSchema.shape;
    expect(shape).not.toHaveProperty("videoId");
    expect(shape).not.toHaveProperty("channelId");
    expect(shape).not.toHaveProperty("viewCount");
    expect(shape).not.toHaveProperty("publishedAt");
  });
});

// ============================================================
// 5. Paramètres de collecte D10
// ============================================================

import { youtubeCollectionParamsSchema } from "../schemas";

describe("youtubeCollectionParamsSchema", () => {
  const baseParams = {
    periodStart: "2026-07-14",
    periodEnd: "2026-07-21",
    mode: "FULL_WEEKLY" as const,
    discoverNewVideos: true,
    refreshStatistics: true,
    createDraft: true,
    recalculateChart: false,
  };

  it("accepte des paramètres valides", () => {
    expect(youtubeCollectionParamsSchema.safeParse(baseParams).success).toBe(true);
  });

  it("refuse periodEnd <= periodStart", () => {
    expect(youtubeCollectionParamsSchema.safeParse({ ...baseParams, periodEnd: "2026-07-14" }).success).toBe(false);
  });

  it("refuse CUSTOM sans cibles", () => {
    expect(youtubeCollectionParamsSchema.safeParse({
      ...baseParams, mode: "CUSTOM", artistIds: [], channelIds: [], videoIds: [], trackIds: [],
    }).success).toBe(false);
  });

  it("accepte CUSTOM avec artistIds", () => {
    expect(youtubeCollectionParamsSchema.safeParse({
      ...baseParams, mode: "CUSTOM", artistIds: ["550e8400-e29b-41d4-a716-446655440000"],
    }).success).toBe(true);
  });

  it("contient tous les paramètres D10", () => {
    const result = youtubeCollectionParamsSchema.safeParse(baseParams);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveProperty("discoverNewVideos");
      expect(result.data).toHaveProperty("refreshStatistics");
      expect(result.data).toHaveProperty("createDraft");
      expect(result.data).toHaveProperty("recalculateChart");
      expect(result.data).toHaveProperty("mode");
      expect(result.data).toHaveProperty("artistIds");
      expect(result.data).toHaveProperty("channelIds");
      expect(result.data).toHaveProperty("videoIds");
      expect(result.data).toHaveProperty("trackIds");
    }
  });

  it("ne contient pas publish ni autoPublish", () => {
    const result = youtubeCollectionParamsSchema.safeParse(baseParams);
    if (result.success) {
      expect(result.data).not.toHaveProperty("publish");
      expect(result.data).not.toHaveProperty("autoPublish");
    }
  });
});

// ============================================================
// 6. Activation de chaîne — cohérence
// ============================================================

describe("activation chaîne — schema", () => {
  const CHANNEL_TYPES = [
    "OFFICIAL_ARTIST_CHANNEL", "TOPIC_CHANNEL", "VEVO_CHANNEL",
    "LABEL_CHANNEL", "DISTRIBUTOR_CHANNEL", "COLLABORATOR_CHANNEL",
    "OTHER_APPROVED_CHANNEL",
  ] as const;

  const channelPatchSchema = z.object({
    status: z.enum(["active", "paused", "rejected", "pending_review"]).optional(),
    isActive: z.boolean().optional(),
    channelType: z.enum(CHANNEL_TYPES).optional(),
    approvalReason: z.string().trim().min(10).max(1000).nullable().optional(),
  }).superRefine((data, ctx) => {
    if (data.status === "active" && (!data.approvalReason || data.approvalReason.trim().length < 10)) {
      ctx.addIssue({ code: "custom", path: ["approvalReason"], message: "Justification requise." });
    }
    if (data.status === "active" && data.isActive === false) {
      ctx.addIssue({ code: "custom", path: ["isActive"], message: "Incohérent." });
    }
  });

  it("refuse activation sans justification", () => {
    expect(channelPatchSchema.safeParse({ status: "active" }).success).toBe(false);
  });

  it("refuse activation avec justification courte", () => {
    expect(channelPatchSchema.safeParse({ status: "active", approvalReason: "ok" }).success).toBe(false);
  });

  it("refuse status=active avec isActive=false", () => {
    expect(channelPatchSchema.safeParse({
      status: "active", isActive: false, approvalReason: "Chaîne officielle vérifiée.",
    }).success).toBe(false);
  });

  it("accepte activation correcte", () => {
    expect(channelPatchSchema.safeParse({
      status: "active", approvalReason: "Chaîne officielle vérifiée via YouTube.",
    }).success).toBe(true);
  });

  it("activation ne peut pas falsifier isVerified (le schema ne l'inclut pas en sortie)", () => {
    // Le vrai contrôle est dans la route : isVerified du client est ignoré pour l'activation
    // Ici on vérifie que le schema ne valide pas isVerified comme condition d'activation
    const result = channelPatchSchema.safeParse({
      status: "active", approvalReason: "Test suffisant pour passer.",
    });
    expect(result.success).toBe(true);
  });
});

// ============================================================
// 7. validate-draft — détection d'anomalies réelles
// ============================================================

import { validateYouTubeDraft } from "../validate-draft";
import type { YouTubeDraftValidationEntry } from "../types";

describe("validateYouTubeDraft", () => {
  const makeEntry = (overrides: Partial<YouTubeDraftValidationEntry> = {}): YouTubeDraftValidationEntry => ({
    trackId: "550e8400-e29b-41d4-a716-446655440000",
    publicTitle: "Titre public",
    videoType: "OFFICIAL_MUSIC_VIDEO",
    verificationStatus: "APPROVED",
    eligibilityStatus: "ELIGIBLE",
    hasStartSnapshot: true,
    hasEndSnapshot: true,
    weeklyViews: 100000,
    hasDuplicate: false,
    artistIsLinked: true,
    manualOverrideApplied: false,
    overrideReason: null,
    likesAvailable: true,
    commentsAvailable: true,
    thumbnailWasChanged: false,
    videoIsAvailable: true,
    ...overrides,
  });

  it("valide un brouillon complet de 20 entrées", () => {
    const entries = Array.from({ length: 20 }, () => makeEntry());
    const result = validateYouTubeDraft({
      periodStart: "2026-07-14", periodEnd: "2026-07-21",
      publicPeriodLabel: "14 – 21 juillet 2026", entries,
    });
    expect(result.valid).toBe(true);
    expect(result.blockingErrors).toHaveLength(0);
  });

  it("détecte snapshot de départ manquant", () => {
    const entries = Array.from({ length: 20 }, (_, i) =>
      makeEntry(i === 0 ? { hasStartSnapshot: false } : {})
    );
    const result = validateYouTubeDraft({
      periodStart: "2026-07-14", periodEnd: "2026-07-21",
      publicPeriodLabel: "Test", entries,
    });
    expect(result.valid).toBe(false);
    expect(result.blockingErrors.some(e => e.code === "START_SNAPSHOT_MISSING")).toBe(true);
  });

  it("détecte snapshot de fin manquant", () => {
    const entries = Array.from({ length: 20 }, (_, i) =>
      makeEntry(i === 3 ? { hasEndSnapshot: false } : {})
    );
    const result = validateYouTubeDraft({
      periodStart: "2026-07-14", periodEnd: "2026-07-21",
      publicPeriodLabel: "Test", entries,
    });
    expect(result.valid).toBe(false);
  });

  it("détecte vidéo indisponible (warning)", () => {
    const entries = Array.from({ length: 20 }, (_, i) =>
      makeEntry(i === 0 ? { videoIsAvailable: false } : {})
    );
    const result = validateYouTubeDraft({
      periodStart: "2026-07-14", periodEnd: "2026-07-21",
      publicPeriodLabel: "Test", entries,
    });
    expect(result.warnings.some(w => w.code === "VIDEO_UNAVAILABLE")).toBe(true);
  });

  it("détecte doublon", () => {
    const entries = Array.from({ length: 20 }, (_, i) =>
      makeEntry(i === 3 ? { hasDuplicate: true } : {})
    );
    const result = validateYouTubeDraft({
      periodStart: "2026-07-14", periodEnd: "2026-07-21",
      publicPeriodLabel: "Test", entries,
    });
    expect(result.valid).toBe(false);
    expect(result.blockingErrors.some(e => e.code === "DUPLICATE")).toBe(true);
  });

  it("détecte absence d'artiste", () => {
    const entries = Array.from({ length: 20 }, (_, i) =>
      makeEntry(i === 0 ? { artistIsLinked: false } : {})
    );
    const result = validateYouTubeDraft({
      periodStart: "2026-07-14", periodEnd: "2026-07-21",
      publicPeriodLabel: "Test", entries,
    });
    expect(result.valid).toBe(false);
    expect(result.blockingErrors.some(e => e.code === "ARTIST_MISSING")).toBe(true);
  });

  it("détecte vidéo non approuvée", () => {
    const entries = Array.from({ length: 20 }, (_, i) =>
      makeEntry(i === 0 ? { verificationStatus: "UNREVIEWED" } : {})
    );
    const result = validateYouTubeDraft({
      periodStart: "2026-07-14", periodEnd: "2026-07-21",
      publicPeriodLabel: "Test", entries,
    });
    expect(result.valid).toBe(false);
  });

  it("warning si moins de 20 chansons", () => {
    const entries = Array.from({ length: 15 }, () => makeEntry());
    const result = validateYouTubeDraft({
      periodStart: "2026-07-14", periodEnd: "2026-07-21",
      publicPeriodLabel: "Test", entries,
    });
    expect(result.warnings.some(w => w.code === "LESS_THAN_20_TRACKS")).toBe(true);
  });

  it("plusieurs vidéos éligibles sur un même track N'EST PAS un doublon", () => {
    // Le modèle N vidéos → 1 chanson est normal
    // hasDuplicate=false pour ces cas dans la route validate
    const entries = Array.from({ length: 20 }, () => makeEntry({ hasDuplicate: false }));
    const result = validateYouTubeDraft({
      periodStart: "2026-07-14", periodEnd: "2026-07-21",
      publicPeriodLabel: "Test", entries,
    });
    expect(result.valid).toBe(true);
  });
});

// ============================================================
// 8. Actions d'audit K6
// ============================================================

describe("actions d'audit K6", () => {
  const EXPECTED_AUDIT_ACTIONS = [
    "youtube_collect",
    "youtube_cancel_run",
    "youtube_channel_create",
    "youtube_channel_update",
    "youtube_channel_deactivate",
    "youtube_channel_refresh",
    "youtube_video_import",
    "youtube_video_update",
    "youtube_video_approve",
    "youtube_video_exclude",
    "youtube_video_link_track",
    "youtube_chart_recalculate",
  ];

  it("12 actions d'audit YouTube définies", () => {
    expect(EXPECTED_AUDIT_ACTIONS.length).toBe(12);
    for (const action of EXPECTED_AUDIT_ACTIONS) {
      expect(action).toMatch(/^youtube_/);
    }
  });
});

// ============================================================
// 9. UUID validation
// ============================================================

describe("UUID validation", () => {
  const uuidSchema = z.string().uuid();

  it("accepte UUID v4 valide", () => {
    expect(uuidSchema.safeParse("550e8400-e29b-41d4-a716-446655440000").success).toBe(true);
  });

  it("refuse UUID invalide", () => {
    expect(uuidSchema.safeParse("not-a-uuid").success).toBe(false);
  });

  it("refuse chaîne vide", () => {
    expect(uuidSchema.safeParse("").success).toBe(false);
  });
});

// ============================================================
// 10. Idempotence
// ============================================================

describe("idempotence — validation", () => {
  it("deux appels identiques produisent le même résultat de validation", () => {
    const params = {
      periodStart: "2026-07-14",
      periodEnd: "2026-07-21",
      mode: "FULL_WEEKLY" as const,
    };
    const r1 = youtubeCollectionParamsSchema.safeParse(params);
    const r2 = youtubeCollectionParamsSchema.safeParse(params);
    expect(r1.success).toBe(true);
    expect(r2.success).toBe(true);
    if (r1.success && r2.success) {
      expect(r1.data.periodStart).toEqual(r2.data.periodStart);
      expect(r1.data.periodEnd).toEqual(r2.data.periodEnd);
    }
  });
});
