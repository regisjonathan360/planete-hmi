import { SITE_NAME, SITE_DESCRIPTION, SITE_URL } from "./site-config";

/**
 * Génère le schéma JSON-LD pour le site web
 */
export function generateWebSiteSchema() {
  return {
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    url: SITE_URL,
    name: SITE_NAME,
    description: SITE_DESCRIPTION,
    inLanguage: "fr-HT",
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE_URL}/recherche?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

/**
 * Génère le schéma JSON-LD pour l'organisation
 */
export function generateOrganizationSchema() {
  return {
    "@type": "Organization",
    "@id": `${SITE_URL}/#organization`,
    name: SITE_NAME,
    alternateName: "Planète HMI",
    url: SITE_URL,
    description: SITE_DESCRIPTION,
    logo: {
      "@type": "ImageObject",
      "@id": `${SITE_URL}/#logo`,
      url: `${SITE_URL}/brand/icon-512x512.png`,
      contentUrl: `${SITE_URL}/brand/icon-512x512.png`,
      width: 512,
      height: 512,
      caption: `${SITE_NAME} - Logo`,
    },
    image: {
      "@type": "ImageObject",
      url: `${SITE_URL}/brand/icon-512x512.png`,
      width: 512,
      height: 512,
    },
    sameAs: [
      // TODO: Ajouter les liens réseaux sociaux quand disponibles
      // "https://www.facebook.com/planetehmi",
      // "https://www.instagram.com/planetehmi",
      // "https://twitter.com/planetehmi",
    ],
  };
}

/**
 * Génère le schéma JSON-LD pour un artiste
 */
export function generateArtistSchema(artist: {
  name: string;
  bio?: string;
  image?: string;
  url: string;
  sameAs?: string[];
}) {
  return {
    "@context": "https://schema.org",
    "@type": "MusicGroup",
    name: artist.name,
    description: artist.bio,
    image: artist.image,
    url: artist.url,
    sameAs: artist.sameAs || [],
  };
}

/**
 * Génère le schéma JSON-LD pour un article/actualité
 */
export function generateArticleSchema(article: {
  title: string;
  description: string;
  image?: string;
  url: string;
  datePublished: string;
  dateModified?: string;
  author?: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.description,
    image: article.image,
    url: article.url,
    datePublished: article.datePublished,
    dateModified: article.dateModified || article.datePublished,
    author: {
      "@type": "Organization",
      name: article.author || SITE_NAME,
      url: SITE_URL,
    },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      url: SITE_URL,
      logo: {
        "@type": "ImageObject",
        url: `${SITE_URL}/brand/icon-512x512.png?v=2`,
      },
    },
  };
}

/**
 * Génère le schéma JSON-LD pour un événement
 */
export function generateEventSchema(event: {
  name: string;
  description: string;
  image?: string;
  url: string;
  startDate: string;
  endDate?: string;
  location?: {
    name: string;
    address?: string;
  };
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Event",
    name: event.name,
    description: event.description,
    image: event.image,
    url: event.url,
    startDate: event.startDate,
    endDate: event.endDate,
    location: event.location
      ? {
          "@type": "Place",
          name: event.location.name,
          address: event.location.address,
        }
      : undefined,
    organizer: {
      "@type": "Organization",
      name: SITE_NAME,
      url: SITE_URL,
    },
  };
}

/**
 * Génère le schéma JSON-LD pour une collection musicale (chart)
 */
export function generateMusicPlaylistSchema(chart: {
  name: string;
  description: string;
  url: string;
  tracks?: Array<{
    name: string;
    artist: string;
  }>;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "MusicPlaylist",
    name: chart.name,
    description: chart.description,
    url: chart.url,
    numTracks: chart.tracks?.length,
    track: chart.tracks?.map((track, index) => ({
      "@type": "MusicRecording",
      position: index + 1,
      name: track.name,
      byArtist: {
        "@type": "MusicGroup",
        name: track.artist,
      },
    })),
  };
}

/**
 * Type pour un élément de breadcrumb
 */
export interface BreadcrumbItem {
  name: string;
  url: string;
}

/**
 * Génère le schéma JSON-LD pour un fil d'Ariane (breadcrumbs)
 */
export function generateBreadcrumbSchema(items: BreadcrumbItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url.startsWith("http") ? item.url : `${SITE_URL}${item.url}`,
    })),
  };
}
