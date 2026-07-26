"use client";

import { useId, useState, type FormEvent } from "react";
import {
  YOUTUBE_COLLECTION_MODES,
} from "../../lib/youtube/constants";
import type { YouTubeCollectionParams } from "../../lib/youtube/schemas";
import { getCollectionModePreset } from "../../lib/youtube/collection-mode";
import {
  getZodFieldErrors,
  joinUuidList,
  splitUuidList,
  youtubeCollectionParamsSchema,
} from "./forms";
import styles from "./YouTubeAdminForms.module.css";

const MODE_LABELS: Record<YouTubeCollectionParams["mode"], string> = {
  FULL_WEEKLY: "Collecte hebdomadaire complète",
  REFRESH_STATISTICS: "Actualiser les statistiques",
  DISCOVER_NEW_RELEASES: "Découvrir les nouvelles vidéos",
  CUSTOM: "Collecte personnalisée",
};

const OPTIONS: Array<{
  field: keyof Pick<
    YouTubeCollectionParams,
    | "discoverNewVideos"
    | "refreshStatistics"
    | "refreshMetadata"
    | "createDraft"
    | "recalculateChart"
  >;
  title: string;
  description: string;
}> = [
  {
    field: "discoverNewVideos",
    title: "Découvrir les vidéos",
    description: "Analyse les playlists des chaînes approuvées.",
  },
  {
    field: "refreshStatistics",
    title: "Actualiser les statistiques",
    description: "Récupère les vues, likes et commentaires disponibles.",
  },
  {
    field: "refreshMetadata",
    title: "Actualiser les métadonnées",
    description: "Rafraîchit les titres, miniatures et disponibilités sources.",
  },
  {
    field: "createDraft",
    title: "Créer le brouillon",
    description: "Prépare une édition sans jamais la publier.",
  },
  {
    field: "recalculateChart",
    title: "Recalculer le Top 20",
    description: "Agrège les vidéos éligibles par chanson.",
  },
];

type EditableCollectionForm = Omit<
  YouTubeCollectionParams,
  "artistIds" | "channelIds" | "videoIds" | "trackIds"
> & {
  artistIds: string;
  channelIds: string;
  videoIds: string;
  trackIds: string;
};

export interface YouTubeCollectionFormProps {
  initialValues: YouTubeCollectionParams;
  onSubmit: (values: YouTubeCollectionParams) => Promise<void> | void;
  submitting?: boolean;
  submitLabel?: string;
}

function toEditableValues(
  values: YouTubeCollectionParams
): EditableCollectionForm {
  return {
    ...values,
    artistIds: joinUuidList(values.artistIds),
    channelIds: joinUuidList(values.channelIds),
    videoIds: joinUuidList(values.videoIds),
    trackIds: joinUuidList(values.trackIds),
  };
}

