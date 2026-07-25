"use client";

import { useEffect, useState } from "react";
import {
  YouTubeAlert,
  YouTubeCollectionForm,
  YouTubeCollectionProgress,
} from "@/components/youtube";
import type { YouTubeCollectionParams } from "@/lib/youtube/schemas";
import type { YouTubeCollectionProgress as Progress } from "@/lib/youtube/types";
import { defaultYouTubePeriod, isRunTerminal, readApiError } from "./utils";
import styles from "./youtube-admin.module.css";

interface RunResponse {
  id: string;
  status: string;
  startedAt: string | null;
  finishedAt: string | null;
  recordsReceived: number | null;
  recordsNormalized: number | null;
  recordsMatched: number | null;
  recordsRejected: number | null;
  metadata: {
    progressPercent?: number;
    currentStep?: string | null;
    warningsCount?: number;
  } | null;
}

const period = defaultYouTubePeriod();
const INITIAL_VALUES: YouTubeCollectionParams = {
  ...period,
  mode: "FULL_WEEKLY",
  artistIds: [],
  channelIds: [],
  videoIds: [],
  trackIds: [],
  discoverNewVideos: true,
  refreshStatistics: true,
  refreshMetadata: false,
  createDraft: true,
  recalculateChart: true,
};

export function CollectionPanel() {
  const [submitting, setSubmitting] = useState(false);
  const [runId, setRunId] = useState<string | null>(null);
  const [run, setRun] = useState<RunResponse | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "warning" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (!runId || (run && isRunTerminal(run.status))) return;
    let cancelled = false;

    async function loadRun() {
      try {
        const response = await fetch(`/api/admin/youtube/collection-runs/${runId}`, {
          cache: "no-store",
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(readApiError(payload, "Impossible de suivre la collecte."));
        if (!cancelled) setRun(payload as RunResponse);
      } catch (error) {
        if (!cancelled) {
          setMessage({
            type: "error",
            text: error instanceof Error ? error.message : "Impossible de suivre la collecte.",
          });
        }
      }
    }

    void loadRun();
    const timer = window.setInterval(loadRun, 2500);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [runId, run]);

  async function handleCollect(values: YouTubeCollectionParams) {
    setSubmitting(true);
    setMessage(null);
    setRun(null);
    try {
      const response = await fetch("/api/admin/youtube/collect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(readApiError(payload, "La collecte n’a pas pu démarrer."));
      }
      setRunId(payload.runId);
      setRun({
        id: payload.runId,
        status: payload.status,
        startedAt: payload.startedAt,
        finishedAt: payload.finishedAt,
        recordsReceived: 0,
        recordsNormalized: 0,
        recordsMatched: 0,
        recordsRejected: 0,
        metadata: {
          progressPercent: isRunTerminal(payload.status) ? 100 : 0,
          currentStep: null,
          warningsCount: payload.warnings?.length ?? 0,
        },
      });
      setMessage({
        type: payload.status === "COMPLETED_WITH_WARNINGS" ? "warning" : "success",
        text: `Collecte ${payload.status.toLowerCase().replaceAll("_", " ")}.`,
      });
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "La collecte n’a pas pu démarrer.",
      });
      throw error;
    } finally {
      setSubmitting(false);
    }
  }

  async function cancelRun() {
    if (!runId) return;
    const response = await fetch(`/api/admin/youtube/collection-runs/${runId}/cancel`, {
      method: "POST",
    });
    const payload = await response.json();
    if (!response.ok) {
      setMessage({ type: "error", text: readApiError(payload, "Annulation impossible.") });
      return;
    }
    setMessage({ type: "warning", text: "Demande d’annulation enregistrée." });
  }

  const progress: Progress | null = run
    ? {
        status: run.status as Progress["status"],
        progressPercent: run.metadata?.progressPercent ?? (isRunTerminal(run.status) ? 100 : 0),
        currentStep: run.metadata?.currentStep ?? null,
        channelsScanned: run.recordsReceived ?? 0,
        videosDiscovered: run.recordsNormalized ?? 0,
        videosRefreshed: run.recordsMatched ?? 0,
        warningsCount: run.metadata?.warningsCount ?? 0,
        errorsCount: run.recordsRejected ?? 0,
        startedAt: run.startedAt,
        finishedAt: run.finishedAt,
      }
    : null;

  return (
    <div className={styles.stack}>
      {message ? (
        <YouTubeAlert tone={message.type} title={message.type === "error" ? "Action impossible" : "Collecte"}>
          {message.text}
        </YouTubeAlert>
      ) : null}
      {progress ? (
        <div className={styles.panel}>
          <YouTubeCollectionProgress progress={progress} />
          {!isRunTerminal(progress.status) ? (
            <div className={styles.panelActions}>
              <button className="btn btn--danger" type="button" onClick={cancelRun}>
                Annuler la collecte
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <h2>Lancer une collecte</h2>
            <p>La collecte prépare un brouillon. Elle ne publie jamais automatiquement.</p>
          </div>
        </div>
        <YouTubeCollectionForm
          initialValues={INITIAL_VALUES}
          onSubmit={handleCollect}
          submitting={submitting}
        />
      </section>
    </div>
  );
}
