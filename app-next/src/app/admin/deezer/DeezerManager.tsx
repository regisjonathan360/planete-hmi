"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { AdminChartData, AdminChartEntry } from "@/lib/charts/admin/types";

interface Toast { message: string; error?: boolean }

export function DeezerManager({
  sourceKey,
  initialData,
}: {
  sourceKey: string;
  initialData: AdminChartData;
}) {
  const router = useRouter();
  const [toast, setToast] = useState<Toast | null>(null);
  const [busy, setBusy] = useState(false);
  const [isCollecting, setIsCollecting] = useState(false);
  const [collectResult, setCollectResult] = useState<{
    status?: string; message?: string; error?: string;
  } | null>(null);
  const [, startTransition] = useTransition();

  const data = initialData;
  const edition = data?.edition;

  function notify(message: string, error = false) {
    setToast({ message, error });
    setTimeout(() => setToast(null), 4000);
  }

  async function post(url: string, body: Record<string, unknown>): Promise<boolean> {
    setBusy(true);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) { notify(json.error ?? "Erreur.", true); return false; }
      notify(json.message ?? "Fait.");
      startTransition(() => router.refresh());
      return true;
    } catch { notify("Erreur réseau.", true); return false; }
    finally { setBusy(false); }
  }

  const collect = async () => {
    setIsCollecting(true);
    setCollectResult(null);
    try {
      notify("Collecte Deezer en cours…");
      const res = await fetch("/api/admin/deezer/collect", { method: "POST" });
      const json = await res.json();
      if (!res.ok || json.status === "error") {
        setCollectResult({ status: "error", error: json.error ?? "Erreur." });
        notify(json.error ?? "Erreur.", true);
      } else {
        setCollectResult(json);
        notify(json.message ?? "Collecte réussie.");
        startTransition(() => router.refresh());
      }
    } catch {
      setCollectResult({ status: "error", error: "Erreur réseau." });
      notify("Erreur réseau.", true);
    } finally { setIsCollecting(false); }
  };

  const publish = () => post("/api/admin/charts/publish", { sourceKey, mode: "publish" });

  return (
    <>
      <div className="admin-card">
        <div className="admin-toolbar" style={{ justifyContent: "space-between" }}>
          <div className="admin-toolbar">
            <button className="btn btn--primary" onClick={collect} disabled={busy || isCollecting}>
              {isCollecting ? "⟳ Collecte en cours…" : "⟳ Collecter depuis Deezer"}
            </button>
            {edition?.collectedAt && (
              <span style={{ color: "var(--admin-muted)", fontSize: "0.82rem" }}>
                Dernière collecte : {new Date(edition.collectedAt).toLocaleString("fr-FR")}
              </span>
            )}
          </div>
          <button className="btn btn--ok" onClick={publish} disabled={busy || !edition}>
            ✓ Publier le classement
          </button>
        </div>

        {collectResult && (
          <div
            className={collectResult.status === "error" ? "banner banner--error" : "banner banner--ok"}
            style={{ marginTop: "0.75rem" }}
          >
            {collectResult.status === "error" ? `❌ ${collectResult.error}` : `✅ ${collectResult.message}`}
          </div>
        )}
      </div>

      {/* Résumé */}
      {data?.summary && (
        <div className="admin-card">
          <h2 className="admin-card__title">Résumé</h2>
          <div className="admin-stats">
            <Stat value={data.summary.totalEntries} label="Musiques" />
            <Stat value={data.summary.distinctArtists} label="Artistes" />
            <Stat value={data.summary.distinctAlbums} label="Albums" />
            <Stat value={data.summary.eligibleEntries} label="Publiables" accent />
          </div>
        </div>
      )}

      {/* Liste des musiques */}
      {data?.entries && data.entries.length > 0 && (
        <div className="admin-card">
          <h2 className="admin-card__title">Top Musiques</h2>
          <div className="entry-list">
            {data.entries.map((e: AdminChartEntry) => (
              <div key={e.entryId} className="entry">
                <div className="entry__pos">{e.filteredPosition ?? e.sourcePosition}</div>
                <img className="entry__cover" src={e.artworkUrl ?? "/image/artists/planet-hmi-artist-placeholder-square.webp.webp"} alt="" />
                <div className="entry__meta">
                  <div className="entry__title">{e.title}</div>
                  <div className="entry__artist">{e.artist}</div>
                </div>
                <div />
              </div>
            ))}
          </div>
        </div>
      )}

      {toast && <div className={toast.error ? "toast toast--error" : "toast"}>{toast.message}</div>}
    </>
  );
}

function Stat({ value, label, accent }: { value: number; label: string; accent?: boolean }) {
  return (
    <div className="stat">
      <div className="stat__value" style={{ color: accent ? "var(--admin-ok)" : undefined }}>{value}</div>
      <div className="stat__label">{label}</div>
    </div>
  );
}
