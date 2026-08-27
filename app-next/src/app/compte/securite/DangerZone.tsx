"use client";

import { useState } from "react";

export function DangerZone() {
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleDelete(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (confirmText !== "SUPPRIMER") {
      setError("Tape SUPPRIMER pour confirmer.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/account/delete", { method: "POST" });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? "La suppression a échoué.");
        setLoading(false);
        return;
      }
      window.location.href = "/";
    } catch {
      setError("Erreur réseau. Réessaie.");
      setLoading(false);
    }
  }

  return (
    <section style={{ borderTop: "1px solid rgba(255,92,124,0.25)", paddingTop: "1.5rem" }}>
      <h2 style={{ fontSize: "1.05rem", marginBottom: "1rem", color: "#ff5c7c" }}>Zone dangereuse</h2>

      <p style={{ fontSize: "0.85rem", color: "rgba(244,239,228,0.6)", marginBottom: "1rem" }}>
        Tu peux exporter toutes les données associées à ton compte (RGPD), ou le supprimer
        définitivement. La suppression est irréversible : favoris, badges et points seront perdus.
      </p>

      <a
        href="/api/account/export"
        download
        style={{
          display: "inline-block", padding: "0.55rem 1rem",
          border: "1px solid rgba(244,239,228,0.25)", borderRadius: "8px",
          color: "#f4efe4", fontSize: "0.85rem", textDecoration: "none", marginBottom: "1.5rem",
        }}
      >
        ⬇ Exporter mes données (JSON)
      </a>

      <form onSubmit={handleDelete}>
        <input
          type="text" placeholder="Tape SUPPRIMER pour confirmer"
          value={confirmText} onChange={(e) => setConfirmText(e.target.value)}
          style={{
            background: "rgba(10,10,20,0.8)", border: "1px solid rgba(255,92,124,0.35)",
            color: "#f4efe4", padding: "0.6rem 0.8rem", borderRadius: "8px", fontSize: "0.9rem",
            width: "100%",
          }}
        />
        {error && <p style={{ color: "#ff5c7c", fontSize: "0.85rem", marginTop: "0.5rem" }}>{error}</p>}
        <button
          type="submit" disabled={loading || confirmText !== "SUPPRIMER"}
          style={{
            marginTop: "0.75rem", width: "100%", padding: "0.7rem",
            background: "transparent", border: "1px solid rgba(255,92,124,0.5)",
            color: "#ff5c7c", borderRadius: "8px", fontSize: "0.9rem", fontWeight: 700,
            cursor: loading ? "wait" : confirmText === "SUPPRIMER" ? "pointer" : "not-allowed",
            opacity: confirmText === "SUPPRIMER" ? 1 : 0.5,
          }}
        >
          {loading ? "..." : "Supprimer définitivement mon compte"}
        </button>
      </form>
    </section>
  );
}
