/**
 * Panel de statistiques de la radio
 * Affiche les statistiques en temps réel et l'historique
 */
"use client";

import type { RadioStats } from "@/lib/radio/types";
import styles from "./RadioStatsPanel.module.css";

interface RadioStatsPanelProps {
  stats: RadioStats | null;
}

export function RadioStatsPanel({ stats }: RadioStatsPanelProps) {
  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <h2>Statistiques de la Radio</h2>
        <div className={styles.liveIndicator}>
          <span className={styles.dot} />
          EN DIRECT
        </div>
      </div>

      {!stats ? (
        <div className={styles.empty}>
          <p>Aucune statistique disponible</p>
        </div>
      ) : (
        <div className={styles.stats}>
          {/* Piste en cours */}
          <div className={styles.statCard}>
            <div className={styles.statIcon}>🎵</div>
            <div className={styles.statContent}>
              <div className={styles.statLabel}>Piste en cours</div>
              <div className={styles.statValue}>
                {stats.current_track?.title || "Aucune piste"}
              </div>
              {stats.current_track && (
                <div className={styles.statSubtext}>
                  {stats.current_track.artist_name}
                </div>
              )}
            </div>
          </div>

          {/* Nombre d'auditeurs */}
          <div className={styles.statCard}>
            <div className={styles.statIcon}>👥</div>
            <div className={styles.statContent}>
              <div className={styles.statLabel}>Auditeurs en ligne</div>
              <div className={styles.statValue}>{stats.listener_count}</div>
              <div className={styles.statSubtext}>
                {stats.listener_count > 1 ? "personnes" : "personne"} à l'écoute
              </div>
            </div>
          </div>

          {/* Temps depuis le début */}
          {stats.started_at && (
            <div className={styles.statCard}>
              <div className={styles.statIcon}>⏱️</div>
              <div className={styles.statContent}>
                <div className={styles.statLabel}>En direct depuis</div>
                <div className={styles.statValue}>
                  {new Date(stats.started_at).toLocaleString("fr-FR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
                <div className={styles.statSubtext}>
                  {new Date(stats.started_at).toLocaleDateString("fr-FR")}
                </div>
              </div>
            </div>
          )}

          {/* Dernière mise à jour */}
          <div className={styles.statCard}>
            <div className={styles.statIcon}>🔄</div>
            <div className={styles.statContent}>
              <div className={styles.statLabel}>Dernière mise à jour</div>
              <div className={styles.statValue}>
                {new Date(stats.updated_at).toLocaleString("fr-FR", {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Section historique (à venir) */}
      <div className={styles.history}>
        <h3>Historique de lecture</h3>
        <p className={styles.comingSoon}>
          Graphiques et historique détaillé à venir...
        </p>
      </div>
    </div>
  );
}
