/**
 * Gestionnaire de playlists radio
 * Permet de créer, modifier, supprimer et gérer les playlists
 */
"use client";

import { useState } from "react";
import type { RadioPlaylist, RadioTrack } from "@/lib/radio/types";
import styles from "./PlaylistManager.module.css";

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
      onPlaylistsUpdate([...playlists, newPlaylist]);
      
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
        {playlists.length === 0 ? (
          <div className={styles.empty}>
            <p>Aucune playlist créée</p>
            <p>Créez votre première playlist pour commencer</p>
          </div>
        ) : (
          <div className={styles.playlistGrid}>
            {playlists.map((playlist) => (
              <div
                key={playlist.id}
                className={`${styles.playlistCard} ${
                  selectedPlaylist === playlist.id ? styles.selected : ""
                }`}
                onClick={() => setSelectedPlaylist(playlist.id)}
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
                    <span>{playlist.track_count || 0} pistes</span>
                    {playlist.is_default && (
                      <span className={styles.defaultBadge}>Par défaut</span>
                    )}
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
          <p>Fonctionnalité à venir : ajout/suppression de pistes, réorganisation, etc.</p>
        </div>
      )}
    </div>
  );
}
