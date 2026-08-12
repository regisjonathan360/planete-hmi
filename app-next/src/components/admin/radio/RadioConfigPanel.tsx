/**
 * Panel de configuration de la radio
 * Permet de choisir la playlist active, le mode auto-chart, etc.
 */
"use client";

import { useState } from "react";
import type { RadioConfig, RadioPlaylist } from "@/lib/radio/types";
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
  const [formData, setFormData] = useState({
    active_playlist_id: config?.active_playlist_id || "",
    auto_switch_to_chart: config?.auto_switch_to_chart || false,
    chart_source_key: config?.chart_source_key || "",
    preload_count: config?.preload_count || 3,
    crossfade_duration_ms: config?.crossfade_duration_ms || 2000,
    is_live: config?.is_live ?? true,
  });

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
        <form onSubmit={handleSubmit} className={styles.form}>
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

          {/* Mode de la radio */}
          <div className={styles.formGroup}>
            <label className={styles.label}>
              Mode de diffusion
            </label>
            <div className={styles.radioGroup}>
              <label className={styles.radioLabel}>
                <input
                  type="radio"
                  name="mode"
                  checked={!formData.auto_switch_to_chart}
                  onChange={() =>
                    setFormData({ ...formData, auto_switch_to_chart: false })
                  }
                />
                <span>Playlist manuelle</span>
              </label>
              <label className={styles.radioLabel}>
                <input
                  type="radio"
                  name="mode"
                  checked={formData.auto_switch_to_chart}
                  onChange={() =>
                    setFormData({ ...formData, auto_switch_to_chart: true })
                  }
                />
                <span>Auto-chart (classement)</span>
              </label>
            </div>
          </div>

          {/* Playlist active (si mode manuel) */}
          {!formData.auto_switch_to_chart && (
            <div className={styles.formGroup}>
              <label htmlFor="playlist" className={styles.label}>
                Playlist active
              </label>
              <select
                id="playlist"
                value={formData.active_playlist_id}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    active_playlist_id: e.target.value,
                  })
                }
                className={styles.select}
              >
                <option value="">-- Sélectionner une playlist --</option>
                {playlists.map((playlist) => (
                  <option key={playlist.id} value={playlist.id}>
                    {playlist.name} ({playlist.track_count || 0} pistes)
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Clé du classement (si mode auto-chart) */}
          {formData.auto_switch_to_chart && (
            <div className={styles.formGroup}>
              <label htmlFor="chart" className={styles.label}>
                Classement à diffuser
              </label>
              <input
                id="chart"
                type="text"
                value={formData.chart_source_key}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    chart_source_key: e.target.value,
                  })
                }
                placeholder="Ex: youtube-week, audiomack-top"
                className={styles.input}
              />
              <p className={styles.hint}>
                Entrez la clé source_key du classement à diffuser
              </p>
            </div>
          )}

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
              Plus de pistes = transitions fluides, mais plus de bande passante
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
              0 = transition instantanée, 2000 = 2 secondes de fondu enchaîné
            </p>
          </div>

          {/* Boutons d'action */}
          <div className={styles.actions}>
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className={styles.cancelButton}
              disabled={isSaving}
            >
              Annuler
            </button>
            <button
              type="submit"
              className={styles.saveButton}
              disabled={isSaving}
            >
              {isSaving ? "Enregistrement..." : "Enregistrer"}
            </button>
          </div>
        </form>
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
