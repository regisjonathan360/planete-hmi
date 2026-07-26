/* eslint-disable @next/next/no-img-element */
"use client";

interface Article {
  id: string;
  source_url: string;
  source_title: string;
  source_image_url: string | null;
  source_excerpt: string | null;
  source_author: string | null;
  source_date: string | null;
  display_title: string | null;
  display_image_url: string | null;
  display_excerpt: string | null;
  category: string;
  is_featured: boolean;
  published_at: string | null;
}

export function NewsList({ articles }: { articles: Article[] }) {
  if (articles.length === 0) {
    return (
      <main style={{ padding: "4rem 1.5rem", textAlign: "center", minHeight: "60vh" }}>
        <h1 style={{ fontSize: "2rem", marginBottom: "1rem" }}>Actualités HMI</h1>
        <p style={{ color: "#9a9ac0" }}>Aucune actualité disponible pour le moment.</p>
      </main>
    );
  }

  const featured = articles.find((a) => a.is_featured) ?? articles[0];
  const rest = articles.filter((a) => a.id !== featured.id);

  return (
    <main style={{ padding: "2rem 1.5rem", maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ marginBottom: "2rem" }}>
        <h1 style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>Actualités <span style={{ color: "var(--accent, #7c5cff)" }}>HMI</span></h1>
        <p style={{ color: "#9a9ac0" }}>Sorties, interviews, records et coulisses.</p>
      </div>

      {/* Article à la une */}
      <a
        href={featured.source_url}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: "block",
          marginBottom: "2rem",
          borderRadius: 12,
          overflow: "hidden",
          background: "#14142a",
          textDecoration: "none",
          color: "inherit",
          border: "1px solid #2a2a4a",
        }}
      >
        {(featured.display_image_url || featured.source_image_url) && (
          <img
            src={featured.display_image_url || featured.source_image_url!}
            alt=""
            style={{ width: "100%", height: 300, objectFit: "cover" }}
          />
        )}
        <div style={{ padding: "1.25rem" }}>
          <span style={{ fontSize: "0.75rem", textTransform: "uppercase", color: "#7c5cff", letterSpacing: "0.05em" }}>
            À la une · {featured.category}
          </span>
          <h2 style={{ fontSize: "1.35rem", margin: "0.5rem 0 0.4rem", lineHeight: 1.3 }}>
            {featured.display_title || featured.source_title}
          </h2>
          {(featured.display_excerpt || featured.source_excerpt) && (
            <p style={{ color: "#9a9ac0", fontSize: "0.9rem", margin: 0 }}>
              {featured.display_excerpt || featured.source_excerpt}
            </p>
          )}
          <span style={{ fontSize: "0.8rem", color: "#666", marginTop: "0.5rem", display: "inline-block" }}>
            {featured.source_date} {featured.source_author && `· ${featured.source_author}`}
          </span>
        </div>
      </a>

      {/* Grille des autres articles */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
        gap: "1.25rem",
      }}>
        {rest.map((article) => (
          <a
            key={article.id}
            href={article.source_url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "block",
              borderRadius: 10,
              overflow: "hidden",
              background: "#14142a",
              border: "1px solid #2a2a4a",
              textDecoration: "none",
              color: "inherit",
              transition: "border-color 0.2s",
            }}
          >
            {(article.display_image_url || article.source_image_url) && (
              <img
                src={article.display_image_url || article.source_image_url!}
                alt=""
                style={{ width: "100%", height: 160, objectFit: "cover" }}
                loading="lazy"
              />
            )}
            <div style={{ padding: "1rem" }}>
              <span style={{ fontSize: "0.7rem", textTransform: "uppercase", color: "#7c5cff" }}>
                {article.category}
              </span>
              <h3 style={{ fontSize: "1rem", margin: "0.35rem 0", lineHeight: 1.3 }}>
                {article.display_title || article.source_title}
              </h3>
              <span style={{ fontSize: "0.75rem", color: "#666" }}>
                {article.source_date}
              </span>
            </div>
          </a>
        ))}
      </div>
    </main>
  );
}