export function YouTubeCollectionForm({
  initialValues,
  onSubmit,
  submitting = false,
  submitLabel = "Lancer la collecte",
}: YouTubeCollectionFormProps) {
  const id = useId();
  const [values, setValues] = useState<EditableCollectionForm>(() =>
    toEditableValues(initialValues)
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const isCustom = values.mode === "CUSTOM";

  function setMode(mode: YouTubeCollectionParams["mode"]) {
    const preset = getCollectionModePreset(mode);
    setValues((current) => ({
      ...current,
      mode,
      ...(preset ?? {}),
    }));
    setErrors((current) => {
      if (current.mode === undefined) return current;
      const next = { ...current };
      delete next.mode;
      return next;
    });
  }

  function setField<Field extends keyof EditableCollectionForm>(
    field: Field,
    value: EditableCollectionForm[Field]
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

    const parsed = youtubeCollectionParamsSchema.safeParse({
      ...values,
      artistIds: splitUuidList(values.artistIds),
      channelIds: splitUuidList(values.channelIds),
      videoIds: splitUuidList(values.videoIds),
      trackIds: splitUuidList(values.trackIds),
    });

    if (!parsed.success) {
      setErrors(getZodFieldErrors(parsed.error));
      return;
    }

    setErrors({});
    try {
      await onSubmit(parsed.data);
    } catch {
      setSubmitError(
        "La collecte n’a pas pu être lancée. Réessayez après avoir vérifié la connexion."
      );
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Période et mode</h2>
          <p className={styles.sectionDescription}>
            La période hebdomadaire est validée avant tout appel serveur.
          </p>
        </div>

        <div className={styles.grid}>
          <FormField
            id={`${id}-period-start`}
            label="Début de la période"
            error={errors.periodStart}
          >
            <input
              className={styles.input}
              id={`${id}-period-start`}
              type="date"
              value={values.periodStart}
              aria-invalid={Boolean(errors.periodStart)}
              onChange={(event) => setField("periodStart", event.target.value)}
              required
            />
          </FormField>

          <FormField
            id={`${id}-period-end`}
            label="Fin de la période"
            error={errors.periodEnd}
          >
            <input
              className={styles.input}
              id={`${id}-period-end`}
              type="date"
              value={values.periodEnd}
              aria-invalid={Boolean(errors.periodEnd)}
              onChange={(event) => setField("periodEnd", event.target.value)}
              required
            />
          </FormField>

          <FormField
            id={`${id}-mode`}
            label="Mode de collecte"
            error={errors.mode}
            full
          >
            <select
              className={styles.select}
              id={`${id}-mode`}
              value={values.mode}
              aria-invalid={Boolean(errors.mode)}
              onChange={(event) =>
                setMode(event.target.value as YouTubeCollectionParams["mode"])
              }
            >
              {YOUTUBE_COLLECTION_MODES.map((mode) => (
                <option key={mode} value={mode}>
                  {MODE_LABELS[mode]}
                </option>
              ))}
            </select>
          </FormField>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Opérations</h2>
          <p className={styles.sectionDescription}>
            Le mode applique un réglage conseillé. Vous pouvez ensuite ajuster
            les opérations. La publication reste toujours séparée.
          </p>
        </div>

        <fieldset className={styles.options}>
          <legend className={styles.legend}>Contenu de la collecte</legend>
          {OPTIONS.map((option) => (
            <label className={styles.option} key={option.field}>
              <input
                className={styles.checkbox}
                type="checkbox"
                checked={values[option.field]}
                disabled={option.field === "refreshMetadata"}
                onChange={(event) =>
                  setField(option.field, event.target.checked)
                }
              />
              <span className={styles.optionText}>
                <span className={styles.optionTitle}>{option.title}</span>
                <span className={styles.optionDescription}>
                  {option.field === "refreshMetadata"
                    ? "Bientôt disponible. Cette opération ne peut pas encore être sélectionnée."
                    : option.description}
                </span>
              </span>
            </label>
          ))}
        </fieldset>
      </section>

      <p className={styles.periodNotice}>
        La période filtre les nouvelles vidéos découvertes. L’actualisation des
        statistiques peut inclure d’anciennes vidéos déjà approuvées afin de
        mesurer les vues gagnées pendant cette période.
      </p>

      {isCustom && (
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Cibles personnalisées</h2>
            <p className={styles.sectionDescription}>
              Collez des identifiants internes séparés par une ligne, une
              virgule ou un espace.
            </p>
          </div>

          <div className={styles.grid}>
            <ListField
              id={`${id}-artist-ids`}
              label="Artistes"
              value={values.artistIds}
              error={errors.artistIds}
              onChange={(value) => setField("artistIds", value)}
            />
            <ListField
              id={`${id}-channel-ids`}
              label="Chaînes"
              value={values.channelIds}
              error={errors.channelIds}
              onChange={(value) => setField("channelIds", value)}
            />
            <ListField
              id={`${id}-video-ids`}
              label="Vidéos"
              value={values.videoIds}
              error={errors.videoIds}
              onChange={(value) => setField("videoIds", value)}
            />
            <ListField
              id={`${id}-track-ids`}
              label="Chansons"
              value={values.trackIds}
              error={errors.trackIds}
              onChange={(value) => setField("trackIds", value)}
            />
          </div>
        </section>
      )}

      <div className={styles.actions}>
        {submitError && (
          <p className={`${styles.status} ${styles.statusError}`} role="alert">
            {submitError}
          </p>
        )}
        <button className={styles.submit} type="submit" disabled={submitting}>
          {submitting ? "Lancement en cours…" : submitLabel}
        </button>
      </div>
    </form>
  );
}

function FormField({
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
  const errorId = `${id}-error`;
  return (
    <div className={`${styles.field} ${full ? styles.fieldFull : ""}`}>
      <label className={styles.label} htmlFor={id}>
        {label}
      </label>
      {children}
      {error && (
        <p className={styles.error} id={errorId}>
          {error}
        </p>
      )}
    </div>
  );
}

function ListField({
  id,
  label,
  value,
  error,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  return (
    <FormField id={id} label={label} error={error}>
      <textarea
        className={styles.textarea}
        id={id}
        value={value}
        aria-invalid={Boolean(error)}
        onChange={(event) => onChange(event.target.value)}
        placeholder="00000000-0000-0000-0000-000000000000"
      />
    </FormField>
  );
}
