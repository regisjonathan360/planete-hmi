"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { YouTubeAlert, YouTubeEmptyState } from "@/components/youtube";
import { Status } from "./YouTubeAdminManager";
import {
  defaultYouTubePeriod,
  formatDate,
  formatDateTime,
  formatNumber,
  readApiError,
} from "./utils";
import type {
  ChartEntry,
  ChartPreview,
  ChartValidation,
  Publication,
  YouTubeAdminStats,
} from "./types";
import styles from "./youtube-admin.module.css";

export function ChartPanel({
  initialEdition,
}: {
  initialEdition: YouTubeAdminStats["latestEdition"];
}) {
  const fallbackPeriod = defaultYouTubePeriod();
  const [periodStart, setPeriodStart] = useState(
    initialEdition?.periodStart ?? fallbackPeriod.periodStart
  );
  const [periodEnd, setPeriodEnd] = useState(
    initialEdition?.periodEnd ?? fallbackPeriod.periodEnd
  );
  const [preview, setPreview] = useState<ChartPreview | null>(null);
  const [validation, setValidation] = useState<ChartValidation | null>(null);
  const [history, setHistory] = useState<Publication[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [notice, setNotice] = useState<{
    tone: "success" | "warning" | "error";
    text: string;
    details?: string[];
  } | null>(null);
  const [scheduleAt, setScheduleAt] = useState("");
  const [revisionReason, setRevisionReason] = useState("");

  const loadHistory = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/youtube/chart/history", {
        cache: "no-store",
      });
      const payload = await response.json();
      if (response.ok) setHistory(payload.publications ?? []);
    } catch {
      // L'historique est secondaire. Le reste de l'éditeur reste utilisable.
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/admin/youtube/chart/history", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        if (active && payload) setHistory(payload.publications ?? []);
      })
      .catch(() => {
        // L'historique est secondaire. Le reste de l'éditeur reste utilisable.
      });
    return () => {
      active = false;
    };
  }, []);

  const periodBody = { periodStart, periodEnd };

  async function call(
    url: string,
    body: Record<string, unknown>,
    fallback: string,
    method: "POST" | "DELETE" = "POST"
  ) {
    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(readApiError(payload, fallback));
    return payload;
  }

  async function loadPreview(announce = false) {
    setLoading(true);
    if (announce) setNotice(null);
    try {
      const payload = await call(
        "/api/admin/youtube/chart/preview",
        periodBody,
        "Aucun brouillon disponible pour cette période."
      );
      setPreview(payload as ChartPreview);
      if (announce) {
        setNotice({ tone: "success", text: "Aperçu du classement actualisé." });
      }
    } catch (error) {
      setPreview(null);
      if (announce) {
        setNotice({
          tone: "error",
          text: error instanceof Error ? error.message : "Aperçu impossible.",
        });
      }
    } finally {
      setLoading(false);
    }
  }

  async function runAction(name: string, action: () => Promise<void>) {
    setBusyAction(name);
    setNotice(null);
    try {
      await action();
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Action impossible.",
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function recalculate() {
    await runAction("recalculate", async () => {
      const payload = await call(
        "/api/admin/youtube/chart/recalculate",
        periodBody,
        "Recalcul impossible."
      );
      setNotice({
        tone: payload.warnings?.length ? "warning" : "success",
        text: `${formatNumber(payload.videosRanked)} vidéo(s) classée(s) dans le brouillon.`,
        details: payload.warnings ?? [],
      });
      setValidation(null);
      await loadPreview();
    });
  }

  async function validate() {
    await runAction("validate", async () => {
      const payload = (await call(
        "/api/admin/youtube/chart/validate",
        periodBody,
        "Validation impossible."
      )) as ChartValidation;
      setValidation(payload);
      setNotice({
        tone: payload.valid ? (payload.warnings.length ? "warning" : "success") : "error",
        text: payload.valid
          ? "Le brouillon peut être publié."
          : "Le brouillon contient des erreurs bloquantes.",
        details: [...payload.blockingErrors, ...payload.warnings],
      });
    });
  }

  async function publish() {
    if (!preview) return;
    await runAction("publish", async () => {
      const payload = await call(
        "/api/admin/youtube/chart/publish",
        { editionId: preview.editionId },
        "Publication impossible."
      );
      setNotice({
        tone: "success",
        text: `Version ${payload.version} publiée sur le site public.`,
      });
      setValidation(null);
      await Promise.all([loadPreview(), loadHistory()]);
    });
  }

  async function schedule(event: FormEvent) {
    event.preventDefault();
    if (!preview || !scheduleAt) return;
    await runAction("schedule", async () => {
      const publishAt = new Date(scheduleAt).toISOString();
      await call(
        "/api/admin/youtube/chart/schedule",
        {
          editionId: preview.editionId,
          publishAt,
          timezone: "America/Port-au-Prince",
        },
        "Programmation impossible."
      );
      setNotice({
        tone: "success",
        text: `Publication programmée le ${formatDateTime(publishAt)}.`,
      });
      await loadPreview();
    });
  }

  async function cancelSchedule() {
    if (!preview) return;
    await runAction("cancel-schedule", async () => {
      await call(
        "/api/admin/youtube/chart/schedule",
        { editionId: preview.editionId },
        "Annulation de la programmation impossible.",
        "DELETE"
      );
      setNotice({ tone: "success", text: "Publication programmée annulée." });
      await loadPreview();
    });
  }

  async function createRevision() {
    if (!preview) return;
    await runAction("revision", async () => {
      await call(
        "/api/admin/youtube/chart/revision",
        { editionId: preview.editionId, reason: revisionReason },
        "Création de la révision impossible."
      );
      setRevisionReason("");
      setNotice({ tone: "success", text: "Révision créée. L’édition est de nouveau modifiable." });
      await loadPreview();
    });
  }

  async function editEntry(
    entry: ChartEntry,
    action: "edit" | "hide" | "unhide" | "exclude" | "include" | "move_up" | "move_down",
    extras: Record<string, unknown> = {}
  ) {
    if (!preview) return;
    await runAction(`entry-${entry.entryId}`, async () => {
      await call(
        "/api/admin/youtube/chart/entries",
        {
          editionId: preview.editionId,
          entryId: entry.entryId,
          action,
          ...extras,
        },
        "Modification de l’entrée impossible."
      );
      setValidation(null);
      await loadPreview();
    });
  }

  async function restore(publication: Publication) {
    await runAction(`restore-${publication.id}`, async () => {
      const payload = await call(
        "/api/admin/youtube/chart/restore",
        { publicationId: publication.id },
        "Restauration impossible."
      );
      setNotice({
        tone: "success",
        text: `La version ${publication.version} a été restaurée comme version ${payload.version}.`,
      });
      await Promise.all([loadPreview(), loadHistory()]);
    });
  }

  const isPublished = preview?.editionStatus === "published";

  return (
    <div className={styles.stack}>
      {notice ? (
        <YouTubeAlert
          tone={notice.tone}
          title="Classement YouTube"
          details={notice.details}
        >
          {notice.text}
        </YouTubeAlert>
      ) : null}

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <h2>Comment faire apparaître les vidéos sur le site public</h2>
            <p>Le Top YouTube classe chaque vidéo séparément. Aucune chanson n’est nécessaire.</p>
          </div>
        </div>
        <div className={styles.workflow}>
          <div className={styles.workflowItem}>
            <div><h3>1. Approuver les vidéos</h3><p>Dans « Vidéos à vérifier », marquez les vidéos officielles comme approuvées et éligibles.</p></div>
          </div>
          <div className={styles.workflowItem}>
            <div><h3>2. Collecter les compteurs</h3><p>Il faut un relevé au début et un autre à la fin de la période pour calculer les nouvelles vues.</p></div>
          </div>
          <div className={styles.workflowItem}>
            <div><h3>3. Calculer puis valider</h3><p>Choisissez les mêmes dates ci-dessous, calculez le brouillon, puis corrigez les éventuelles erreurs.</p></div>
          </div>
          <div className={styles.workflowItem}>
            <div><h3>4. Publier</h3><p>Le classement public reste vide tant que vous n’avez pas cliqué sur « Publier maintenant ».</p></div>
          </div>
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <h2>Période du classement</h2>
            <p>Calculez automatiquement le Top 20, puis vérifiez le brouillon avant publication.</p>
          </div>
        </div>
        <div className={styles.chartToolbar}>
          <label className={styles.field}>
            <span>Début</span>
            <input type="date" value={periodStart} onChange={(event) => setPeriodStart(event.target.value)} />
          </label>
          <label className={styles.field}>
            <span>Fin</span>
            <input type="date" value={periodEnd} onChange={(event) => setPeriodEnd(event.target.value)} />
          </label>
          <button className="btn" type="button" disabled={loading} onClick={() => loadPreview(true)}>
            Charger l’aperçu
          </button>
          <button className="btn btn--primary" type="button" disabled={busyAction !== null} onClick={recalculate}>
            {busyAction === "recalculate" ? "Calcul en cours..." : "Calculer et créer le brouillon"}
          </button>
          <button className="btn btn--ok" type="button" disabled={!preview || busyAction !== null} onClick={validate}>
            {busyAction === "validate" ? "Validation..." : "Valider"}
          </button>
        </div>
      </section>

      {loading ? <ChartLoading /> : null}
      {!loading && !preview ? (
        <YouTubeEmptyState
          title="Aucun aperçu chargé"
          description="Choisissez une période, puis chargez ou recalculez le classement."
        />
      ) : null}

      {preview ? (
        <>
          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <div className={styles.rowTitleLine}>
                  <h2>{preview.periodLabel || `${periodStart} au ${periodEnd}`}</h2>
                  <Status value={preview.editionStatus} />
                </div>
                <p>{formatNumber(preview.entries.length)} entrée(s) dans le brouillon.</p>
              </div>
              <a className="btn btn--ghost" href="/charts/youtube" target="_blank" rel="noreferrer">
                Voir le site public
              </a>
            </div>

            {isPublished ? (
              <div className={styles.revisionBox}>
                <p>Cette édition est publiée. Créez une révision avant toute modification.</p>
                <input
                  value={revisionReason}
                  onChange={(event) => setRevisionReason(event.target.value)}
                  placeholder="Motif de la révision"
                />
                <button
                  className="btn"
                  type="button"
                  disabled={revisionReason.trim().length < 3 || busyAction !== null}
                  onClick={createRevision}
                >
                  Créer une révision
                </button>
              </div>
            ) : null}

            <div className={styles.chartList}>
              {preview.entries.map((entry, index) => (
                <ChartEntryRow
                  key={entry.entryId}
                  entry={entry}
                  first={index === 0}
                  last={index === preview.entries.length - 1}
                  locked={isPublished || busyAction !== null}
                  onAction={editEntry}
                />
              ))}
            </div>
          </section>

          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <h2>Publication</h2>
                <p>Validez le brouillon avant de le publier ou de le programmer.</p>
              </div>
            </div>
            {validation ? (
              <div className={styles.validationSummary}>
                <Status value={validation.valid ? "Prêt à publier" : "Erreurs à corriger"} />
                <span>{formatNumber(validation.entryCount)} entrée(s) vérifiée(s)</span>
              </div>
            ) : null}
            <div className={styles.publishGrid}>
              <div>
                <h3>Publication immédiate</h3>
                <p>Remplace la version actuellement visible après une dernière validation.</p>
                <button
                  className="btn btn--primary"
                  type="button"
                  disabled={!validation?.valid || busyAction !== null || isPublished}
                  onClick={publish}
                >
                  {busyAction === "publish" ? "Publication..." : "Publier maintenant"}
                </button>
              </div>
              <form onSubmit={schedule}>
                <h3>Programmer</h3>
                <p>Heure affichée selon le fuseau de Port-au-Prince.</p>
                {preview.scheduledPublishAt ? (
                  <div className={styles.scheduledNotice}>
                    <span>Prévue le {formatDateTime(preview.scheduledPublishAt)}</span>
                    <button
                      className="btn btn--sm btn--danger"
                      type="button"
                      disabled={busyAction !== null}
                      onClick={cancelSchedule}
                    >
                      Annuler la programmation
                    </button>
                  </div>
                ) : null}
                <input
                  type="datetime-local"
                  value={scheduleAt}
                  onChange={(event) => setScheduleAt(event.target.value)}
                  required
                />
                <button
                  className="btn"
                  type="submit"
                  disabled={!validation?.valid || !scheduleAt || busyAction !== null || isPublished}
                >
                  Programmer
                </button>
              </form>
            </div>
          </section>
        </>
      ) : null}

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <h2>Historique des publications</h2>
            <p>Restaurer une version crée une nouvelle publication traçable.</p>
          </div>
        </div>
        {history.length === 0 ? (
          <p className={styles.muted}>Aucune publication enregistrée.</p>
        ) : (
          <div className={styles.historyList}>
            {history.map((publication) => (
              <div className={styles.historyRow} key={publication.id}>
                <strong>Version {publication.version}</strong>
                <span>
                  {formatDate(publication.period_start)} au {formatDate(publication.period_end)}
                </span>
                <span>{formatNumber(publication.entry_count)} entrées</span>
                <span>{formatDateTime(publication.published_at)}</span>
                <button
                  className="btn btn--sm btn--ghost"
                  type="button"
                  disabled={busyAction !== null}
                  onClick={() => restore(publication)}
                >
                  Restaurer
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function ChartEntryRow({
  entry,
  first,
  last,
  locked,
  onAction,
}: {
  entry: ChartEntry;
  first: boolean;
  last: boolean;
  locked: boolean;
  onAction: (
    entry: ChartEntry,
    action: "edit" | "hide" | "unhide" | "exclude" | "include" | "move_up" | "move_down",
    extras?: Record<string, unknown>
  ) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [excluding, setExcluding] = useState(false);
  const [title, setTitle] = useState(entry.title);
  const [artist, setArtist] = useState(entry.artists);
  const [reason, setReason] = useState("");

  return (
    <article
      className={`${styles.chartEntry} ${entry.isHidden || entry.isExcluded ? styles.chartEntryMuted : ""}`}
    >
      <div className={styles.rank}>{entry.rank}</div>
      <div className={styles.rowMain}>
        <div className={styles.rowTitleLine}>
          {entry.thumbnailUrl ? (
            <a href={entry.videoUrl} target="_blank" rel="noreferrer" className={styles.chartVideoThumb}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={entry.thumbnailUrl} alt="" />
              <span aria-hidden="true">▶</span>
            </a>
          ) : null}
          <strong>{entry.title}</strong>
          {entry.isHidden ? <Status value="Masquée" /> : null}
          {entry.isExcluded ? <Status value="Exclue" /> : null}
        </div>
        <p>{entry.artists}</p>
        <div className={styles.meta}>
          <span>{formatNumber(entry.weeklyViews)} vues semaine</span>
          <span>{formatNumber(entry.totalViews)} vues totales</span>
          <a href={entry.videoUrl} target="_blank" rel="noreferrer">Voir la vidéo ↗</a>
        </div>
        {editing ? (
          <div className={styles.inlineEditor}>
            <div className={styles.formGrid}>
              <label className={styles.field}>
                <span>Titre public</span>
                <input value={title} onChange={(event) => setTitle(event.target.value)} />
              </label>
              <label className={styles.field}>
                <span>Artiste public</span>
                <input value={artist} onChange={(event) => setArtist(event.target.value)} />
              </label>
            </div>
            <div className={styles.inlineActions}>
              <button
                className="btn btn--ok"
                type="button"
                onClick={async () => {
                  await onAction(entry, "edit", { title, artist });
                  setEditing(false);
                }}
              >
                Enregistrer
              </button>
              <button className="btn btn--ghost" type="button" onClick={() => setEditing(false)}>
                Annuler
              </button>
            </div>
          </div>
        ) : null}
        {excluding ? (
          <div className={styles.inlineEditor}>
            <label className={styles.field}>
              <span>Raison de l’exclusion</span>
              <input value={reason} onChange={(event) => setReason(event.target.value)} />
            </label>
            <div className={styles.inlineActions}>
              <button
                className="btn btn--danger"
                type="button"
                disabled={reason.trim().length < 5}
                onClick={async () => {
                  await onAction(entry, "exclude", { reason });
                  setExcluding(false);
                }}
              >
                Confirmer l’exclusion
              </button>
              <button className="btn btn--ghost" type="button" onClick={() => setExcluding(false)}>
                Annuler
              </button>
            </div>
          </div>
        ) : null}
      </div>
      <div className={styles.rowActions}>
        <button
          className="btn btn--sm"
          type="button"
          disabled={locked || first}
          aria-label={`Monter ${entry.title}`}
          onClick={() => onAction(entry, "move_up")}
        >
          Monter
        </button>
        <button
          className="btn btn--sm"
          type="button"
          disabled={locked || last}
          aria-label={`Descendre ${entry.title}`}
          onClick={() => onAction(entry, "move_down")}
        >
          Descendre
        </button>
        <button className="btn btn--sm" type="button" disabled={locked} onClick={() => setEditing(true)}>
          Corriger
        </button>
        <button
          className="btn btn--sm btn--ghost"
          type="button"
          disabled={locked}
          onClick={() => onAction(entry, entry.isHidden ? "unhide" : "hide")}
        >
          {entry.isHidden ? "Afficher" : "Masquer"}
        </button>
        {entry.isExcluded ? (
          <button
            className="btn btn--sm btn--ghost"
            type="button"
            disabled={locked}
            onClick={() => onAction(entry, "include")}
          >
            Réintégrer
          </button>
        ) : (
          <button
            className="btn btn--sm btn--danger"
            type="button"
            disabled={locked}
            onClick={() => setExcluding(true)}
          >
            Exclure
          </button>
        )}
      </div>
    </article>
  );
}

function ChartLoading() {
  return (
    <div className={styles.loadingRows} aria-label="Chargement">
      <span />
      <span />
      <span />
    </div>
  );
}
