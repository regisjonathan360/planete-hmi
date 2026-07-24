import type { YouTubeDraftValidationEntry } from "./types";

export type YouTubeValidationSeverity = "BLOCKING" | "WARNING";

export interface YouTubeValidationIssue {
  code: string;
  severity: YouTubeValidationSeverity;
  entryIndex: number | null;
  message: string;
}

export interface YouTubeDraftValidationInput {
  periodStart: string;
  periodEnd: string;
  publicPeriodLabel: string;
  entries: YouTubeDraftValidationEntry[];
}

export interface YouTubeDraftValidationResult {
  valid: boolean;
  blockingErrors: YouTubeValidationIssue[];
  warnings: YouTubeValidationIssue[];
}

function issue(
  code: string,
  severity: YouTubeValidationSeverity,
  message: string,
  entryIndex: number | null = null
): YouTubeValidationIssue {
  return { code, severity, entryIndex, message };
}

/** Contrôles purs à exécuter avant toute publication du Top YouTube HMI. */
export function validateYouTubeDraft(
  input: YouTubeDraftValidationInput
): YouTubeDraftValidationResult {
  const issues: YouTubeValidationIssue[] = [];
  const start = Date.parse(input.periodStart);
  const end = Date.parse(input.periodEnd);

  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) {
    issues.push(
      issue("INVALID_PERIOD", "BLOCKING", "La période est invalide.")
    );
  }
  if (!input.publicPeriodLabel.trim()) {
    issues.push(
      issue(
        "PUBLIC_PERIOD_MISSING",
        "BLOCKING",
        "La période publique est absente."
      )
    );
  }
  if (input.entries.length < 20) {
    issues.push(
      issue(
        "LESS_THAN_20_TRACKS",
        "WARNING",
        "Moins de 20 chansons sont éligibles."
      )
    );
  }

  input.entries.forEach((entry, entryIndex) => {
    if (!entry.hasStartSnapshot) {
      issues.push(
        issue(
          "START_SNAPSHOT_MISSING",
          "BLOCKING",
          "Le snapshot de départ est absent.",
          entryIndex
        )
      );
    }
    if (!entry.hasEndSnapshot) {
      issues.push(
        issue(
          "END_SNAPSHOT_MISSING",
          "BLOCKING",
          "Le snapshot de fin est absent.",
          entryIndex
        )
      );
    }
    if (entry.verificationStatus !== "APPROVED") {
      issues.push(
        issue(
          "VIDEO_NOT_APPROVED",
          "BLOCKING",
          "Une vidéo du classement n’est pas vérifiée.",
          entryIndex
        )
      );
    }
    if (!entry.trackId) {
      issues.push(
        issue(
          "TRACK_MISSING",
          "BLOCKING",
          "Aucune chanson n’est associée.",
          entryIndex
        )
      );
    }
    if (!entry.artistIsLinked) {
      issues.push(
        issue(
          "ARTIST_MISSING",
          "BLOCKING",
          "Aucun artiste n’est associé.",
          entryIndex
        )
      );
    }
    if (entry.hasDuplicate) {
      issues.push(
        issue(
          "DUPLICATE",
          "BLOCKING",
          "Un doublon non résolu est présent.",
          entryIndex
        )
      );
    }
    if (entry.videoType === "SHORT") {
      issues.push(
        issue(
          "SHORT_INCLUDED",
          "BLOCKING",
          "Un Short est inclus dans le classement principal.",
          entryIndex
        )
      );
    }
    if (entry.eligibilityStatus !== "ELIGIBLE") {
      issues.push(
        issue(
          "INELIGIBLE_VIDEO",
          "BLOCKING",
          "Une vidéo non éligible est utilisée.",
          entryIndex
        )
      );
    }
    if (entry.weeklyViews == null || entry.weeklyViews < 0) {
      issues.push(
        issue(
          "INVALID_WEEKLY_VIEWS",
          "BLOCKING",
          "La métrique hebdomadaire est absente ou négative.",
          entryIndex
        )
      );
    }
    if (entry.manualOverrideApplied && !entry.overrideReason?.trim()) {
      issues.push(
        issue(
          "OVERRIDE_REASON_MISSING",
          "BLOCKING",
          "Une intervention manuelle n’a pas de justification.",
          entryIndex
        )
      );
    }
    if (!entry.publicTitle.trim()) {
      issues.push(
        issue(
          "PUBLIC_TITLE_MISSING",
          "BLOCKING",
          "Le titre public est absent.",
          entryIndex
        )
      );
    }
    if (!entry.likesAvailable) {
      issues.push(
        issue(
          "LIKES_UNAVAILABLE",
          "WARNING",
          "Les likes ne sont pas disponibles.",
          entryIndex
        )
      );
    }
    if (!entry.commentsAvailable) {
      issues.push(
        issue(
          "COMMENTS_UNAVAILABLE",
          "WARNING",
          "Les commentaires ne sont pas disponibles.",
          entryIndex
        )
      );
    }
    if (entry.thumbnailWasChanged) {
      issues.push(
        issue(
          "THUMBNAIL_CHANGED",
          "WARNING",
          "La miniature a été modifiée.",
          entryIndex
        )
      );
    }
    if (!entry.videoIsAvailable) {
      issues.push(
        issue(
          "VIDEO_UNAVAILABLE",
          "WARNING",
          "La vidéo est devenue indisponible.",
          entryIndex
        )
      );
    }
  });

  const blockingErrors = issues.filter(
    (item) => item.severity === "BLOCKING"
  );
  return {
    valid: blockingErrors.length === 0,
    blockingErrors,
    warnings: issues.filter((item) => item.severity === "WARNING"),
  };
}
