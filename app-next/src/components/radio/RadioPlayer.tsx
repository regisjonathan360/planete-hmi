/**
 * Composant lecteur radio pour Planète HMI
 * Affichage fixe en bas de page avec contrôles
 */
"use client";

import { useRadioPlayer } from "@/lib/radio/useRadioPlayer";
import { useEffect, useState } from "react";
import styles from "./RadioPlayer.module.css";
import {
  FaPlay,
  FaPause,
  FaStepForward,
  FaStepBackward,
  FaVolumeUp,
  FaVolumeMute,
  FaSpinner,
} from "react-icons/fa";

export function RadioPlayer() {
  const {
    isPlaying,
    currentTrack,
    nextTrack,
    volume,
    isMuted,
    isLoading,
    error,
    togglePlay,
    next,
    previous,
    setVolume,
    toggleMute,
  } = useRadioPlayer({ autoPlay: false, volume: 0.7, preloadCount: 3 });

  const [isVisible, setIsVisible] = useState(true);

  // Animation d'apparition
  useEffect(() => {
    if (currentTrack) {
      setIsVisible(true);
    }
  }, [currentTrack]);

  if (!isVisible && !currentTrack) {
    return null;
  }

  return (
    <div className={styles.radioPlayer} data-visible={isVisible}>
      {/* Barre de progression cosmique */}
      <div className={styles.cosmicGlow} />

      <div className={styles.container}>
        {/* Ligne supérieure : pochette + infos */}
        <div className={styles.topRow}>
          {/* Pochette de l'album */}
          <div className={styles.coverSection}>
            {currentTrack?.cover_image_url ? (
              <img
                src={currentTrack.cover_image_url}
                alt={currentTrack.title}
                className={styles.cover}
              />
            ) : (
              <div className={styles.coverPlaceholder}>
                <span>🎵</span>
              </div>
            )}
            {isPlaying && <div className={styles.playingAnimation} />}
          </div>

          {/* Informations de la piste */}
          <div className={styles.trackInfo}>
            {isLoading ? (
              <div className={styles.loading}>
                <FaSpinner className={styles.spinner} />
                <span>Chargement...</span>
              </div>
            ) : error ? (
              <div className={styles.error}>{error}</div>
            ) : currentTrack ? (
              <>
                <div className={styles.trackTitle}>{currentTrack.title}</div>
                <div className={styles.trackArtist}>{currentTrack.artist_name}</div>
              </>
            ) : (
              <div className={styles.noTrack}>Radio Planète HMI</div>
            )}
          </div>
        </div>

        {/* Ligne de contrôles : play/pause + live + minimize */}
        <div className={styles.controlsRow}>
          {/* Contrôles de lecture */}
          <div className={styles.controls}>
            <button
              className={styles.controlButton}
              onClick={previous}
              disabled={!currentTrack}
              title="Piste précédente"
            >
              <FaStepBackward />
            </button>

            <button
              className={`${styles.controlButton} ${styles.playButton}`}
              onClick={togglePlay}
              disabled={!currentTrack || isLoading}
              title={isPlaying ? "Pause" : "Lecture"}
            >
              {isPlaying ? <FaPause /> : <FaPlay />}
            </button>

            <button
              className={styles.controlButton}
              onClick={next}
              disabled={!currentTrack}
              title="Piste suivante"
            >
              <FaStepForward />
            </button>

            <button
              className={styles.controlButton}
              onClick={toggleMute}
              title={isMuted ? "Activer le son" : "Couper le son"}
            >
              {isMuted ? <FaVolumeMute /> : <FaVolumeUp />}
            </button>
          </div>

          {/* Contrôles droite : Badge LIVE + Minimize */}
          <div className={styles.rightControls}>
            <div className={styles.liveBadge}>
              <span className={styles.liveIndicator} />
              LIVE
            </div>

            <button
              className={styles.minimizeButton}
              onClick={() => setIsVisible(false)}
              title="Réduire"
            >
              ×
            </button>
          </div>
        </div>
      </div>

      {/* Bouton pour réafficher quand réduit */}
      {!isVisible && (
        <button
          className={styles.showButton}
          onClick={() => setIsVisible(true)}
          title="Afficher la radio"
        >
          🎵
        </button>
      )}
    </div>
  );
}
