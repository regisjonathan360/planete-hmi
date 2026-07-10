"use client";

import { useState, useEffect, useCallback } from "react";

interface PendingSound {
  music_id: string;
  sound_title: string;
  sound_author: string | null;
  total_videos: number;
  score: number;
  validation_status: string;
  first_seen_at: string;
}

/**
 * File de validation des sons TikTok.
 * Affiche les sons avec status "a_verifier" et permet de les valider ou refuser.
 *
 * Requirements: 4.2, 4.3, 4.4, 4.5, 4.6
 */
export function ValidationQueue() {
  const [sounds, setSounds] = useState<PendingSound[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const fetchPendingSounds = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/tiktok/sounds?status=a_verifier");
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(json.error ?? "Erreur lors du chargement des sons.");
        return;
      }
      const json = await res.json();
      setSounds(json.sounds ?? []);
    } catch {
      setError("Erreur de connexion au serveur.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPendingSounds();
  }, [fetchPendingSounds]);

  async function handleValidate(musicId: string, status: "valide" | "refuse") {
    setBusyId(musicId);
    try {
      const res = await fetch("/api/admin/tiktok/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ music_id: musicId, status }),
      });
      if (res.ok) {
        setSounds((prev) => prev.filter((s) => s.music_id !== musicId));
      } else {
        const json = await res.json().catch(() => ({}));
        alert(json.error ?? "Erreur lors de la validation.");
      }
    } catch {
      alert("Erreur de connexion au serveur.");
    } finally {
      setBusyId(null);
    }
  }

  function formatScore(score: number): string {
    return score.toFixed(2);
  }

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString("fr-FR");
  }

  // --- État vide ---
  if (loading) {
    return (
      <div style={{ padding: "1.5rem", textAlign: "center", color: "var(--admin-muted)" }}>
        Chargement des sons à valider…
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: "1rem" }}>
        <div className="banner">{error}</div>
        <button type="button" className="btn btn--primary" onClick={fetchPendingSounds}>
          Réessayer
        </button>
      </div>
    );
  }

  if (sounds.length === 0) {
    return (
      <div style={{ padding: "1.5rem", textAlign: "center", color: "var(--admin-muted)" }}>
        ✓ Aucun son en attente de validation.
      </div>
    );
  }

  // --- Liste des sons à valider ---
  return (
    <div>
      <p style={{ color: "var(--admin-muted)", fontSize: "0.85rem", marginBottom: "0.75rem" }}>
        {sounds.length} son{sounds.length > 1 ? "s" : ""} en attente de validation
      </p>

      <div className="entry-list">
        {sounds.map((sound) => (
          <div key={sound.music_id} className="entry">
            {/* Position → on affiche un icône d'attente */}
            <div className="entry__pos" style={{ color: "var(--admin-warn)" }}>⏳</div>

            {/* Infos du son */}
            <div className="entry__meta" style={{ gridColumn: "2 / 4" }}>
              <div className="entry__title">{sound.sound_title}</div>
              <div className="entry__artist">
                {sound.sound_author ?? "Artiste inconnu"}
                <span style={{ marginLeft: "0.5rem", color: "var(--admin-muted)", fontSize: "0.8rem" }}>
                  · {sound.total_videos} publication{sound.total_videos > 1 ? "s" : ""}
                  · Score : {formatScore(sound.score)}
                  · Détecté le {formatDate(sound.first_seen_at)}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="entry__actions">
              <button
                type="button"
                className="btn btn--ok btn--sm"
                disabled={busyId === sound.music_id}
                onClick={() => handleValidate(sound.music_id, "valide")}
                title="Valider ce son pour les classements"
              >
                ✓ Valider
              </button>
              <button
                type="button"
                className="btn btn--danger btn--sm"
                disabled={busyId === sound.music_id}
                onClick={() => handleValidate(sound.music_id, "refuse")}
                title="Refuser ce son — ne sera pas inclus dans les classements"
              >
                ✗ Refuser
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
