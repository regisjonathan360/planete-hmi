"use client";

import { memo } from "react";
import {
  RANK_LABELS,
  SUIT_COLOR,
  SUIT_GLYPHS,
  getArtistSafeArea,
  pipLayout,
  type CardFaceConfig,
  type Rank,
  type Suit,
} from "@/lib/solitaire/cards";
import styles from "./solitaire-card-face.module.css";

const MASK_RADIUS: Record<CardFaceConfig["maskType"], string> = {
  circle: "50%",
  "rounded-square": "18%",
  square: "6%",
};

export interface SolitaireCardFaceProps {
  rank: Rank;
  suit: Suit;
  /** Configuration de la carte (depuis le provider ou l'éditeur admin). */
  config: CardFaceConfig | null;
  className?: string;
}

/**
 * Face de carte du Solitaire (spécification §1, §10, §15, §16) :
 * fond → image artiste masquée → pips → rang/enseigne (toujours lisibles).
 * Les pips dont le centre tombe sous le masque ne sont pas rendus.
 * Unités relatives (0→1) via container queries : la composition est
 * identique quelle que soit la taille de la carte.
 */
export const SolitaireCardFace = memo(function SolitaireCardFace({
  rank,
  suit,
  config,
  className,
}: SolitaireCardFaceProps) {
  const label = RANK_LABELS[rank];
  const glyph = SUIT_GLYPHS[suit];
  const color = SUIT_COLOR[suit];

  const safeArea = config
    ? getArtistSafeArea(rank, config)
    : { x: 0.5, y: 0.5, width: 0, height: 0 };
  const pips = pipLayout(rank).filter((pip) => {
    if (!config || safeArea.width <= 0) return true;
    return !(
      pip.x > safeArea.x &&
      pip.x < safeArea.x + safeArea.width &&
      pip.y > safeArea.y &&
      pip.y < safeArea.y + safeArea.height
    );
  });

  return (
    <div
      className={`${styles.face} ${className ?? ""}`}
      data-color={color}
      data-rank={label}
      data-suit={suit}
    >
      <div className={styles.face__base} aria-hidden="true" />
      {config && config.artistImageUrl && (
        <div
          className={styles.face__mask}
          style={{
            left: `${safeArea.x * 100}%`,
            top: `${safeArea.y * 100}%`,
            width: `${safeArea.width * 100}%`,
            height: `${safeArea.height * 100}%`,
            borderRadius: MASK_RADIUS[config.maskType],
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className={styles.face__img}
            src={config.artistImageUrl}
            alt={config.artistName ?? "Artiste"}
            draggable={false}
            style={{
              objectPosition: `${config.imagePositionX * 100}% ${config.imagePositionY * 100}%`,
              transform: `scale(${config.imageZoom})`,
              transformOrigin: `${config.imagePositionX * 100}% ${config.imagePositionY * 100}%`,
            }}
          />
        </div>
      )}
      <div className={styles.face__gloss} aria-hidden="true" />
      {pips.map((pip, index) => (
        <span
          key={`${pip.x}-${pip.y}-${index}`}
          className={styles.face__pip}
          style={{ left: `${pip.x * 100}%`, top: `${pip.y * 100}%` }}
          aria-hidden="true"
        >
          {glyph}
        </span>
      ))}
      <div className={styles.face__corner} aria-hidden="true">
        <span className={styles.face__rank}>{label}</span>
        <span className={styles.face__suit}>{glyph}</span>
      </div>
      <div className={`${styles.face__corner} ${styles.face__cornerBottom}`} aria-hidden="true">
        <span className={styles.face__rank}>{label}</span>
        <span className={styles.face__suit}>{glyph}</span>
      </div>
    </div>
  );
});
