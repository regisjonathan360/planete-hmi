/**
 * Lecteur radio persistant de Planète HMI.
 *
 * La mécanique audio reste dans useRadioPlayer : ce composant ne fait que
 * rendre les commandes autour de l'habillage boombox HMI.
 */
"use client";

import { useRadioPlayer } from "@/lib/radio/useRadioPlayer";
import { useMemo, useState, type CSSProperties } from "react";
import styles from "./RadioPlayer.module.css";
import {
  FaMusic,
  FaPause,
  FaPlay,
  FaSpinner,
  FaStepBackward,
  FaStepForward,
  FaTimes,
} from "react-icons/fa";

function formatGenre(genre?: string) {
  if (!genre) return "Tous les genres";

  return genre
    .trim()
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function RadioPlayer() {
  const {
    isPlaying,
    currentTrack,
    nextTrack,
    playlist,
    selectedGenre,
    volume,
    isMuted,
    isLoading,
    error,
    togglePlay,
    next,
    previous,
    setVolume,
    setGenre,
  } = useRadioPlayer({ autoPlay: false, volume: 0.7, preloadCount: 3 });

  const [isVisible, setIsVisible] = useState(false);
  const genreOptions = useMemo(
    () => Array.from(new Set(
      playlist
        .map((track) => track.genre?.trim())
        .filter((genre): genre is string => Boolean(genre)),
    )).sort((first, second) => first.localeCompare(second, "fr")),
    [playlist],
  );

  const volumeLevel = Math.round((isMuted ? 0 : volume) * 100);
  const isLive = Boolean(currentTrack && !error);
  const activeGenre = selectedGenre || currentTrack?.genre;
  const radioStyle = { "--radio-volume": `${volumeLevel}%` } as CSSProperties;

  if (!isVisible) {
    return (
      <button
        className={styles.radioLauncher}
        type="button"
        onClick={() => setIsVisible(true)}
        aria-label="Ouvrir la radio Planète HMI"
        title="Ouvrir la radio"
        data-playing={isPlaying && !isMuted}
      >
        <span className={styles.launcherPulse} aria-hidden="true" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={styles.launcherImg} src="/images/radio/hmi-boombox-mini.png" alt="" aria-hidden="true" draggable={false} />
      </button>
    );
  }

  return (
    <aside
      className={styles.radioPlayer}
      aria-label="Radio Planète HMI"
      data-playing={isPlaying && !isMuted}
      data-live={isLive}
      style={radioStyle}
    >
      <div className={styles.boombox}>
        <img
          className={styles.boomboxArtwork}
          src="/images/radio/hmi-boombox.png"
          alt=""
          aria-hidden="true"
          draggable={false}
        />

        <div className={styles.stationScreen} aria-live="polite">
          <span className={styles.stationName}>PLANÈTE HMI</span>
          {isLoading ? (
            <span className={styles.screenState}>
              <FaSpinner className={styles.spinner} aria-hidden="true" /> Chargement
            </span>
          ) : error ? (
            <span className={styles.screenError} title={error}>Piste indisponible</span>
          ) : currentTrack ? (
            <>
              <strong className={styles.trackTitle} title={currentTrack.title}>{currentTrack.title}</strong>
              <span className={styles.trackArtist} title={currentTrack.artist_name}>{currentTrack.artist_name}</span>
            </>
          ) : (
            <span className={styles.screenState}>En attente de programme</span>
          )}
        </div>

        <div className={styles.genreControl}>
          <label className={styles.srOnly} htmlFor="radio-genre">Filtrer la radio par genre</label>
          <select
            id="radio-genre"
            className={styles.genreSelect}
            value={selectedGenre || ""}
            onChange={(event) => setGenre(event.target.value || undefined)}
            disabled={genreOptions.length === 0}
            title={genreOptions.length ? "Choisir un genre" : "Les genres seront disponibles dès leur configuration"}
          >
            <option value="">{genreOptions.length ? "Tous les genres" : "Genres à venir"}</option>
            {genreOptions.map((genre) => (
              <option key={genre} value={genre}>{formatGenre(genre)}</option>
            ))}
          </select>
          <span className={styles.genreReadout}>{formatGenre(activeGenre)}</span>
        </div>

        <img
          className={`${styles.speakerDecor} ${styles.speakerLeft}`}
          src="/images/radio/hmi-speaker-left.png"
          alt=""
          aria-hidden="true"
          draggable={false}
        />
        <img
          className={`${styles.speakerDecor} ${styles.speakerRight}`}
          src="/images/radio/hmi-speaker-right.png"
          alt=""
          aria-hidden="true"
          draggable={false}
        />

        <button
          className={styles.speakerLeftCenter}
          type="button"
          onClick={previous}
          disabled={!currentTrack || isLoading}
          title="Piste précédente"
          aria-label="Piste précédente"
        >
          <FaStepBackward aria-hidden="true" />
        </button>

        <button
          className={styles.speakerRightCenter}
          type="button"
          onClick={next}
          disabled={!currentTrack || isLoading}
          title="Piste suivante"
          aria-label="Piste suivante"
        >
          <FaStepForward aria-hidden="true" />
        </button>

        <div className={styles.coverWell}>
          {currentTrack?.cover_image_url ? (
            <img
              className={styles.cover}
              src={currentTrack.cover_image_url}
              alt={`Pochette de ${currentTrack.title}`}
            />
          ) : (
            <div className={styles.coverPlaceholder} aria-label="Pochette indisponible">
              <FaMusic aria-hidden="true" />
            </div>
          )}
          {isPlaying && !isMuted && <span className={styles.coverPulse} aria-hidden="true" />}
        </div>

        <button
          className={styles.playButton}
          type="button"
          onClick={togglePlay}
          disabled={!currentTrack || isLoading}
          title={isPlaying ? "Mettre la radio en pause" : "Lire la radio"}
          aria-label={isPlaying ? "Mettre la radio en pause" : "Lire la radio"}
        >
          {isPlaying ? <FaPause aria-hidden="true" /> : <FaPlay aria-hidden="true" />}
        </button>

        <div className={styles.volumeControl}>
          <label className={styles.srOnly} htmlFor="radio-volume">Volume de la radio</label>
          <input
            id="radio-volume"
            className={styles.volumeSlider}
            type="range"
            min="0"
            max="100"
            step="1"
            value={volumeLevel}
            onChange={(event) => setVolume(Number(event.target.value) / 100)}
            aria-valuetext={`${volumeLevel} %`}
            title={`Volume : ${volumeLevel} %`}
          />
          <span className={styles.volumeButton} aria-hidden="true" />
        </div>

        <div className={styles.liveStatus} data-live={isLive}>
          <span className={styles.liveDot} aria-hidden="true" />
          {isLoading ? "CHARGEMENT" : error ? "HORS LIGNE" : isPlaying ? "EN DIRECT" : "EN PAUSE"}
        </div>

        <div className={styles.nextPreview} title={nextTrack ? `À suivre : ${nextTrack.title} — ${nextTrack.artist_name}` : undefined}>
          <span>À suivre</span>
          <strong>{nextTrack ? `${nextTrack.title} — ${nextTrack.artist_name}` : "Programmation en cours"}</strong>
        </div>

        <button
          className={styles.minimizeButton}
          type="button"
          onClick={() => setIsVisible(false)}
          title="Réduire la radio"
          aria-label="Réduire la radio"
        >
          <FaTimes aria-hidden="true" />
        </button>
      </div>
    </aside>
  );
}
