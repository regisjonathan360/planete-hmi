/**
 * Gestionnaire de playlists radio
 * Permet de créer, modifier, supprimer et gérer les playlists
 */
"use client";

import { useState } from "react";
import type { RadioPlaylist, RadioTrack } from "@/lib/radio/types";
import { normalizePlaylistTrackCount } from "@/lib/radio/types";
import styles from "./PlaylistManager.module.css";
import { AvailableSourcesSelector } from "./AvailableSourcesSelector";

interface PlaylistManagerProps {
  playlists: RadioPlaylist[];
  tracks: RadioTrack[];
  onPlaylistsUpdate: (playlists: RadioPlaylist[]) => void;
}

export function PlaylistManager({
  playlists,
  tracks,
  onPlaylistsUpdate,
}: PlaylistManagerProps) {
  const [selectedPlaylist, setSelectedPlaylist] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [newPlaylistDescription, setNewPlaylistDescription] = useState("");
  const [selectedTrackIds, setSelectedTrackIds] = useState<string[]>([]);
  const [isSavingTracks, setIsSavingTracks] = useState(false);
  const [selectedChartId, setSelectedChartId] = useState("");
  const [playlistTracks, setPlaylistTracks] = useState<RadioTrack[]>([]);
  const safePlaylists = Array.isArray(playlists) ? playlists : [];

  const handleCreatePlaylist = async () => {
    if (!newPlaylistName.trim()) return;

    try {
      const response = await fetch("/api/admin/radio/playlists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newPlaylistName,
          description: newPlaylistDescription,
          shuffle_enabled: true,
          repeat_enabled: true,
        }),
      });

      if (!response.ok) throw new Error("Erreur lors de la création");

      const newPlaylist = await response.json();
      onPlaylistsUpdate([...safePlaylists, newPlaylist]);
      
      setIsCreating(false);
      setNewPlaylistName("");
      setNewPlaylistDescription("");
    } catch (error) {
      console.error("Error creating playlist:", error);
      alert("Erreur lors de la création de la playlist");
    }
  };

  return (
    <div className={styles.manager}>
      <div className={styles.header}>
        <h2>Gestion des Playlists</h2>
        <button
          className={styles.createButton}
          onClick={() => setIsCreating(true)}
        >
          ➕ Nouvelle playlist
        </button>
      </div>

      {isCreating && (
        <div className={styles.createForm}>
          <h3>Créer une playlist</h3>
          <input
            type="text"
            placeholder="Nom de la playlist"
            value={newPlaylistName}
            onChange={(e) => setNewPlaylistName(e.target.value)}
            className={styles.input}
          />
          <textarea
            placeholder="Description (optionnelle)"
            value={newPlaylistDescription}
            onChange={(e) => setNewPlaylistDescription(e.target.value)}
            className={styles.textarea}
            rows={3}
          />
          <div className={styles.formActions}>
            <button
              onClick={() => setIsCreating(false)}
              className={styles.cancelButton}
            >
              Annuler
            </button>
            <button onClick={handleCreatePlaylist} className={styles.saveButton}>
              Créer
            </button>
          </div>
        </div>
      )}

      <div className={styles.playlists}>
        {safePlaylists.length === 0 ? (
          <div className={styles.empty}>
            <p>Aucune playlist créée</p>
            <p>Créez votre première playlist pour commencer</p>
          </div>
        ) : (
          <div className={styles.playlistGrid}>
            {safePlaylists.map((playlist) => (
              <div
                key={playlist.id}
                className={`${styles.playlistCard} ${
                  selectedPlaylist === playlist.id ? styles.selected : ""
                }`}
                onClick={async () => {
                  setSelectedPlaylist(playlist.id);
                  const response = await fetch(`/api/admin/radio/playlists/${playlist.id}/tracks`);
                  if (response.ok) {
                    const rows = await response.json();
                    setPlaylistTracks(rows.map((row: { radio_tracks: RadioTrack }) => row.radio_tracks).filter(Boolean));
                  }
                }}
              >
                <div className={styles.playlistIcon}>📋</div>
                <div className={styles.playlistInfo}>
                  <h3 className={styles.playlistName}>{playlist.name}</h3>
                  {playlist.description && (
                    <p className={styles.playlistDescription}>
                      {playlist.description}
                    </p>
                  )}
                  <div className={styles.playlistMeta}>
                    <span>
                      {normalizePlaylistTrackCount(playlist.track_count)} pistes
                    </span>
                    {playlist.is_default && (
                      <span className={styles.defaultBadge}>Par défaut</span>
                    )}
                  </div>
                  <div className={styles.playlistActions}>
                    <button className={styles.actionButton} onClick={async (event) => {
                      event.stopPropagation();
                      const name = window.prompt("Nom de la playlist", playlist.name);
                      if (!name?.trim()) return;
                      const response = await fetch(`/api/admin/radio/playlists/${playlist.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: name.trim() }) });
                      if (response.ok) onPlaylistsUpdate(safePlaylists.map((item) => item.id === playlist.id ? { ...item, name: name.trim() } : item));
                    }}>Modifier</button>
                    <button className={styles.actionButton} onClick={async (event) => {
                      event.stopPropagation();
                      if (!window.confirm(`Supprimer la playlist « ${playlist.name} » ?`)) return;
                      const response = await fetch(`/api/admin/radio/playlists/${playlist.id}`, { method: "DELETE" });
                      if (response.ok) {
                        onPlaylistsUpdate(safePlaylists.filter((item) => item.id !== playlist.id));
                        if (selectedPlaylist === playlist.id) setSelectedPlaylist(null);
                      }
                    }}>Supprimer</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedPlaylist && (
        <div className={styles.playlistDetails}>
          <h3>Détails de la playlist</h3>
          <p>{playlistTracks.length} piste{playlistTracks.length > 1 ? "s" : ""} dans cette playlist. Les pistes sans URL audio directe ne sont pas jouables.</p>
          <div className={styles.playlistTracks}>
            {playlistTracks.map((track, index) => (
              <div key={track.id} className={styles.trackRow}>
                <span>{index + 1}. {track.title} · {track.artist_name}</span>
                <button className={styles.actionButton} onClick={async () => {
                  const response = await fetch(`/api/admin/radio/playlists/${selectedPlaylist}/tracks`, {
                    method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ trackId: track.id }),
                  });
                  if (response.ok) setPlaylistTracks((current) => current.filter((item) => item.id !== track.id));
                }}>Retirer</button>
              </div>
            ))}
          </div>
          <div className={styles.trackPicker}>
            <select
              multiple
              value={selectedTrackIds}
              onChange={(event) => setSelectedTrackIds(Array.from(event.target.selectedOptions, (option) => option.value))}
              className={styles.input}
              aria-label="Pistes à ajouter"
            >
              {tracks.filter((track) => track.audio_url).map((track) => (
                <option key={track.id} value={track.id}>{track.title} · {track.artist_name}</option>
              ))}
            </select>
            <button
              className={styles.saveButton}
              disabled={!selectedTrackIds.length || isSavingTracks}
              onClick={async () => {
                setIsSavingTracks(true);
                try {
                  const response = await fetch(`/api/admin/radio/playlists/${selectedPlaylist}/tracks`, {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ trackIds: selectedTrackIds }),
                  });
                  if (!response.ok) throw new Error("add");
                  setSelectedTrackIds([]);
                  const playlistResponse = await fetch(`/api/admin/radio/playlists/${selectedPlaylist}/tracks`);
                  if (playlistResponse.ok) {
                    const rows = await playlistResponse.json();
                    setPlaylistTracks(rows.map((row: { radio_tracks: RadioTrack }) => row.radio_tracks).filter(Boolean));
                  }
                  const refreshed = await fetch("/api/admin/radio/playlists");
                  if (refreshed.ok) onPlaylistsUpdate(await refreshed.json());
                } catch { alert("Impossible d’ajouter les pistes à la playlist"); }
                finally { setIsSavingTracks(false); }
              }}
            >{isSavingTracks ? "Ajout…" : "Ajouter les pistes sélectionnées"}</button>
          </div>
          <p className={styles.playlistDescription}>Pour importer un classement complet dans cette playlist, utilisez l’action de synchronisation dans Configuration, puis choisissez cette playlist comme source active.</p>
          <AvailableSourcesSelector onSelectChart={setSelectedChartId} />
          <button
            className={styles.saveButton}
            disabled={!selectedChartId || isSavingTracks}
            onClick={async () => {
              setIsSavingTracks(true);
              try {
                const response = await fetch("/api/admin/radio/sync-chart", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chartId: selectedChartId, playlistId: selectedPlaylist }) });
                if (!response.ok) throw new Error("sync");
                const refreshed = await fetch("/api/admin/radio/playlists");
                if (refreshed.ok) onPlaylistsUpdate(await refreshed.json());
              } catch { alert("Impossible d’importer ce classement. Vérifiez qu’il contient des sources audio directes."); }
              finally { setIsSavingTracks(false); }
            }}
          >{isSavingTracks ? "Import…" : "Importer ce classement dans la playlist"}</button>
        </div>
      )}
    </div>
  );
}
