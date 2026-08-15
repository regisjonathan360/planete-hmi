import React, { RefObject, useMemo } from "react";
import { createPortal } from "react-dom";
import CSS from "csstype";
import { useDragLayer } from "react-dnd";
import { connect } from "react-redux";
import { CardsDistributionInitialState } from "../../../store/reducers/";
import { itemTypes } from "../../../configs/dragndropConfig";
import { cardFrontsImages } from "../../../static/cardsFronts";
import { cardConfigType } from "../../../configs/cardTypes";
import { useSolitaireCards } from "@/components/solitaire/SolitaireCardsProvider";
import { useSolitaireFullscreen } from "@/components/solitaire/SolitaireScaleFrame";
import { SolitaireCardFace } from "@/components/solitaire/SolitaireCardFace";
import { cardKeyOf } from "@/lib/solitaire/cards";
import type { Rank, Suit } from "@/lib/solitaire/cards";

type CardDragPropTypes = {
  pilesContainer: RefObject<HTMLDivElement>;
  outlineDragging: boolean;
};

type CardDragLayerStateTypes = {
  cardsOnPiles: { [key: string]: cardConfigType[] };
};

const CardDragLayerInternal: React.FC<
  CardDragLayerStateTypes & CardDragPropTypes
> = (props) => {
  const { cardsOnPiles, pilesContainer, outlineDragging } = props;

  const { itemType, currentOffset, isDragging, item } = useDragLayer(
    (monitor) => ({
      itemType: monitor.getItemType(),
      item: monitor.getItem(),
      currentOffset: monitor.getSourceClientOffset(),
      isDragging: monitor.isDragging(),
    })
  );

  const scrollResolver = (
    offsetAxis: number,
    windowAxis: number,
    axisAdditionalLength: number,
    scrollDirection: string
  ): void => {
    if (offsetAxis < 0 || windowAxis < offsetAxis + axisAdditionalLength) {
      if (offsetAxis < 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ((document.querySelector("#gameContainer") as any) as {
          [key: string]: number;
        })[scrollDirection] += offsetAxis;
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ((document.querySelector("#gameContainer") as any) as {
          [key: string]: number;
        })[scrollDirection] += offsetAxis + axisAdditionalLength + 15 - windowAxis;
      }
    }
  };

  if (currentOffset) {
    scrollResolver(currentOffset.x, window.innerWidth, 115, "scrollLeft");
    scrollResolver(currentOffset.y, window.innerHeight, 160, "scrollTop");
  }

  const draggedCard = useMemo(
    () => `${item?.cardFront}_${item?.cardSuite}`,
    [item?.cardFront, item?.cardSuite]
  );

  const frontImage = useMemo(
    () => cardFrontsImages[draggedCard],
    [draggedCard]
  );

  const cardFromPiles = useMemo(
    () =>
      cardsOnPiles[item?.pileNumber]?.map((card) => `${card[0]}_${card[1]}`),
    [cardsOnPiles, item?.pileNumber]
  );

  const cardsToDragWhenOnPiles = cardFromPiles?.slice(
    cardFromPiles.indexOf(draggedCard)
  );

  const cardsAttributes = useMemo(
    () => cardsToDragWhenOnPiles?.map((card) => card.split("_")),
    [cardsToDragWhenOnPiles]
  );

  const draggedCardFromPileParent = (card: string[] | cardConfigType) =>
    (pilesContainer.current as HTMLDivElement).querySelector(
      `div[data-cardname="${card[0]}"][data-suite="${card[1]}"]`
    )?.parentNode;

  isDragging &&
    !outlineDragging &&
    cardsAttributes?.forEach((card) => {
      if (draggedCardFromPileParent(card)) {
        (draggedCardFromPileParent(card) as HTMLDivElement).style.opacity = "0";
      }
    });

  if (!isDragging && pilesContainer.current && !outlineDragging) {
    // Restaure l'opacité de TOUTES les faces visibles du plateau : les
    // cartes de la donne initiale n'ont pas el[2] marqué (elles sont
    // visibles « par position »), un filtre sur el[2] les laisserait
    // définitivement invisibles après un drag.
    const faces = (
      pilesContainer.current as HTMLDivElement
    ).querySelectorAll<HTMLDivElement>("div[data-cardname]");
    faces.forEach((face) => {
      const parent = face.parentElement;
      if (parent) {
        parent.style.opacity = "1";
      }
    });
  }

  const layerStyles: CSS.Properties = {
    position: "fixed",
    pointerEvents: "none",
    zIndex: 10000,
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    backgroundColor: "transparent",
    display: !currentOffset ? "none" : "block",
  };

  const { getConfig } = useSolitaireCards();
  const { scale, isFullscreen, frameHost } = useSolitaireFullscreen();

  /* En plein écran, l'élément du cadre est dans la top layer du navigateur :
     un portal vers document.body rendrait le fantôme invisible (derrière la
     table). On se portalise dans le cadre lui-même ; les coordonnées fixed
     restent celles du viewport. */
  const portalTarget =
    isFullscreen && frameHost ? frameHost : document.body;

  const cardFace = (frontImageCard: string) => {
    const [rank, suit] = frontImageCard.split("_");
    if (!rank || !suit) return null;
    const config = getConfig(cardKeyOf(rank as Rank, suit as Suit));
    return config?.artistImageUrl ? (
      <SolitaireCardFace rank={rank as Rank} suit={suit as Suit} config={config} />
    ) : null;
  };

  const cardNode = (frontImageCard: string, cardIndex: number) => (
    <div
      style={{
        width: "130px",
        height: "175px",
        border: "2px solid #000000",
        borderRadius: "7px",
        backgroundImage: cardFace(frontImageCard)
          ? undefined
          : `url(${cardFrontsImages[frontImageCard]})`,
        backgroundColor: "white",
        backgroundSize: "cover",
        top: `${27 * cardIndex}px`,
        position: "absolute",
        overflow: "hidden",
      }}
      key={cardIndex}
    >
      {cardFace(frontImageCard)}
    </div>
  );

  const draggingCardOultine = (cardIndex = 0) => (
    <div
      style={{
        width: "130px",
        height: "175px",
        borderTop: "2px dotted #3f3f3f",
        top: `${27 * cardIndex}px`,
        position: "absolute",
      }}
      key={cardIndex}
    />
  );

  const rednerOutlinedCards = () =>
    cardsToDragWhenOnPiles ? (
      <div
        style={{
          position: "relative",
          borderBottom: "2px dotted #3f3f3f",
          borderLeft: "2px dotted #3f3f3f",
          borderRight: "2px dotted #3f3f3f",
          height: `${(cardsToDragWhenOnPiles.length - 1) * 25 + 175}px`,
          width: "135px",
        }}
      >
        {cardsToDragWhenOnPiles?.map((card, index) =>
          draggingCardOultine(index)
        )}
      </div>
    ) : (
      <div
        style={{
          width: "130px",
          height: "175px",
          border: "2px dotted #3f3f3f",
          position: "absolute",
        }}
      />
    );

  const renderUsualDragLayer = () =>
    cardsToDragWhenOnPiles ? (
      <div
        style={{
          position: "relative",
        }}
      >
        {cardsToDragWhenOnPiles?.map((card, index) => cardNode(card, index))}
      </div>
    ) : (
      <div
        style={{
          width: "130px",
          height: "175px",
          border: "2px solid #000000",
          borderRadius: "7px",
          backgroundImage: cardFace(draggedCard)
            ? undefined
            : `url(${frontImage})`,
          backgroundColor: "white",
          backgroundSize: "cover",
          overflow: "hidden",
        }}
      >
        {cardFace(draggedCard)}
      </div>
    );

  function renderItem() {
    switch (itemType) {
      case itemTypes.CARD:
        return outlineDragging ? rednerOutlinedCards() : renderUsualDragLayer();
      default:
        return null;
    }
  }

  return isDragging
    ? createPortal(
        <div style={layerStyles}>
          <div
            style={{
              position: "absolute",
              top: currentOffset?.y,
              left: currentOffset?.x,
            }}
          >
            {/* Reproduit l'échelle de la table : la carte suit exactement
                le curseur, à la bonne taille, en coordonnées de fenêtre. */}
            <div
              style={{
                transform: `scale(${scale})`,
                transformOrigin: "top left",
              }}
            >
              {renderItem()}
            </div>
          </div>
        </div>,
        portalTarget
      )
    : null;
};

const mapStateToProps = (state: {
  cardDistribution: CardsDistributionInitialState;
}) => {
  return {
    cardsOnPiles: state.cardDistribution.cardsOnPiles,
  };
};

export const CardDragLayer = connect(mapStateToProps)(CardDragLayerInternal);
