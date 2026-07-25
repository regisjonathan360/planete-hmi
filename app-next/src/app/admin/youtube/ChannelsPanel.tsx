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

export function ChannelsPanel({
  onChannelCreated,
}: {
  onChannelCreated: () => void;
}) {
  const [channels, setChannels] = useState<YouTubeChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [approvalId, setApprovalId] = useState<string | null>(null);
  const [approvalReason, setApprovalReason] = useState("");
  const [notice, setNotice] = useState<{ tone: "success" | "error" | "warning"; text: string } | null>(null);

  const loadChannels = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "100", offset: "0" });
      if (search.trim()) params.set("search", search.trim());
      if (status) params.set("status", status);
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
  }, [search, status]);

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
          <button className="btn btn--primary" type="button" onClick={() => setShowCreate((value) => !value)}>
            {showCreate ? "Fermer" : "Ajouter une chaîne"}
          </button>
        </div>

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

function LoadingRows() {
  return (
    <div className={styles.loadingRows} aria-label="Chargement">
      <span />
      <span />
      <span />
    </div>
  );
}

