/* eslint-disable @next/next/no-img-element */
"use client";

import { useState } from "react";

interface NewsSource {
  id: string;
  name: string;
  slug: string;
  scrape_url: string;
  is_active: boolean;
  last_scraped_at: string | null;
}

interface NewsArticle {
  id: string;
  source_url: string;
  source_title: string;
  source_image_url: string | null;
  source_excerpt: string | null;
  source_author: string | null;
  source_date: string | null;
  display_title: string | null;
  display_image_url: string | null;
  display_excerpt: string | null;
  category: string;
  status: "draft" | "published" | "archived" | "rejected";
  is_featured: boolean;
  collected_at: string;
  news_sources: { name: string; slug: string } | null;
}

export function NewsManager({
  sources,
  initialArticles,
}: {
  sources: NewsSource[];
  initialArticles: NewsArticle[];
}) {
  const [articles, setArticles] = useState<NewsArticle[]>(initialArticles);
  const [collecting, setCollecting] = useState(false);
  const [filter, setFilter] = useState<string>("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  async function handleCollect(sourceId?: string) {
    setCollecting(true);
    setToast(null);
    try {
      const res = await fetch("/api/admin/news/collect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceId }),
      });
      const data = await res.json();
      if (res.ok) {
        setToast(
          `✓ ${data.found} articles Musique trouvés et ${data.synchronized ?? data.inserted} synchronisés.`
        );
        // Refresh articles
        const refreshRes = await fetch("/api/admin/news/articles");
        if (refreshRes.ok) {
          const refreshData = await refreshRes.json();
          setArticles(refreshData.articles);
        }
      } else {
        setToast(`✗ ${data.error}`);
      }
    } catch {
      setToast("✗ Erreur réseau.");
    }
    setCollecting(false);
  }

  async function updateArticle(id: string, updates: Record<string, unknown>) {
    const res = await fetch("/api/admin/news/articles", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...updates }),
    });
    if (res.ok) {
      const data = await res.json();
      setArticles((prev) =>
        prev.map((a) => (a.id === id ? { ...a, ...flattenUpdates(updates), status: data.article.status } : a))
      );
      setToast("✓ Article mis à jour.");
    } else {
      setToast("✗ Erreur de mise à jour.");
    }
  }

  function flattenUpdates(updates: Record<string, unknown>) {
    const map: Record<string, string> = {
      displayTitle: "display_title",
      displayExcerpt: "display_excerpt",
      category: "category",
      isFeatured: "is_featured",
    };
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(updates)) {
      result[map[k] ?? k] = v;
    }
    return result;
  }

  const filtered = filter === "all" ? articles : articles.filter((a) => a.status === filter);

  return (
    <div>
      {/* Sources et collecte */}
      <div className="admin-card">
        <h2 className="admin-card__title">Sources</h2>
        <div className="admin-toolbar">
          {sources.map((src) => (
            <button
              key={src.id}
              className="btn btn--primary"
              disabled={collecting || !src.is_active}
              onClick={() => handleCollect(src.id)}
            >
              {collecting ? "Collecte..." : `Collecter ${src.name}`}
            </button>
          ))}
        </div>
        {sources.map((src) => (
          <p key={src.id} style={{ fontSize: "0.8rem", color: "var(--admin-muted)", marginTop: "0.5rem" }}>
            {src.name} — {src.scrape_url}
            {src.last_scraped_at && ` — Dernière collecte : ${new Date(src.last_scraped_at).toLocaleString("fr-FR")}`}
          </p>
        ))}
      </div>

      {/* Filtres */}
      <div className="admin-card">
        <div className="tabs">
          {["all", "draft", "published", "archived", "rejected"].map((s) => (
            <button
              key={s}
              className={`tabs__btn ${filter === s ? "is-active" : ""}`}
              onClick={() => setFilter(s)}
            >
              {s === "all" ? "Tous" : s === "draft" ? "Brouillons" : s === "published" ? "Publiés" : s === "archived" ? "Archivés" : "Rejetés"}
              {" "}({s === "all" ? articles.length : articles.filter((a) => a.status === s).length})
            </button>
          ))}
        </div>
      </div>

      {/* Liste des articles */}
      <div className="entry-list">
        {filtered.map((article) => (
          <div key={article.id} className={`entry ${article.status === "rejected" ? "is-excluded" : ""}`} style={{ gridTemplateColumns: "80px 1fr auto" }}>
            {article.source_image_url ? (
              <img
                src={article.display_image_url || article.source_image_url}
                alt=""
                className="entry__cover"
                style={{ width: 80, height: 56, objectFit: "cover", borderRadius: 6 }}
              />
            ) : (
              <div style={{ width: 80, height: 56, background: "var(--admin-panel-2)", borderRadius: 6 }} />
            )}
            <div className="entry__meta">
              <div className="entry__title">{article.display_title || article.source_title}</div>
              <div className="entry__artist">
                {article.news_sources?.name} · {article.source_date ?? "—"} · {article.source_author ?? ""}
              </div>
              {editingId === article.id && (
                <EditPanel article={article} onSave={updateArticle} onClose={() => setEditingId(null)} />
              )}
            </div>
            <div className="entry__actions">
              <span className={`badge badge--${article.status === "published" ? "ok" : article.status === "draft" ? "warn" : "muted"}`}>
                {article.status}
              </span>
              {article.status === "draft" && (
                <button className="btn btn--ok btn--sm" onClick={() => updateArticle(article.id, { status: "published" })}>
                  Publier
                </button>
              )}
              {article.status === "published" && (
                <button className="btn btn--sm" onClick={() => updateArticle(article.id, { status: "archived" })}>
                  Archiver
                </button>
              )}
              {article.status === "draft" && (
                <button className="btn btn--danger btn--sm" onClick={() => updateArticle(article.id, { status: "rejected" })}>
                  Rejeter
                </button>
              )}
              <button className="btn btn--sm" onClick={() => setEditingId(editingId === article.id ? null : article.id)}>
                {editingId === article.id ? "Fermer" : "Modifier"}
              </button>
              <a href={article.source_url} target="_blank" rel="noopener noreferrer" className="btn btn--ghost btn--sm">
                Source ↗
              </a>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <p style={{ color: "var(--admin-muted)", textAlign: "center", padding: "2rem" }}>
            Aucun article pour ce filtre. Lancez une collecte pour récupérer les actualités.
          </p>
        )}
      </div>

      {toast && <div className={`toast ${toast.startsWith("✗") ? "toast--error" : ""}`}>{toast}</div>}
    </div>
  );
}

