import React, { useEffect } from "react";
import { Provider } from "react-redux";
import { createStore, applyMiddleware, compose } from "redux";
import { dealCards } from "./store/actions/";
import { undoActions } from "./helpers/undo";
import { rootReducer } from "./store/reducers";
import { MainPage } from "./components/game-containers/MainPage/MainPage";
import "./Solitaire95.scss";

const STORAGE_KEY = "solitaireState";

function loadPersistedState() {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw);
    // Une ancienne version pouvait enregistrer une fenêtre ouverte ou un
    // état partiel. Reprendre uniquement une partie complète évite un écran
    // vide après une migration ou une coupure pendant l'enregistrement.
    if (
      !parsed ||
      typeof parsed !== "object" ||
      !parsed.cardDistribution?.cardsOnPiles ||
      !parsed.gameState
    ) {
      return undefined;
    }
    delete parsed.toggleWindows;
    return parsed;
  } catch {
    return undefined;
  }
}

const persistedState = loadPersistedState();

const middlewareEnhancer = applyMiddleware(undoActions);
// @ts-ignore
const composeEnhancers = window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ || compose;

const store = createStore(
  rootReducer,
  persistedState,
  composeEnhancers(middlewareEnhancer)
);

if (!persistedState) {
  store.dispatch(dealCards());
}

type PropTypes = {
  playSounds?: boolean;
  aboutChildren?: React.ReactNode;
  preserveStateInLocalStorage?: boolean;
};

const Solitaire95: React.FC<PropTypes> = (props) => {
  const {
    playSounds,
    aboutChildren,
    preserveStateInLocalStorage = true,
  } = props;

  useEffect(() => {
    if (!preserveStateInLocalStorage) return undefined;
    const persist = () => {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store.getState()));
      } catch {
        /* stockage privé ou quota plein : la partie reste jouable */
      }
    };
    const unsubscribe = store.subscribe(persist);
    return unsubscribe;
  }, [preserveStateInLocalStorage]);

  return (
    <Provider store={store}>
      <MainPage playSounds={playSounds} aboutChildren={aboutChildren} />
    </Provider>
  );
};

export { Solitaire95 };
