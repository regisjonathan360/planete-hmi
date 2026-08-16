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
      setState((previous) => ({ ...previous, isPlaying: false, error: `Impossible de lire « ${track.title} »` }));
      window.setTimeout(() => nextRef.current(), 250);
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
          previousAudio.volume = snapshot.volume * (1 - progress);
          audio.volume = snapshot.volume * progress;
          if (progress < 1) requestAnimationFrame(fade);
          else previousAudio.pause();
        };
        requestAnimationFrame(fade);
      }
    } catch {
      setState((previous) => ({ ...previous, isPlaying: false, error: "Cliquez sur lecture pour autoriser le son" }));
    }
  }, [getAudio, recordPlay, syncPreloadWindow]);

  const next = useCallback(() => {
    const snapshot = stateRef.current;
    if (snapshot.playlist.length) void playIndex((snapshot.currentIndex + 1) % snapshot.playlist.length);
  }, [playIndex]);
  useEffect(() => { nextRef.current = next; }, [next]);

  const loadPlaylist = useCallback(async () => {
    try {
      setState((previous) => ({ ...previous, isLoading: true, error: undefined }));
      const url = sourceId && sourceType ? `/api/admin/radio/source-tracks?${new URLSearchParams({ [`${sourceType}Id`]: sourceId })}` : "/api/radio/playlist";
      const response = await fetch(url);
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
    } catch {
      setState((previous) => ({ ...previous, isLoading: false, error: "Impossible de charger la playlist radio" }));
    }
  }, [autoPlay, initialPreloadCount, playIndex, sourceId, sourceType, syncPreloadWindow]);

  const pause = useCallback(() => { radioRuntime.currentAudio?.pause(); setState((previous) => ({ ...previous, isPlaying: false })); }, []);
  const resume = useCallback(() => { void radioRuntime.currentAudio?.play().then(() => setState((previous) => ({ ...previous, isPlaying: true }))).catch(() => undefined); }, []);
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
