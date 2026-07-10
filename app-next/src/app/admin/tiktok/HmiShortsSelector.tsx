"use client";

import { useState, useEffect, useCallback } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FeaturedShort {
  id: string;
  video_id: string;
  music_id: string;
  display_order: number;
  selected_at: string;
  tiktok_videos: {
    video_id: string;
    username: string;
    music_id: string;
  } | null;
  tiktok_sounds: {
    sound_title: string;
    sound_author: string | null;
    validation_status: string;
  } | null;
}

interface SearchResult {
  video_id: string;
  username: string;
  music_id: string;
  view_count: number;
  tiktok_sounds: {
    sound_title: string;
    sound_author: string | null;
    validation_status: string;
  } | null;
}

const MAX_SHORTS = 10;

// ---------------------------------------------------------------------------
// Composant principal
// ---------------------------------------------------------------------------

export function HmiShortsSelector() {
  const [shorts, setShorts] = useState<FeaturedShort[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Recherche
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ message: string; error?: boolean } | null>(null);

  function notify(message: string, isError = false) {
    setToast({ message, error: isError });
    setTimeout(() => setToast(null), 4000);
  }

  // --- Charger les shorts featured ---
  const loadShorts = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/tiktok/shorts");
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erreur lors du chargement.");
        return;
      }
      setShorts(data.shorts ?? []);
      setError(null);
    } catch {
      setError("Erreur de connexion au serveur.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadShorts();
  }, [loadShorts]);

  // --- Recherche de vidéos (sons validés uniquement) ---
  async function handleSearch() {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setSearchResults([]);
    try {
      const res = await fetch(
        `/api/admin/tiktok/shorts?search=${encodeURIComponent(searchQuery.trim())}`
      );
      const data = await res.json();
      if (!res.ok) {
        notify(data.error ?? "Erreur lors de la recherche.", true);
        return;
      }
      setSearchResults(data.results ?? []);
      if ((data.results ?? []).length === 0) {
        notify("Aucune vidéo trouvée avec un son validé.");
      }
    } catch {
      notify("Erreur de connexion au serveur.", true);
    } finally {
      setSearching(false);
    }
  }

  // --- Ajouter une vidéo ---
  async function handleAdd(video: SearchResult) {
    if (shorts.length >= MAX_SHORTS) {
      notify(`Maximum ${MAX_SHORTS} vidéos atteint.`, true);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/admin/tiktok/shorts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add",
          video_id: video.video_id,
          music_id: video.music_id,
          display_order: shorts.length + 1,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        notify(data.error ?? "Erreur lors de l'ajout.", true);
        return;
      }
      notify("Vidéo ajoutée.");
      await loadShorts();
      // Retirer des résultats de recherche
      setSearchResults((prev) => prev.filter((r) => r.video_id !== video.video_id));
    } catch {
      notify("Erreur de connexion.", true);
    } finally {
      setBusy(false);
    }
  }

  // --- Retirer une vidéo ---
  async function handleRemove(videoId: string) {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/tiktok/shorts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "remove", video_id: videoId }),
      });
      const data = await res.json();
      if (!res.ok) {
        notify(data.error ?? "Erreur lors du retrait.", true);
        return;
      }
      notify("Vidéo retirée.");
      await loadShorts();
    } catch {
      notify("Erreur de connexion.", true);
    } finally {
      setBusy(false);
    }
  }

  // --- Vérifier si une vidéo est déjà sélectionnée ---
  function isAlreadySelected(videoId: string): boolean {
    return shorts.some((s) => s.video_id === videoId);
  }

  // --- Rendu ---
  if (loading) {
    return <p style={{ color: "var(--admin-muted)" }}>Chargement des HMI Shorts…</p>;
  }

  if (error) {
    return <p style={{ color: "var(--admin-danger, #e74c3c)" }}>{error}</p>;
  }

  return (
    <div style={{ marginTop: "1rem" }}>
      {/* Compteur */}
      <div style={{ marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.8rem" }}>
        <h3 style={{ margin: 0, fontSize: "1rem" }}>HMI Shorts — Vidéos en vedette</h3>
        <span
          className="badge"
          style={{
            background:
              shorts.length >= MAX_SHORTS ? "var(--admin-danger, #e74c3c)" : "var(--admin-ok, #27ae60)",
            color: "#fff",
            padding: "0.25rem 0.6rem",
            borderRadius: "4px",
            fontSize: "0.82rem",
          }}
        >
          {shorts.length} / {MAX_SHORTS} sélectionnées
        </span>
      </div>

      {/* Liste des vidéos sélectionnées */}
      {shorts.length === 0 ? (
        <p style={{ color: "var(--admin-muted)", fontSize: "0.9rem" }}>
          Aucune vidéo sélectionnée. Utilisez la recherche ci-dessous pour ajouter des vidéos.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "1.5rem" }}>
          {shorts.map((short) => (
            <div
              key={short.id}
              className="entry"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.8rem",
                padding: "0.6rem 0.8rem",
                borderRadius: "8px",
                background: "var(--admin-card-bg, #1a1a2e)",
                border: "1px solid var(--admin-border, #2d2d44)",
              }}
            >
              <div className="entry__pos" style={{ minWidth: "2rem", textAlign: "center" }}>
                {short.display_order}
              </div>
              <div className="entry__meta" style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>
                  {short.tiktok_sounds?.sound_title ?? "Son inconnu"}
                </div>
                <div style={{ color: "var(--admin-muted)", fontSize: "0.8rem" }}>
                  @{short.tiktok_videos?.username ?? "—"} · ID: {short.video_id}
                </div>
              </div>
              <button
                type="button"
                className="btn btn--sm btn--danger"
                disabled={busy}
                onClick={() => handleRemove(short.video_id)}
              >
                Retirer
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Recherche */}
      <div
        style={{
          borderTop: "1px solid var(--admin-border, #2d2d44)",
          paddingTop: "1rem",
        }}
      >
        <h4 style={{ margin: "0 0 0.6rem 0", fontSize: "0.95rem" }}>
          Rechercher des vidéos (sons validés uniquement)
        </h4>
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.8rem" }}>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSearch();
            }}
            placeholder="Rechercher par username, video_id ou titre du son…"
            style={{
              flex: 1,
              padding: "0.55rem 0.8rem",
              borderRadius: "8px",
              border: "1px solid var(--admin-border, #2d2d44)",
              background: "var(--admin-bg, #0f0f1a)",
              color: "var(--admin-text, #e0e0e0)",
              fontSize: "0.9rem",
            }}
          />
          <button
            type="button"
            className="btn btn--primary btn--sm"
            onClick={handleSearch}
            disabled={searching || !searchQuery.trim()}
          >
            {searching ? "Recherche…" : "Rechercher"}
          </button>
        </div>

        {/* Résultats de recherche */}
        {searchResults.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
            {searchResults.map((result) => {
              const alreadySelected = isAlreadySelected(result.video_id);
              return (
                <div
                  key={result.video_id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.8rem",
                    padding: "0.5rem 0.8rem",
                    borderRadius: "8px",
                    background: "var(--admin-card-bg, #1a1a2e)",
                    border: "1px solid var(--admin-border, #2d2d44)",
                    opacity: alreadySelected ? 0.5 : 1,
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: "0.88rem" }}>
                      {result.tiktok_sounds?.sound_title ?? "Son inconnu"}
                    </div>
                    <div style={{ color: "var(--admin-muted)", fontSize: "0.78rem" }}>
                      @{result.username} · ID: {result.video_id} · {result.view_count.toLocaleString("fr-FR")} vues
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn--sm btn--ok"
                    disabled={busy || alreadySelected || shorts.length >= MAX_SHORTS}
                    onClick={() => handleAdd(result)}
                  >
                    {alreadySelected ? "Déjà sélectionnée" : "Ajouter"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Toast interne */}
      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: "1.5rem",
            right: "1.5rem",
            padding: "0.7rem 1.2rem",
            borderRadius: "8px",
            background: toast.error ? "var(--admin-danger, #e74c3c)" : "var(--admin-ok, #27ae60)",
            color: "#fff",
            fontSize: "0.88rem",
            zIndex: 9999,
            boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
          }}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}
