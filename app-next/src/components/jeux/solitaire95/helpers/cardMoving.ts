import { cardConfigType } from "../configs/cardTypes";
import { FoundationInitialState } from "../store/reducers/";
import { CountVegasScoreType } from "../store/actions/actionTypes";

export const moveToFoundation = (
  event: React.SyntheticEvent,
  cardsOnFoundations: FoundationInitialState,
  addToFoundationCallback: (
    card: cardConfigType,
    foundationNumber: string,
    foundationSuite?: string
  ) => void,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  removeFromCallback: (...args: any[]) => void,
  isPile: boolean,
  addPoints: (points: number) => void,
  oneCardFromStock?: cardConfigType[],
  startGame?: () => void,
  gameStarted?: boolean,
  threeCardsFromStock?: cardConfigType[],
  isVegas?: boolean,
  vegasDollarCounter?: CountVegasScoreType
): void => {
  // Les cartes personnalisées contiennent plusieurs nœuds enfants. Utiliser
  // event.target faisait échouer le double-clic dès qu'on cliquait sur le
  // visage de l'artiste au lieu du conteneur de la carte.
  const target = (event.target as Element | null)?.closest?.(
    "[data-cardname]"
  ) as HTMLElement | null;
  const dataset = target?.dataset ?? {};
  const { cardname, suite, color, pilenumber, order } = dataset;
  if (!cardname || !suite || !color || !order) return;
  const cardConfig = [cardname, suite, true, color, order] as cardConfigType;

  if (cardname?.match("ace")) {
    const foundationToPopulate: string[] = [];
    Object.keys(cardsOnFoundations).forEach((foundation) => {
      if (!cardsOnFoundations[foundation].cards.length) {
        foundationToPopulate.push(foundation);
      }
    });

    if (!cardsOnFoundations[foundationToPopulate[0]].cards.length) {
      addToFoundationCallback(cardConfig, foundationToPopulate[0], suite);
      addPoints(10);
      if (isVegas && vegasDollarCounter) {
        vegasDollarCounter(5);
      }
      !gameStarted && startGame && startGame();
      isPile
        ? removeFromCallback(pilenumber)
        : removeFromCallback(
            oneCardFromStock?.filter(
              (card) => `${card[0]}_${card[1]}` !== `${cardname}_${suite}`
            ),
            threeCardsFromStock?.filter(
              (card) => `${card[0]}_${card[1]}` !== `${cardname}_${suite}`
            )
          );
    }
  }

  if (!cardname?.match("ace")) {
    Object.keys(cardsOnFoundations).forEach((foundation) => {
      if (cardsOnFoundations[foundation].foundationSuite === suite) {
        const cardsOnFoundation = cardsOnFoundations[foundation].cards;
        if (
          parseInt(
            cardsOnFoundation[cardsOnFoundation.length - 1][4] as string
          ) ===
          Number(order) - 1
        ) {
          addToFoundationCallback(cardConfig, foundation);
          addPoints(10);
          if (isVegas && vegasDollarCounter) {
            vegasDollarCounter(5);
          }
          !gameStarted && startGame && startGame();
          isPile
            ? removeFromCallback(pilenumber)
            : removeFromCallback(
                oneCardFromStock?.filter(
                  (card) => `${card[0]}_${card[1]}` !== `${cardname}_${suite}`
                ),
                threeCardsFromStock?.filter(
                  (card) => `${card[0]}_${card[1]}` !== `${cardname}_${suite}`
                )
              );
        }
      }
    });
  }
};
