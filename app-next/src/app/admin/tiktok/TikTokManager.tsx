"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ValidationQueue } from "./ValidationQueue";
import { ChartEditor } from "./ChartEditor";
import { HmiShortsSelector } from "./HmiShortsSelector";
import {
  ArtistConnectionsQueue,
  type PendingArtistClaim,
} from "./ArtistConnectionsQueue";

type Tab =
  | "global"
  | "en_montee"
  | "nouveautes"
  | "validation"
  | "connections"
  | "shorts";

interface Toast {
  message: string;
  error?: boolean;
}

interface TikTokManagerProps {
  initialData: {
    stats: {
      totalSounds: number;
      pendingSounds: number;
      validatedSounds: number;
      lastSyncRun: {
        status: string;
        completedAt: string | null;
      } | null;
      latestEdition: {
        editionId: string;
        status: string;
        hasUnpublishedChanges: boolean;
      } | null;
      connectedArtists: number;
      pendingArtistClaims: PendingArtistClaim[];
    };
  };
}

export function TikTokManager({ initialData }: TikTokManagerProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("global");
  const [isCollecting, setIsCollecting] = useState(false);
  const [collectResult, setCollectResult] = useState<{
    ok?: boolean;
    videosCollected?: number;
    newSounds?: number;
    error?: string;
  } | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [, startTransition] = useTransition();

  const { stats } = initialData;

  function notify(message: string, error = false) {
    setToast({ message, error });
    setTimeout(() => setToast(null), 4000);
  }

  async function handleCollect() {
    setIsCollecting(true);
    setCollectResult(null);
    try {
      const res = await fetch("/api/admin/tiktok/collect", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setCollectResult({ error: data.error ?? "Erreur lors de la collecte." });
        notify(data.error ?? "Erreur lors de la collecte.", true);
      } else {
        setCollectResult(data);
        notify(
          `Collecte terminée : ${data.videosCollected ?? 0} vidéos, ${data.newSounds ?? 0} nouveaux sons.`
        );
        startTransition(() => router.refresh());
      }
    } catch {
      setCollectResult({ error: "Erreur de connexion au serveur." });
      notify("Erreur de connexion au serveur.", true);
    } finally {
      setIsCollecting(false);
    }
  }

  async function handleSyncConnections() {
    setIsCollecting(true);
    setCollectResult(null);
    try {
      const res = await fetch("/api/admin/tiktok/sync-connections", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setCollectResult({ error: data.error ?? "Erreur lors de la synchronisation." });
        notify(data.error ?? "Erreur.", true);
      } else {
        setCollectResult(data);
        notify(data.message ?? "Synchronisation terminée.");
        startTransition(() => router.refresh());
      }
    } catch {
      setCollectResult({ error: "Erreur réseau." });
      notify("Erreur réseau.", true);
    } finally {
      setIsCollecting(false);
    }
  }

  function formatDate(dateStr: string | null): string {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleString("fr-FR");
  }

  function editionStatusLabel(status: string | undefined): string {
    switch (status) {
      case "draft":
        return "Brouillon";
      case "ready":
        return "Publié";
      case "published":
        return "Publié";
      default:
        return status ?? "Aucune";
    }
  }

  return (
    <>
      {/* Barre de collecte */}
      <div className="admin-card">
        <div className="admin-toolbar" style={{ justifyContent: "space-between" }}>
          <div className="admin-toolbar">
            <button
              type="button"
              className="btn btn--primary"
              onClick={handleCollect}
              disabled={isCollecting}
            >
              {isCollecting ? "⟳ Collecte en cours…" : "⟳ Lancer la collecte"}
            </button>
            <button
              type="button"
              className="btn"
              onClick={handleSyncConnections}
              disabled={isCollecting}
            >
              {isCollecting ? "⟳ …" : "🔄 Sync artistes connectés"}
            </button>
            {stats.lastSyncRun?.completedAt && (
              <span style={{ color: "var(--admin-muted)", fontSize: "0.82rem" }}>
                Dernière collecte : {formatDate(stats.lastSyncRun.completedAt)}
              </span>
            )}
          </div>
        </div>

        {collectResult && !collectResult.error && (
          <div className="banner banner--ok" style={{ marginTop: "0.9rem" }}>
            Collecte réussie — {collectResult.videosCollected} vidéos collectées,{" "}
            {collectResult.newSounds} nouveaux sons détectés.
          </div>
        )}
        {collectResult?.error && (
          <div className="banner" style={{ marginTop: "0.9rem" }}>
            {collectResult.error}
          </div>
        )}

        {stats.latestEdition?.hasUnpublishedChanges && (
          <div className="banner" style={{ marginTop: "0.9rem" }}>
            Modifications en brouillon non publiées. Le site public affiche encore la dernière
            version publiée.
          </div>
        )}
      </div>

      {/* Résumé stats */}
      <div className="admin-card">
        <h2 className="admin-card__title">Résumé TikTok</h2>
        <div className="admin-stats">
          <Stat value={stats.totalSounds} label="Total sons" />
          <Stat value={stats.pendingSounds} label="En attente" warn />
          <Stat value={stats.connectedArtists} label="Artistes connectes" accent />
          <Stat value={stats.validatedSounds} label="Validés" accent />
          <StatText value={editionStatusLabel(stats.latestEdition?.status)} label="Statut édition" />
          <StatText
            value={formatDate(stats.lastSyncRun?.completedAt ?? null)}
            label="Dernière collecte"
          />
        </div>
      </div>

      {/* Onglets */}
      <div className="admin-card">
        <div className="tabs">
          <button
            type="button"
            className={tabCls(activeTab, "global")}
            onClick={() => setActiveTab("global")}
          >
            Global
          </button>
          <button
            type="button"
            className={tabCls(activeTab, "en_montee")}
            onClick={() => setActiveTab("en_montee")}
          >
            En montée
          </button>
          <button
            type="button"
            className={tabCls(activeTab, "nouveautes")}
            onClick={() => setActiveTab("nouveautes")}
          >
            Nouveautés
          </button>
          <button
            type="button"
            className={tabCls(activeTab, "validation")}
            onClick={() => setActiveTab("validation")}
          >
            Validation
            {stats.pendingSounds > 0 && (
              <span className="badge badge--warn" style={{ marginLeft: "0.4rem" }}>
                {stats.pendingSounds}
              </span>
            )}
          </button>
          <button
            type="button"
            className={tabCls(activeTab, "connections")}
            onClick={() => setActiveTab("connections")}
          >
            Connexions artistes
            {stats.pendingArtistClaims.length > 0 && (
              <span className="badge badge--warn" style={{ marginLeft: "0.4rem" }}>
                {stats.pendingArtistClaims.length}
              </span>
            )}
          </button>
          <button
            type="button"
            className={tabCls(activeTab, "shorts")}
            onClick={() => setActiveTab("shorts")}
          >
            HMI Shorts
          </button>
        </div>

        {/* Contenu onglet */}
        {activeTab === "global" && (
          <ChartEditor sourceKey="tiktok_haiti_global" chartLabel="Top TikTok Haiti — Global" />
        )}
        {activeTab === "en_montee" && (
          <ChartEditor sourceKey="tiktok_haiti_en_montee" chartLabel="Top TikTok Haiti — En montée" />
        )}
        {activeTab === "nouveautes" && (
          <ChartEditor sourceKey="tiktok_haiti_nouveautes" chartLabel="Top TikTok Haiti — Nouveautés" />
        )}
        {activeTab === "validation" && <ValidationQueue />}
        {activeTab === "connections" && (
          <ArtistConnectionsQueue claims={stats.pendingArtistClaims} />
        )}
        {activeTab === "shorts" && <HmiShortsSelector />}
      </div>

      {/* Toast */}
      {toast && (
        <div className={toast.error ? "toast toast--error" : "toast"}>{toast.message}</div>
      )}
    </>
  );
}

/* --- Helper components --- */

function tabCls(active: Tab, self: Tab): string {
  return active === self ? "tabs__btn is-active" : "tabs__btn";
}

function Stat({
  value,
  label,
  accent,
  warn,
}: {
  value: number;
  label: string;
  accent?: boolean;
  warn?: boolean;
}) {
  return (
    <div className="stat">
      <div
        className="stat__value"
        style={{
          color: accent ? "var(--admin-ok)" : warn ? "var(--admin-warn)" : undefined,
        }}
      >
        {value}
      </div>
      <div className="stat__label">{label}</div>
    </div>
  );
}

function StatText({ value, label }: { value: string; label: string }) {
  return (
    <div className="stat">
      <div className="stat__value" style={{ fontSize: "1rem" }}>
        {value}
      </div>
      <div className="stat__label">{label}</div>
    </div>
  );
}
