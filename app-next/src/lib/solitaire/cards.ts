/**
 * Domaine "Cartes du Solitaire personnalisables par artiste".
 * Partagé par : le rendu du jeu (SolitaireCardFace), l'aperçu admin,
 * l'API publique et l'API d'administration.
 *
 * Toutes les valeurs de masque/cadrage sont relatives (0 → 1) afin que
 * la composition reste proportionnelle quelle que soit la taille de la
 * carte (responsive mobile/tablette/desktop).
 */

export const SUITS = ["hearts", "diamonds", "clubs", "spades"] as const;
export type Suit = (typeof SUITS)[number];

export const RANKS = [
  "ace",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "jack",
  "queen",
  "king",
] as const;
export type Rank = (typeof RANKS)[number];

export type MaskType = "circle" | "square" | "rounded-square";

/** Rang affiché sur la carte. */
export const RANK_LABELS: Record<Rank, string> = {
  ace: "A",
  two: "2",
  three: "3",
  four: "4",
  five: "5",
  six: "6",
  seven: "7",
  eight: "8",
  nine: "9",
  ten: "10",
  jack: "J",
  queen: "Q",
  king: "K",
};

/** Enseignes affichées sur la carte. */
export const SUIT_GLYPHS: Record<Suit, string> = {
  hearts: "♥",
  diamonds: "♦",
  clubs: "♣",
  spades: "♠",
};

/** Lettre d'enseigne utilisée dans les clés de carte (ex. "KH"). */
export const SUIT_KEYS: Record<Suit, "H" | "D" | "C" | "S"> = {
  hearts: "H",
  diamonds: "D",
  clubs: "C",
  spades: "S",
};

/** Couleur des enseignes : rouge pour ♥/♦, noir pour ♣/♠ (jamais altérée par l'image). */
export const SUIT_COLOR: Record<Suit, "red" | "black"> = {
  hearts: "red",
  diamonds: "red",
  clubs: "black",
  spades: "black",
};

export const MASK_TYPES: MaskType[] = ["circle", "square", "rounded-square"];

/**
 * Configuration de style d'une carte : masque + cadrage de l'image.
 * Toutes les valeurs sont relatives (0 → 1).
 */
export interface CardStyleConfig {
  maskType: MaskType;
  /** Taille du masque (proportion de la largeur de la carte). */
  maskScale: number;
  /** Centre du masque sur l'axe X (0.5 = centré). */
  maskPositionX: number;
  /** Centre du masque sur l'axe Y. */
  maskPositionY: number;
  /** Zoom de l'image de l'artiste (≥ 1). */
  imageZoom: number;
  /** Point de mise au point de l'image sur l'axe X (object-position). */
  imagePositionX: number;
  /** Point de mise au point de l'image sur l'axe Y. */
  imagePositionY: number;
}

/** Configuration complète d'une carte, telle que consommée par le rendu. */
export interface CardFaceConfig extends CardStyleConfig {
  /** Clé unique de carte, ex. "KH" (roi de cœur). */
  cardKey: string;
  artistId: string | null;
  artistName: string | null;
  artistImageUrl: string | null;
}

export interface SolitaireCardRow {
  card_key: string;
  artist_id: string | null;
  mask_type: MaskType | null;
  mask_scale: number | null;
  mask_pos_x: number | null;
  mask_pos_y: number | null;
  image_zoom: number | null;
  image_pos_x: number | null;
  image_pos_y: number | null;
}

export interface SolitaireRankPresetRow {
  rank: string;
  mask_type: MaskType;
  mask_scale: number;
  mask_pos_x: number;
  mask_pos_y: number;
  image_zoom: number;
  image_pos_x: number;
  image_pos_y: number;
}

/**
 * Presets de masque par rang (spécification §21).
 * A–5 : cercle. 6–10 : carré arrondi. J/Q/K : carré.
 * Modifiables depuis l'administration (table solitaire_rank_presets).
 */