function EditPanel({
  article,
  onSave,
  onClose,
}: {
  article: { id: string; source_title: string; display_title: string | null; display_excerpt: string | null; category: string; is_featured: boolean };
  onSave: (id: string, updates: Record<string, unknown>) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(article.display_title || article.source_title);
  const [excerpt, setExcerpt] = useState(article.display_excerpt || "");
  const [category, setCategory] = useState(article.category);
  const [featured, setFeatured] = useState(article.is_featured);

  return (
    <div className="edit-panel">
      <div className="edit-panel__grid">
        <div className="field">
          <label>Titre affiché</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="field">
          <label>Catégorie</label>
          <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="musique, sorties, interview..." />
        </div>
      </div>
      <div className="field">
        <label>Résumé personnalisé</label>
        <input value={excerpt} onChange={(e) => setExcerpt(e.target.value)} placeholder="Laisser vide pour utiliser le résumé source" />
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.85rem", marginBottom: "0.5rem" }}>
        <input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} />
        À la une
      </label>
      <div className="admin-toolbar">
        <button
          className="btn btn--primary btn--sm"
          onClick={() => {
            onSave(article.id, { displayTitle: title, displayExcerpt: excerpt || null, category, isFeatured: featured });
            onClose();
          }}
        >
          Enregistrer
        </button>
        <button className="btn btn--ghost btn--sm" onClick={onClose}>Annuler</button>
      </div>
    </div>
  );
}
