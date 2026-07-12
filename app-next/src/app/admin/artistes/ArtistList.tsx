"use client";
/* eslint-disable @next/next/no-img-element */

import { useState } from "react";
import Link from "next/link";

interface Artist {
  id: string;
  name: string;
  slug: string;
  image_url: string | null;
  haitian_status: string;
  is_active: boolean;
  tags: string[] | null;
  primary_genre: string | null;
  city: string | null;
  created_at: string;
  updated_at: string;
}

const STATUS_LABELS: Record<string, string> = {
  verified_haitian: "✅ Vérifié",
  verified_haitian_diaspora: "✅ Diaspora",
  verified_haitian_group: "✅ Groupe",
  pending_review: "⏳ À vérifier",
  rejected: "❌ Refusé",
};

export function ArtistList({ artists }: { artists: Artist[] }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [activeFilter, setActiveFilter] = useState<string>("all");

  const filtered = artists.filter((a) => {
    if (search && !a.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter !== "all" && a.haitian_status !== statusFilter) return false;
    if (activeFilter === "active" && !a.is_active) return false;
    if (activeFilter === "inactive" && a.is_active) return false;
    return true;
  });

  return (
    <>
      {/* Toolbar */}
      <div className="admin-card">
        <div className="admin-toolbar" style={{ flexWrap: "wrap", gap: "0.75rem" }}>
          <input
            type="search"
            placeholder="Rechercher un artiste…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              flex: "1 1 200px", background: "var(--admin-bg)", border: "1px solid var(--admin-border)",
              color: "var(--admin-text)", padding: "0.5rem 0.75rem", borderRadius: "8px", fontSize: "0.88rem",
            }}
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              background: "var(--admin-bg)", border: "1px solid var(--admin-border)",
              color: "var(--admin-text)", padding: "0.5rem", borderRadius: "8px", fontSize: "0.85rem",
            }}
          >
            <option value="all">Tous les statuts</option>
            <option value="verified_haitian">Vérifié haïtien</option>
            <option value="verified_haitian_diaspora">Diaspora</option>
            <option value="verified_haitian_group">Groupe</option>
            <option value="pending_review">À vérifier</option>
            <option value="rejected">Refusé</option>
          </select>
          <select
            value={activeFilter}
            onChange={(e) => setActiveFilter(e.target.value)}
            style={{
              background: "var(--admin-bg)", border: "1px solid var(--admin-border)",
              color: "var(--admin-text)", padding: "0.5rem", borderRadius: "8px", fontSize: "0.85rem",
            }}
          >
            <option value="all">Actifs + masqués</option>
            <option value="active">Actifs uniquement</option>
            <option value="inactive">Masqués uniquement</option>
          </select>
          <Link href="/admin/artistes/nouveau" className="btn btn--primary" style={{ textDecoration: "none" }}>
            + Créer un artiste
          </Link>
        </div>
        <p style={{ color: "var(--admin-muted)", fontSize: "0.8rem", marginTop: "0.5rem" }}>
          {filtered.length} résultat{filtered.length > 1 ? "s" : ""}
        </p>
      </div>

      {/* Liste */}
      <div className="admin-card">
        <div className="entry-list">
          {filtered.slice(0, 100).map((a) => (
            <Link
              key={a.id}
              href={`/admin/artistes/${a.id}`}
              className="entry"
              style={{ textDecoration: "none", color: "inherit" }}
            >
              <div className="entry__pos" style={{ fontSize: "0.7rem", color: "var(--admin-muted)" }}>
                {a.is_active ? "●" : "○"}
              </div>
              <img
                className="entry__cover"
                src={a.image_url ?? "/image/artists/planet-hmi-artist-placeholder-square.webp.webp"}
                alt=""
                style={{ borderRadius: "50%" }}
              />
              <div className="entry__meta">
                <div className="entry__title">{a.name}</div>
                <div className="entry__artist">
                  {STATUS_LABELS[a.haitian_status] ?? a.haitian_status}
                  {a.tags?.length ? ` · ${a.tags.join(", ")}` : ""}
                  {a.city ? ` · 📍 ${a.city}` : ""}
                  {a.primary_genre ? ` · 🎵 ${a.primary_genre}` : ""}
                </div>
              </div>
              <div style={{ color: "var(--admin-muted)", fontSize: "0.72rem", textAlign: "right" }}>
                /{a.slug}
              </div>
            </Link>
          ))}
          {filtered.length > 100 && (
            <p style={{ color: "var(--admin-muted)", textAlign: "center", padding: "1rem" }}>
              … et {filtered.length - 100} autres. Affinez votre recherche.
            </p>
          )}
        </div>
      </div>
    </>
  );
}
