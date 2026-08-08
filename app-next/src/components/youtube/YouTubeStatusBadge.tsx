import type {
  YouTubeChartStatus,
  YouTubeCollectionStatus,
  YouTubeEligibilityStatus,
  YouTubeVerificationStatus,
} from "@/lib/youtube/types";
import styles from "./YouTubeAdminStates.module.css";

type StatusCategory =
  | "collection"
  | "chart"
  | "verification"
  | "eligibility";

type StatusByCategory = {
  collection: YouTubeCollectionStatus;
  chart: YouTubeChartStatus;
  verification: YouTubeVerificationStatus;
  eligibility: YouTubeEligibilityStatus;
};

type BadgeTone = "neutral" | "info" | "success" | "warning" | "danger";

const LABELS: {
  [Category in StatusCategory]: Record<StatusByCategory[Category], string>;
} = {
  collection: {
    PENDING: "En attente",
    RUNNING: "En cours",
    COMPLETED: "Terminée",
    COMPLETED_WITH_WARNINGS: "Terminée avec avertissements",
    FAILED: "Échec",
    CANCELLED: "Annulée",
  },
  chart: {
    EMPTY: "Vide",
    COLLECTING: "Collecte",
    NEEDS_REVIEW: "À vérifier",
    DRAFT: "Brouillon",
    READY: "Prêt",
    SCHEDULED: "Programmé",
    PUBLISHED: "Publié",
    ARCHIVED: "Archivé",
    FAILED: "Échec",
  },
  verification: {
    UNREVIEWED: "Non vérifiée",
    NEEDS_INFORMATION: "Informations requises",
    APPROVED: "Approuvée",
    EXCLUDED: "Exclue",
    DUPLICATE: "Doublon",
    IGNORED: "Ignorée",
  },
  eligibility: {
    ELIGIBLE: "Éligible",
    INELIGIBLE: "Non éligible",
    PENDING: "En attente",
  },
};

const TONES: Record<string, BadgeTone> = {
  RUNNING: "info",
  COLLECTING: "info",
  DRAFT: "info",
  SCHEDULED: "info",
  COMPLETED: "success",
  READY: "success",
  PUBLISHED: "success",
  APPROVED: "success",
  ELIGIBLE: "success",
  COMPLETED_WITH_WARNINGS: "warning",
  NEEDS_REVIEW: "warning",
  NEEDS_INFORMATION: "warning",
  UNREVIEWED: "warning",
  PENDING: "warning",
  FAILED: "danger",
  EXCLUDED: "danger",
  INELIGIBLE: "danger",
};

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: styles.toneNeutral,
  info: styles.toneInfo,
  success: styles.toneSuccess,
  warning: styles.toneWarning,
  danger: styles.toneDanger,
};

export type YouTubeStatusBadgeProps<Category extends StatusCategory> = {
  category: Category;
  status: StatusByCategory[Category];
};

export function YouTubeStatusBadge<Category extends StatusCategory>({
  category,
  status,
}: YouTubeStatusBadgeProps<Category>) {
  const label = LABELS[category][status];
  const tone = TONES[status] ?? "neutral";

  return (
    <span
      className={`${styles.badge} ${TONE_CLASSES[tone]}`}
      data-youtube-status={status}
    >
      {label}
    </span>
  );
}
