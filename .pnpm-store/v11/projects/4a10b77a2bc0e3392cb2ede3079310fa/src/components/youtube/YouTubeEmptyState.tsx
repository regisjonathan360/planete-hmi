import type { ReactNode } from "react";
import styles from "./YouTubeAdminStates.module.css";

export interface YouTubeEmptyStateProps {
  title: string;
  description: string;
  eyebrow?: string;
  action?: ReactNode;
}

export function YouTubeEmptyState({
  title,
  description,
  eyebrow = "Top YouTube HMI",
  action,
}: YouTubeEmptyStateProps) {
  return (
    <section className={styles.emptyState} aria-label={title}>
      <p className={styles.emptyEyebrow}>{eyebrow}</p>
      <h2 className={styles.emptyTitle}>{title}</h2>
      <p className={styles.emptyDescription}>{description}</p>
      {action ? <div className={styles.emptyAction}>{action}</div> : null}
    </section>
  );
}