export const CARD_MASK_PRESETS: Record<Rank, CardStyleConfig> = {
  ace: { maskType: "circle", maskScale: 0.72, maskPositionX: 0.5, maskPositionY: 0.5, imageZoom: 1.1, imagePositionX: 0.5, imagePositionY: 0.35 },
  two: { maskType: "circle", maskScale: 0.42, maskPositionX: 0.5, maskPositionY: 0.5, imageZoom: 1.1, imagePositionX: 0.5, imagePositionY: 0.35 },
  three: { maskType: "circle", maskScale: 0.42, maskPositionX: 0.5, maskPositionY: 0.5, imageZoom: 1.1, imagePositionX: 0.5, imagePositionY: 0.35 },
  four: { maskType: "circle", maskScale: 0.42, maskPositionX: 0.5, maskPositionY: 0.5, imageZoom: 1.1, imagePositionX: 0.5, imagePositionY: 0.35 },
  five: { maskType: "circle", maskScale: 0.42, maskPositionX: 0.5, maskPositionY: 0.5, imageZoom: 1.1, imagePositionX: 0.5, imagePositionY: 0.35 },
  six: { maskType: "rounded-square", maskScale: 0.42, maskPositionX: 0.5, maskPositionY: 0.5, imageZoom: 1.1, imagePositionX: 0.5, imagePositionY: 0.35 },
  seven: { maskType: "rounded-square", maskScale: 0.42, maskPositionX: 0.5, maskPositionY: 0.5, imageZoom: 1.1, imagePositionX: 0.5, imagePositionY: 0.35 },
  eight: { maskType: "rounded-square", maskScale: 0.42, maskPositionX: 0.5, maskPositionY: 0.5, imageZoom: 1.1, imagePositionX: 0.5, imagePositionY: 0.35 },
  nine: { maskType: "rounded-square", maskScale: 0.42, maskPositionX: 0.5, maskPositionY: 0.5, imageZoom: 1.1, imagePositionX: 0.5, imagePositionY: 0.35 },
  ten: { maskType: "rounded-square", maskScale: 0.42, maskPositionX: 0.5, maskPositionY: 0.5, imageZoom: 1.1, imagePositionX: 0.5, imagePositionY: 0.35 },
  jack: { maskType: "square", maskScale: 0.82, maskPositionX: 0.5, maskPositionY: 0.5, imageZoom: 1.1, imagePositionX: 0.5, imagePositionY: 0.35 },
  queen: { maskType: "square", maskScale: 0.82, maskPositionX: 0.5, maskPositionY: 0.5, imageZoom: 1.1, imagePositionX: 0.5, imagePositionY: 0.35 },
  king: { maskType: "square", maskScale: 0.82, maskPositionX: 0.5, maskPositionY: 0.5, imageZoom: 1.1, imagePositionX: 0.5, imagePositionY: 0.35 },
};

export function cardKeyOf(rank: Rank, suit: Suit): string {
  return `${RANK_LABELS[rank]}${SUIT_KEYS[suit]}`;
}

export function suitFromKey(key: string): Suit | null {
  const suitKey = key.slice(-1);
  return (Object.keys(SUIT_KEYS) as Suit[]).find(
    (suit) => SUIT_KEYS[suit] === suitKey
  ) ?? null;
}

export function rankFromKey(key: string): Rank | null {
  const rankLabel = key.slice(0, -1);
  const rank = (Object.keys(RANK_LABELS) as Rank[]).find(
    (r) => RANK_LABELS[r] === rankLabel
  );
  return rank ?? null;
}

export function allCardKeys(): string[] {
  const keys: string[] = [];
  for (const rank of RANKS) {
    for (const suit of SUITS) {
      keys.push(cardKeyOf(rank, suit));
    }
  }
  return keys;
}

/**
 * Jeu de données brut (bundle) tel que lu depuis Supabase :
 * presets par rang + personnalisations par carte.
 */
export interface SolitaireCardsBundle {
  presets: SolitaireRankPresetRow[];
  cards: SolitaireCardRow[];
}

/**
 * Construit les 52 configurations de cartes (une par clé) en fusionnant :
 * preset du rang ← override de la carte. L'API complète ensuite
 * artistName / artistImageUrl à partir de la fiche artiste.
 */
export function buildCardFaceConfigs(bundle: SolitaireCardsBundle): CardFaceConfig[] {
  const presetByRank = new Map<string, CardStyleConfig>(
    bundle.presets.map((preset) => [
      preset.rank,
      {
        maskType: preset.mask_type,
        maskScale: preset.mask_scale,
        maskPositionX: preset.mask_pos_x,
        maskPositionY: preset.mask_pos_y,
        imageZoom: preset.image_zoom,
        imagePositionX: preset.image_pos_x,
        imagePositionY: preset.image_pos_y,
      },
    ])
  );
  const overrideByKey = new Map<string, SolitaireCardRow>(
    bundle.cards.map((card) => [card.card_key, card])
  );

  return allCardKeys().map((cardKey) => {
    const rank = rankFromKey(cardKey) ?? "ace";
    const preset = presetByRank.get(rank) ?? CARD_MASK_PRESETS[rank];
    const card = overrideByKey.get(cardKey);

    return {
      cardKey,
      artistId: card?.artist_id ?? null,
      artistName: null,
      artistImageUrl: null,
      maskType: card?.mask_type ?? preset.maskType,
      maskScale: card?.mask_scale ?? preset.maskScale,
      maskPositionX: card?.mask_pos_x ?? preset.maskPositionX,
      maskPositionY: card?.mask_pos_y ?? preset.maskPositionY,
      imageZoom: card?.image_zoom ?? preset.imageZoom,
      imagePositionX: card?.image_pos_x ?? preset.imagePositionX,
      imagePositionY: card?.image_pos_y ?? preset.imagePositionY,
    };
  });
}

