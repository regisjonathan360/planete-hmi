"use client";

import { useId, useState, type FormEvent } from "react";
import {
  YOUTUBE_VIDEO_TYPES,
  YOUTUBE_VIDEO_VERIFICATION_STATUSES,
} from "../../lib/youtube/constants";
import type {
  YouTubeVideoType,
  YouTubeVerificationStatus,
} from "../../lib/youtube/types";
import {
  getZodFieldErrors,
  youtubeVideoEditorialInputSchema,
  type YouTubeVideoEditorialInput,
} from "./forms";
import styles from "./YouTubeAdminForms.module.css";

const REVIEW_STATUS_LABELS: Record<YouTubeVerificationStatus, string> = {
  UNREVIEWED: "À vérifier",
  NEEDS_INFORMATION: "Informations requises",
  APPROVED: "Approuvée",
  EXCLUDED: "Exclue",
  DUPLICATE: "Doublon",
  IGNORED: "Ignorée",
};

const VIDEO_TYPE_LABELS: Record<YouTubeVideoType, string> = {
  OFFICIAL_MUSIC_VIDEO: "Clip officiel",
  OFFICIAL_AUDIO: "Audio officiel",
  OFFICIAL_LYRIC_VIDEO: "Lyric vidéo officielle",
  OFFICIAL_VISUALIZER: "Visualizer officiel",
  OFFICIAL_ANIMATION: "Animation officielle",
  SHORT: "Short",
  LIVE_PERFORMANCE: "Performance live",
  CONCERT: "Concert",
  INTERVIEW: "Interview",
  TEASER: "Teaser",
  TRAILER: "Bande-annonce",
  REACTION: "Réaction",
  FAN_UPLOAD: "Publication de fan",
  DANCE_CHALLENGE: "Défi de danse",
  PODCAST: "Podcast",
  COMPILATION: "Compilation",
  BEHIND_THE_SCENES: "Coulisses",
  UNKNOWN: "Type inconnu",
};

type EditableEditorialValues = Omit<
  YouTubeVideoEditorialInput,
  "trackId" | "displayThumbnailUrl"
> & {
  trackId: string;
  displayThumbnailUrl: string;
};

export interface YouTubeEditorialSourceSummary {
  videoId: string;
  sourceTitle: string;
  channelTitle: string;
  publishedAt: string;
  viewCount: number;
}

export interface YouTubeVideoEditorialFormProps {
  source: YouTubeEditorialSourceSummary;
  initialValues: YouTubeVideoEditorialInput;
  onSubmit: (values: YouTubeVideoEditorialInput) => Promise<void> | void;
  submitting?: boolean;
  submitLabel?: string;
}

