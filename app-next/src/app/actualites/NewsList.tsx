"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import "./actualites.css";

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

const ALL_CATEGORIES = "Toutes";

function articleTitle(article: Article) {
  return article.display_title || article.source_title;
}

function articleImage(article: Article, featured = false) {
  return (
    article.display_image_url ||
    article.source_image_url ||
    (featured
      ? "/image/covers/planet-hmi-cover-placeholder-banner.webp.webp"
      : "/image/covers/planet-hmi-cover-placeholder-square.webp.webp")
  );
}

function articleExcerpt(article: Article) {
  return article.display_excerpt || article.source_excerpt;
}

function formatDate(article: Article) {
  const rawDate = article.published_at || article.source_date;
  if (!rawDate) return null;

  const date = new Date(rawDate);
  if (Number.isNaN(date.getTime())) return article.source_date;

  return new Intl.DateTimeFormat("fr-HT", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function ArticleCard({
  article,
  featured = false,
}: {
  article: Article;
  featured?: boolean;
}) {
  const title = articleTitle(article);
  const excerpt = articleExcerpt(article);
  const date = formatDate(article);

  return (
    <a
      href={article.source_url}
      target="_blank"
      rel="noopener noreferrer"
      className={`news-card${featured ? " news-card--feature" : ""}`}
      aria-label={`Lire « ${title} »`}
    >
      <div className="news-card__media">
        <Image
          unoptimized
          src={articleImage(article, featured)}
          alt={title}
          width={featured ? 800 : 480}
          height={featured ? 400 : 300}
          sizes={featured ? "(max-width: 720px) 100vw, 66vw" : "(max-width: 720px) 100vw, 33vw"}
        />
        {featured && <span className="news-card__feature-badge">À la une</span>}
      </div>
      <div className="news-card__body">
        <span className="news-card__tag">{article.category}</span>
        <h2 className="news-card__title">{title}</h2>
        {excerpt && <p className="news-card__excerpt">{excerpt}</p>}
        <div className="news-card__meta">
          {date && <time className="news-card__date">{date}</time>}
          {article.source_author && (
            <span className="news-card__source">{article.source_author}</span>
          )}
        </div>
      </div>
    </a>
  );
}

export function NewsList({ articles }: { articles: Article[] }) {
  const categories = useMemo(
    () => [
      ALL_CATEGORIES,
      ...Array.from(
        new Set(articles.map((article) => article.category).filter(Boolean))
      ).sort((a, b) => a.localeCompare(b, "fr")),
    ],
    [articles]
  );
  const [activeCategory, setActiveCategory] = useState(ALL_CATEGORIES);

  const visibleArticles = useMemo(
    () =>
      activeCategory === ALL_CATEGORIES
        ? articles
        : articles.filter((article) => article.category === activeCategory),
    [activeCategory, articles]
  );

  const featured =
    visibleArticles.find((article) => article.is_featured) ?? visibleArticles[0] ?? null;
  const rest = featured
    ? visibleArticles.filter((article) => article.id !== featured.id)
    : [];

  return (
    <>
      <div className="grain" aria-hidden="true" />
      <div className="cosmos news-cosmos" aria-hidden="true">
        <div className="cosmos__layer cosmos__stars-distant" data-depth="0.06" />
        <div className="cosmos__layer cosmos__stars-near" data-depth="0.14" />
        <div className="cosmos__glow" />
      </div>

      <a className="skip-link" href="#contenu">Aller au contenu principal</a>
      <SiteHeader />

      <main id="contenu" className="news-page">
        <section className="page-hero news-page__hero">
          <div className="wrap">
            <p className="breadcrumb">
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- rechargement complet volontaire */}
              <a href="/">Accueil</a> / Actualités
            </p>
            <p className="section-tag">{"// La musique haïtienne en mouvement"}</p>
            <h1 className="page-title">
              Actualités <span className="fx-o">HMI</span>
            </h1>
            <p className="page-lead">
              Sorties, interviews, records et coulisses. Tout ce qui fait vibrer la planète.
            </p>
          </div>
        </section>

        <div className="wrap news-page__content">
          {categories.length > 1 && (
            <div
              className="pill-row news-page__filters"
              role="group"
              aria-label="Filtrer les actualités par rubrique"
            >
              {categories.map((category) => (
                <button
                  key={category}
                  type="button"
                  className={`pill${activeCategory === category ? " is-active" : ""}`}
                  aria-pressed={activeCategory === category}
                  onClick={() => setActiveCategory(category)}
                >
                  {category}
                </button>
              ))}
            </div>
          )}

          <section className="section section--tight" aria-live="polite">
            {featured ? (
              <>
                <div className="news-page__section-heading">
                  <div>
                    <span className="section-tag">
                      {`// ${activeCategory === ALL_CATEGORIES ? "Dernières publications" : activeCategory}`}
                    </span>
                    <h2>À lire maintenant</h2>
                  </div>
                  <span className="news-page__count">
                    {visibleArticles.length} article{visibleArticles.length > 1 ? "s" : ""}
                  </span>
                </div>

                <div className="news-grid">
                  <ArticleCard article={featured} featured />
                  {rest.map((article) => (
                    <ArticleCard key={article.id} article={article} />
                  ))}
                </div>
              </>
            ) : (
              <div className="news-page__empty">
                <span className="section-tag">{"// Actualités HMI"}</span>
                <h2>Aucune publication disponible</h2>
                <p>
                  Les prochaines nouvelles de la musique haïtienne apparaîtront ici dès leur
                  publication.
                </p>
                {activeCategory !== ALL_CATEGORIES && (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => setActiveCategory(ALL_CATEGORIES)}
                  >
                    Voir toutes les actualités
                  </button>
                )}
              </div>
            )}
          </section>
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
