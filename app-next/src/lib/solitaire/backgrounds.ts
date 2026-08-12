/**
 * Fonds de table sélectionnables pour le Solitaire de l'Arène.
 *
 * Les images vivent dans /public/games/solitaire/backgrounds (copiées depuis
 * le dossier « Background image » du projet Solitaire). Le choix du joueur
 * est persisté dans localStorage et diffusé au container de jeu via un
 * CustomEvent (aucun état redux ajouté).
 */

export interface SolitaireBackground {
  id: string;
  label: string;
  src: string;
}

/** "classic" = le vert Windows 95 d'origine (pas une image). */
export const SOLITAIRE_CLASSIC_BACKGROUND_ID = "classic";

export const SOLITAIRE_BACKGROUNDS: SolitaireBackground[] = [
  {
    id: "cosmic-planet-space",
    label: "Espace planète",
    src: "/games/solitaire/backgrounds/cosmic-planet-space.webp",
  },
  {
    id: "planet-hmi",
    label: "Planète HMI",
    src: "/games/solitaire/backgrounds/planet-hmi-background.webp",
  },
  {
    id: "planet-hmi-desktop",
    label: "Planète HMI — Bureau",
    src: "/games/solitaire/backgrounds/planet-hmi-background-desktop.webp",
  },
  {
    id: "planet-hmi-mobile",
    label: "Planète HMI — Mobile",
    src: "/games/solitaire/backgrounds/planet-hmi-background-mobile.webp",
  },
  {
    id: "planet-hmi-artist-desktop",
    label: "Artist — Bureau",
    src: "/games/solitaire/backgrounds/planet-hmi-artist-background-desktop.webp",
  },
  {
    id: "planet-hmi-artist-mobile",
    label: "Artist — Mobile",
    src: "/games/solitaire/backgrounds/planet-hmi-artist-background-mobile.webp",
  },
  {
    id: "planet-hmi-hero-head",
    label: "Hero Head",
    src: "/games/solitaire/backgrounds/planet-hmi-hero-head.webp",
  },
  {
    id: "planet-hmi-profil-desktop",
    label: "Profil — Bureau",
    src: "/games/solitaire/backgrounds/planet-hmi-profil-background-desktop.webp",
  },
  {
    id: "planet-hmi-profil-mobile",
    label: "Profil — Mobile",
    src: "/games/solitaire/backgrounds/planet-hmi-profil-background-mobile.webp",
  },
];

export const SOLITAIRE_BACKGROUND_STORAGE_KEY = "solitaire95.background";
export const SOLITAIRE_BACKGROUND_EVENT = "solitaire95.background";

export function getSolitaireBackgroundById(
  id: string | null
): SolitaireBackground | null {
  if (!id || id === SOLITAIRE_CLASSIC_BACKGROUND_ID) return null;
  return SOLITAIRE_BACKGROUNDS.find((background) => background.id === id) ?? null;
}

/** Fond actuellement choisi (null = fond classique). Jamais d'exception SSR. */
export function getStoredSolitaireBackground(): SolitaireBackground | null {
  if (typeof window === "undefined") return null;
  try {
    return getSolitaireBackgroundById(
      window.localStorage.getItem(SOLITAIRE_BACKGROUND_STORAGE_KEY)
    );
  } catch {
    return null;
  }
}

/** Enregistre le choix et le diffuse à tous les containers de jeu ouverts. */
export function setStoredSolitaireBackground(
  background: SolitaireBackground | null
): void {
  if (typeof window === "undefined") return;
  try {
    if (background) {
      window.localStorage.setItem(
        SOLITAIRE_BACKGROUND_STORAGE_KEY,
        background.id
      );
    } else {
      window.localStorage.removeItem(SOLITAIRE_BACKGROUND_STORAGE_KEY);
    }
  } catch {
    return;
  }
  window.dispatchEvent(
    new CustomEvent(SOLITAIRE_BACKGROUND_EVENT, {
      detail: { background: background ?? null },
    })
  );
}

/** Abonnement au changement de fond (retourne la fonction de désabonnement). */
export function subscribeSolitaireBackground(
  listener: (background: SolitaireBackground | null) => void
): () => void {
  if (typeof window === "undefined") return () => undefined;
  const handler = (event: Event) => {
    const detail = (event as CustomEvent).detail as
      | { background: SolitaireBackground | null }
      | undefined;
    listener(detail?.background ?? null);
  };
  window.addEventListener(SOLITAIRE_BACKGROUND_EVENT, handler);
  return () => window.removeEventListener(SOLITAIRE_BACKGROUND_EVENT, handler);
}