/**
 * Zone sûre de l'image de l'artiste (spécification §16) :
 * rectangle relatif (0→1) dans lequel l'image est affichée.
 *
 * Le masque peut dépasser la zone « sûre » : aucune limite de taille
 * n'est imposée, l'admin choisit librement (maskScale), quitte à recouvrir
 * les pips (ceux dont le centre tombe sous le masque ne sont pas rendus).
 * Les coins rang/enseigne restent toujours au-dessus (z-index).
 */
export function getArtistSafeArea(rank: Rank, config: CardStyleConfig): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  const pipRanks = ["two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"] as const;
  const hasPips = (pipRanks as readonly string[]).includes(rank);
  const width = config.maskScale;
  const height = hasPips ? width * 1.05 : width * 1.15;
  return {
    x: config.maskPositionX - width / 2,
    y: config.maskPositionY - height / 2,
    width,
    height,
  };
}

/**
 * Disposition des pips (enseignes internes) pour les cartes 2–10,
 * en coordonnées relatives (0→1). Les pips dont le centre tombe dans la
 * zone du masque ne sont pas rendus : le masque ne recouvre jamais les
 * pips restés visibles.
 */
export function pipLayout(rank: Rank): { x: number; y: number }[] {
  switch (rank) {
    case "two":
      return [{ x: 0.5, y: 0.32 }, { x: 0.5, y: 0.68 }];
    case "three":
      return [{ x: 0.5, y: 0.25 }, { x: 0.5, y: 0.5 }, { x: 0.5, y: 0.75 }];
    case "four":
      return [
        { x: 0.25, y: 0.28 }, { x: 0.75, y: 0.28 },
        { x: 0.25, y: 0.72 }, { x: 0.75, y: 0.72 },
      ];
    case "five":
      return [
        { x: 0.25, y: 0.28 }, { x: 0.75, y: 0.28 },
        { x: 0.5, y: 0.5 },
        { x: 0.25, y: 0.72 }, { x: 0.75, y: 0.72 },
      ];
    case "six":
      return [
        { x: 0.25, y: 0.24 }, { x: 0.75, y: 0.24 },
        { x: 0.25, y: 0.46 }, { x: 0.75, y: 0.46 },
        { x: 0.25, y: 0.68 }, { x: 0.75, y: 0.68 },
      ];
    case "seven":
      return [
        { x: 0.25, y: 0.22 }, { x: 0.75, y: 0.22 },
        { x: 0.25, y: 0.44 }, { x: 0.75, y: 0.44 },
        { x: 0.25, y: 0.66 }, { x: 0.75, y: 0.66 },
        { x: 0.5, y: 0.33 },
      ];
    case "eight":
      return [
        { x: 0.25, y: 0.22 }, { x: 0.75, y: 0.22 },
        { x: 0.25, y: 0.44 }, { x: 0.75, y: 0.44 },
        { x: 0.25, y: 0.66 }, { x: 0.75, y: 0.66 },
        { x: 0.5, y: 0.38 }, { x: 0.5, y: 0.62 },
      ];
    case "nine":
      return [
        { x: 0.25, y: 0.2 }, { x: 0.75, y: 0.2 },
        { x: 0.25, y: 0.42 }, { x: 0.75, y: 0.42 },
        { x: 0.25, y: 0.64 }, { x: 0.75, y: 0.64 },
        { x: 0.5, y: 0.31 }, { x: 0.5, y: 0.51 }, { x: 0.5, y: 0.71 },
      ];
    case "ten":
      return [
        { x: 0.25, y: 0.2 }, { x: 0.75, y: 0.2 },
        { x: 0.25, y: 0.4 }, { x: 0.75, y: 0.4 },
        { x: 0.5, y: 0.3 }, { x: 0.5, y: 0.5 },
        { x: 0.25, y: 0.6 }, { x: 0.75, y: 0.6 },
        { x: 0.5, y: 0.7 },
      ];
    default:
      return [];
  }
}
