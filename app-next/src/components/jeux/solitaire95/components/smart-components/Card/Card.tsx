import React, { useEffect, useContext } from "react";
import { connect } from "react-redux";
import { GameState } from "../../../store/reducers/";
import { useDrag } from "react-dnd";
import { getEmptyImage } from "react-dnd-html5-backend";
import { itemTypes } from "../../../configs/dragndropConfig";
import {
  CardNameType,
  CardSuiteType,
  CardColorType,
} from "../../../configs/cardTypes";
import { cardFrontsImages } from "../../../static/cardsFronts";
import { cardBackImages } from "../../../static/cardBacks";
import { WindowsOpenedContext } from "../../game-containers";
import { useSolitaireCards } from "@/components/solitaire/SolitaireCardsProvider";
import { SolitaireCardFace } from "@/components/solitaire/SolitaireCardFace";
import { cardKeyOf } from "@/lib/solitaire/cards";
import styles from "./Card.module.scss";

type CardStateTypes = {
  outlineDragging: boolean;
};

type CardPropTypes = {
  cardFront: CardNameType;
  cardColor: CardColorType;
  cardSuite: CardSuiteType;
  cardOrder: string | number;
  cardBack: string;
  isTurnedBack?: boolean;
  onDoubleClick?:
    | ((event: React.MouseEvent<HTMLDivElement, MouseEvent>) => void)
    | undefined;
  pileNumber?: number;
  foundationNumber?: string;
  wasCardTurnedFront?: boolean;
  onClick?: (
    event: React.KeyboardEvent | React.MouseEvent<HTMLDivElement, MouseEvent>
  ) => void;
  positionOnPile?: number;
  canBeDragged?: boolean;
  canBeFocused?: boolean;
};

export const CardInternal: React.FC<CardPropTypes & CardStateTypes> = ({
  cardFront,
  cardBack,
  isTurnedBack = true,
  onDoubleClick,
  pileNumber,
  foundationNumber,
  cardColor,
  cardSuite,
  cardOrder,
  onClick,
  positionOnPile,
  outlineDragging,
  canBeDragged,
  canBeFocused,
}) => {
  const [{ isDragging }, drag, preview] = useDrag({
    item: {
      type: itemTypes.CARD,
      cardFront,
      cardSuite,
      cardColor,
      pileNumber,
      cardOrder,
      foundationNumber,
    },
    // Une carte face cachée ne doit jamais pouvoir être tirée. Avant cette
    // garde, un drag pouvait contourner les règles de retournement.
    canDrag: !isTurnedBack && canBeDragged !== false,
    collect: (monitor) => ({
      isDragging: !!monitor.isDragging(),
      item: monitor.getItem(),
    }),
  });

  useEffect(() => {
    preview(getEmptyImage(), { captureDraggingState: true });
  }, [preview]);

  const frontImage: string = cardFrontsImages[`${cardFront}_${cardSuite}`];
  const backImage: string = cardBackImages[`${cardBack}`];

  const handleButtonClick = (event: React.KeyboardEvent) => {
    if (event.key === "Enter" || event.key === " ") {
      onClick?.(event);
    }
  };

  const { isAnyWindowOpened } = useContext(WindowsOpenedContext);
  const { getConfig } = useSolitaireCards();
  const cardKey = cardKeyOf(cardFront, cardSuite);
  const cardConfig = getConfig(cardKey);
  const showArtistFace = !!cardConfig?.artistImageUrl;

  return (
    <div
      className={styles.card}
      onClick={onClick}
      onDoubleClick={!isTurnedBack ? onDoubleClick : undefined}
      ref={drag as unknown as React.Ref<HTMLDivElement>}
      style={
        isDragging
          ? outlineDragging
            ? undefined
            : { opacity: "0" }
          : { opacity: "1" }
      }
      data-front={!isTurnedBack}
      data-cardname={cardFront}
      data-suite={cardSuite}
      data-color={cardColor}
      data-order={cardOrder}
      data-pilenumber={pileNumber}
      data-positiononpile={positionOnPile}
      role="button"
      aria-label={`${cardFront} ${cardSuite}${isTurnedBack ? ", carte cachée" : ""}`}
      aria-disabled={isTurnedBack || canBeDragged === false}
      tabIndex={canBeFocused && !isAnyWindowOpened ? 1 : -1}
      onKeyDown={handleButtonClick}
    >
      {!isTurnedBack ? (
        <div
          className={styles.card__front}
          style={
            showArtistFace
              ? undefined
              : { backgroundImage: `url(${frontImage})` }
          }
          data-cardname={cardFront}
          data-suite={cardSuite}
          data-color={cardColor}
          data-order={cardOrder}
          data-pilenumber={pileNumber}
          data-foundationnumber={foundationNumber}
          data-cardback={cardBack}
          role="listitem"
          aria-label={`${cardFront} ${cardSuite}`}
        >
          {showArtistFace && (
            <SolitaireCardFace rank={cardFront} suit={cardSuite} config={cardConfig} />
          )}
        </div>
      ) : (
        <div
          className={styles.card__back}
          style={{ backgroundImage: `url(${backImage})` }}
        ></div>
      )}
    </div>
  );
};

const mapStateToProps = (state: { gameState: GameState }) => {
  return {
    outlineDragging: state.gameState.outlineDragging,
  };
};

export const Card = connect(
  mapStateToProps
)(CardInternal);
