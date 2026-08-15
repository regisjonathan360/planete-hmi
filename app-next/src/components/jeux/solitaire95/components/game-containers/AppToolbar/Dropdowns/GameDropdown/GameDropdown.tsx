import React, { useContext } from "react";
import { connect } from "react-redux";
import { VegasContext } from "../../../";
import { toggleWindow, finishGame } from "../../../../../store/actions/";
import {
  ToggleWindowType,
  FinishGameType,
  WindowTypes,
} from "../../../../../store/actions/actionTypes";
import { ToolButton, Separator } from "../../../../ui-components";
import { dealCardsAllSteps } from "../../../../../helpers/dealCardsAllSteps";
import { UndoButton } from "./UndoButton";
import {
  SOLITAIRE_MODES,
  SOLITAIRE_MODE_SWITCH_EVENT,
} from "@/lib/solitaire/modes";
import { useExitSolitaire } from "@/components/solitaire/useExitSolitaire";
import { Dispatch } from "redux";

type GameDropdownDispatchTypes = {
  toggleCardBackWindow: ToggleWindowType;
  setGameFinished: FinishGameType;
  dealCardsAllSteps: (isVegas: boolean, keepVegasScore: boolean) => void;
};

type GameDropdownPropTypes = {
  gameVisible: boolean;
  setBottomBarText: (text: string) => void;
  setGameVisible: (prevState: boolean) => void;
  setHelpVisible: (prevState: boolean) => void;
};

const switchMode = (mode: string) => {
  window.dispatchEvent(
    new CustomEvent(SOLITAIRE_MODE_SWITCH_EVENT, { detail: { mode } })
  );
};

export const GameDropdownInternal: React.FC<
  GameDropdownPropTypes & GameDropdownDispatchTypes
> = ({
  gameVisible,
  toggleCardBackWindow,
  dealCardsAllSteps,
  setGameFinished,
  setBottomBarText,
  setGameVisible,
  setHelpVisible,
}) => {
  const { isVegas, keepVegasScore } = useContext(VegasContext);
  const exitSolitaire = useExitSolitaire();
  return (
    <>
      <ToolButton
        onClick={() => {
          setGameVisible(!gameVisible);
          setHelpVisible(false);
          setGameFinished(false);
          dealCardsAllSteps(isVegas, keepVegasScore);
        }}
        onMouseOver={() => setBottomBarText("Deal a new game")}
        onMouseLeave={() => setBottomBarText("")}
        underscoredLetter={0}
        label="Deal"
      />
      <Separator />
      <UndoButton
        setGameVisible={setGameVisible}
        gameVisible={gameVisible}
        setBottomBarText={setBottomBarText}
      />
      <ToolButton
        onClick={() => {
          toggleCardBackWindow(true, "cardBackWindow");
          setGameVisible(false);
        }}
        onMouseOver={() => setBottomBarText("Choose new deck back")}
        onMouseLeave={() => setBottomBarText("")}
        underscoredLetter={2}
        label="Deck"
      />
      <ToolButton
        onClick={() => {
          toggleCardBackWindow(true, "optionsWindow");
          setGameVisible(false);
        }}
        onMouseOver={() => setBottomBarText("Change Solitaire options")}
        onMouseLeave={() => setBottomBarText("")}
        underscoredLetter={0}
        label="Options"
      />
      <Separator />
      {SOLITAIRE_MODES.map((m) => (
        <ToolButton
          key={m.id}
          onClick={() => {
            setGameVisible(false);
            switchMode(m.id);
          }}
          onMouseOver={() => setBottomBarText(m.label)}
          onMouseLeave={() => setBottomBarText("")}
          underscoredLetter={0}
          label={`  ${m.label}`}
        />
      ))}
      <Separator />
      <ToolButton
        onClick={exitSolitaire}
        onMouseOver={() => setBottomBarText("Exit Solitaire")}
        onMouseLeave={() => setBottomBarText("")}
        underscoredLetter={1}
        label="Exit"
      />
    </>
  );
};

const mapDispatchToProps = (dispatch: Dispatch) => {
  return {
    toggleCardBackWindow: (windowState: boolean, windowToToggle: WindowTypes) =>
      dispatch(toggleWindow(windowState, windowToToggle)),
    setGameFinished: (gameState: boolean) => dispatch(finishGame(gameState)),
    dealCardsAllSteps: (isVegas: boolean, keepVegasScore: boolean) =>
      dealCardsAllSteps(dispatch, isVegas, keepVegasScore),
  };
};

export const GameDropdown = connect(
  undefined,
  mapDispatchToProps
)(GameDropdownInternal);
