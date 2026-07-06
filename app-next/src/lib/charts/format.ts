/** Helpers de formatage pour l'affichage des classements. */

export const FUSEAU_OFFICIEL = "America/Port-au-Prince";

/** Date/heure ISO -> texte en heure d'Haïti. */
export function dateHaiti(iso: string | null | undefined, avecHeure = false): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("fr-FR", {
      timeZone: FUSEAU_OFFICIEL,
      day: "numeric",
      month: "long",
      year: "numeric",
      ...(avecHeure ? { hour: "2-digit", minute: "2-digit" } : {}),
    });
  } catch {
    return "—";
  }
}

/** Entier compact : 12 400 -> "12,4 k". */
export function nombreCompact(n: number | null | undefined): string {
  if (n == null || isNaN(Number(n))) return "—";
  const v = Number(n);
  if (v >= 1e9) return (v / 1e9).toFixed(1).replace(".", ",") + " Md";
  if (v >= 1e6) return (v / 1e6).toFixed(1).replace(".", ",") + " M";
  if (v >= 1e3) return (v / 1e3).toFixed(1).replace(".", ",") + " k";
  return String(v);
}

/** Libellé lisible d'une métrique selon son unité. */
export function libelleMetrique(value: number | null, unit: string | null): string | null {
  if (value == null || !unit) return null;
  switch (unit) {
    case "posts_count":
      return `${nombreCompact(value)} publications`;
    case "haiti_views":
      return `${nombreCompact(value)} vues en Haïti`;
    case "global_views":
      return `${nombreCompact(value)} vues globales`;
    case "weekly_view_delta":
      return `+${nombreCompact(value)} vues / 7 j`;
    default:
      return `${nombreCompact(value)} ${unit}`;
  }
}

/** Slug de route par plateforme. */
export const SLUG_PAR_PLATEFORME: Record<string, string> = {
  youtube: "youtube",
  spotify: "spotify",
  audiomack: "audiomack",
  apple_music: "apple-music",
  tiktok: "tiktok",
};

/** source_key principal par slug de plateforme (page détail). */
export const SOURCE_KEY_PAR_SLUG: Record<string, string> = {
  youtube: "youtube_haiti_official",
  spotify: "spotify_haiti_popular",
  audiomack: "audiomack_haiti_weekly100",
  "apple-music": "apple_hmi_worldwide",
  tiktok: "tiktok_haiti_sounds",
};

/** Libellé + variante du badge de méthode (mode d'ingestion / péremption). */
export function badgeMethode(ingestionMode: string, isStale: boolean | null): {
  label: string;
  variant: "api" | "import" | "partner" | "stale" | "experimental";
} {
  if (isStale) return { label: "Mise à jour en attente", variant: "stale" };
  switch (ingestionMode) {
    case "OFFICIAL_API":
      return { label: "API officielle", variant: "api" };
    case "OFFICIAL_EXPORT":
      return { label: "Export officiel", variant: "import" };
    case "VERIFIED_ADMIN_IMPORT":
      return { label: "Import officiel vérifié", variant: "import" };
    case "PARTNER_FEED":
      return { label: "Flux partenaire", variant: "partner" };
    default:
      return { label: "Données expérimentales", variant: "experimental" };
  }
}
