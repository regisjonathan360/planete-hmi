"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ArtistCreateForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("Le nom est requis."); return; }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/artistes/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Erreur."); return; }
      // Rediriger vers la page d'édition du nouvel artiste
      router.push(`/admin/artistes/${json.id}`);
    } catch { setError("Erreur réseau."); }
    finally { setSaving(false); }
  }

  return (
    <form onSubmit={handleSubmit} className="admin-card" style={{ maxWidth: 500 }}>
      <label style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
        <span style={{ fontWeight: 600, fontSize: "0.88rem" }}>Nom de l&apos;artiste</span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex: Teddy Hashtag"
          required
          style={{
            background: "var(--admin-bg)", border: "1px solid var(--admin-border)",
            color: "var(--admin-text)", padding: "0.6rem 0.8rem", borderRadius: "8px", fontSize: "0.9rem",
          }}
        />
      </label>
      {error && <p style={{ color: "var(--admin-danger)", fontSize: "0.85rem", marginTop: "0.5rem" }}>{error}</p>}
      <button type="submit" className="btn btn--primary" disabled={saving} style={{ marginTop: "1rem" }}>
        {saving ? "Création…" : "Créer et continuer vers l'édition"}
      </button>
    </form>
  );
}
