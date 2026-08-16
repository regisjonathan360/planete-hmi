"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RadioPlayerState, RadioTrack } from "./types";

interface UseRadioPlayerOptions {
  autoPlay?: boolean;
  volume?: number;
  preloadCount?: number;
  crossfadeDuration?: number;
  sourceId?: string;
  sourceType?: "chart" | "playlist";
}

type BufferedAudio = HTMLAudioElement & { __radioHandlersAttached?: boolean };

const RADIO_SESSION_KEY = "planete-hmi:radio-session:v2";

const radioRuntime: {
  audioCache: Map<string, BufferedAudio>;
  currentAudio: BufferedAudio | null;
  currentTrackId?: string;
  pendingPosition?: { trackId: string; position: number };
  playRequest: number;
} = {
  audioCache: new Map(),
  currentAudio: null,
  playRequest: 0,
};

interface PersistedRadioSession {
  trackId?: string;
  position?: number;
  isPlaying?: boolean;
  volume?: number;
  isMuted?: boolean;
}

function readRadioSession(): PersistedRadioSession | undefined {
  try {
    const raw = window.sessionStorage.getItem(RADIO_SESSION_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as PersistedRadioSession;
    return parsed && typeof parsed === "object" ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function writeRadioSession(state: RadioPlayerState) {
  if (!state.currentTrack) return;
  try {
    window.sessionStorage.setItem(
      RADIO_SESSION_KEY,
      JSON.stringify({
        trackId: state.currentTrack.id,
        position: radioRuntime.currentAudio?.currentTime ?? 0,
        isPlaying: state.isPlaying,
        volume: state.volume,
        isMuted: state.isMuted,
      } satisfies PersistedRadioSession),
    );
  } catch {
    // Storage can be disabled by privacy settings; playback still works.
  }
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function isPlayableAudioUrl(url?: string) {
  if (!url) return false;
  try {
    const parsed = new URL(url, window.location.href);
    const path = parsed.pathname.toLowerCase();
    const isAllowedProtocol = ["http:", "https:", "blob:", "data:"].includes(parsed.protocol);
    const isPageUrl = /youtube\.com|youtu\.be|spotify\.com|audiomack\.com|deezer\.com/.test(parsed.hostname)
      || /\.(html?|php)(\?|$)/.test(path);
    return isAllowedProtocol && !isPageUrl;
  } catch {
    return false;
  }
}

export function useRadioPlayer(options: UseRadioPlayerOptions = {}) {
  const {
    autoPlay = false,
    volume: initialVolume = 0.7,
    preloadCount: initialPreloadCount = 3,
    crossfadeDuration: initialCrossfadeDuration = 0,
    sourceId,
    sourceType,
  } = options;
  const [state, setState] = useState<RadioPlayerState>({
    isPlaying: false, playlist: [], currentIndex: -1, volume: initialVolume,
    isMuted: false, preloadedTracks: new Set(), isLoading: true,
  });
  const stateRef = useRef(state);
  const preloadCount = useRef(clamp(initialPreloadCount, 1, 5));
  const crossfadeDuration = useRef(Math.max(0, initialCrossfadeDuration));
  const nextRef = useRef<() => void>(() => undefined);
  const recoverAudioRef = useRef<(trackId: string) => void>(() => undefined);
  const recoveryInFlight = useRef(new Set<string>());
  const recoveryAttempts = useRef(new Map<string, number>());
  useEffect(() => { stateRef.current = state; }, [state]);

  const getAudio = useCallback((track: RadioTrack) => {
    const cached = radioRuntime.audioCache.get(track.id);
    if (cached) return cached;
    const audio = new Audio() as BufferedAudio;
    audio.preload = "auto";
    audio.src = track.audio_url;
    radioRuntime.audioCache.set(track.id, audio);
    audio.load();
    return audio;
  }, []);

  const removeCachedAudio = useCallback((trackId: string) => {
    const audio = radioRuntime.audioCache.get(trackId);
    if (!audio) return;
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
    radioRuntime.audioCache.delete(trackId);
  }, []);

  const syncPreloadWindow = useCallback((index: number, tracks: RadioTrack[]) => {
    if (!tracks.length) return;
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
    const constrained = Boolean(connection?.saveData) || /slow-2g|2g/.test(connection?.effectiveType || "");
    const count = constrained ? 1 : preloadCount.current;
    const keep = new Set<string>();
    for (let offset = 0; offset <= count; offset += 1) {
      const track = tracks[(index + offset) % tracks.length];
      if (!track || !isPlayableAudioUrl(track.audio_url)) continue;
      keep.add(track.id);
      const cached = radioRuntime.audioCache.get(track.id);
      if (cached && cached.src !== new URL(track.audio_url, window.location.href).href) {
        removeCachedAudio(track.id);
      }
      getAudio(track);
    }
    for (const trackId of radioRuntime.audioCache.keys()) {
      if (!keep.has(trackId) && trackId !== tracks[index]?.id) removeCachedAudio(trackId);
    }
    setState((previous) => ({ ...previous, preloadedTracks: new Set([...keep].filter((id) => id !== tracks[index]?.id)) }));
  }, [getAudio, removeCachedAudio]);

  const recordPlay = useCallback((track: RadioTrack) => {
    void fetch("/api/radio/play", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ trackId: track.id }) }).catch(() => undefined);
  }, []);

  const playIndex = useCallback(async (index: number) => {
    const snapshot = stateRef.current;
    const tracks = snapshot.playlist;
    if (!tracks.length || index < 0 || index >= tracks.length) return;
    const track = tracks[index];
    if (!isPlayableAudioUrl(track.audio_url)) {
      setState((previous) => ({ ...previous, error: `Source audio non lisible : ${track.title}` }));
      return;
    }
    const requestId = ++radioRuntime.playRequest;
    const previousAudio = radioRuntime.currentAudio;
    const audio = getAudio(track);
    audio.volume = snapshot.isMuted ? 0 : snapshot.volume;
    const isResumingSameAudio = previousAudio === audio && radioRuntime.currentTrackId === track.id;
    const pendingPosition = radioRuntime.pendingPosition?.trackId === track.id
      ? radioRuntime.pendingPosition.position
      : undefined;
    if (!isResumingSameAudio) {
      audio.currentTime = pendingPosition && Number.isFinite(pendingPosition)
        ? Math.max(0, pendingPosition)
        : 0;
      radioRuntime.pendingPosition = undefined;
    }
    audio.onended = () => { if (requestId === radioRuntime.playRequest) nextRef.current(); };
    audio.onerror = () => {
      if (requestId !== radioRuntime.playRequest) return;
      recoverAudioRef.current(track.id);
    };
    const fadeDuration = Math.min(crossfadeDuration.current, 5000);
    const shouldCrossfade = Boolean(previousAudio && previousAudio !== audio && fadeDuration > 0 && !snapshot.isMuted);
    if (previousAudio && previousAudio !== audio && !shouldCrossfade) previousAudio.pause();
    if (shouldCrossfade) audio.volume = 0;
    try {
      await audio.play();
      if (requestId !== radioRuntime.playRequest) return;
      radioRuntime.currentAudio = audio;
      radioRuntime.currentTrackId = track.id;
      recoveryAttempts.current.delete(track.id);
      setState((previous) => ({ ...previous, isPlaying: true, currentIndex: index, currentTrack: track, nextTrack: tracks[(index + 1) % tracks.length], error: undefined }));
      syncPreloadWindow(index, tracks);
      recordPlay(track);
      if (shouldCrossfade && previousAudio) {
        const startedAt = performance.now();
        const fade = (now: number) => {
          if (requestId !== radioRuntime.playRequest) {
            previousAudio.pause();
            return;
          }
          const progress = Math.min(1, (now - startedAt) / fadeDuration);
          previousAudio.volume = clamp(snapshot.volume * (1 - progress), 0, 1);
          audio.volume = clamp(snapshot.volume * progress, 0, 1);
          if (progress < 1) requestAnimationFrame(fade);
          else previousAudio.pause();
        };
        requestAnimationFrame(fade);
      }
    } catch (playError: unknown) {
      const name = playError instanceof DOMException ? playError.name : "";
      if (name === "NotAllowedError" || name === "SecurityError") {
        setState((previous) => ({ ...previous, isPlaying: false, error: "Cliquez sur lecture pour autoriser le son" }));
      } else {
        recoverAudioRef.current(track.id);
      }
    }
  }, [getAudio, recordPlay, syncPreloadWindow]);

  const next = useCallback(() => {
    const snapshot = stateRef.current;
    if (snapshot.playlist.length) void playIndex((snapshot.currentIndex + 1) % snapshot.playlist.length);
  }, [playIndex]);
  useEffect(() => { nextRef.current = next; }, [next]);

  const loadPlaylist = useCallback(async (forceRefresh = false, refreshTrackId?: string): Promise<RadioTrack[]> => {
    try {
      setState((previous) => ({ ...previous, isLoading: true, error: undefined }));
      const refreshParams = new URLSearchParams();
      if (forceRefresh) refreshParams.set("refresh", "1");
      if (refreshTrackId) refreshParams.set("trackId", refreshTrackId);
      const refreshQuery = refreshParams.toString();
      const url = sourceId && sourceType
        ? `/api/admin/radio/source-tracks?${new URLSearchParams({ [`${sourceType}Id`]: sourceId })}`
        : `/api/radio/playlist${refreshQuery ? `?${refreshQuery}` : ""}`;
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) throw new Error("playlist");
      const data = await response.json();
      const rawTracks = data.tracks || [];
      const tracks = rawTracks.filter((track: RadioTrack) => isPlayableAudioUrl(track.audio_url));
      if (data.config) {
        preloadCount.current = clamp(Number(data.config.preload_count) || initialPreloadCount, 1, 5);
        crossfadeDuration.current = Math.max(0, Number(data.config.crossfade_duration_ms) || 0);
      }
      const session = readRadioSession();
      const preferredTrackId = radioRuntime.currentTrackId ?? session?.trackId;
      const restoredIndex = preferredTrackId
        ? tracks.findIndex((track: RadioTrack) => track.id === preferredTrackId)
        : -1;
      const currentIndex = restoredIndex >= 0 ? restoredIndex : (tracks.length ? 0 : -1);
      const hasRuntimeAudio = Boolean(
        radioRuntime.currentAudio &&
        radioRuntime.currentTrackId &&
        radioRuntime.currentTrackId === tracks[currentIndex]?.id,
      );
      if (
        !hasRuntimeAudio &&
        session?.trackId &&
        session.trackId === tracks[currentIndex]?.id &&
        Number.isFinite(session.position)
      ) {
        radioRuntime.pendingPosition = { trackId: session.trackId, position: Math.max(0, session.position ?? 0) };
      }
      setState((previous) => ({
        ...previous,
        playlist: tracks,
        currentIndex,
        currentTrack: tracks[currentIndex],
        nextTrack: tracks.length ? tracks[(currentIndex + 1) % tracks.length] : undefined,
        volume: session?.volume !== undefined ? clamp(session.volume, 0, 1) : previous.volume,
        isMuted: session?.isMuted ?? previous.isMuted,
        isPlaying: hasRuntimeAudio ? Boolean(radioRuntime.currentAudio && !radioRuntime.currentAudio.paused) : false,
        isLoading: false,
        error: rawTracks.length > 0 && tracks.length === 0
          ? "Cette playlist ne contient aucune source audio lisible. Ajoutez un fichier ou une URL audio directe."
          : undefined,
      }));
      if (tracks.length) syncPreloadWindow(currentIndex, tracks);
      if (autoPlay && tracks.length && !hasRuntimeAudio) window.setTimeout(() => void playIndex(currentIndex), 0);
      return tracks;
    } catch {
      setState((previous) => ({ ...previous, isLoading: false, error: "Impossible de charger la playlist radio" }));
      return [];
    }
  }, [autoPlay, initialPreloadCount, playIndex, sourceId, sourceType, syncPreloadWindow]);

  const recoverAudio = useCallback(async (trackId: string) => {
    if (recoveryInFlight.current.has(trackId)) return;

    const attempts = recoveryAttempts.current.get(trackId) || 0;
    if (attempts >= 1) {
      recoveryAttempts.current.delete(trackId);
      setState((previous) => ({
        ...previous,
        isPlaying: false,
        isLoading: false,
        error: `La piste « ${stateRef.current.currentTrack?.title || "en cours"} » est temporairement indisponible.`,
      }));
      window.setTimeout(() => nextRef.current(), 250);
      return;
    }

    recoveryAttempts.current.set(trackId, attempts + 1);
    recoveryInFlight.current.add(trackId);
    const cached = radioRuntime.audioCache.get(trackId);
    if (cached) removeCachedAudio(trackId);
    if (radioRuntime.currentTrackId === trackId) radioRuntime.currentAudio = null;
    setState((previous) => ({ ...previous, isPlaying: false, isLoading: true, error: undefined }));

    try {
      const refreshedTracks = await loadPlaylist(true, trackId);
      window.setTimeout(() => {
        const index = refreshedTracks.findIndex((track) => track.id === trackId);
        if (index >= 0) void playIndex(index);
        else nextRef.current();
      }, 50);
    } finally {
      recoveryInFlight.current.delete(trackId);
    }
  }, [loadPlaylist, playIndex, removeCachedAudio]);
  recoverAudioRef.current = (trackId) => { void recoverAudio(trackId); };

  const pause = useCallback(() => { radioRuntime.currentAudio?.pause(); setState((previous) => ({ ...previous, isPlaying: false })); }, []);
  const resume = useCallback(() => {
    const audio = radioRuntime.currentAudio;
    const trackId = radioRuntime.currentTrackId || stateRef.current.currentTrack?.id;
    if (!audio) {
      void playIndex(Math.max(0, stateRef.current.currentIndex));
      return;
    }
    void audio.play()
      .then(() => setState((previous) => ({ ...previous, isPlaying: true, error: undefined })))
      .catch((playError: unknown) => {
        const name = playError instanceof DOMException ? playError.name : "";
        if (name === "NotAllowedError" || name === "SecurityError") {
          setState((previous) => ({ ...previous, isPlaying: false, error: "Cliquez sur lecture pour autoriser le son" }));
        } else if (trackId) {
          recoverAudioRef.current(trackId);
        }
      });
  }, [playIndex]);
  const togglePlay = useCallback(() => { if (stateRef.current.isPlaying) pause(); else if (radioRuntime.currentAudio) resume(); else void playIndex(Math.max(0, stateRef.current.currentIndex)); }, [pause, playIndex, resume]);
  const previous = useCallback(() => { const snapshot = stateRef.current; if (snapshot.playlist.length) void playIndex((snapshot.currentIndex - 1 + snapshot.playlist.length) % snapshot.playlist.length); }, [playIndex]);
  const setVolume = useCallback((value: number) => { const nextVolume = clamp(value, 0, 1); if (radioRuntime.currentAudio) radioRuntime.currentAudio.volume = nextVolume; setState((previous) => ({ ...previous, volume: nextVolume, isMuted: nextVolume === 0 })); }, []);
  const toggleMute = useCallback(() => { const muted = !stateRef.current.isMuted; if (radioRuntime.currentAudio) radioRuntime.currentAudio.volume = muted ? 0 : stateRef.current.volume; setState((previous) => ({ ...previous, isMuted: muted })); }, []);
  useEffect(() => {
    void loadPlaylist();
    const persist = () => writeRadioSession(stateRef.current);
    const interval = window.setInterval(persist, 2000);
    window.addEventListener("pagehide", persist);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("pagehide", persist);
      // Do not stop or destroy the shared Audio elements when a client
      // component is remounted during navigation.
    };
  }, [loadPlaylist]);

  return { ...state, play: () => void playIndex(Math.max(0, stateRef.current.currentIndex)), pause, resume, togglePlay, next, previous, setVolume, toggleMute, loadPlaylist };
}
