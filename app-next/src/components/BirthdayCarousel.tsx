"use client";

import { useEffect, useState } from "react";

interface BirthdayArtist {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
  tags: string[];
  isToday: boolean;
  daysUntil: number;
}

/**
 * Section "Anniversaires des artistes" — carrousel défilant.
 * Affiche les artistes qui fêtent leur anniversaire aujourd'hui ou dans les 7 jours.
 */
export function BirthdayCarousel() {
  const [artists, setArtists] = useState<BirthdayArtist[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/artists/birthdays")
      .then((r) => r.json())
      .then((d) => setArtists(d.birthdays ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading || artists.length === 0) return null;

  return (
    <section className="birthday-section" aria-label="Anniversaires des artistes">
      <h2 className="birthday-section__title">🎂 Anniversaires des artistes</h2>
      <div className="birthday-carousel">
        <div className="birthday-carousel__track">
          {/* Double les items pour l'animation infinie */}
          {[...artists, ...artists].map((a, i) => (
            <a
              key={`${a.id}-${i}`}
              href={`/artistes/${a.slug}`}
              className={`birthday-card${a.isToday ? " birthday-card--today" : ""}`}
            >
              <img
                className="birthday-card__img"
                src={a.imageUrl ?? "/image/artists/planet-hmi-artist-placeholder-square.webp.webp"}
                alt={a.name}
                width={80}
                height={80}
              />
              <div className="birthday-card__info">
                <span className="birthday-card__name">{a.name}</span>
                <span className="birthday-card__label">
                  {a.isToday ? "🎉 Aujourd'hui !" : `Dans ${a.daysUntil} jour${a.daysUntil > 1 ? "s" : ""}`}
                </span>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
