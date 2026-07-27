"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  YOUTUBE_VIDEO_TYPES,
  YOUTUBE_VIDEO_VERIFICATION_STATUSES,
} from "@/lib/youtube/constants";
import { YouTubeAlert, YouTubeEmptyState } from "@/components/youtube";
import { Status } from "./YouTubeAdminManager";
import { VideoResetPanel } from "./VideoResetPanel";
import { formatDate, formatNumber, readApiError } from "./utils";
import type { TrackOption, YouTubeVideo } from "./types";
import styles from "./youtube-admin.module.css";

const STATUS_LABELS: Record<string, string> = {
  UNREVIEWED: "À vérifier",
  NEEDS_INFORMATION: "Informations requises",
  APPROVED: "Approuvée",
  EXCLUDED: "Exclue",
  DUPLICATE: "Doublon",
  IGNORED: "Ignorée",
};

const TYPE_LABELS: Record<string, string> = {
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

export function VideosPanel({
  onVideoImported,
}: {
  onVideoImported: () => void;
}) {
  const [videos, setVideos] = useState<YouTubeVideo[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("UNREVIEWED");
  const [eligible, setEligible] = useState("");
  const [offset, setOffset] = useState(0);
  const [editing, setEditing] = useState<YouTubeVideo | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const limit = 30;

  const loadVideos = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: String(limit),
        offset: String(offset),
      });
      if (search.trim()) params.set("search", search.trim());
      if (status) params.set("status", status);
      if (eligible) params.set("eligible", eligible);
      const response = await fetch(`/api/admin/youtube/videos?${params}`, {
        cache: "no-store",
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(readApiError(payload, "Chargement des vidéos impossible."));
      setVideos(payload.videos ?? []);
      setTotal(payload.total ?? 0);
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Chargement des vidéos impossible.",
      });
    } finally {
      setLoading(false);
    }
  }, [eligible, offset, search, status]);

  useEffect(() => {
    const timer = window.setTimeout(loadVideos, 250);
    return () => window.clearTimeout(timer);
  }, [loadVideos]);

  function changeFilter(action: () => void) {
    setOffset(0);
    action();
  }

  return (
    <div className={styles.stack}>
      {notice ? (
        <YouTubeAlert tone={notice.tone} title="Vidéos YouTube">
          {notice.text}
        </YouTubeAlert>
      ) : null}
      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <h2>File de vérification</h2>
            <p>Associez chaque vidéo officielle à une chanson avant de la rendre éligible.</p>
          </div>
          <button className="btn btn--primary" type="button" onClick={() => setShowImport((value) => !value)}>
            {showImport ? "Fermer" : "Importer une URL"}
          </button>
        </div>

        {showImport ? (
          <ImportVideoForm
            onImported={async () => {
              setShowImport(false);
              onVideoImported();
              setNotice({ tone: "success", text: "Vidéo importée dans la file de vérification." });
              await loadVideos();
            }}
          />
        ) : null}

        <div className={styles.filters}>
          <label className={styles.field}>
            <span>Rechercher</span>
            <input
              value={search}
              onChange={(event) => changeFilter(() => setSearch(event.target.value))}
              placeholder="Titre de la vidéo"
            />
          </label>
          <label className={styles.field}>
            <span>Décision éditoriale</span>
            <select value={status} onChange={(event) => changeFilter(() => setStatus(event.target.value))}>
              <option value="">Toutes</option>
              {YOUTUBE_VIDEO_VERIFICATION_STATUSES.map((value) => (
                <option value={value} key={value}>
                  {STATUS_LABELS[value] ?? value}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            <span>Éligibilité</span>
            <select value={eligible} onChange={(event) => changeFilter(() => setEligible(event.target.value))}>
              <option value="">Toutes</option>
              <option value="true">Éligibles</option>
              <option value="false">Non éligibles</option>
            </select>
          </label>
        </div>

        {loading ? <VideoLoading /> : null}
        {!loading && videos.length === 0 ? (
          <YouTubeEmptyState
            title="Aucune vidéo"
            description="La file ne contient aucune vidéo correspondant aux filtres."
          />
        ) : null}
        {!loading && videos.length > 0 ? (
          <>
            <div className={styles.dataList}>
              {videos.map((video) => (
                <article className={styles.videoRow} key={video.id}>
                  <a
                    className={styles.videoThumb}
                    href={`https://www.youtube.com/watch?v=${video.video_id}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {video.source_thumbnail_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={video.source_thumbnail_url} alt="" />
                    ) : (
                      <span>YT</span>
                    )}
                  </a>
                  <div className={styles.rowMain}>
                    <div className={styles.rowTitleLine}>
                      <strong>{video.display_title || video.source_title}</strong>
                      <Status value={STATUS_LABELS[video.review_status] ?? video.review_status} />
                      {video.is_eligible ? (
                        <span className={`${styles.status} ${styles.statusOk}`}>Éligible</span>
                      ) : null}
                    </div>
                    <p>{TYPE_LABELS[video.video_type] ?? video.video_type}</p>
                    <div className={styles.meta}>
                      <span>{formatNumber(video.view_count)} vues</span>
                      <span>{formatNumber(video.like_count)} likes</span>
                      <span>Publiée le {formatDate(video.published_at)}</span>
                    </div>
                  </div>
                  <div className={styles.rowActions}>
                    <a
                      className="btn btn--sm btn--ghost"
                      href={`https://www.youtube.com/watch?v=${video.video_id}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Voir
                    </a>
                    <button className="btn btn--sm btn--primary" type="button" onClick={() => setEditing(video)}>
                      Vérifier
                    </button>
                  </div>
                </article>
              ))}
            </div>
            <div className={styles.pagination}>
              <span>
                {formatNumber(offset + 1)}-{formatNumber(Math.min(offset + limit, total))} sur{" "}
                {formatNumber(total)}
              </span>
              <div>
                <button
                  className="btn btn--sm"
                  type="button"
                  disabled={offset === 0}
                  onClick={() => setOffset(Math.max(0, offset - limit))}
                >
                  Précédent
                </button>
                <button
                  className="btn btn--sm"
                  type="button"
                  disabled={offset + limit >= total}
                  onClick={() => setOffset(offset + limit)}
                >
                  Suivant
                </button>
              </div>
            </div>
          </>
        ) : null}
      </section>

      <VideoResetPanel onReset={loadVideos} />

      {editing ? (
        <VideoEditor
          video={editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            setNotice({ tone: "success", text: "Décision éditoriale enregistrée." });
            await loadVideos();
          }}
        />
      ) : null}
    </div>
  );
}

function ImportVideoForm({ onImported }: { onImported: () => Promise<void> }) {
  const [url, setUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/youtube/videos/import-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(readApiError(payload, "Import impossible."));
      await onImported();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Import impossible.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className={styles.importForm} onSubmit={submit}>
      <label className={styles.field}>
        <span>URL de la vidéo YouTube</span>
        <input
          type="url"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="https://www.youtube.com/watch?v=..."
          required
        />
      </label>
      <button className="btn btn--primary" type="submit" disabled={submitting}>
        {submitting ? "Import en cours..." : "Importer"}
      </button>
      {error ? <p className={styles.formError}>{error}</p> : null}
    </form>
  );
}

function VideoEditor({
  video,
  onClose,
  onSaved,
}: {
  video: YouTubeVideo;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [displayTitle, setDisplayTitle] = useState(video.display_title || video.source_title);
  const [thumbnail, setThumbnail] = useState(video.display_thumbnail_url || "");
  const [reviewStatus, setReviewStatus] = useState(video.review_status);
  const [videoType, setVideoType] = useState(video.video_type);
  const [eligible, setEligible] = useState(video.is_eligible);
  const [trackId, setTrackId] = useState(video.track_id || "");
  const [exclusionReason, setExclusionReason] = useState("");
  const [reviewReason, setReviewReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mustExplainExclusion =
    reviewStatus === "EXCLUDED" || (reviewStatus === "APPROVED" && !eligible);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/youtube/videos/${video.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayTitle,
          displayThumbnailUrl: thumbnail || null,
          reviewStatus,
          videoType,
          isEligible: eligible,
          trackId: trackId || null,
          exclusionReason,
          reviewReason,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(readApiError(payload, "Enregistrement impossible."));
      await onSaved();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Enregistrement impossible.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.modalBackdrop} role="presentation" onMouseDown={onClose}>
      <section
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="youtube-video-editor-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className={styles.modalHeader}>
          <div>
            <h2 id="youtube-video-editor-title">Décision éditoriale</h2>
            <p>{video.source_title}</p>
          </div>
          <button className="btn btn--ghost" type="button" onClick={onClose} aria-label="Fermer">
            Fermer
          </button>
        </div>
        <form onSubmit={submit}>
          <div className={styles.formGrid}>
            <label className={`${styles.field} ${styles.fieldFull}`}>
              <span>Titre public</span>
              <input value={displayTitle} onChange={(event) => setDisplayTitle(event.target.value)} required />
            </label>
            <label className={styles.field}>
              <span>Statut de vérification</span>
              <select
                value={reviewStatus}
                onChange={(event) => {
                  const value = event.target.value;
                  setReviewStatus(value);
                  if (value !== "APPROVED") setEligible(false);
                }}
              >
                {YOUTUBE_VIDEO_VERIFICATION_STATUSES.map((value) => (
                  <option value={value} key={value}>
                    {STATUS_LABELS[value] ?? value}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              <span>Type de vidéo</span>
              <select value={videoType} onChange={(event) => setVideoType(event.target.value)}>
                {YOUTUBE_VIDEO_TYPES.map((value) => (
                  <option value={value} key={value}>
                    {TYPE_LABELS[value] ?? value}
                  </option>
                ))}
              </select>
            </label>
            <TrackSearch selectedId={trackId} onSelect={setTrackId} />
            <label className={styles.checkField}>
              <input
                type="checkbox"
                checked={eligible}
                disabled={reviewStatus !== "APPROVED"}
                onChange={(event) => setEligible(event.target.checked)}
              />
              <span>
                <strong>Éligible au Top 20</strong>
                <small>La vidéo sera agrégée avec les autres vidéos de la même chanson.</small>
              </span>
            </label>
            <label className={`${styles.field} ${styles.fieldFull}`}>
              <span>Miniature publique personnalisée (facultatif)</span>
              <input
                type="url"
                value={thumbnail}
                onChange={(event) => setThumbnail(event.target.value)}
                placeholder="https://..."
              />
            </label>
            {mustExplainExclusion ? (
              <label className={`${styles.field} ${styles.fieldFull}`}>
                <span>Raison d’exclusion</span>
                <textarea
                  value={exclusionReason}
                  onChange={(event) => setExclusionReason(event.target.value)}
                  required
                />
              </label>
            ) : null}
            <label className={`${styles.field} ${styles.fieldFull}`}>
              <span>Justification de la décision</span>
              <textarea
                value={reviewReason}
                onChange={(event) => setReviewReason(event.target.value)}
                minLength={10}
                required
                placeholder="Expliquez la vérification effectuée"
              />
            </label>
          </div>
          {error ? <p className={styles.formError}>{error}</p> : null}
          <div className={styles.modalActions}>
            <button className="btn btn--ghost" type="button" onClick={onClose}>
              Annuler
            </button>
            <button className="btn btn--primary" type="submit" disabled={submitting}>
              {submitting ? "Enregistrement..." : "Enregistrer la décision"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function TrackSearch({
  selectedId,
  onSelect,
}: {
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [tracks, setTracks] = useState<TrackOption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(
          `/api/admin/youtube/tracks?search=${encodeURIComponent(query)}`,
          { cache: "no-store" }
        );
        const payload = await response.json();
        if (response.ok && !cancelled) setTracks(payload.tracks ?? []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query]);

  const selected = useMemo(() => tracks.find((track) => track.id === selectedId), [selectedId, tracks]);

  return (
    <div className={`${styles.field} ${styles.fieldFull}`}>
      <label htmlFor="youtube-track-search">Chanson associée</label>
      <input
        id="youtube-track-search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Rechercher une chanson"
      />
      <select
        value={selectedId}
        onChange={(event) => onSelect(event.target.value)}
        aria-label="Résultats de chansons"
      >
        <option value="">{loading ? "Recherche..." : "Sélectionner une chanson"}</option>
        {selectedId && !selected ? <option value={selectedId}>Chanson actuellement associée</option> : null}
        {tracks.map((track) => (
          <option key={track.id} value={track.id}>
            {track.title} - {track.artists}
          </option>
        ))}
      </select>
    </div>
  );
}

function VideoLoading() {
  return (
    <div className={styles.loadingRows} aria-label="Chargement">
      <span />
      <span />
      <span />
    </div>
  );
}
