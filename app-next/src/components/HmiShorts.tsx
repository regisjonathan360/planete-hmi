"use client";

import { useEffect, useState } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ShortItem {
  video_id: string;
  username: string;
  sound_title: string;
  sound_author: string | null;
  display_order: number;
}

// ---------------------------------------------------------------------------
// HmiShorts — Section publique homepage
// Affiche les vidéos TikTok featured (max 10) avec lien vers TikTok.
// Design responsive : grille sur desktop, scroll horizontal sur mobile.
// ---------------------------------------------------------------------------

export function HmiShorts() {
  const [shorts, setShorts] = useState<ShortItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchShorts() {
      try {
        const res = await fetch("/api/shorts");
        if (!res.ok) {
          setShorts([]);
          return;
        }
        const json = await res.json();
        setShorts(json.shorts ?? []);
      } catch {
        setShorts([]);
      } finally {
        setLoading(false);
      }
    }
    fetchShorts();
  }, []);

  // État vide : ne pas afficher la section du tout
  if (!loading && shorts.length === 0) return null;

  return (
    <section className="section hmi-shorts-section" aria-labelledby="hmi-shorts-title">
      <div className="wrap">
        {/* En-tête de section */}
        <div className="section-head">
          <div>
            <span className="section-tag">TikTok</span>
            <h2 className="section-title" id="hmi-shorts-title">
              HMI Shorts
            </h2>
          </div>
        </div>

        {/* État de chargement */}
        {loading && (
          <div className="hmi-shorts__loading" aria-live="polite">
            <div className="hmi-shorts__spinner" />
            <p>Chargement des shorts…</p>
          </div>
        )}

        {/* Grille de vidéos */}
        {!loading && shorts.length > 0 && (
          <div className="shorts hmi-shorts__grid">
            {shorts.map((item) => (
              <a
                key={item.video_id}
                href={`https://www.tiktok.com/@${item.username}/video/${item.video_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="short hmi-shorts__card"
                aria-label={`${item.sound_title} par @${item.username} — Voir sur TikTok`}
              >
                {/* Thumbnail TikTok */}
                <div className="hmi-shorts__thumb">
                  <svg
                    className="hmi-shorts__tiktok-icon"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .55.04.81.1V9.01a6.33 6.33 0 0 0-.81-.05A6.34 6.34 0 0 0 3.15 15.3a6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V9.22a8.16 8.16 0 0 0 4.76 1.52v-3.4a4.85 4.85 0 0 1-1-.65z" />
                  </svg>
                </div>

                {/* Infos overlay */}
                <div className="hmi-shorts__info">
                  <p className="hmi-shorts__sound-title">{item.sound_title}</p>
                  <p className="hmi-shorts__username">@{item.username}</p>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Styles scopés pour HMI Shorts */}
      <style jsx>{`
        .hmi-shorts__loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.8rem;
          padding: 3rem 0;
          color: var(--cream-dim);
          font-size: 0.9rem;
        }

        .hmi-shorts__spinner {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          border: 2px solid var(--line-2);
          border-top-color: var(--flame-orange);
          animation: hmi-spin 0.7s linear infinite;
        }

        @keyframes hmi-spin {
          to { transform: rotate(360deg); }
        }

        .hmi-shorts__grid {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 1.2rem;
        }

        @media (max-width: 1024px) {
          .hmi-shorts__grid {
            grid-template-columns: repeat(3, 1fr);
          }
        }

        @media (max-width: 560px) {
          .hmi-shorts__grid {
            display: flex;
            overflow-x: auto;
            scroll-snap-type: x mandatory;
            gap: 0.8rem;
            padding-bottom: 0.8rem;
            -webkit-overflow-scrolling: touch;
          }

          .hmi-shorts__card {
            flex: 0 0 60vw;
            max-width: 200px;
            scroll-snap-align: start;
          }
        }

        .hmi-shorts__card {
          display: flex;
          flex-direction: column;
          text-decoration: none;
          color: var(--cream);
          transition: transform 0.25s var(--ease), border-color 0.25s;
        }

        .hmi-shorts__card:hover {
          border-color: var(--flame-orange);
        }

        .hmi-shorts__thumb {
          position: absolute;
          inset: 0;
          display: grid;
          place-content: center;
          background: linear-gradient(
            145deg,
            var(--panel) 0%,
            var(--void-soft) 60%,
            var(--panel-2) 100%
          );
        }

        .hmi-shorts__tiktok-icon {
          width: 36px;
          height: 36px;
          color: var(--cream-dim);
          opacity: 0.4;
          transition: opacity 0.2s, color 0.2s;
        }

        .hmi-shorts__card:hover .hmi-shorts__tiktok-icon {
          opacity: 0.7;
          color: var(--flame-orange);
        }

        .hmi-shorts__info {
          position: absolute;
          left: 0;
          right: 0;
          bottom: 0;
          z-index: 2;
          padding: 0.7rem;
          display: flex;
          flex-direction: column;
          gap: 0.15rem;
        }

        .hmi-shorts__sound-title {
          margin: 0;
          font-family: var(--font-display);
          font-size: 0.85rem;
          line-height: 1.2;
          text-shadow: 0 1px 6px rgba(0, 0, 0, 0.7);
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .hmi-shorts__username {
          margin: 0;
          font-family: var(--font-mono);
          font-size: 0.7rem;
          color: var(--cream-dim);
          text-shadow: 0 1px 4px rgba(0, 0, 0, 0.6);
        }
      `}</style>
    </section>
  );
}
