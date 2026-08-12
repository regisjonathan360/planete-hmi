/**
 * Gestionnaire de pistes radio
 * Permet d'ajouter, modifier, supprimer des pistes
 */
"use client";

import { useState } from "react";
import type { RadioTrack } from "@/lib/radio/types";
import styles from "./TrackManager.module.css";

interface TrackManagerProps {
  tracks: RadioTrack[];
  onTracksUpdate: (tracks: RadioTrack[]) => void;
}

export function TrackManager({ tracks, onTracksUpdate }: TrackManagerProps) {
  const [filter, setFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [isAdding, setIsAdding] = useState(false);

  const filteredTracks = tracks.filter((track) => {
    const matchesSearch =
      track.title.toLowerCase().includes(filter.toLowerCase()) ||
      track.artist_name.toLowerCase().includes(filter.toLowerCase());
    
    const matchesSource =
      sourceFilter === "all" || track.source === sourceFilter;

    return matchesSearch && matchesSource;
  });

  const sources = ["all", ...new Set(tracks.map((t) => t.source))];

  return (
    <div className={styles.manager}>
      <div className={styles.header}>
        <h2>Gestion des Pistes</h2>
        <button
          className={styles.addButton}
          onClick={() => setIsAdding(true)}
        >
          ➕ Ajouter une piste
        </button>
      </div>

      {/* Filtres */}
      <div className={styles.filters}>
        <input
          type="text"
          placeholder="Rechercher une piste ou un artiste..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className={styles.searchInput}
        />
        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
          className={styles.select}
        >
          {sources.map((source) => (
            <option key={source} value={source}>
              {source === "all"
                ? "Toutes les sources"
                : source.charAt(0).toUpperCase() + source.slice(1)}
            </option>
          ))}
        </select>
      </div>

      {/* Liste des pistes */}
      <div className={styles.tracks}>
        {filteredTracks.length === 0 ? (
          <div className={styles.empty}>
            <p>Aucune piste trouvée</p>
            {filter && <p>Essayez de modifier vos filtres</p>}
          </div>
        ) : (
          <div className={styles.trackList}>
            {filteredTracks.map((track) => (
              <div key={track.id} className={styles.trackCard}>
                <div className={styles.trackCover}>
                  {track.cover_image_url ? (
                    <img src={track.cover_image_url} alt={track.title} />
                  ) : (
                    <div className={styles.coverPlaceholder}>🎵</div>
                  )}
                </div>
                <div className={styles.trackInfo}>
                  <div className={styles.trackTitle}>{track.title}</div>
                  <div className={styles.trackArtist}>{track.artist_name}</div>
                  <div className={styles.trackMeta}>
                    <span className={styles.source}>
                      {track.source.toUpperCase()}
                    </span>
                    <span>
                      {Math.floor(track.duration_seconds / 60)}:
                      {String(track.duration_seconds % 60).padStart(2, "0")}
                    </span>
                    <span>{track.play_count} écoutes</span>
                  </div>
                </div>
                <div className={styles.trackActions}>
                  <button
                    className={styles.actionButton}
                    title="Écouter"
                    onClick={() => {
                      const audio = new Audio(track.audio_url);
                      audio.play();
                    }}
                  >
                    ▶️
                  </button>
                  <button
                    className={styles.actionButton}
                    title="Modifier"
                  >
                    ✏️
                  </button>
                  <button
                    className={styles.actionButton}
                    title="Supprimer"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {isAdding && (
        <div className={styles.modal}>
          <div className={styles.modalContent}>
            <h3>Ajouter une piste</h3>
            <p>Fonctionnalité à venir : formulaire d'ajout de piste</p>
            <button
              className={styles.closeButton}
              onClick={() => setIsAdding(false)}
            >
              Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
