"use client";

import { memo } from "react";
import { cardFrontsImages } from "@/components/jeux/solitaire95/static/cardsFronts";
import { cardBackImages } from "@/components/jeux/solitaire95/static/cardBacks";
import { SolitaireCardFace } from "@/components/solitaire/SolitaireCardFace";
import { useSolitaireCards } from "@/components/solitaire/SolitaireCardsProvider";
import { cardKeyOf } from "@/lib/solitaire/cards";
import type { GameCard } from "@/lib/solitaire/modes";
import styles from "./solitaire-playing-card.module.css";

interface SolitairePlayingCardProps {
  card: GameCard;
  /** Clé du dos choisi (ex. "robo"), voir static/cardBacks. */
  backKey: string;
  /** Carte sélectionnée (contour lumineux). */
  selected?: boolean;
  /** Carte surlignée par l'indice. */
  hinted?: boolean;
  /** Carte fantôme pendant le drag (suit le curseur). */
  ghost?: boolean;
  /** La carte est la source d'un drag en cours (on la masque). */
  hidden?: boolean;
  /** Drag désactivé (carte non déplaçable). */
  draggable?: boolean;
  /** Position dans la colonne (lue par le moteur au clic/drop). */
  position?: number;
  /** Zone de dépôt de la carte (data-drop) : id de colonne/cellule. */
  dropZone?: string;
  onPointerDown?: (event: React.PointerEvent<HTMLDivElement>) => void;
  onPointerUp?: (event: React.PointerEvent<HTMLDivElement>) => void;
  onDoubleClick?: (event: React.MouseEvent<HTMLDivElement>) => void;
  className?: string;
}

/**
 * Carte de solitaire partagée par les moteurs Spider / FreeCell / Pyramid.
 * Rendu strictement identique au Klondike existant : face personnalisée de
 * l'artiste (masque + zoom + presets du rang) si la carte est configurée,
 * sinon la face classique Windows 95 ; dos choisi par le joueur.
 */
export const SolitairePlayingCard = memo(function SolitairePlayingCard({
  card,
  backKey,
  selected = false,
  hinted = false,
  ghost = false,
  hidden = false,
  draggable = true,
  position,
  dropZone,
  onPointerDown,
  onPointerUp,
  onDoubleClick,
  className = "",
}: SolitairePlayingCardProps) {
  const { getConfig } = useSolitaireCards();
  const cardKey = cardKeyOf(card.rank, card.suit);
  const cardConfig = getConfig(cardKey);
  const showArtistFace = !!cardConfig?.artistImageUrl;
  const frontImage = cardFrontsImages[`${card.rank}_${card.suit}`];
  const backImage = cardBackImages[backKey];

  const stateClass = ghost
    ? styles.ghost
    : hidden
      ? styles.hidden
      : selected
        ? styles.selected
        : hinted
          ? styles.hinted
          : "";

  return (
    <div
      className={`${styles.card} ${stateClass} ${className}`.trim()}
      style={
        ghost
          ? { marginLeft: -cardWidth / 2, marginTop: -cardHeight / 2 }
          : undefined
      }
      onPointerDown={draggable ? onPointerDown : undefined}
      onPointerUp={onPointerUp}
      onDoubleClick={onDoubleClick}
      data-drop={dropZone}
      data-position={position}
      data-cardrank={card.rank}
      data-cardsuit={card.suit}
      data-facedown={card.faceDown}
      draggable={false}
    >
      {!card.faceDown ? (
        <div
          className={styles.front}
          style={
            showArtistFace ? undefined : { backgroundImage: `url(${frontImage})` }
          }
          aria-label={`${card.rank} ${card.suit}`}
        >
          {showArtistFace && (
            <SolitaireCardFace
              rank={card.rank}
              suit={card.suit}
              config={cardConfig}
            />
          )}
        </div>
      ) : (
        <div
          className={styles.back}
          style={{ backgroundImage: `url(${backImage})` }}
        />
      )}
    </div>
  );
});

/* Ratio de solitaire-master : 100×145 (~0.69). La largeur est posée par le
   layout de chaque mode via une variable CSS (--card-w). */
const cardWidth = "var(--card-w, 96px)";
const cardHeight = "var(--card-h, 139px)";