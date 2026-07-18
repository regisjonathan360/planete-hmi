"use client";

import { useState, useRef, useEffect } from "react";

interface TopVideoData {
  title: string | null;
  description: string | null;
  coverUrl: string | null;
  embedLink: string | null;
  shareUrl: string | null;
  viewCount: number;
  likeCount: number;
  artistName: string;
}

/**
 * Affiche la vidéo TikTok la plus populaire de la semaine pour un artiste.
 * - Cover au repos
 * - Hover : joue un extrait audio Deezer (recherche auto par titre+artiste)
 * - Clic : ouvre l'embed TikTok ou le lien
 */
export function ArtistTopVideo({ video }: { video: TopVideoData }) {
  const [hovering, setHovering] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Chercher l'extrait Deezer quand on hover pour la première fois
  useEffect(() => {
    if (!hovering || previewUrl !== null || loading) return;

    const query = video.title
      ? `${video.artistName} ${video.title}`
      : video.artistName;

    setLoading(true);
    fetch(`https://api.deezer.com/search?q=${encodeURIComponent(query)}&limit=3`)
      .then((r) => r.json())
      .then((d) => {
        const track = d.data?.[0];
        setPreviewUrl(track?.preview ?? "");
      })
      .catch(() => setPreviewUrl(""))
      .finally(() => setLoading(false));
  }, [hovering, previewUrl, loading, video.title, video.artistName]);

  // Jouer/arrêter l'audio au hover
  useEffect(() => {
    if (!previewUrl) return;
    if (hovering) {
      if (!audioRef.current) audioRef.current = new Audio();
      audioRef.current.src = previewUrl;
      audioRef.current.volume = 0.4;
      audioRef.current.play().catch(() => {});
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
    }
  }, [hovering, previewUrl]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (audioRef.current) audioRef.current.pause();
    };
  }, []);

  const destination = video.shareUrl ?? video.embedLink;

  return (
    <div
      className="artist-top-video"
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      <a
        href={destination ?? "#"}
        target="_blank"
        rel="noopener noreferrer"
        className="artist-top-video__link"
      >
        {video.coverUrl ? (
          <img
            className="artist-top-video__cover"
            src={video.coverUrl}
            alt={video.title ?? "Vidéo TikTok"}
            width={200}
            height={356}
          />
        ) : (
          <div className="artist-top-video__placeholder">🎵</div>
        )}

        {/* Overlay au hover */}
        <div className={`artist-top-video__overlay${hovering ? " is-active" : ""}`}>
          <span className="artist-top-video__play">
            {hovering && previewUrl ? "♫ Extrait en cours…" : "▶ Voir sur TikTok"}
          </span>
        </div>

        {/* Badge stats */}
        <div className="artist-top-video__stats">
          <span>👁 {formatCompact(video.viewCount)}</span>
          <span>♥ {formatCompact(video.likeCount)}</span>
        </div>
      </a>

      {video.title && (
        <p className="artist-top-video__title">{video.title}</p>
      )}
    </div>
  );
}

function formatCompact(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return String(n);
}
