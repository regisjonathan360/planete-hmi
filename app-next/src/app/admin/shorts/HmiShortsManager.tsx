"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  FiCheck,
  FiExternalLink,
  FiEye,
  FiEyeOff,
  FiPlus,
  FiTrash2,
  FiVideo,
} from "react-icons/fi";
import {
  getHmiShortEmbedUrl,
  hmiShortPlatformLabel,
  type HmiShortPlatform,
} from "@/lib/hmi-shorts";
import styles from "./shorts-admin.module.css";

interface HmiShort {
  id: string;
  platform: HmiShortPlatform;
  source_url: string;
  external_id: string | null;
  title: string;
  creator_name: string | null;
  thumbnail_url: string | null;
  description: string | null;
  display_order: number;
  is_published: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

interface ShortDraft {
  title: string;
  creatorName: string;
  displayOrder: number;
}

const initialForm = {
  url: "",
  title: "",
  creatorName: "",
  description: "",
  displayOrder: 1,
  isPublished: false,
};

export function HmiShortsManager() {
  const [shorts, setShorts] = useState<HmiShort[]>([]);
  const [form, setForm] = useState(initialForm);
  const [drafts, setDrafts] = useState<Record<string, ShortDraft>>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null);

  const notify = useCallback((text: string, error = false) => {
    setNotice({ text, error });
    window.setTimeout(() => setNotice(null), 4500);
  }, []);

