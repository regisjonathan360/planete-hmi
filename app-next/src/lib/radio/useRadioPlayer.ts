/**
 * Hook React pour le lecteur radio avec préchargement intelligent
 */
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Howl } from "howler";
import type { RadioTrack, RadioPlayerState } from "./types";

interface UseRadioPlayerOptions {
  autoPlay?: boolean;
  volume?: number;
  preloadCount?: number;
  crossfadeDuration?: number;
  sourceId?: string;
  sourceType?: "chart" | "playlist";
}

export function useRadioPlayer(options: UseRadioPlayerOptions = {}) {
  const {
    autoPlay = false,
    volume: initialVolume = 0.7,
    preloadCount = 3,
    crossfadeDuration = 2000,
    sourceId,
    sourceType,
  } = options;

  const [state, setState] = useState<RadioPlayerState>({
    isPlaying: false,
    playlist: [],
    currentIndex: -1,
    volume: initialVolume,
    isMuted: false,
    preloadedTracks: new Set(),
    isLoading: true,
    error: undefined,
  });

  const currentHowlRef = useRef<Howl | null>(null);
  const nextHowlRef = useRef<Howl | null>(null);
  const preloadedHowls = useRef<Map<string, Howl>>(new Map());
  const isCrossfading = useRef(false);

  /**
   * Charge la playlist depuis l'API (données par défaut)
   */
  const loadDefaultPlaylist = useCallback(async () => {
    try {
      setState((prev) => ({ ...prev, isLoading: true, error: undefined }));

      const response = await fetch("/api/radio/playlist");
      if (!response.ok) throw new Error("Failed to load playlist");

      const data = await response.json();
      const tracks = data.tracks || [];

      setState((prev) => ({
        ...prev,
        playlist: tracks,
        isLoading: false,
        currentIndex: tracks.length > 0 ? 0 : -1,
      }));

      if (tracks.length > 0 && autoPlay) {
        // Démarre la lecture automatiquement
        setTimeout(() => play(), 100);
      }
    } catch (error) {
      console.error("Error loading default playlist:", error);
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: "Impossible de charger la playlist",
      }));
    }
  }, [autoPlay]);

  /**
   * Charge la playlist depuis une source (chart ou playlist)
   */
  const loadSourcePlaylist = useCallback(async (id: string, type: "chart" | "playlist") => {
    try {
      setState((prev) => ({ ...prev, isLoading: true, error: undefined }));

      const params = new URLSearchParams();
      if (type === "chart") {
        params.append("chartId", id);
      } else {
        params.append("playlistId", id);
      }

      const response = await fetch(`/api/admin/radio/source-tracks?${params}`);
      if (!response.ok) {
        throw new Error("Erreur lors du chargement des pistes");
      }

      const data = await response.json();
      const tracks = data.tracks || [];

      setState((prev) => ({
        ...prev,
        playlist: tracks,
        isLoading: false,
        currentIndex: tracks.length > 0 ? 0 : -1,
      }));

      if (tracks.length > 0 && autoPlay) {
        // Démarre la lecture automatiquement
        setTimeout(() => play(), 100);
      }
    } catch (error) {
      console.error("Error loading source playlist:", error);
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: "Impossible de charger les pistes",
      }));
    }
  }, [autoPlay]);

  /**
   * Charge la playlist appropriée
   */
  const loadPlaylist = useCallback(async () => {
    if (sourceId && sourceType) {
      await loadSourcePlaylist(sourceId, sourceType);
    } else {
      await loadDefaultPlaylist();
    }
  }, [sourceId, sourceType, loadSourcePlaylist, loadDefaultPlaylist]);

  /**
   * Précharge les prochaines pistes
   */
  const preloadTracks = useCallback(
    (startIndex: number) => {
      const { playlist } = state;
      if (playlist.length === 0) return;

      for (let i = 1; i <= preloadCount; i++) {
        const index = (startIndex + i) % playlist.length;
        const track = playlist[index];

        if (!track || preloadedHowls.current.has(track.id)) continue;

        const howl = new Howl({
          src: [track.audio_url],
          html5: true,
          preload: true,
          volume: 0, // Volume à 0 car on ne joue pas encore
        });

        preloadedHowls.current.set(track.id, howl);
        setState((prev) => ({
          ...prev,
          preloadedTracks: new Set([...prev.preloadedTracks, track.id]),
        }));
      }
    },
    [state, preloadCount]
  );

  /**
   * Crée un Howl pour une piste
   */
  const createHowl = useCallback(
    (track: RadioTrack): Howl => {
      // Vérifier si déjà préchargé
      if (preloadedHowls.current.has(track.id)) {
        const howl = preloadedHowls.current.get(track.id)!;
        howl.volume(state.isMuted ? 0 : state.volume);
        return howl;
      }

      return new Howl({
        src: [track.audio_url],
        html5: true,
        volume: state.isMuted ? 0 : state.volume,
        onend: () => {
          // Piste terminée, passer à la suivante
          next();
        },
        onloaderror: (id, error) => {
          console.error("Error loading track:", track.title, error);
          setState((prev) => ({
            ...prev,
            error: `Erreur de chargement: ${track.title}`,
          }));
          // Passer à la piste suivante
          setTimeout(() => next(), 1000);
        },
        onplayerror: (id, error) => {
          console.error("Error playing track:", track.title, error);
          setTimeout(() => next(), 1000);
        },
      });
    },
    [state.volume, state.isMuted]
  );

  /**
   * Joue la piste actuelle
   */
  const play = useCallback(() => {
    const { playlist, currentIndex } = state;
    if (playlist.length === 0 || currentIndex === -1) return;

    const track = playlist[currentIndex];
    if (!track) return;

    // Arrêter la piste actuelle si elle existe
    if (currentHowlRef.current) {
      currentHowlRef.current.stop();
    }

    // Créer ou récupérer le Howl
    const howl = createHowl(track);
    currentHowlRef.current = howl;

    // Lancer la lecture
    howl.play();

    setState((prev) => ({
      ...prev,
      isPlaying: true,
      currentTrack: track,
      nextTrack: playlist[(currentIndex + 1) % playlist.length],
    }));

    // Précharger les prochaines pistes
    preloadTracks(currentIndex);

    // Enregistrer l'écoute
    fetch("/api/radio/play", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trackId: track.id }),
    }).catch(console.error);
  }, [state, createHowl, preloadTracks]);

  /**
   * Met en pause la lecture
   */
  const pause = useCallback(() => {
    if (currentHowlRef.current) {
      currentHowlRef.current.pause();
      setState((prev) => ({ ...prev, isPlaying: false }));
    }
  }, []);

  /**
   * Reprend la lecture
   */
  const resume = useCallback(() => {
    if (currentHowlRef.current) {
      currentHowlRef.current.play();
      setState((prev) => ({ ...prev, isPlaying: true }));
    }
  }, []);

  /**
   * Toggle play/pause
   */
  const togglePlay = useCallback(() => {
    if (state.isPlaying) {
      pause();
    } else if (currentHowlRef.current && currentHowlRef.current.playing()) {
      resume();
    } else {
      play();
    }
  }, [state.isPlaying, play, pause, resume]);

  /**
   * Passe à la piste suivante avec crossfade optionnel
   */
  const next = useCallback(() => {
    const { playlist, currentIndex } = state;
    if (playlist.length === 0) return;

    const nextIndex = (currentIndex + 1) % playlist.length;
    const nextTrack = playlist[nextIndex];

    if (!nextTrack) return;

    // Si crossfade activé
    if (crossfadeDuration > 0 && !isCrossfading.current) {
      isCrossfading.current = true;
      const currentHowl = currentHowlRef.current;
      const nextHowl = createHowl(nextTrack);

      if (currentHowl) {
        // Fade out de la piste actuelle
        currentHowl.fade(state.volume, 0, crossfadeDuration);
        setTimeout(() => {
          currentHowl.stop();
        }, crossfadeDuration);
      }

      // Fade in de la nouvelle piste
      nextHowl.volume(0);
      nextHowl.play();
      nextHowl.fade(0, state.volume, crossfadeDuration);

      currentHowlRef.current = nextHowl;
      isCrossfading.current = false;
    } else {
      // Transition normale
      if (currentHowlRef.current) {
        currentHowlRef.current.stop();
      }
      setState((prev) => ({ ...prev, currentIndex: nextIndex }));
      setTimeout(() => play(), 100);
      return;
    }

    setState((prev) => ({
      ...prev,
      currentIndex: nextIndex,
      currentTrack: nextTrack,
      nextTrack: playlist[(nextIndex + 1) % playlist.length],
    }));

    // Précharger les prochaines pistes
    preloadTracks(nextIndex);

    // Enregistrer l'écoute
    fetch("/api/radio/play", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trackId: nextTrack.id }),
    }).catch(console.error);
  }, [state, createHowl, crossfadeDuration, play, preloadTracks]);

  /**
   * Passe à la piste précédente
   */
  const previous = useCallback(() => {
    const { playlist, currentIndex } = state;
    if (playlist.length === 0) return;

    const prevIndex = currentIndex === 0 ? playlist.length - 1 : currentIndex - 1;

    setState((prev) => ({ ...prev, currentIndex: prevIndex }));
    setTimeout(() => play(), 100);
  }, [state, play]);

  /**
   * Change le volume
   */
  const setVolume = useCallback((newVolume: number) => {
    const vol = Math.max(0, Math.min(1, newVolume));
    
    if (currentHowlRef.current) {
      currentHowlRef.current.volume(vol);
    }

    setState((prev) => ({ ...prev, volume: vol, isMuted: vol === 0 }));
  }, []);

  /**
   * Toggle mute
   */
  const toggleMute = useCallback(() => {
    const newMuted = !state.isMuted;

    if (currentHowlRef.current) {
      currentHowlRef.current.volume(newMuted ? 0 : state.volume);
    }

    setState((prev) => ({ ...prev, isMuted: newMuted }));
  }, [state]);

  /**
   * Charge la playlist au montage du composant
   */
  useEffect(() => {
    loadPlaylist();

    return () => {
      // Nettoyage
      if (currentHowlRef.current) {
        currentHowlRef.current.unload();
      }
      preloadedHowls.current.forEach((howl) => howl.unload());
      preloadedHowls.current.clear();
    };
  }, [loadPlaylist]);

  return {
    ...state,
    play,
    pause,
    resume,
    togglePlay,
    next,
    previous,
    setVolume,
    toggleMute,
    loadPlaylist,
  };
}
