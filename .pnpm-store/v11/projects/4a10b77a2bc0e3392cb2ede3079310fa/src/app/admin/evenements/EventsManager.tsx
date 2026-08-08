/* eslint-disable @next/next/no-img-element */
"use client";

import { useState } from "react";
import { CollectProgressBar, readCollectStream, type CollectProgress } from "@/components/CollectProgressBar";

interface EventSource {
  id: string;
  name: string;
  slug: string;
  scrape_url: string;
  is_active: boolean;
  source_type: string | null;
  notes: string | null;
  last_scraped_at: string | null;
  last_success_at: string | null;
  last_found_count: number | null;
  last_error: string | null;
}

const SOURCE_TYPE_LABELS: Record<string, string> = {
  auto: "détection auto",
  eventbrite: "Eventbrite (JSON-LD)",
  wordpress: "API WordPress",
  bandsintown: "Bandsintown",
  jsonld: "schema.org générique",
};

function formatDateTime(value: string | null): string | null {
  return value ? new Date(value).toLocaleString("fr-FR") : null;
}

interface EventItem {
  id: string;
  source_url: string;
  source_title: string;
  source_image_url: string | null;
  source_date: string | null;
  source_time: string | null;
  source_location: string | null;
  source_price: string | null;
  display_title: string | null;
  display_description: string | null;
  category: string;
  status: "draft" | "published" | "archived" | "rejected";
  is_featured: boolean;
  collected_at: string;
  event_sources: { name: string; slug: string } | null;
}