  const loadShorts = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/shorts", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Chargement impossible.");
      const rows = (result.shorts ?? []) as HmiShort[];
      setShorts(rows);
      setDrafts(
        Object.fromEntries(
          rows.map((short) => [
            short.id,
            {
              title: short.title,
              creatorName: short.creator_name ?? "",
              displayOrder: short.display_order,
            },
          ]),
        ),
      );
    } catch (error) {
      notify(error instanceof Error ? error.message : "Chargement impossible.", true);
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      void loadShorts();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [loadShorts]);

  async function createShort(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    try {
      const response = await fetch("/api/admin/shorts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Ajout impossible.");
      setForm({ ...initialForm, displayOrder: shorts.length + 1 });
      notify(
        form.isPublished
          ? "Short ajouté et publié sur l’accueil."
          : "Short ajouté comme brouillon.",
      );
      await loadShorts();
    } catch (error) {
      notify(error instanceof Error ? error.message : "Ajout impossible.", true);
    } finally {
      setSubmitting(false);
    }
  }

  async function patchShort(id: string, patch: Record<string, unknown>, success: string) {
    setBusyId(id);
    try {
      const response = await fetch(`/api/admin/shorts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Modification impossible.");
      notify(success);
      await loadShorts();
    } catch (error) {
      notify(error instanceof Error ? error.message : "Modification impossible.", true);
    } finally {
      setBusyId(null);
    }
  }

  async function removeShort(short: HmiShort) {
    if (!window.confirm(`Supprimer définitivement « ${short.title} » ?`)) return;
    setBusyId(short.id);
    try {
      const response = await fetch(`/api/admin/shorts/${short.id}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Suppression impossible.");
      notify("Short supprimé.");
      await loadShorts();
    } catch (error) {
      notify(error instanceof Error ? error.message : "Suppression impossible.", true);
    } finally {
      setBusyId(null);
    }
  }

  const publishedCount = shorts.filter((short) => short.is_published).length;

  return (
    <div className={styles.workspace}>
      <section className={styles.composer}>
        <div className={styles.composerIntro}>
          <span className={styles.composerIcon}>
            <FiPlus aria-hidden="true" />
          </span>
          <div>
            <h2>Ajouter une vidéo</h2>
            <p>
              Collez le lien public. La plateforme et les métadonnées disponibles seront détectées
              automatiquement.
            </p>
          </div>
        </div>

        <form onSubmit={createShort} className={styles.form}>
          <label className={styles.fieldWide}>
            <span>URL TikTok, Instagram Reel ou YouTube Short</span>
            <input
              required
              type="url"
              value={form.url}
              onChange={(event) => setForm({ ...form, url: event.target.value })}
              placeholder="https://www.youtube.com/shorts/…"
            />
          </label>
          <label>
            <span>Titre public <small>(facultatif)</small></span>
            <input
              value={form.title}
              maxLength={160}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
              placeholder="Détecté automatiquement si possible"
            />
          </label>
          <label>
            <span>Créateur ou artiste <small>(facultatif)</small></span>
            <input
              value={form.creatorName}
              maxLength={120}
              onChange={(event) => setForm({ ...form, creatorName: event.target.value })}
              placeholder="@artiste"
            />
          </label>
          <label className={styles.fieldWide}>
            <span>Courte description <small>(facultatif)</small></span>
            <textarea
              value={form.description}
              maxLength={500}
              rows={3}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              placeholder="Contexte éditorial visible sous la vidéo"
            />
          </label>
          <label>
            <span>Position</span>
            <input
              type="number"
              min={1}
              max={100}
              value={form.displayOrder}
              onChange={(event) =>
                setForm({ ...form, displayOrder: Number(event.target.value) })
              }
            />
          </label>
          <label className={styles.publishChoice}>
            <input
              type="checkbox"
              checked={form.isPublished}
              onChange={(event) => setForm({ ...form, isPublished: event.target.checked })}
            />
            <span>
              Publier immédiatement
              <small>Sinon la vidéo reste en brouillon.</small>
            </span>
          </label>
          <button className="btn btn--primary" type="submit" disabled={submitting}>
            <FiPlus aria-hidden="true" />
            {submitting ? "Ajout en cours…" : "Ajouter à HMI Shorts"}
          </button>
        </form>
      </section>

      <section className={styles.library}>
        <div className={styles.libraryHead}>
          <div>
            <p className={styles.kicker}>Bibliothèque</p>
            <h2>{shorts.length} vidéo{shorts.length > 1 ? "s" : ""}</h2>
          </div>
          <span className={styles.liveCount}>
            <span aria-hidden="true" />
            {publishedCount} publiée{publishedCount > 1 ? "s" : ""}
          </span>
        </div>

        {loading ? (
          <div className={styles.loadingGrid} aria-label="Chargement des Shorts">
            {[1, 2, 3].map((item) => <span key={item} />)}
          </div>
        ) : shorts.length === 0 ? (
          <div className={styles.empty}>
            <FiVideo aria-hidden="true" />
            <h3>Aucun Short pour le moment</h3>
            <p>La première vidéo ajoutée apparaîtra ici avant sa publication.</p>
          </div>
        ) : (
          <div className={styles.cards}>
            {shorts.map((short) => {
              const draft = drafts[short.id] ?? {
                title: short.title,
                creatorName: short.creator_name ?? "",
                displayOrder: short.display_order,
              };
              const embedUrl = getHmiShortEmbedUrl(short.platform, short.external_id);
              const busy = busyId === short.id;

              return (
                <article className={styles.card} key={short.id}>
                  <div className={styles.preview}>
                    {embedUrl ? (
                      <iframe
                        src={embedUrl}
                        title={`Aperçu de ${short.title}`}
                        loading="lazy"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    ) : (
                      <a href={short.source_url} target="_blank" rel="noreferrer">
                        <FiExternalLink aria-hidden="true" />
                        Ouvrir la vidéo
                      </a>
                    )}
                    <span className={`${styles.platform} ${styles[short.platform]}`}>
                      {hmiShortPlatformLabel(short.platform)}
                    </span>
                  </div>

                  <div className={styles.cardBody}>
                    <div className={styles.statusRow}>
                      <span className={short.is_published ? styles.published : styles.draft}>
                        {short.is_published ? "En ligne" : "Brouillon"}
                      </span>
                      <a href={short.source_url} target="_blank" rel="noreferrer">
                        Source <FiExternalLink aria-hidden="true" />
                      </a>
                    </div>

                    <label>
                      <span>Titre</span>
                      <input
                        value={draft.title}
                        maxLength={160}
                        onChange={(event) =>
                          setDrafts((current) => ({
                            ...current,
                            [short.id]: { ...draft, title: event.target.value },
                          }))
                        }
                      />
                    </label>
                    <div className={styles.twoFields}>
                      <label>
                        <span>Créateur</span>
                        <input
                          value={draft.creatorName}
                          maxLength={120}
                          onChange={(event) =>
                            setDrafts((current) => ({
                              ...current,
                              [short.id]: { ...draft, creatorName: event.target.value },
                            }))
                          }
                        />
                      </label>
                      <label>
                        <span>Position</span>
                        <input
                          type="number"
                          min={1}
                          max={100}
                          value={draft.displayOrder}
                          onChange={(event) =>
                            setDrafts((current) => ({
                              ...current,
                              [short.id]: {
                                ...draft,
                                displayOrder: Number(event.target.value),
                              },
                            }))
                          }
                        />
                      </label>
                    </div>

                    <div className={styles.actions}>
                      <button
                        type="button"
                        className="btn btn--ghost"
                        disabled={busy || !draft.title.trim()}
                        onClick={() =>
                          patchShort(
                            short.id,
                            {
                              title: draft.title,
                              creatorName: draft.creatorName,
                              displayOrder: draft.displayOrder,
                            },
                            "Informations enregistrées.",
                          )
                        }
                      >
                        <FiCheck aria-hidden="true" /> Enregistrer
                      </button>
                      <button
                        type="button"
                        className={short.is_published ? "btn btn--ghost" : "btn btn--ok"}
                        disabled={busy}
                        onClick={() =>
                          patchShort(
                            short.id,
                            { isPublished: !short.is_published },
                            short.is_published
                              ? "Short retiré de l’accueil."
                              : "Short publié sur l’accueil.",
                          )
                        }
                      >
                        {short.is_published ? <FiEyeOff /> : <FiEye />}
                        {short.is_published ? "Dépublier" : "Publier"}
                      </button>
                      <button
                        type="button"
                        className="btn btn--danger"
                        disabled={busy}
                        onClick={() => removeShort(short)}
                        aria-label={`Supprimer ${short.title}`}
                      >
                        <FiTrash2 aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {notice && (
        <div className={notice.error ? "toast toast--error" : "toast"} role="status">
          {notice.text}
        </div>
      )}
    </div>
  );
}
