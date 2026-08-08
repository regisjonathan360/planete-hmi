import { SITE_NAME, SITE_URL, SITE_DESCRIPTION } from "@/lib/site-config";

/**
 * Génère les données structurées JSON-LD pour le SEO
 */

export interface BreadcrumbItem {
  name: string;
  url: string;
}

export function generateOrganizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_URL,
    description: SITE_DESCRIPTION,
    logo: {
      "@type": "ImageObject",
      url: `${SITE_URL}/brand/icon-512x512.png`,
      width: 512,
      height: 512,
    },
    sameAs: [
      // Ajouter les réseaux sociaux ici quand disponibles
    ],
  };
}

export function generateWebSiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL,
    description: SITE_DESCRIPTION,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE_URL}/artistes?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

export function generateBreadcrumbSchema(items: BreadcrumbItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export function generateMusicGroupSchema(artist: {
  name: string;
  url: string;
  image?: string;
  description?: string;
  genre?: string[];
}) {
  return {
    "@context": "https://schema.org",
    "@type": "MusicGroup",
    name: artist.name,
    url: artist.url,
    ...(artist.image && {
      image: artist.image,
    }),
    ...(artist.description && {
      description: artist.description,
    }),
    ...(artist.genre && artist.genre.length > 0 && {
      genre: artist.genre,
    }),
  };
}

export function generateArticleSchema(article: {
  title: string;
  description: string;
  url: string;
  image?: string;
  datePublished: string;
  dateModified?: string;
  author?: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.description,
    url: article.url,
    ...(article.image && {
      image: article.image,
    }),
    datePublished: article.datePublished,
    dateModified: article.dateModified || article.datePublished,
    author: {
      "@type": "Organization",
      name: article.author || SITE_NAME,
    },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      logo: {
        "@type": "ImageObject",
        url: `${SITE_URL}/brand/icon-512x512.png`,
      },
    },
  };
}

export function generateEventSchema(event: {
  name: string;
  description: string;
  url: string;
  startDate: string;
  endDate?: string;
  location?: {
    name: string;
    address?: string;
  };
  image?: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "MusicEvent",
    name: event.name,
    description: event.description,
    url: event.url,
    startDate: event.startDate,
    ...(event.endDate && {
      endDate: event.endDate,
    }),
    ...(event.location && {
      location: {
        "@type": "Place",
        name: event.location.name,
        ...(event.location.address && {
          address: event.location.address,
        }),
      },
    }),
    ...(event.image && {
      image: event.image,
    }),
    organizer: {
      "@type": "Organization",
      name: SITE_NAME,
      url: SITE_URL,
    },
  };
}
