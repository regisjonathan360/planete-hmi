/**
 * Dashboard d'administration de la radio
 * Interface complète pour gérer toutes les fonctionnalités radio
 */
"use client";

import { useState } from "react";
import type {
  RadioPlaylist,
  RadioTrack,
  RadioConfig,
  RadioStats,
} from "@/lib/radio/types";
import styles from "./RadioAdminDashboard.module.css";
import { PlaylistManager } from "./PlaylistManager";
import { TrackManager } from "./TrackManager";
import { RadioConfigPanel } from "./RadioConfigPanel";
import { RadioStatsPanel } from "./RadioStatsPanel";

interface RadioAdminDashboardProps {
  initialPlaylists: RadioPlaylist[];
  initialTracks: RadioTrack[];
  initialConfig: RadioConfig | null;
  initialStats: RadioStats | null;
  adminEmail: string;
}

type TabType = "playlists" | "tracks" | "config" | "stats";

export function RadioAdminDashboard({
  initialPlaylists,
  initialTracks,
  initialConfig,
  initialStats,
  adminEmail,
}: RadioAdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<TabType>("config");
  const [playlists, setPlaylists] = useState(initialPlaylists);
  const [tracks, setTracks] = useState(initialTracks);
  const [config, setConfig] = useState(initialConfig);
  const [stats, setStats] = useState(initialStats);

  const tabs: { id: TabType; label: string; icon: string }[] = [
    { id: "config", label: "Configuration", icon: "⚙️" },
    { id: "playlists", label: "Playlists", icon: "📋" },
    { id: "tracks", label: "Pistes", icon: "🎵" },
    { id: "stats", label: "Statistiques", icon: "📊" },
  ];

  return (
    <div className={styles.dashboard}>
      {/* Navigation par onglets */}
      <div className={styles.tabs}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`${styles.tab} ${
              activeTab === tab.id ? styles.activeTab : ""
            }`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className={styles.tabIcon}>{tab.icon}</span>
            <span className={styles.tabLabel}>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Contenu de l'onglet actif */}
      <div className={styles.content}>
        {activeTab === "config" && (
          <RadioConfigPanel
            config={config}
            playlists={playlists}
            onConfigUpdate={setConfig}
          />
        )}

        {activeTab === "playlists" && (
          <PlaylistManager
            playlists={playlists}
            tracks={tracks}
            onPlaylistsUpdate={setPlaylists}
          />
        )}

        {activeTab === "tracks" && (
          <TrackManager
            tracks={tracks}
            onTracksUpdate={setTracks}
          />
        )}

        {activeTab === "stats" && (
          <RadioStatsPanel stats={stats} />
        )}
      </div>
    </div>
  );
}
