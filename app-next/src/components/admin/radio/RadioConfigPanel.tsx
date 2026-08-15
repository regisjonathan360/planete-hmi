/**
 * Panel de configuration de la radio
 * Permet de choisir entre classements et sources de collecte
 */
"use client";

import { useState, useEffect } from "react";
import { AvailableSourcesSelector } from "./AvailableSourcesSelector";
import type { RadioConfig, RadioPlaylist, RadioTrack } from "@/lib/radio/types";
import { normalizePlaylistTrackCount } from "@/lib/radio/types";
import styles from "./RadioConfigPanel.module.css";

interface RadioConfigPanelProps {
  config: RadioConfig | null;
  playlists: RadioPlaylist[];
  onConfigUpdate: (config: RadioConfig) => void;
}

export function RadioConfigPanel({
  config,
  playlists,
  onConfigUpdate,
}: RadioConfigPanelProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedSourceId, setSelectedSourceId] = useState("");
  const [selectedSourceType, setSelectedSourceType] = useState<"chart" | "playlist" | "">(
    ""
  );
  const [sourcePreview, setSourcePreview] = useState<{
    name: string;
    tracks: RadioTrack[];
    isLoading: boolean;
  } | null>(null);

  const [formData, setFormData] = useState({
    active_playlist_id: config?.active_playlist_id || "",
    auto_switch_to_chart: config?.auto_switch_to_chart || false,
    chart_source_key: config?.chart_source_key || "",
    preload_count: config?.preload_count || 3,
    crossfade_duration_ms: config?.crossfade_duration_ms || 2000,
    is_live: config?.is_live ?? true,
  });

  /**
   * Charge les pistes d'une source sélectionnée
   */
  const handleSourceChange = async (
    sourceId: string,
    sourceType: "chart" | "playlist"
  ) => {
    setSelectedSourceId(sourceId);
    setSelectedSourceType(sourceType);
    setSourcePreview({ name: "", tracks: [], isLoading: true });

    try {
      const params = new URLSearchParams();
      if (sourceType === "chart") {
        params.append("chartId", sourceId);
      } else {
        params.append("playlistId", sourceId);
      }

      const response = await fetch(`/api/admin/radio/source-tracks?${params}`);
      if (!response.ok) throw new Error("Erreur de chargement");

      const data = await response.json();
      setSourcePreview({
        name: data.source_name,
        tracks: data.tracks || [],
        isLoading: false,
      });
    } catch (error) {
      console.error("Erreur de chargement:", error);
      setSourcePreview({
        name: "Erreur de chargement",
        tracks: [],
        isLoading: false,
      });
    }
  };

  /**
   * Applique la source sélectionnée comme source radio
   */
  const applySource = async () => {
    if (!selectedSourceId || !selectedSourceType) return;

    setIsSaving(true);

    try {
      const updateData = {
        ...formData,
        chart_source_key: selectedSourceType === "chart" ? selectedSourceId : "",
        active_playlist_id:
          selectedSourceType === "playlist" ? selectedSourceId : "",
        auto_switch_to_chart: selectedSourceType === "chart",
      };

      const response = await fetch("/api/admin/radio/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) throw new Error("Erreur lors de la mise à jour");

      const updatedConfig = await response.json();
      onConfigUpdate(updatedConfig);
      setFormData(updateData);
      alert(
        `✅ Radio configurée avec: ${sourcePreview?.name}`
      );
    } catch (error) {
      console.error("Erreur:", error);
      alert("Erreur lors de la mise à jour de la configuration");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const response = await fetch("/api/admin/radio/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error("Erreur lors de la mise à jour");
      }

      const updatedConfig = await response.json();
      onConfigUpdate(updatedConfig);
      setIsEditing(false);
    } catch (error) {
      console.error("Error updating config:", error);
      alert("Erreur lors de la mise à jour de la configuration");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <h2>Configuration de la Radio</h2>
        {!isEditing && (
          <button
            className={styles.editButton}
            onClick={() => setIsEditing(true)}
          >
            ✏️ Modifier
          </button>
        )}
      </div>

      {!config ? (
        <div className={styles.empty}>
          <p>Aucune configuration trouvée</p>
          <button
            className={styles.createButton}
            onClick={() => setIsEditing(true)}
          >
            Créer la configuration
          </button>
        </div>
      ) : isEditing ? (
        <div className={styles.form}>
          {/* Section 1 : Sélectionner une source */}
          <div className={styles.formSection}>
            <h3>📻 Sélectionner la source radio</h3>
            <p className={styles.hint}>
              Choisissez un classement ou une playlist pour alimenter la radio
            </p>

            <AvailableSourcesSelector
              onSelectChart={(id) => handleSourceChange(id, "chart")}
              onSelectSource={(id) => handleSourceChange(id, "playlist")}
            />

            {/* Preview des pistes */}
            {sourcePreview && (
              <div className={styles.sourcePreview}>
                <h4>{sourcePreview.name}</h4>
                {sourcePreview.isLoading ? (
                  <p>Chargement des pistes...</p>
                ) : sourcePreview.tracks.length > 0 ? (
                  <>
                    <p className={styles.trackCount}>
                      ✅ {sourcePreview.tracks.length} piste
                      {sourcePreview.tracks.length > 1 ? "s" : ""} trouvée
                      {sourcePreview.tracks.length > 1 ? "s" : ""}
                    </p>

                    <div className={styles.trackList}>
                      {sourcePreview.tracks.slice(0, 5).map((track, idx) => (
                        <div key={track.id} className={styles.trackItem}>
                          <span className={styles.trackNumber}>{idx + 1}.</span>
                          <span className={styles.trackName}>
                            {track.title}
                          </span>
                          <span className={styles.trackArtist}>
                            {track.artist_name}
                          </span>
                        </div>
                      ))}
                      {sourcePreview.tracks.length > 5 && (
                        <p className={styles.more}>
                          ... et {sourcePreview.tracks.length - 5} autre(s)
                        </p>
                      )}
                    </div>

                    <button
                      type="button"
                      className={styles.applyButton}
                      onClick={applySource}
                      disabled={isSaving}
                    >
                      {isSaving
                        ? "Application..."
                        : "✅ Appliquer cette source"}
                    </button>
                  </>
                ) : (
                  <p className={styles.emptyTracks}>
                    Aucune piste trouvée pour cette source
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Section 2 : Paramètres avancés */}
          <div className={styles.formSection}>
            <h3>⚙️ Paramètres avancés</h3>

            {/* État de la radio */}
            <div className={styles.formGroup}>
              <label className={styles.label}>
                <input
                  type="checkbox"
                  checked={formData.is_live}
                  onChange={(e) =>
                    setFormData({ ...formData, is_live: e.target.checked })
                  }
                />
                <span>Radio en direct (LIVE)</span>
              </label>
            </div>

            {/* Nombre de pistes à précharger */}
            <div className={styles.formGroup}>
              <label htmlFor="preload" className={styles.label}>
                Pistes à précharger
              </label>
              <input
                id="preload"
                type="number"
                min="1"
                max="10"
                value={formData.preload_count}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    preload_count: parseInt(e.target.value, 10),
                  })
                }
                className={styles.input}
              />
              <p className={styles.hint}>
                Plus de pistes = transitions fluides
              </p>
            </div>

            {/* Durée du crossfade */}
            <div className={styles.formGroup}>
              <label htmlFor="crossfade" className={styles.label}>
                Durée du crossfade (ms)
              </label>
              <input
                id="crossfade"
                type="number"
                min="0"
                max="10000"
                step="100"
                value={formData.crossfade_duration_ms}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    crossfade_duration_ms: parseInt(e.target.value, 10),
                  })
                }
                className={styles.input}
              />
              <p className={styles.hint}>
                0 = sans fondu, 2000 = 2 secondes
              </p>
            </div>
          </div>

          {/* Boutons d'action */}
          <div className={styles.actions}>
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className={styles.cancelButton}
              disabled={isSaving}
            >
              Fermer
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              className={styles.saveButton}
              disabled={isSaving}
            >
              {isSaving ? "Enregistrement..." : "💾 Enregistrer"}
            </button>
          </div>
        </div>
      ) : (
        <div className={styles.summary}>
          <div className={styles.summaryItem}>
            <span className={styles.summaryLabel}>État</span>
            <span className={styles.summaryValue}>
              {config.is_live ? (
                <span className={styles.live}>🔴 EN DIRECT</span>
              ) : (
                <span className={styles.offline}>⚫ Hors ligne</span>
              )}
            </span>
          </div>

          <div className={styles.summaryItem}>
            <span className={styles.summaryLabel}>Mode</span>
            <span className={styles.summaryValue}>
              {config.auto_switch_to_chart
                ? `🎯 Auto-chart: ${config.chart_source_key}`
                : "📋 Playlist manuelle"}
            </span>
          </div>

          {!config.auto_switch_to_chart && config.active_playlist_id && (
            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>Playlist active</span>
              <span className={styles.summaryValue}>
                {playlists.find((p) => p.id === config.active_playlist_id)
                  ?.name || "Non trouvée"}
              </span>
            </div>
          )}

          <div className={styles.summaryItem}>
            <span className={styles.summaryLabel}>Préchargement</span>
            <span className={styles.summaryValue}>
              {config.preload_count} piste{config.preload_count > 1 ? "s" : ""}
            </span>
          </div>

          <div className={styles.summaryItem}>
            <span className={styles.summaryLabel}>Crossfade</span>
            <span className={styles.summaryValue}>
              {config.crossfade_duration_ms}ms
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

