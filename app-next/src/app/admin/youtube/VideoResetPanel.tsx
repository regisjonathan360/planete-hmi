"use client";

import { useState } from "react";
import { YouTubeAlert } from "@/components/youtube";
import {
  YOUTUBE_VIDEO_RESET_CONFIRMATIONS,
  type YouTubeVideoResetScope,
} from "@/lib/youtube/video-reset";
import { readApiError } from "./utils";
import styles from "./youtube-admin.module.css";

const RESET_OPTIONS: Array<{
  scope: YouTubeVideoResetScope;
  title: string;
  description: string;
  action: string;
  danger?: boolean;
}> = [
  {
    scope: "pending",
    title: "File à vérifier",
    description:
      "Retire les vidéos non vérifiées et celles qui demandent encore des informations.",
    action: "Vider la file",
  },
  {
    scope: "rejected",
    title: "Vidéos écartées",
    description:
      "Nettoie les vidéos exclues, ignorées ou marquées comme doublons.",
    action: "Nettoyer la liste",
  },
  {
    scope: "all",
    title: "Toutes les vidéos collectées",
    description:
      "Vide toutes les listes actives. Les relevés historiques restent conservés et protégés.",
    action: "Tout réinitialiser",
    danger: true,
  },
];

interface ResetResponse {
  affectedCount: number;
  deletedCount: number;
  archivedCount: number;
}

export function VideoResetPanel({ onReset }: { onReset: () => Promise<void> }) {
  const [selectedScope, setSelectedScope] =
    useState<YouTubeVideoResetScope | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);

  const selectedOption = RESET_OPTIONS.find(
    (option) => option.scope === selectedScope
  );
  const expectedConfirmation = selectedScope
    ? YOUTUBE_VIDEO_RESET_CONFIRMATIONS[selectedScope]
    : "";

  function closeDialog() {
    if (submitting) return;
    setSelectedScope(null);
    setConfirmation("");
  }

  async function submitReset() {
    if (!selectedScope || confirmation !== expectedConfirmation) return;
    setSubmitting(true);
    setNotice(null);
    try {
      const response = await fetch("/api/admin/youtube/videos/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope: selectedScope,
          confirmation,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(
          readApiError(payload, "La réinitialisation a échoué.")
        );
      }

      const result = payload as ResetResponse;
      setNotice({
        tone: "success",
        text: `${result.affectedCount} vidéo(s) retirée(s) des listes actives. ${result.deletedCount} supprimée(s), ${result.archivedCount} archivée(s) pour préserver les relevés historiques.`,
      });
      setSelectedScope(null);
      setConfirmation("");
      await onReset();
    } catch (error) {
      setNotice({
        tone: "error",
        text:
          error instanceof Error
            ? error.message
            : "La réinitialisation a échoué.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className={`${styles.panel} ${styles.resetPanel}`}>
      <div className={styles.panelHeader}>
        <div>
          <h2>Réinitialiser les vidéos collectées</h2>
          <p>
            Choisissez précisément la liste à vider. Aucune chaîne ni chanson
            ne sera supprimée.
          </p>
        </div>
      </div>

      {notice ? (
        <YouTubeAlert tone={notice.tone} title="Réinitialisation YouTube">
          {notice.text}
        </YouTubeAlert>
      ) : null}

      <div className={styles.resetOptions}>
        {RESET_OPTIONS.map((option) => (
          <div className={styles.resetOption} key={option.scope}>
            <div>
              <strong>{option.title}</strong>
              <p>{option.description}</p>
            </div>
            <button
              type="button"
              className={option.danger ? "btn btn--danger" : "btn btn--ghost"}
              onClick={() => {
                setSelectedScope(option.scope);
                setConfirmation("");
              }}
            >
              {option.action}
            </button>
          </div>
        ))}
      </div>

      {selectedScope && selectedOption ? (
        <div
          className={styles.modalBackdrop}
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeDialog();
          }}
        >
          <section
            className={`${styles.modal} ${styles.resetModal}`}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="youtube-reset-title"
            aria-describedby="youtube-reset-description"
          >
            <div className={styles.modalHeader}>
              <div>
                <h2 id="youtube-reset-title">{selectedOption.title}</h2>
                <p id="youtube-reset-description">
                  Cette action retire les vidéos concernées de l’administration.
                  Les snapshots historiques ne seront jamais effacés.
                </p>
              </div>
            </div>
            <label className={styles.field}>
              <span>
                Saisissez <strong>{expectedConfirmation}</strong> pour confirmer
              </span>
              <input
                autoFocus
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                autoComplete="off"
              />
            </label>
            <div className={styles.modalActions}>
              <button
                className="btn btn--ghost"
                type="button"
                onClick={closeDialog}
                disabled={submitting}
              >
                Annuler
              </button>
              <button
                className="btn btn--danger"
                type="button"
                onClick={submitReset}
                disabled={
                  submitting || confirmation !== expectedConfirmation
                }
              >
                {submitting ? "Réinitialisation..." : "Confirmer"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
