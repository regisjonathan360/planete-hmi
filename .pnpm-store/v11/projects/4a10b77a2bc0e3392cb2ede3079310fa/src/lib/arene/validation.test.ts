import { describe, it, expect } from "vitest";
import {
  validatePseudo,
  validateCommentBody,
  pseudoSchema,
  commentBodySchema,
  battleSchema,
  challengeSchema,
  badgeSchema,
} from "./validation";

// ---------------------------------------------------------------------------
// validatePseudo
// ---------------------------------------------------------------------------

describe("validatePseudo", () => {
  it("accepts a valid pseudo", () => {
    expect(validatePseudo("Player-1", [])).toEqual({ valid: true });
  });

  it("accepts pseudo with Unicode letters", () => {
    expect(validatePseudo("Réné_étoile", [])).toEqual({ valid: true });
  });

  it("accepts pseudo at min length (3 chars)", () => {
    expect(validatePseudo("abc", [])).toEqual({ valid: true });
  });

  it("accepts pseudo at max length (30 chars)", () => {
    const pseudo = "a".repeat(30);
    expect(validatePseudo(pseudo, [])).toEqual({ valid: true });
  });

  it("rejects pseudo shorter than 3 chars", () => {
    const result = validatePseudo("ab", []);
    expect(result.valid).toBe(false);
  });

  it("rejects pseudo longer than 30 chars", () => {
    const result = validatePseudo("a".repeat(31), []);
    expect(result.valid).toBe(false);
  });

  it("rejects pseudo with spaces", () => {
    const result = validatePseudo("hello world", []);
    expect(result.valid).toBe(false);
  });

  it("rejects pseudo with special characters", () => {
    const result = validatePseudo("user@name!", []);
    expect(result.valid).toBe(false);
  });

  it("rejects pseudo containing a banned term (case-insensitive)", () => {
    const result = validatePseudo("badWord123", ["badword"]);
    expect(result.valid).toBe(false);
  });

  it("rejects pseudo containing banned term as substring", () => {
    const result = validatePseudo("my-spam-name", ["spam"]);
    expect(result.valid).toBe(false);
  });

  it("ignores empty strings in banned terms list", () => {
    expect(validatePseudo("Player1", [""])).toEqual({ valid: true });
  });
});

// ---------------------------------------------------------------------------
// validateCommentBody
// ---------------------------------------------------------------------------

describe("validateCommentBody", () => {
  it("accepts a valid comment", () => {
    expect(validateCommentBody("Bonne musique!")).toEqual({ valid: true });
  });

  it("accepts comment at min length (1 char after trim)", () => {
    expect(validateCommentBody("  a  ")).toEqual({ valid: true });
  });

  it("accepts comment at max length (500 chars after trim)", () => {
    const body = "x".repeat(500);
    expect(validateCommentBody(body)).toEqual({ valid: true });
  });

  it("rejects empty comment", () => {
    const result = validateCommentBody("");
    expect(result.valid).toBe(false);
  });

  it("rejects whitespace-only comment", () => {
    const result = validateCommentBody("    ");
    expect(result.valid).toBe(false);
  });

  it("rejects comment exceeding 500 chars after trim", () => {
    const result = validateCommentBody("x".repeat(501));
    expect(result.valid).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Zod Schemas
// ---------------------------------------------------------------------------

describe("pseudoSchema", () => {
  it("accepts a valid pseudo", () => {
    expect(pseudoSchema.safeParse("Player-1").success).toBe(true);
  });

  it("rejects too-short pseudo", () => {
    expect(pseudoSchema.safeParse("ab").success).toBe(false);
  });

  it("rejects invalid characters", () => {
    expect(pseudoSchema.safeParse("no spaces").success).toBe(false);
  });
});

describe("commentBodySchema", () => {
  it("trims and accepts valid body", () => {
    const result = commentBodySchema.safeParse("  hello  ");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe("hello");
    }
  });

  it("rejects whitespace-only body", () => {
    expect(commentBodySchema.safeParse("   ").success).toBe(false);
  });

  it("rejects body over 500 chars", () => {
    expect(commentBodySchema.safeParse("x".repeat(501)).success).toBe(false);
  });
});

describe("battleSchema", () => {
  const validBattle = {
    title: "Battle du mois",
    side_a_type: "artist" as const,
    side_a_id: "550e8400-e29b-41d4-a716-446655440000",
    side_a_label: "Artiste A",
    side_b_type: "song" as const,
    side_b_id: "550e8400-e29b-41d4-a716-446655440001",
    side_b_label: "Chanson B",
    duration_hours: 48 as const,
  };

  it("accepts valid battle data", () => {
    expect(battleSchema.safeParse(validBattle).success).toBe(true);
  });

  it("accepts battle with optional description", () => {
    expect(
      battleSchema.safeParse({ ...validBattle, description: "Desc" }).success
    ).toBe(true);
  });

  it("rejects invalid duration", () => {
    expect(
      battleSchema.safeParse({ ...validBattle, duration_hours: 12 }).success
    ).toBe(false);
  });

  it("rejects invalid uuid for side_a_id", () => {
    expect(
      battleSchema.safeParse({ ...validBattle, side_a_id: "not-a-uuid" }).success
    ).toBe(false);
  });

  it("rejects title over 100 chars", () => {
    expect(
      battleSchema.safeParse({ ...validBattle, title: "x".repeat(101) }).success
    ).toBe(false);
  });
});

describe("challengeSchema", () => {
  const validChallenge = {
    title: "Défi de la semaine",
    challenge_type: "vote_battles" as const,
    target_count: 10,
    reward_points: 100,
    ends_at: "2025-01-15T12:00:00Z",
  };

  it("accepts valid challenge data", () => {
    expect(challengeSchema.safeParse(validChallenge).success).toBe(true);
  });

  it("rejects target_count over 100", () => {
    expect(
      challengeSchema.safeParse({ ...validChallenge, target_count: 101 }).success
    ).toBe(false);
  });

  it("rejects reward_points over 10000", () => {
    expect(
      challengeSchema.safeParse({ ...validChallenge, reward_points: 10001 })
        .success
    ).toBe(false);
  });

  it("rejects invalid challenge_type", () => {
    expect(
      challengeSchema.safeParse({ ...validChallenge, challenge_type: "invalid" })
        .success
    ).toBe(false);
  });

  it("rejects invalid ends_at format", () => {
    expect(
      challengeSchema.safeParse({ ...validChallenge, ends_at: "not-a-date" })
        .success
    ).toBe(false);
  });
});

describe("badgeSchema", () => {
  const validBadge = {
    name: "Premier commentaire",
    description: "Vous avez publié votre premier commentaire",
    icon_url: "https://example.com/badge.png",
  };

  it("accepts valid badge data", () => {
    expect(badgeSchema.safeParse(validBadge).success).toBe(true);
  });

  it("accepts badge with optional fields", () => {
    expect(
      badgeSchema.safeParse({
        ...validBadge,
        badge_type: "first_comment",
        is_special: false,
      }).success
    ).toBe(true);
  });

  it("rejects name under 3 chars", () => {
    expect(
      badgeSchema.safeParse({ ...validBadge, name: "ab" }).success
    ).toBe(false);
  });

  it("rejects description under 10 chars", () => {
    expect(
      badgeSchema.safeParse({ ...validBadge, description: "short" }).success
    ).toBe(false);
  });

  it("rejects invalid icon_url", () => {
    expect(
      badgeSchema.safeParse({ ...validBadge, icon_url: "not-a-url" }).success
    ).toBe(false);
  });
});
