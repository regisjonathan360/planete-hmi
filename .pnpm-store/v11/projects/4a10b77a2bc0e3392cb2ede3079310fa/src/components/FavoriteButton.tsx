"use client";

import { useState } from "react";

/**
 * Bouton ♥ pour ajouter/retirer un artiste des favoris.
 * Si non connecté, redirige vers /connexion.
 */
export function FavoriteButton({ artistId, initialFavorited = false }: { artistId: string; initialFavorited?: boolean }) {
  const [favorited, setFavorited] = useState(initialFavorited);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    try {
      const method = favorited ? "DELETE" : "POST";
      const res = await fetch("/api/favorites", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ artistId }),
      });
      if (res.status === 401) {
        window.location.href = `/connexion?next=${window.location.pathname}`;
        return;
      }
      if (res.ok) setFavorited(!favorited);
    } catch {}
    finally { setBusy(false); }
  }

  return (
    <button
      type="button"
      className={`fav-btn${favorited ? " is-fav" : ""}`}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggle(); }}
      disabled={busy}
      aria-label={favorited ? "Retirer des favoris" : "Ajouter aux favoris"}
      title={favorited ? "Retirer des favoris" : "Ajouter aux favoris"}
    >
      {favorited ? "♥" : "♡"}
    </button>
  );
}
