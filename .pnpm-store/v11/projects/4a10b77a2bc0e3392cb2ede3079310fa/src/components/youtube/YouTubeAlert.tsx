import type { ReactNode } from "react";
import styles from "./YouTubeAdminStates.module.css";

type YouTubeAlertTone = "info" | "success" | "warning" | "error";

const ALERT_CLASSES: Record<YouTubeAlertTone, string> = {
  info: styles.alertInfo,
  success: styles.alertSuccess,
  warning: styles.alertWarning,
  error: styles.alertError,
};

export interface YouTubeAlertProps {
  tone: YouTubeAlertTone;
  title: string;
  children: ReactNode;
  details?: readonly string[];
}

export function YouTubeAlert({
  tone,
  title,
  children,
  details = [],
}: YouTubeAlertProps) {
  return (
    <section
      className={`${styles.alert} ${ALERT_CLASSES[tone]}`}
      role={tone === "error" ? "alert" : "status"}
    >
      <div className={styles.alertContent}>
        <p className={styles.alertTitle}>{title}</p>
        <div className={styles.alertMessage}>{children}</div>
        {details.length > 0 ? (
          <ul className={styles.alertDetails}>
            {details.map((detail) => (
              <li key={detail}>{detail}</li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}
