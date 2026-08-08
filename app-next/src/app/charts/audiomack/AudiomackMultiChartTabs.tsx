"use client";

import { useState } from "react";
import type { AudiomackGenreTab, AudiomackChartEntry } from "./page";
import { AudiomackEmbedPreview } from "@/components/charts/AudiomackEmbedPreview";
import { ChartMovementBadge } from "@/components/charts/ChartMovementBadge";
import { ChartEmptyState } from "@/components/charts/ChartEmptyState";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface AudiomackMultiChartTabsProps {
  composite: AudiomackGenreTab | null;
  genres: AudiomackGenreTab[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AudiomackMultiChartTabs({ composite, genres }: AudiomackMultiChartTabsProps) {
  const tabs: AudiomackGenreTab[] = [];
  if (composite) tabs.push(composite);
  tabs.push(...genres);

  const [activeTab, setActiveTab] = useState(tabs[0]?.key ?? "");
  const activeData = tabs.find((t) => t.key === activeTab) ?? tabs[0];

  return (
    <>
      {/* Tab navigation */}
      <div className="tabs" role="tablist" aria-label="Genres Audiomack">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            role="tab"
            aria-selected={tab.key === activeTab}
            className={tab.key === activeTab ? "tabs__btn is-active" : "tabs__btn"}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
            {tab.entryCount > 0 && (
              <span
                style={{
                  fontSize: "0.7rem",
                  marginLeft: "0.3rem",
                  opacity: 0.7,
                }}
              >
                ({tab.entryCount})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeData && (
        <div role="tabpanel" aria-label={activeData.label}>
          {/* Header info */}
          {activeData.updatedAt && (
            <p className="hmi__meta" style={{ marginTop: "0.75rem" }}>
              {activeData.label}
              {" · "}
              Mis à jour le{" "}
              {new Date(activeData.updatedAt).toLocaleDateString("fr-FR", {
                day: "2-digit",
                month: "long",
                year: "numeric",
              })}
              {" · "}
              {activeData.entryCount} titre{activeData.entryCount > 1 ? "s" : ""}
            </p>
          )}

          {activeData.entries.length === 0 ? (
            <ChartEmptyState message={`Aucune édition publiée pour "${activeData.label}" pour le moment.`} />
          ) : (
            <div className="chart-entries" style={{ marginTop: "0.5rem" }}>
              {activeData.entries.map((entry) => (
                <AudiomackChartRow
                  key={`${activeData.key}-${entry.position}`}
                  entry={entry}
                  isComposite={activeData.genreId === "composite"}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Chart Row
// ---------------------------------------------------------------------------

const placeholder = "/image/artists/planet-hmi-artist-placeholder-square.webp.webp";

function AudiomackChartRow({
  entry,
  isComposite,
}: {
  entry: AudiomackChartEntry;
  isComposite: boolean;
}) {
  const pos = entry.position;
  const rankClass =
    pos === 1
      ? "num card__rank--1"
      : pos === 2
        ? "num card__rank--2"
        : pos === 3
          ? "num card__rank--3"
          : pos === 4
            ? "num card__rank--4"
            : "num card__rank--rest";

  return (
    <AudiomackEmbedPreview
      artistSlug={entry.artistSlug}
      trackSlug={entry.trackSlug}
      trackTitle={entry.title}
      artistName={entry.artist}
      platformUrl={entry.platformUrl}
    >
      <div
        className="chart-row"
        style={{
          display: "grid",
          gridTemplateColumns: "40px 40px 48px 1fr auto",
          gap: "0.6rem",
          alignItems: "center",
          padding: "0.5rem 0.6rem",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          transition: "background 0.15s",
        }}
      >
        {/* Position */}
        <span className={rankClass} style={{ textAlign: "center", fontWeight: 700 }}>
          {pos}
        </span>

        {/* Movement */}
        <ChartMovementBadge movement={entry.movement} entryStatus={entry.entryStatus} />

        {/* Artwork */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={entry.artworkUrl ?? placeholder}
          alt=""
          width={44}
          height={44}
          loading="lazy"
          style={{ borderRadius: "6px", objectFit: "cover" }}
        />

        {/* Title + Artist + Genre badges */}
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontWeight: 600,
              fontSize: "0.9rem",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {entry.title}
          </div>
          <div
            style={{
              fontSize: "0.8rem",
              color: "rgba(255,255,255,0.65)",
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
              flexWrap: "wrap",
            }}
          >
            <span>{entry.artist}</span>
            {isComposite && entry.contributions && entry.contributions.length > 0 && (
              <span style={{ display: "inline-flex", gap: "0.2rem", flexWrap: "wrap" }}>
                {entry.contributions.map((c) => (
                  <span
                    key={c.genreId}
                    className="badge badge--muted"
                    style={{ fontSize: "0.65rem", padding: "0.1rem 0.35rem" }}
                    title={`${c.genreLabel} #${c.sourcePosition}`}
                  >
                    {c.genreId}
                  </span>
                ))}
              </span>
            )}
          </div>
        </div>

        {/* External link */}
        {entry.platformUrl && (
          <a
            href={entry.platformUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: "0.75rem",
              color: "rgba(255,255,255,0.5)",
              textDecoration: "none",
            }}
            aria-label={`Écouter ${entry.title} sur Audiomack`}
          >
            ↗
          </a>
        )}
      </div>
    </AudiomackEmbedPreview>
  );
}
