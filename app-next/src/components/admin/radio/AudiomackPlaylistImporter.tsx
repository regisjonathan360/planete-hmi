"use client";

import { useState } from "react";
import type { RadioPlaylist } from "@/lib/radio/types";
import styles from "./AudiomackPlaylistImporter.module.css";

interface AudiomackPlaylistImporterProps {
  onImported: (playlist: RadioPlaylist, activate: boolean) => void;
}

interface ImportResponse {
  playlist: RadioPlaylist;
  importedTracks: number;
  skippedTracks: number;
  activated: boolean;
  message: string;
}

export function AudiomackPlaylistImporter({ onImported }: AudiomackPlaylistImporterProps) {
  const [playlistUrl, setPlaylistUrl] = useState("");
  const [name, setName] = useState("");
  const [activate, setActivate] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  async function importPlaylist(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!playlistUrl.trim()) return;

    setIsImporting(true);
    setMessage("");
    setIsError(false);
    try {
      const response = await fetch("/api/admin/radio/audiomack-playlist/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playlistUrl, name: name.trim() || undefined, activate }),
      });
      const data = await response.json() as ImportResponse | { error?: string };
      if (!response.ok || !("playlist" in data)) {
        throw new Error("error" in data && data.error ? data.error : "Import Audiomack impossible.");
      }

      onImported(data.playlist, data.activated);
      setMessage(`${data.message}${data.skippedTracks ? ` ${data.skippedTracks} piste(s) sans flux public ont été ignorée(s).` : ""}`);
      setPlaylistUrl("");
      setName("");
    } catch (error) {
      setIsError(true);
      setMessage(error instanceof Error ? error.message : "Import Audiomack impossible.");
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <section className={styles.importer} aria-labelledby="audiomack-import-title">
      <div className={styles.heading}>
        <div>
          <span className={styles.eyebrow}>Source externe</span>
          <h3 id="audiomack-import-title">Importer une playlist Audiomack</h3>
        </div>
        <span className={styles.badge}>Audiomack</span>
      </div>
      <p className={styles.help}>
        Collez le lien public d&apos;une playlist. Les morceaux avec un flux audio public sont ajoutés dans l&apos;ordre et peuvent être diffusés immédiatement.
      </p>

      <form className={styles.form} onSubmit={importPlaylist}>
        <label htmlFor="audiomack-playlist-url">URL de la playlist</label>
        <input
          id="audiomack-playlist-url"
          type="url"
          value={playlistUrl}
          onChange={(event) => setPlaylistUrl(event.target.value)}
          placeholder="https://audiomack.com/artiste/playlist/nom-de-la-playlist"
          required
          disabled={isImporting}
        />

        <label htmlFor="audiomack-playlist-name">Nom dans la radio <span>optionnel</span></label>
        <input
          id="audiomack-playlist-name"
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Le nom Audiomack sera utilisé par défaut"
          maxLength={140}
          disabled={isImporting}
        />

        <label className={styles.activateLine} htmlFor="audiomack-activate">
          <input
            id="audiomack-activate"
            type="checkbox"
            checked={activate}
            onChange={(event) => setActivate(event.target.checked)}
            disabled={isImporting}
          />
          <span>
            <strong>Mettre cette playlist en ligne maintenant</strong>
            <small>Elle devient la source active de la radio après l&apos;import.</small>
          </span>
        </label>

        <button type="submit" className={styles.importButton} disabled={isImporting}>
          {isImporting ? "Collecte Audiomack en cours…" : activate ? "Importer et mettre en ligne" : "Importer dans les playlists"}
        </button>
      </form>

      {message && <p className={`${styles.message} ${isError ? styles.error : styles.success}`} role="status">{message}</p>}
      <p className={styles.notice}>Les fichiers ne sont pas téléchargés ni réhébergés. Les titres sans flux public ou réservés aux abonnés sont exclus.</p>
    </section>
  );
}