export function EventsManager({ sources, initialEvents }: { sources: EventSource[]; initialEvents: EventItem[] }) {
  const [events, setEvents] = useState<EventItem[]>(initialEvents);
  const [collecting, setCollecting] = useState(false);
  const [progress, setProgress] = useState<CollectProgress | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  async function handleCollect(sourceId?: string) {
    setCollecting(true);
    setToast(null);
    setProgress({ phase: "init", percent: 0, message: "Démarrage de la collecte..." });

    try {
      const res = await fetch("/api/admin/events/collect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceId }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setProgress({ phase: "error", percent: 0, message: data.error ?? "Collecte refusée." });
        setCollecting(false);
        return;
      }

      const final = await readCollectStream(res, setProgress);

      if (final?.phase === "done") {
        const refreshRes = await fetch("/api/admin/events/articles");
        if (refreshRes.ok) {
          const refreshData = await refreshRes.json();
          setEvents(refreshData.events);
        }
      }
    } catch {
      setProgress({ phase: "error", percent: 0, message: "Erreur réseau pendant la collecte." });
    }
    setCollecting(false);
  }

  async function updateEvent(id: string, updates: Record<string, unknown>) {
    const res = await fetch("/api/admin/events/articles", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...updates }),
    });
    if (res.ok) {
      const data = await res.json();
      setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, status: data.event.status, ...flatUpdates(updates) } : e)));
      setToast("✓ Événement mis à jour.");
    } else {
      setToast("✗ Erreur de mise à jour.");
    }
  }

  function flatUpdates(u: Record<string, unknown>) {
    const map: Record<string, string> = { displayTitle: "display_title", displayDescription: "display_description", category: "category", isFeatured: "is_featured" };
    const r: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(u)) { r[map[k] ?? k] = v; }
    return r;
  }

  const filtered = filter === "all" ? events : events.filter((e) => e.status === filter);

  return (
    <div>
      <div className="admin-card">
        <h2 className="admin-card__title">Sources</h2>
        <div className="admin-toolbar">
          {sources
            .filter((src) => src.is_active)
            .map((src) => (
              <button
                key={src.id}
                className="btn btn--primary"
                disabled={collecting}
                onClick={() => handleCollect(src.id)}
              >
                {collecting ? "Collecte..." : src.name}
              </button>
            ))}
        </div>

        <div style={{ display: "grid", gap: "0.5rem", marginTop: "0.9rem" }}>
          {sources.map((src) => (
            <div
              key={src.id}
              style={{
                padding: "0.6rem 0.75rem",
                borderRadius: 8,
                background: "var(--admin-panel-2)",
                border: `1px solid ${src.last_error ? "var(--admin-warn)" : "var(--admin-border)"}`,
                opacity: src.is_active ? 1 : 0.65,
                fontSize: "0.8rem",
              }}
            >
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "baseline", flexWrap: "wrap" }}>
                <strong style={{ fontSize: "0.85rem" }}>{src.name}</strong>
                <span className={src.is_active ? "badge badge--ok" : "badge badge--muted"}>
                  {src.is_active ? "active" : "désactivée"}
                </span>
                <span className="badge badge--muted">
                  {SOURCE_TYPE_LABELS[src.source_type ?? "auto"] ?? src.source_type}
                </span>
                {src.last_found_count !== null && (
                  <span style={{ color: "var(--admin-muted)" }}>
                    {src.last_found_count} trouvé(s) au dernier passage
                  </span>
                )}
              </div>

              <p style={{ margin: "0.3rem 0 0", color: "var(--admin-muted)", wordBreak: "break-all" }}>
                <a
                  href={src.scrape_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "var(--admin-accent-2)" }}
                >
                  {src.scrape_url}
                </a>
              </p>

              {src.notes && (
                <p style={{ margin: "0.3rem 0 0", color: "var(--admin-muted)" }}>{src.notes}</p>
              )}

              <p style={{ margin: "0.3rem 0 0", color: "var(--admin-muted)" }}>
                {formatDateTime(src.last_success_at)
                  ? `Dernier succès : ${formatDateTime(src.last_success_at)}`
                  : "Aucune collecte réussie pour l'instant"}
                {src.last_scraped_at &&
                  ` · dernière tentative : ${formatDateTime(src.last_scraped_at)}`}
              </p>

              {src.last_error && (
                <p style={{ margin: "0.35rem 0 0", color: "var(--admin-warn)" }}>
                  ⚠ {src.last_error}
                </p>
              )}
            </div>
          ))}
        </div>

        <CollectProgressBar progress={progress} />
      </div>

      <div className="admin-card">
        <div className="tabs">
          {["all", "draft", "published", "archived", "rejected"].map((s) => (
            <button key={s} className={`tabs__btn ${filter === s ? "is-active" : ""}`} onClick={() => setFilter(s)}>
              {s === "all" ? "Tous" : s === "draft" ? "Brouillons" : s === "published" ? "Publiés" : s === "archived" ? "Archivés" : "Rejetés"}
              {" "}({s === "all" ? events.length : events.filter((e) => e.status === s).length})
            </button>
          ))}
        </div>
      </div>

      <div className="entry-list">
        {filtered.map((event) => (
          <div key={event.id} className={`entry ${event.status === "rejected" ? "is-excluded" : ""}`} style={{ gridTemplateColumns: "80px 1fr auto" }}>
            {event.source_image_url ? (
              <img src={event.source_image_url} alt="" style={{ width: 80, height: 56, objectFit: "cover", borderRadius: 6 }} />
            ) : (
              <div style={{ width: 80, height: 56, background: "var(--admin-panel-2)", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.5rem" }}>🎵</div>
            )}
            <div className="entry__meta">
              <div className="entry__title">{event.display_title || event.source_title}</div>
              <div className="entry__artist">
                {event.source_date ?? "—"} · {event.source_location ?? "Lieu non précisé"} · {event.source_price ?? ""}
              </div>
              {editingId === event.id && (
                <EditPanel event={event} onSave={updateEvent} onClose={() => setEditingId(null)} />
              )}
            </div>
            <div className="entry__actions">
              <span className={`badge badge--${event.status === "published" ? "ok" : event.status === "draft" ? "warn" : "muted"}`}>
                {event.status}
              </span>
              {event.status === "draft" && (
                <button className="btn btn--ok btn--sm" onClick={() => updateEvent(event.id, { status: "published" })}>Publier</button>
              )}
              {event.status === "published" && (
                <button className="btn btn--sm" onClick={() => updateEvent(event.id, { status: "archived" })}>Archiver</button>
              )}
              {event.status === "draft" && (
                <button className="btn btn--danger btn--sm" onClick={() => updateEvent(event.id, { status: "rejected" })}>Rejeter</button>
              )}
              <button className="btn btn--sm" onClick={() => setEditingId(editingId === event.id ? null : event.id)}>
                {editingId === event.id ? "Fermer" : "Modifier"}
              </button>
              <a href={event.source_url} target="_blank" rel="noopener noreferrer" className="btn btn--ghost btn--sm">Source ↗</a>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <p style={{ color: "var(--admin-muted)", textAlign: "center", padding: "2rem" }}>
            Aucun événement pour ce filtre. Lancez une collecte.
          </p>
        )}
      </div>

      {toast && <div className={`toast ${toast.startsWith("✗") ? "toast--error" : ""}`}>{toast}</div>}
    </div>
  );
}

function EditPanel({ event, onSave, onClose }: { event: EventItem; onSave: (id: string, u: Record<string, unknown>) => void; onClose: () => void }) {
  const [title, setTitle] = useState(event.display_title || event.source_title);
  const [desc, setDesc] = useState(event.display_description || "");
  const [featured, setFeatured] = useState(event.is_featured);

  return (
    <div className="edit-panel">
      <div className="edit-panel__grid">
        <div className="field">
          <label>Titre affiché</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
      </div>
      <div className="field">
        <label>Description</label>
        <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Description optionnelle" />
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.85rem", marginBottom: "0.5rem" }}>
        <input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} /> À la une
      </label>
      <div className="admin-toolbar">
        <button className="btn btn--primary btn--sm" onClick={() => { onSave(event.id, { displayTitle: title, displayDescription: desc || null, isFeatured: featured }); onClose(); }}>
          Enregistrer
        </button>
        <button className="btn btn--ghost btn--sm" onClick={onClose}>Annuler</button>
      </div>
    </div>
  );
}
