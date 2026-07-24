import type { YouTubeCollectionProgress as CollectionProgress } from "@/lib/youtube/types";
import styles from "./YouTubeAdminStates.module.css";
import { YouTubeStatusBadge } from "./YouTubeStatusBadge";

const NUMBER_FORMAT = new Intl.NumberFormat("fr-HT");
const DATE_FORMAT = new Intl.DateTimeFormat("fr-HT", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Port-au-Prince",
});

function clampPercent(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}

function formatDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : DATE_FORMAT.format(date);
}

export interface YouTubeCollectionProgressProps {
  progress: CollectionProgress;
}

export function YouTubeCollectionProgress({
  progress,
}: YouTubeCollectionProgressProps) {
  const percent = clampPercent(progress.progressPercent);
  const startedAt = formatDate(progress.startedAt);
  const finishedAt = formatDate(progress.finishedAt);
  const metrics = [
    {
      label: "Chaînes analysées",
      value: progress.channelsScanned,
      className: "",
    },
    {
      label: "Vidéos découvertes",
      value: progress.videosDiscovered,
      className: "",
    },
    {
      label: "Vidéos actualisées",
      value: progress.videosRefreshed,
      className: "",
    },
    {
      label: "Avertissements",
      value: progress.warningsCount,
      className: styles.metricWarning,
    },
    {
      label: "Erreurs",
      value: progress.errorsCount,
      className: styles.metricError,
    },
  ];

  return (
    <section className={styles.progressPanel} aria-label="Collecte YouTube">
      <div className={styles.progressHeader}>
        <div className={styles.progressHeading}>
          <h2 className={styles.progressTitle}>Collecte YouTube</h2>
          <p className={styles.progressStep}>
            {progress.currentStep || "Préparation de la collecte"}
          </p>
        </div>
        <YouTubeStatusBadge category="collection" status={progress.status} />
      </div>

      <label className={styles.progressGroup}>
        <span className={styles.progressHeading}>
          <span className={styles.progressValue}>{percent} %</span>
          <span className={styles.progressStep}>Progression globale</span>
        </span>
        <progress
          className={styles.progressBar}
          max={100}
          value={percent}
        >
          {percent} %
        </progress>
      </label>

      <dl className={styles.metrics}>
        {metrics.map((metric) => (
          <div
            className={`${styles.metric} ${metric.className}`.trim()}
            key={metric.label}
          >
            <dt>{metric.label}</dt>
            <dd>{NUMBER_FORMAT.format(Math.max(0, metric.value))}</dd>
          </div>
        ))}
      </dl>

      {startedAt || finishedAt ? (
        <p className={styles.progressTimes}>
          {startedAt ? <span>Début : {startedAt}</span> : null}
          {finishedAt ? <span>Fin : {finishedAt}</span> : null}
        </p>
      ) : null}
    </section>
  );
}
