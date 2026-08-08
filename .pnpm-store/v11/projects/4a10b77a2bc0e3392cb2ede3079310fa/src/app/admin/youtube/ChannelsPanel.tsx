"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { YOUTUBE_CHANNEL_TYPES } from "@/lib/youtube/constants";
import { YouTubeAlert, YouTubeEmptyState } from "@/components/youtube";
import { Status } from "./YouTubeAdminManager";
import { formatDateTime, formatNumber, readApiError } from "./utils";
import type { YouTubeChannel } from "./types";
import styles from "./youtube-admin.module.css";

const CHANNEL_TYPE_LABELS: Record<string, string> = {
  OFFICIAL_ARTIST_CHANNEL: "Chaîne officielle d’artiste",
  TOPIC_CHANNEL: "Chaîne Topic",
  VEVO_CHANNEL: "Chaîne VEVO",
  LABEL_CHANNEL: "Label",
  DISTRIBUTOR_CHANNEL: "Distributeur",
  COLLABORATOR_CHANNEL: "Collaborateur",
  OTHER_APPROVED_CHANNEL: "Autre chaîne approuvée",
};

interface ArtistProfileSyncDetail {
  artistId: string;
  artistName: string;
  sourceUrl: string;
  channelId: string | null;
  channelTitle: string | null;
  status: string;
  message: string;
}

interface ArtistProfileSyncSummary {
  profilesScanned: number;
  urlsDetected: number;
  created: number;
  alreadyLinked: number;
  linkedExisting: number;
  duplicateProfileUrls: number;
  conflicts: number;
  errors: number;
  details: ArtistProfileSyncDetail[];
}

interface ArtistProfileSyncPage extends ArtistProfileSyncSummary {
  nextCursor: string | null;
}

