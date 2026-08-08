import type { Metadata } from "next";
import {
  SITE_NAME,
  SITE_URL,
  SITE_DESCRIPTION,
  SITE_LOCALE,
  SOCIAL_IMAGE,
} from "@/lib/site-config";

export interface PageMetadataProps {
  title: string;
  description?: string;
  image?: {
    url: string;
    width: number;
    height: number;
    alt: string;
  };
  path?: string;
  noIndex?: boolean;
  keywords?: string[];
  type?: "website" | "article" | "profile";
  publishedTime?: string;
  modifiedTime?: string;
}

/**
 * Génère les métadonnées pour une page
 */
export function generatePageMetadata({
  title,
  description = SITE_DESCRIPTION,
  image = SOCIAL_IMAGE,
  path = "",
  noIndex = false,
  keywords = [],
  type = "website",
  publishedTime,
  modifiedTime,
}: PageMetadataProps): Metadata {
  const pageUrl = `${SITE_URL}${path}`;
  const fullTitle = title === SITE_NAME ? title : `${title} | ${SITE_NAME}`;

  const metadata: Metadata = {
    title,
    description,
    keywords: keywords.length > 0 ? keywords : undefined,
    openGraph: {
      title: fullTitle,
      description,
      url: pageUrl,
      siteName: SITE_NAME,
      locale: SITE_LOCALE,
      type,
      images: [
        {
          url: image.url.startsWith("http") ? image.url : `${SITE_URL}${image.url}`,
          width: image.width,
          height: image.height,
          alt: image.alt,
        },
      ],
      ...(type === "article" && {
        publishedTime,
        modifiedTime,
      }),
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: [
        {
          url: image.url.startsWith("http") ? image.url : `${SITE_URL}${image.url}`,
          width: image.width,
          height: image.height,
          alt: image.alt,
        },
      ],
    },
    alternates: {
      canonical: pageUrl,
    },
    robots: noIndex
      ? {
          index: false,
          follow: true,
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
export function generateArtistMetadata({
  name,
  description,
  image,
  slug,
}: {
  name: string;
  description?: string;
  image?: string;
  slug: string;
}): Metadata {
  return generatePageMetadata({
    title: name,
    description:
      description ||
      `Découvrez ${name} sur ${SITE_NAME}. Classements, statistiques et tendances de l'artiste.`,
    path: `/artistes/${slug}`,
    type: "profile",
    keywords: [name, "artiste haïtien", "musique haïtienne", SITE_NAME],
    ...(image && {
      image: {
        url: image,
        width: 1200,
        height: 630,
        alt: name,
      },
    }),
  });
}

/**
 * Génère les métadonnées pour une page d'actualité
 */
export function generateNewsMetadata({
  title,
  description,
  image,
  slug,
  publishedAt,
  updatedAt,
}: {
  title: string;
  description: string;
  image?: string;
  slug: string;
  publishedAt: string;
  updatedAt?: string;
}): Metadata {
  return generatePageMetadata({
    title,
    description,
    path: `/actualites/${slug}`,
    type: "article",
    publishedTime: publishedAt,
    modifiedTime: updatedAt || publishedAt,
    keywords: ["actualités", "musique haïtienne", SITE_NAME],
    ...(image && {
      image: {
        url: image,
        width: 1200,
        height: 630,
        alt: title,
      },
    }),
  });
}

/**
 * Génère les métadonnées pour une page d'événement
 */
export function generateEventMetadata({
  name,
  description,
  image,
  slug,
  startDate,
}: {
  name: string;
  description: string;
  image?: string;
  slug: string;
  startDate: string;
}): Metadata {
  return generatePageMetadata({
    title: name,
    description,
    path: `/evenements/${slug}`,
    type: "article",
    publishedTime: startDate,
    keywords: ["événements", "concerts", "musique haïtienne", SITE_NAME],
    ...(image && {
      image: {
        url: image,
        width: 1200,
        height: 630,
        alt: name,
      },
    }),
  });
}
