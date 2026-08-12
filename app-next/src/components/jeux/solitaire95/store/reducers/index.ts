import { combineReducers } from "redux";
import { cardDistribution } from "./cardsDistributionReducer";
import { cardsOnFoundation } from "./foundationReducer";
import { toggleWindows } from "./windowsReducer";
import { countScore } from "./scoreReducer";
import { gameState } from "./gameReducer";
import { stockCounter } from "./stockCounterReducer";
import { timeCounter } from "./timeReducer";

export type { FoundationState, FoundationInitialState } from "./foundationReducer";
export type { CardsDistributionInitialState } from "./cardsDistributionReducer";
export type { WindowsState } from "./windowsReducer";
export type { Points } from "./scoreReducer";
export type { GameState } from "./gameReducer";
export type { StockCount } from "./stockCounterReducer";

export const rootReducer = combineReducers({
  cardDistribution,
  cardsOnFoundation,
  toggleWindows,
  countScore,
  gameState,
  stockCounter,
  timeCounter,
});
