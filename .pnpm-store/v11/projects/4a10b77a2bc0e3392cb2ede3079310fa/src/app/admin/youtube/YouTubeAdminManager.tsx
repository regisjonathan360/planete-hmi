"use client";

import { useState } from "react";
import { CollectionPanel } from "./CollectionPanel";
import { ChannelsPanel } from "./ChannelsPanel";
import { VideosPanel } from "./VideosPanel";
import { ChartPanel } from "./ChartPanel";
import { formatDate, formatNumber } from "./utils";
import type { YouTubeAdminStats } from "./types";
import styles from "./youtube-admin.module.css";

type Tab = "overview" | "collection" | "channels" | "videos" | "chart";

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "overview", label: "Vue d’ensemble" },
  { id: "collection", label: "Collecte" },
  { id: "channels", label: "Chaînes" },
  { id: "videos", label: "Vidéos à vérifier" },
  { id: "chart", label: "Classement" },
];

export function YouTubeAdminManager({
  initialStats,
}: {
  initialStats: YouTubeAdminStats;
}) {
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [stats, setStats] = useState(initialStats);

  function incrementStat(
    field: keyof Pick<YouTubeAdminStats, "channels" | "pendingVideos">,
    amount = 1
  ) {
    setStats((current) => ({ ...current, [field]: current[field] + amount }));
  }

  return (
    <div className={styles.manager}>
      <div className={styles.tabs} role="tablist" aria-label="Administration YouTube">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            className={activeTab === tab.id ? styles.tabActive : styles.tab}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
            {tab.id === "videos" && stats.pendingVideos > 0 ? (
              <span className={styles.tabCount}>{formatNumber(stats.pendingVideos)}</span>
            ) : null}
          </button>
        ))}
      </div>

      {activeTab === "overview" ? (
        <Overview
          stats={stats}
          openTab={setActiveTab}
        />
      ) : null}
      {activeTab === "collection" ? <CollectionPanel /> : null}
      {activeTab === "channels" ? (
        <ChannelsPanel onChannelCreated={(amount) => incrementStat("channels", amount)} />
      ) : null}
      {activeTab === "videos" ? (
        <VideosPanel onVideoImported={() => incrementStat("pendingVideos")} />
      ) : null}
      {activeTab === "chart" ? (
        <ChartPanel initialEdition={stats.latestEdition} />
      ) : null}
    </div>
  );
}

function Overview({
  stats,
  openTab,
}: {
  stats: YouTubeAdminStats;
  openTab: (tab: Tab) => void;
}) {
  return (
    <div className={styles.stack}>
      <section className={styles.summary} aria-label="Résumé YouTube">
        <Stat value={stats.channels} label="Chaînes suivies" />
        <Stat value={stats.activeChannels} label="Chaînes actives" tone="ok" />
        <Stat value={stats.pendingVideos} label="Vidéos à vérifier" tone="warn" />
        <Stat value={stats.eligibleVideos} label="Vidéos éligibles" tone="accent" />
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <h2>Flux de travail recommandé</h2>
            <p>Chaque publication reste une décision manuelle de l’administrateur.</p>
          </div>
        </div>
        <div className={styles.workflow}>
          <WorkflowAction
            title="Collecter"
            description="Découvrir les nouveautés et relever les compteurs de la semaine."
            action="Ouvrir la collecte"
            onClick={() => openTab("collection")}
          />
          <WorkflowAction
            title="Vérifier"
            description={`${formatNumber(stats.pendingVideos)} vidéo(s) attendent une décision éditoriale.`}
            action="Traiter les vidéos"
            onClick={() => openTab("videos")}
          />
          <WorkflowAction
            title="Publier"
            description={
              stats.latestEdition
                ? `Dernière période: ${formatDate(stats.latestEdition.periodStart)} au ${formatDate(stats.latestEdition.periodEnd)}.`
                : "Aucun brouillon n’a encore été créé."
            }
            action="Éditer le Top 20"
            onClick={() => openTab("chart")}
          />
        </div>
      </section>

      {stats.latestEdition ? (
        <section className={styles.panel}>
          <div className={styles.editionSummary}>
            <div>
              <span className={styles.muted}>Dernière édition</span>
              <strong>
                {formatDate(stats.latestEdition.periodStart)} au{" "}
                {formatDate(stats.latestEdition.periodEnd)}
              </strong>
            </div>
            <Status value={stats.latestEdition.status} />
            <button className="btn btn--primary" type="button" onClick={() => openTab("chart")}>
              Ouvrir l’édition
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function Stat({
  value,
  label,
  tone,
}: {
  value: number;
  label: string;
  tone?: "ok" | "warn" | "accent";
}) {
  return (
    <div className={styles.stat}>
      <strong className={tone ? styles[`stat_${tone}`] : undefined}>
        {formatNumber(value)}
      </strong>
      <span>{label}</span>
    </div>
  );
}

function WorkflowAction({
  title,
  description,
  action,
  onClick,
}: {
  title: string;
  description: string;
  action: string;
  onClick: () => void;
}) {
  return (
    <div className={styles.workflowItem}>
      <div>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
      <button className="btn btn--ghost" type="button" onClick={onClick}>
        {action}
      </button>
    </div>
  );
}

export function Status({ value }: { value: string }) {
  const normalized = value.toLowerCase();
  const tone =
    normalized.includes("fail") || normalized.includes("reject") || normalized.includes("exclude")
      ? styles.statusDanger
      : normalized.includes("warn") ||
          normalized.includes("pending") ||
          normalized.includes("review")
        ? styles.statusWarn
        : normalized.includes("complete") ||
            normalized.includes("publish") ||
            normalized.includes("active") ||
            normalized.includes("approved") ||
            normalized.includes("ready")
          ? styles.statusOk
          : styles.statusMuted;
  return <span className={`${styles.status} ${tone}`}>{value.replaceAll("_", " ")}</span>;
}