export function ChannelsPanel({
  onChannelCreated,
}: {
  onChannelCreated: (amount?: number) => void;
}) {
  const [channels, setChannels] = useState<YouTubeChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState("subscribers_desc");
  const [showCreate, setShowCreate] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [approvalId, setApprovalId] = useState<string | null>(null);
  const [approvalReason, setApprovalReason] = useState("");
  const [syncingProfiles, setSyncingProfiles] = useState(false);
  const [syncSummary, setSyncSummary] = useState<ArtistProfileSyncSummary | null>(null);
  const [notice, setNotice] = useState<{ tone: "success" | "error" | "warning"; text: string } | null>(null);

  const loadChannels = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "100", offset: "0" });
      if (search.trim()) params.set("search", search.trim());
      if (status) params.set("status", status);
      params.set("sort", sort);
      const response = await fetch(`/api/admin/youtube/channels?${params}`, {
        cache: "no-store",
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(readApiError(payload, "Chargement des chaînes impossible."));
      setChannels(payload.channels ?? []);
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Chargement des chaînes impossible.",
      });
    } finally {
      setLoading(false);
    }
  }, [search, status, sort]);

  useEffect(() => {
    const timer = window.setTimeout(loadChannels, 250);
    return () => window.clearTimeout(timer);
  }, [loadChannels]);

  async function mutate(
    channelId: string,
    url: string,
    options: RequestInit,
    success: string
  ) {
    setBusyId(channelId);
    setNotice(null);
    try {
      const response = await fetch(url, options);
      const payload = await response.json();
      if (!response.ok) throw new Error(readApiError(payload, "Action impossible."));
      setNotice({ tone: "success", text: success });
      setApprovalId(null);
      setApprovalReason("");
      await loadChannels();
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Action impossible.",
      });
    } finally {
      setBusyId(null);
    }
  }

  async function activate(channel: YouTubeChannel) {
    await mutate(
      channel.id,
      `/api/admin/youtube/channels/${channel.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "active",
          isActive: true,
          approvalReason,
        }),
      },
      `${channel.channel_title} est maintenant active.`
    );
  }

  async function importArtistProfiles() {
    setSyncingProfiles(true);
    setSyncSummary(null);
    setNotice(null);

    const total = emptyArtistProfileSyncSummary();
    let cursor: string | null = null;
    let pages = 0;

    try {
      do {
        const response: Response = await fetch("/api/admin/youtube/channels/import-artists", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cursor }),
        });
        const payload: ArtistProfileSyncPage = await response.json();
        if (!response.ok) {
          throw new Error(readApiError(payload, "Import des profils artistes impossible."));
        }

        mergeArtistProfileSyncSummary(total, payload as ArtistProfileSyncPage);
        cursor = typeof payload.nextCursor === "string" ? payload.nextCursor : null;
        pages++;
        if (pages > 100) throw new Error("Import interrompu : trop de pages à traiter.");
      } while (cursor);

      setSyncSummary(total);
      if (total.created > 0) onChannelCreated(total.created);
      setNotice({
        tone: total.errors > 0 || total.conflicts > 0 ? "warning" : "success",
        text: `${total.created} nouvelle(s) chaîne(s), ${total.linkedExisting} liaison(s) récupérée(s), ${total.errors} erreur(s).`,
      });
      await loadChannels();
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Import des profils artistes impossible.",
      });
    } finally {
      setSyncingProfiles(false);
    }
  }

  return (
    <div className={styles.stack}>
      {notice ? (
        <YouTubeAlert tone={notice.tone} title="Chaînes YouTube">
          {notice.text}
        </YouTubeAlert>
      ) : null}

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <h2>Sources approuvées</h2>
            <p>Seules les chaînes actives alimentent la découverte automatique.</p>
          </div>
          <div className={styles.headerActions}>
            <button
              className="btn btn--ghost"
              type="button"
              disabled={syncingProfiles}
              onClick={importArtistProfiles}
            >
              {syncingProfiles ? "Synchronisation en cours…" : "Importer depuis les profils"}
            </button>
            <button className="btn btn--primary" type="button" onClick={() => setShowCreate((value) => !value)}>
              {showCreate ? "Fermer" : "Ajouter une chaîne"}
            </button>
          </div>
        </div>

        {syncSummary ? <ArtistProfileSyncReport summary={syncSummary} /> : null}

        {showCreate ? (
          <ChannelCreateForm
            onCreated={async () => {
              setShowCreate(false);
              onChannelCreated();
              setNotice({ tone: "success", text: "Chaîne ajoutée à la file de vérification." });
              await loadChannels();
            }}
          />
        ) : null}

        <div className={styles.filters}>
          <label className={styles.field}>
            <span>Rechercher</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Nom de la chaîne"
            />
          </label>
          <label className={styles.field}>
            <span>Statut</span>
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">Tous</option>
              <option value="pending_review">À vérifier</option>
              <option value="active">Active</option>
              <option value="paused">En pause</option>
              <option value="rejected">Rejetée</option>
            </select>
          </label>
          <label className={styles.field}>
            <span>Trier par</span>
            <select value={sort} onChange={(event) => setSort(event.target.value)}>
              <option value="subscribers_desc">Plus d’abonnés</option>
              <option value="subscribers_asc">Moins d’abonnés</option>
              <option value="title_asc">Nom, de A à Z</option>
              <option value="title_desc">Nom, de Z à A</option>
              <option value="videos_desc">Plus de vidéos</option>
              <option value="recently_scanned">Contrôle le plus récent</option>
              <option value="recently_added">Ajout le plus récent</option>
            </select>
          </label>
        </div>

        {loading ? <LoadingRows /> : null}
        {!loading && channels.length === 0 ? (
          <YouTubeEmptyState
            title="Aucune chaîne"
            description="Ajoutez une chaîne officielle pour commencer la découverte."
          />
        ) : null}
        {!loading && channels.length > 0 ? (
          <div className={styles.dataList}>
            {channels.map((channel) => (
              <article className={styles.channelRow} key={channel.id}>
                <div className={styles.avatar}>
                  {channel.thumbnail_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={channel.thumbnail_url} alt="" />
                  ) : (
                    channel.channel_title.slice(0, 1).toUpperCase()
                  )}
                </div>
                <div className={styles.rowMain}>
                  <div className={styles.rowTitleLine}>
                    <a href={channel.channel_url} target="_blank" rel="noreferrer">
                      {channel.channel_title}
                    </a>
                    <Status value={channel.status} />
                    {channel.is_youtube_verified ? (
                      <span className={`${styles.status} ${styles.statusOk}`}>Vérifiée</span>
                    ) : null}
                  </div>
                  <p>
                    {CHANNEL_TYPE_LABELS[channel.channel_type] ?? channel.channel_type}
                    {channel.channel_handle ? `, ${channel.channel_handle}` : ""}
                  </p>
                  <div className={styles.meta}>
                    <span>{formatNumber(channel.subscriber_count)} abonnés</span>
                    <span>{formatNumber(channel.video_count)} vidéos</span>
                    <span>Dernier contrôle: {formatDateTime(channel.last_scanned_at)}</span>
                  </div>
                  {approvalId === channel.id ? (
                    <div className={styles.inlineEditor}>
                      <label className={styles.field}>
                        <span>Justification d’approbation</span>
                        <input
                          value={approvalReason}
                          onChange={(event) => setApprovalReason(event.target.value)}
                          minLength={10}
                          placeholder="Chaîne officielle vérifiée par l’équipe"
                        />
                      </label>
                      <div className={styles.inlineActions}>
                        <button
                          className="btn btn--ok"
                          type="button"
                          disabled={approvalReason.trim().length < 10 || busyId === channel.id}
                          onClick={() => activate(channel)}
                        >
                          Confirmer l’activation
                        </button>
                        <button className="btn btn--ghost" type="button" onClick={() => setApprovalId(null)}>
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
                    disabled={busyId === channel.id}
                    onClick={() =>
                      mutate(
                        channel.id,
                        `/api/admin/youtube/channels/${channel.id}/refresh`,
                        { method: "POST" },
                        "Métadonnées YouTube actualisées."
                      )
                    }
                  >
                    Actualiser
                  </button>
                  {channel.status !== "active" ? (
                    <button
                      className="btn btn--sm btn--ok"
                      type="button"
                      disabled={busyId === channel.id}
                      onClick={() => {
                        setApprovalId(channel.id);
                        setApprovalReason("");
                      }}
                    >
                      Activer
                    </button>
                  ) : (
                    <button
                      className="btn btn--sm btn--danger"
                      type="button"
                      disabled={busyId === channel.id}
                      onClick={() =>
                        mutate(
                          channel.id,
                          `/api/admin/youtube/channels/${channel.id}`,
                          { method: "DELETE" },
                          "Chaîne mise en pause."
                        )
                      }
                    >
                      Mettre en pause
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}

function ChannelCreateForm({ onCreated }: { onCreated: () => Promise<void> }) {
  const [channelId, setChannelId] = useState("");
  const [channelUrl, setChannelUrl] = useState("");
  const [channelType, setChannelType] = useState("OFFICIAL_ARTIST_CHANNEL");
  const [artistId, setArtistId] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/youtube/channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          artistId: artistId.trim() || null,
          channelId: channelId.trim(),
          channelTitle: "Validation YouTube",
          channelType,
          uploadsPlaylistId: null,
          channelUrl: channelUrl.trim(),
          isVerified: true,
          isActive: true,
          notes: notes.trim() || null,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(readApiError(payload, "Ajout impossible."));
      await onCreated();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Ajout impossible.");
    } finally {
      setSubmitting(false);
    }
  }

  const multiArtist = ["LABEL_CHANNEL", "DISTRIBUTOR_CHANNEL", "COLLABORATOR_CHANNEL"].includes(channelType);

  return (
    <form className={styles.createForm} onSubmit={submit}>
      <div className={styles.formGrid}>
        <label className={styles.field}>
          <span>Identifiant de chaîne</span>
          <input
            value={channelId}
            onChange={(event) => setChannelId(event.target.value)}
            placeholder="UC..."
            pattern="UC[A-Za-z0-9_-]{22}"
            required
          />
        </label>
        <label className={styles.field}>
          <span>URL YouTube</span>
          <input
            type="url"
            value={channelUrl}
            onChange={(event) => setChannelUrl(event.target.value)}
            placeholder="https://www.youtube.com/channel/UC..."
            required
          />
        </label>
        <label className={styles.field}>
          <span>Type de chaîne</span>
          <select value={channelType} onChange={(event) => setChannelType(event.target.value)}>
            {YOUTUBE_CHANNEL_TYPES.map((type) => (
              <option key={type} value={type}>
                {CHANNEL_TYPE_LABELS[type] ?? type}
              </option>
            ))}
          </select>
        </label>
        {!multiArtist ? (
          <label className={styles.field}>
            <span>Artiste associé (facultatif)</span>
            <input
              value={artistId}
              onChange={(event) => setArtistId(event.target.value)}
              placeholder="Identifiant interne de l’artiste"
            />
          </label>
        ) : null}
        <label className={`${styles.field} ${styles.fieldFull}`}>
          <span>Notes internes</span>
          <textarea value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={2000} />
        </label>
      </div>
      {error ? <p className={styles.formError}>{error}</p> : null}
      <button className="btn btn--primary" type="submit" disabled={submitting}>
        {submitting ? "Validation YouTube en cours..." : "Valider et ajouter"}
      </button>
    </form>
  );
}

function emptyArtistProfileSyncSummary(): ArtistProfileSyncSummary {
  return {
    profilesScanned: 0,
    urlsDetected: 0,
    created: 0,
    alreadyLinked: 0,
    linkedExisting: 0,
    duplicateProfileUrls: 0,
    conflicts: 0,
    errors: 0,
    details: [],
  };
}

function mergeArtistProfileSyncSummary(
  total: ArtistProfileSyncSummary,
  page: ArtistProfileSyncPage
) {
  total.profilesScanned += page.profilesScanned;
  total.urlsDetected += page.urlsDetected;
  total.created += page.created;
  total.alreadyLinked += page.alreadyLinked;
  total.linkedExisting += page.linkedExisting;
  total.duplicateProfileUrls += page.duplicateProfileUrls;
  total.conflicts += page.conflicts;
  total.errors += page.errors;
  total.details.push(...page.details);
}

function ArtistProfileSyncReport({ summary }: { summary: ArtistProfileSyncSummary }) {
  const issues = summary.details
    .filter((detail) => detail.status === "error" || detail.status === "conflict")
    .slice(0, 12);

  return (
    <section className={styles.syncReport} aria-live="polite">
      <div className={styles.syncMetrics}>
        <span><strong>{summary.profilesScanned}</strong> profils analysés</span>
        <span><strong>{summary.urlsDetected}</strong> liens détectés</span>
        <span><strong>{summary.created}</strong> chaînes à vérifier</span>
        <span><strong>{summary.alreadyLinked + summary.linkedExisting}</strong> déjà reliées</span>
        <span><strong>{summary.conflicts + summary.errors}</strong> à corriger</span>
      </div>
      {issues.length > 0 ? (
        <div className={styles.syncIssues}>
          <strong>Points nécessitant une vérification manuelle</strong>
          <ul>
            {issues.map((detail) => (
              <li key={`${detail.artistId}-${detail.sourceUrl}`}>
                <span>{detail.artistName}</span>
                <small>{detail.message}</small>
              </li>
            ))}
          </ul>
          {summary.conflicts + summary.errors > issues.length ? (
            <p>{summary.conflicts + summary.errors - issues.length} autre(s) point(s) non affiché(s).</p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function LoadingRows() {
  return (
    <div className={styles.loadingRows} aria-label="Chargement">
      <span />
      <span />
      <span />
    </div>
  );
}

