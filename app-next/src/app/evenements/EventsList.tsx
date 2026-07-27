/* eslint-disable @next/next/no-img-element */
"use client";

import { useState } from "react";
import styles from "./evenements.module.css";

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
  display_image_url: string | null;
  display_description: string | null;
  category: string;
  is_featured: boolean;
  published_at: string | null;
  event_date: string | null;
}

export function EventsList({ events, savedIds, isLoggedIn }: { events: EventItem[]; savedIds: string[]; isLoggedIn: boolean }) {
  const [saved, setSaved] = useState<Set<string>>(new Set(savedIds));

  async function toggleSave(eventId: string) {
    if (!isLoggedIn) return;
    const isSaved = saved.has(eventId);
    const method = isSaved ? "DELETE" : "POST";

    setSaved((prev) => {
      const next = new Set(prev);
      if (isSaved) next.delete(eventId);
      else next.add(eventId);
      return next;
    });

    await fetch("/api/events/save", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId }),
    });
  }

  if (events.length === 0) {
    return (
      <main className={styles.page}>
        <div className={styles.hero}>
          <h1 className={styles.pageTitle}>Événements <span className={styles.accent}>HMI</span></h1>
          <p className={styles.lead}>Aucun événement à venir pour le moment.</p>
        </div>
      </main>
    );
  }

  const featured = events.find((e) => e.is_featured) ?? events[0];
  const rest = events.filter((e) => e.id !== featured.id);

  return (
    <main className={styles.page}>
      <div className={styles.hero}>
        <h1 className={styles.pageTitle}>Événements <span className={styles.accent}>HMI</span></h1>
        <p className={styles.lead}>Concerts, festivals et soirées de la musique haïtienne.</p>
      </div>

      {/* Événement à la une */}
      <section className={styles.featuredSection}>
        <a href={featured.source_url} target="_blank" rel="noopener noreferrer" className={styles.featuredCard}>
          {(featured.display_image_url || featured.source_image_url) && (
            <img src={featured.display_image_url || featured.source_image_url!} alt="" className={styles.featuredImage} />
          )}
          <div className={styles.featuredBody}>
            <span className={styles.tag}>À la une</span>
            <h2 className={styles.featuredTitle}>{featured.display_title || featured.source_title}</h2>
            {featured.source_date && <p className={styles.meta}>📅 {featured.source_date}</p>}
            {featured.source_location && <p className={styles.meta}>📍 {featured.source_location}</p>}
            {featured.display_description && <p className={styles.excerpt}>{featured.display_description}</p>}
          </div>
        </a>
        {isLoggedIn && (
          <button className={`${styles.saveBtn} ${saved.has(featured.id) ? styles.saved : ""}`} onClick={(e) => { e.preventDefault(); toggleSave(featured.id); }} title={saved.has(featured.id) ? "Retirer" : "Enregistrer"}>
            <BookmarkIcon filled={saved.has(featured.id)} />
          </button>
        )}
      </section>

      {/* Grille des événements */}
      <section className={styles.grid}>
        {rest.map((event) => (
          <article key={event.id} className={styles.card}>
            <a href={event.source_url} target="_blank" rel="noopener noreferrer" className={styles.cardLink}>
              {(event.display_image_url || event.source_image_url) ? (
                <img src={event.display_image_url || event.source_image_url!} alt="" className={styles.cardImage} loading="lazy" />
              ) : (
                <div className={styles.cardImagePlaceholder}>🎵</div>
              )}
              <div className={styles.cardBody}>
                <h3 className={styles.cardTitle}>{event.display_title || event.source_title}</h3>
                {event.source_date && <p className={styles.cardMeta}>📅 {event.source_date}</p>}
                {event.source_location && <p className={styles.cardMeta}>📍 {event.source_location}</p>}
                {event.source_price && <p className={styles.cardPrice}>🎫 {event.source_price}</p>}
              </div>
            </a>
            {isLoggedIn && (
              <button className={`${styles.saveBtn} ${styles.cardSaveBtn} ${saved.has(event.id) ? styles.saved : ""}`} onClick={() => toggleSave(event.id)} title={saved.has(event.id) ? "Retirer" : "Enregistrer"}>
                <BookmarkIcon filled={saved.has(event.id)} />
              </button>
            )}
          </article>
        ))}
      </section>
    </main>
  );
}

function BookmarkIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  );
}
