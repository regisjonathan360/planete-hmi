import type { Metadata } from "next";
import { SITE_NAME, SITE_URL, SOCIAL_IMAGE } from "./site-config";

/**
 * Options pour générer les métadonnées d'une page
 */
export interface PageMetadataOptions {
  title: string;
  description: string;
  path: string;
  image?: {
    url: string;
    width?: number;
    height?: number;
    alt?: string;
  };
  type?: "website" | "article" | "profile";
  keywords?: string[];
  noindex?: boolean;
  canonical?: string;
  publishedTime?: string;
  modifiedTime?: string;
  author?: string;
}

/**
 * Génère les métadonnées complètes pour une page
 */
export function generatePageMetadata(
  options: PageMetadataOptions
): Metadata {
  const {
    title,
    description,
    path,
    image = SOCIAL_IMAGE,
    type = "website",
    keywords = [],
    noindex = false,
    canonical,
    publishedTime,
    modifiedTime,
    author,
  } = options;

  const url = `${SITE_URL}${path}`;
  const fullTitle = title === SITE_NAME ? title : `${title} | ${SITE_NAME}`;

  const metadata: Metadata = {
    title,
    description,
    keywords: keywords.length > 0 ? keywords : undefined,
    authors: author ? [{ name: author }] : undefined,
    openGraph: {
      title: fullTitle,
      description,
      url,
      siteName: SITE_NAME,
      locale: "fr_HT",
      type,
      images: [
        {
          url: image.url.startsWith("http") ? image.url : `${SITE_URL}${image.url}`,
          width: image.width || SOCIAL_IMAGE.width,
          height: image.height || SOCIAL_IMAGE.height,
          alt: image.alt || `${title} - ${SITE_NAME}`,
        },
      ],
      ...(publishedTime && { publishedTime }),
      ...(modifiedTime && { modifiedTime }),
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: [image.url.startsWith("http") ? image.url : `${SITE_URL}${image.url}`],
    },
    alternates: {
      canonical: canonical || url,
    },
    robots: noindex
      ? {
          index: false,
          follow: false,
        }
      : {
          index: true,
          follow: true,
        },
  };

  return metadata;
}

/**
 * Génère les métadonnées pour une page d'artiste
 */
export function generateArtistMetadata(artist: {
  name: string;
  bio?: string;
  image?: string;
  slug: string;
}): Metadata {
  return generatePageMetadata({
    title: artist.name,
    description:
      artist.bio ||
      `Découvrez ${artist.name} sur Planète HMI. Classements, actualités et toute l'info sur cet artiste haïtien.`,
    path: `/artistes/${artist.slug}`,
    image: artist.image
      ? {
          url: artist.image,
          alt: `${artist.name} - Artiste haïtien`,
        }
      : undefined,
    type: "profile",
    keywords: [
      artist.name,
      "artiste haïtien",
      "musique haïtienne",
      "Planète HMI",
    ],
  });
}

/**
 * Génère les métadonnées pour une page d'actualité
 */
export function generateArticleMetadata(article: {
  title: string;
  excerpt?: string;
  image?: string;
  slug: string;
  publishedAt?: string;
  updatedAt?: string;
  author?: string;
}): Metadata {
  return generatePageMetadata({
    title: article.title,
    description:
      article.excerpt ||
      `Actualité musique haïtienne : ${article.title}`,
    path: `/actualites/${article.slug}`,
    image: article.image
      ? {
          url: article.image,
          alt: article.title,
        }
      : undefined,
    type: "article",
    publishedTime: article.publishedAt,
    modifiedTime: article.updatedAt,
    author: article.author,
    keywords: [
      "actualité",
      "musique haïtienne",
      "news",
      "Planète HMI",
    ],
  });
}

/**
 * Génère les métadonnées pour une page de chart
 */
export function generateChartMetadata(chart: {
  platform: string;
  title: string;
  description?: string;
  slug: string;
}): Metadata {
  return generatePageMetadata({
    title: chart.title,
    description:
      chart.description ||
      `Découvrez le classement ${chart.platform} de la musique haïtienne sur Planète HMI.`,
    path: `/charts/${chart.slug}`,
    keywords: [
      "classement",
      "chart",
      chart.platform,
      "musique haïtienne",
      "top",
      "Planète HMI",
    ],
  });
}
