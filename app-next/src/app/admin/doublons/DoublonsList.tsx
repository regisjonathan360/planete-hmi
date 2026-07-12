"use client";
/* eslint-disable @next/next/no-img-element */

import { useState } from "react";
import { useRouter } from "next/navigation";

interface ArtistPreview {
  id: string;
  name: string;
  slug: string;
  image_url: string | null;
  haitian_status: string;
  tags: string[] | null;
}

interface Candidate {
  id: string;
  confidence: number;
  reason: string;
  status: string;
  created_at: string;
  artist_a: ArtistPreview | null;
  artist_b: ArtistPreview | null;
}

export function DoublonsList({ candidates }: { candidates: unknown[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  const items = (candidates ?? []).map((c: unknown) => {
    const row = c as { id: string; confidence: number; reason: string; status: string; created_at: string; artist_a: ArtistPreview | ArtistPreview[]; artist_b: ArtistPreview | ArtistPreview[] };
    return {
      ...row,
      artist_a: Array.isArray(row.artist_a) ? row.artist_a[0] : row.artist_a,
      artist_b: Array.isArray(row.artist_b) ? row.artist_b[0] : row.artist_b,
    };
  });

  if (!items.length) {
    return (
      <div className="admin-card">
        <p style={{ color: "var(--admin-muted)" }}>Aucun doublon détecté pour le moment. 🎉</p>
      </div>
    );
  }

  async function resolve(candidateId: string, action: "merge" | "dismiss", keepId?: string) {
    setBusy(candidateId);
    try {
      await fetch("/api/admin/doublons/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidateId, action, keepId }),
      });
      router.refresh();
    } catch {}
    finally { setBusy(null); }
  }

  return (
    <div className="entry-list">
      {items.map((c) => {
        const a = c.artist_a;
        const b = c.artist_b;
        if (!a || !b) return null;

        return (
          <div key={c.id} className="admin-card" style={{ marginBottom: "1rem" }}>
            <div style={{ display: "flex", gap: "1.5rem", alignItems: "center", flexWrap: "wrap" }}>
              {/* Artiste A */}
              <div style={{ flex: 1, textAlign: "center", minWidth: 140 }}>
                <img
                  src={a.image_url ?? "/image/artists/planet-hmi-artist-placeholder-square.webp.webp"}
                  alt="" width={60} height={60} style={{ borderRadius: "50%", objectFit: "cover" }}
                />
                <p style={{ fontWeight: 700, margin: "0.4rem 0 0" }}>{a.name}</p>
                <p style={{ fontSize: "0.75rem", color: "var(--admin-muted)" }}>/{a.slug}</p>
                {a.tags?.length ? <p style={{ fontSize: "0.72rem" }}>{a.tags.join(", ")}</p> : null}
              </div>

              {/* Indicateur */}
              <div style={{ textAlign: "center" }}>
                <div className="badge badge--warn" style={{ fontSize: "0.8rem" }}>
                  {Math.round(c.confidence * 100)}% confiance
                </div>
                <p style={{ fontSize: "0.72rem", color: "var(--admin-muted)", marginTop: "0.3rem" }}>{c.reason}</p>
              </div>

              {/* Artiste B */}
              <div style={{ flex: 1, textAlign: "center", minWidth: 140 }}>
                <img
                  src={b.image_url ?? "/image/artists/planet-hmi-artist-placeholder-square.webp.webp"}
                  alt="" width={60} height={60} style={{ borderRadius: "50%", objectFit: "cover" }}
                />
                <p style={{ fontWeight: 700, margin: "0.4rem 0 0" }}>{b.name}</p>
                <p style={{ fontSize: "0.75rem", color: "var(--admin-muted)" }}>/{b.slug}</p>
                {b.tags?.length ? <p style={{ fontSize: "0.72rem" }}>{b.tags.join(", ")}</p> : null}
              </div>
            </div>

            {/* Actions */}
            <div className="admin-toolbar" style={{ marginTop: "1rem", justifyContent: "center" }}>
              <button
                className="btn btn--primary btn--sm"
                disabled={busy === c.id}
                onClick={() => resolve(c.id, "merge", a.id)}
              >
                Fusionner (garder {a.name})
              </button>
              <button
                className="btn btn--sm"
                disabled={busy === c.id}
                onClick={() => resolve(c.id, "merge", b.id)}
              >
                Fusionner (garder {b.name})
              </button>
              <button
                className="btn btn--ghost btn--sm"
                disabled={busy === c.id}
                onClick={() => resolve(c.id, "dismiss")}
              >
                Garder séparés
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