export function YouTubeVideoEditorialForm({
  source,
  initialValues,
  onSubmit,
  submitting = false,
  submitLabel = "Enregistrer les modifications",
}: YouTubeVideoEditorialFormProps) {
  const id = useId();
  const [values, setValues] = useState<EditableEditorialValues>(() => ({
    ...initialValues,
    trackId: initialValues.trackId ?? "",
    displayThumbnailUrl: initialValues.displayThumbnailUrl ?? "",
  }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  function setField<Field extends keyof EditableEditorialValues>(
    field: Field,
    value: EditableEditorialValues[Field]
  ) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => {
      if (current[field] === undefined) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);

    const parsed = youtubeVideoEditorialInputSchema.safeParse(values);
    if (!parsed.success) {
      setErrors(getZodFieldErrors(parsed.error));
      return;
    }

    setErrors({});
    try {
      await onSubmit(parsed.data);
    } catch {
      setSubmitError(
        "Les modifications n’ont pas pu être enregistrées. Réessayez plus tard."
      );
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <section className={styles.section} aria-labelledby={`${id}-source-title`}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle} id={`${id}-source-title`}>
            Données YouTube originales
          </h2>
          <p className={styles.sectionDescription}>
            Ces informations sont en lecture seule et ne seront jamais écrasées
            par une correction éditoriale.
          </p>
        </div>
        <div className={styles.sourceGrid}>
          <SourceItem label="Titre source" value={source.sourceTitle} />
          <SourceItem label="Chaîne" value={source.channelTitle} />
          <SourceItem label="Video ID" value={source.videoId} />
          <SourceItem
            label="Publication"
            value={new Intl.DateTimeFormat("fr-FR", {
              dateStyle: "medium",
              timeZone: "UTC",
            }).format(new Date(source.publishedAt))}
          />
          <SourceItem
            label="Vues observées"
            value={new Intl.NumberFormat("fr-FR").format(source.viewCount)}
          />
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Décision éditoriale</h2>
          <p className={styles.sectionDescription}>
            Une vidéo approuvée et éligible doit être liée à une chanson.
          </p>
        </div>

        <div className={styles.grid}>
          <Field
            id={`${id}-review-status`}
            label="Statut de vérification"
            error={errors.reviewStatus}
          >
            <select
              className={styles.select}
              id={`${id}-review-status`}
              value={values.reviewStatus}
              aria-invalid={Boolean(errors.reviewStatus)}
              onChange={(event) =>
                setField(
                  "reviewStatus",
                  event.target.value as YouTubeVerificationStatus
                )
              }
            >
              {YOUTUBE_VIDEO_VERIFICATION_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {REVIEW_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </Field>

          <Field
            id={`${id}-video-type`}
            label="Type de vidéo"
            error={errors.videoType}
          >
            <select
              className={styles.select}
              id={`${id}-video-type`}
              value={values.videoType}
              aria-invalid={Boolean(errors.videoType)}
              onChange={(event) =>
                setField("videoType", event.target.value as YouTubeVideoType)
              }
            >
              {YOUTUBE_VIDEO_TYPES.map((type) => (
                <option key={type} value={type}>
                  {VIDEO_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </Field>

          <Field
            id={`${id}-track-id`}
            label="Identifiant interne de la chanson"
            error={errors.trackId}
          >
            <input
              className={styles.input}
              id={`${id}-track-id`}
              value={values.trackId}
              aria-invalid={Boolean(errors.trackId)}
              onChange={(event) => setField("trackId", event.target.value)}
              placeholder="00000000-0000-0000-0000-000000000000"
            />
          </Field>

          <div className={styles.field}>
            <span className={styles.label}>Éligibilité au Top 20</span>
            <label className={styles.option}>
              <input
                className={styles.checkbox}
                type="checkbox"
                checked={values.isEligible}
                aria-invalid={Boolean(errors.isEligible)}
                onChange={(event) =>
                  setField("isEligible", event.target.checked)
                }
              />
              <span className={styles.optionText}>
                <span className={styles.optionTitle}>Vidéo éligible</span>
                <span className={styles.optionDescription}>
                  Active son inclusion dans l’agrégation de la chanson.
                </span>
              </span>
            </label>
            {errors.isEligible && (
              <p className={styles.error}>{errors.isEligible}</p>
            )}
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Affichage public</h2>
          <p className={styles.sectionDescription}>
            Les valeurs originales restent conservées à côté de ces champs.
          </p>
        </div>

        <div className={styles.grid}>
          <Field
            id={`${id}-display-title`}
            label="Titre public"
            error={errors.displayTitle}
            full
          >
            <input
              className={styles.input}
              id={`${id}-display-title`}
              value={values.displayTitle}
              aria-invalid={Boolean(errors.displayTitle)}
              onChange={(event) =>
                setField("displayTitle", event.target.value)
              }
              maxLength={200}
              required
            />
          </Field>

          <Field
            id={`${id}-thumbnail`}
            label="Miniature publique personnalisée"
            error={errors.displayThumbnailUrl}
            full
          >
            <input
              className={styles.input}
              id={`${id}-thumbnail`}
              type="url"
              value={values.displayThumbnailUrl}
              aria-invalid={Boolean(errors.displayThumbnailUrl)}
              onChange={(event) =>
                setField("displayThumbnailUrl", event.target.value)
              }
              placeholder="https://i.ytimg.com/..."
            />
          </Field>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Justification et audit</h2>
          <p className={styles.sectionDescription}>
            Toute intervention manuelle doit laisser une trace compréhensible.
          </p>
        </div>

        <div className={styles.grid}>
          <Field
            id={`${id}-exclusion-reason`}
            label="Raison d’exclusion"
            error={errors.exclusionReason}
          >
            <textarea
              className={styles.textarea}
              id={`${id}-exclusion-reason`}
              value={values.exclusionReason}
              aria-invalid={Boolean(errors.exclusionReason)}
              onChange={(event) =>
                setField("exclusionReason", event.target.value)
              }
              maxLength={1000}
            />
          </Field>

          <Field
            id={`${id}-review-reason`}
            label="Justification de la modification"
            error={errors.reviewReason}
          >
            <textarea
              className={styles.textarea}
              id={`${id}-review-reason`}
              value={values.reviewReason}
              aria-invalid={Boolean(errors.reviewReason)}
              onChange={(event) =>
                setField("reviewReason", event.target.value)
              }
              minLength={10}
              maxLength={1000}
              required
            />
          </Field>
        </div>
      </section>

      <div className={styles.actions}>
        {submitError && (
          <p className={`${styles.status} ${styles.statusError}`} role="alert">
            {submitError}
          </p>
        )}
        <button className={styles.submit} type="submit" disabled={submitting}>
          {submitting ? "Enregistrement…" : submitLabel}
        </button>
      </div>
    </form>
  );
}

function Field({
  id,
  label,
  error,
  full = false,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`${styles.field} ${full ? styles.fieldFull : ""}`}>
      <label className={styles.label} htmlFor={id}>
        {label}
      </label>
      {children}
      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
}

function SourceItem({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.sourceItem}>
      <span className={styles.sourceLabel}>{label}</span>
      <span className={styles.sourceValue}>{value}</span>
    </div>
  );
}
