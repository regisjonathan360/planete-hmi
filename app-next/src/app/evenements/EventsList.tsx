/* eslint-disable @next/next/no-img-element */
"use client";

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
}

export function EventsList({ events }: { events: EventItem[] }) {
  if (events.length === 0) {
    return (
      <main style={{ padding: "4rem 1.5rem", textAlign: "center", minHeight: "60vh" }}>
        <h1 style={{ fontSize: "2rem", marginBottom: "1rem" }}>Événements HMI</h1>
        <p style={{ color: "#9a9ac0" }}>Aucun événement à venir pour le moment.</p>
      </main>
    );
  }

  return (
    <main style={{ padding: "2rem 1.5rem", maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ marginBottom: "2rem" }}>
        <h1 style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>Événements <span style={{ color: "#7c5cff" }}>HMI</span></h1>
        <p style={{ color: "#9a9ac0" }}>Concerts, festivals et événements musicaux haïtiens.</p>
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
        gap: "1.25rem",
      }}>
        {events.map((event) => (
          <a
            key={event.id}
            href={event.source_url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "block",
              borderRadius: 12,
              overflow: "hidden",
              background: "#14142a",
              border: "1px solid #2a2a4a",
              textDecoration: "none",
              color: "inherit",
              transition: "border-color 0.2s, transform 0.2s",
            }}
          >
            {(event.display_image_url || event.source_image_url) && (
              <img
                src={event.display_image_url || event.source_image_url!}
                alt=""
                style={{ width: "100%", height: 180, objectFit: "cover" }}
                loading="lazy"
              />
            )}
            <div style={{ padding: "1.1rem" }}>
              <h3 style={{ fontSize: "1.05rem", margin: "0 0 0.5rem", lineHeight: 1.3 }}>
                {event.display_title || event.source_title}
              </h3>
              {event.source_date && (
                <p style={{ margin: "0 0 0.3rem", fontSize: "0.85rem", color: "#7c5cff", fontWeight: 600 }}>
                  📅 {event.source_date} {event.source_time && `· ${event.source_time}`}
                </p>
              )}
              {event.source_location && (
                <p style={{ margin: "0 0 0.3rem", fontSize: "0.83rem", color: "#9a9ac0" }}>
                  📍 {event.source_location}
                </p>
              )}
              {event.source_price && (
                <p style={{ margin: "0", fontSize: "0.8rem", color: "#00d4b8" }}>
                  🎫 {event.source_price}
                </p>
              )}
              {event.display_description && (
                <p style={{ margin: "0.5rem 0 0", fontSize: "0.85rem", color: "#9a9ac0" }}>
                  {event.display_description}
                </p>
              )}
            </div>
          </a>
        ))}
      </div>
    </main>
  );
}
