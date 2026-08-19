import React, { useEffect, useRef } from "react";
import { ToolBar, TopbarButton } from "../../ui-components";
import { ToolDropdown } from "../../ui-components";
import styles from "./AppToolbar.module.scss";
import { GameDropdown } from "./Dropdowns/GameDropdown/GameDropdown";
import { HelpDropdown } from "./Dropdowns/HelpDropdown/HelpDropdown";

type AppToolbarPropTypes = {
  gameVisible: boolean;
  helpVisible: boolean;
  setGameVisible: (prevState: boolean) => void;
  setHelpVisible: (prevState: boolean) => void;
  setBottomBarText: (text: string) => void;
};

export const AppToolbar: React.FC<AppToolbarPropTypes> = (props) => {
  const {
    gameVisible,
    helpVisible,
    setGameVisible,
    setHelpVisible,
    setBottomBarText,
  } = props;

  const toolbarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const closeMenusOutside = (event: PointerEvent) => {
      if (!toolbarRef.current?.contains(event.target as Node)) {
        setGameVisible(false);
        setHelpVisible(false);
      }
    };
    document.addEventListener("pointerdown", closeMenusOutside);
    return () => document.removeEventListener("pointerdown", closeMenusOutside);
  }, [setGameVisible, setHelpVisible]);

  return (
    <div ref={toolbarRef}>
      <ToolBar>
      <div className={styles.topBarButtonContainer}>
        <div style={{ width: "100%" }}>
          <TopbarButton
            onClick={() => {
              setGameVisible(!gameVisible);
              setHelpVisible(false);
            }}
            underscoredLetter={0}
            label="Game"
            id={"gameButton"}
            active={gameVisible}
            onMouseOver={() => undefined}
          />
          <ToolDropdown visible={gameVisible} buttonId={"gameButton"}>
            <GameDropdown
              gameVisible={gameVisible}
              setBottomBarText={setBottomBarText}
              setGameVisible={setGameVisible}
              setHelpVisible={setHelpVisible}
            />
          </ToolDropdown>
        </div>
        <div style={{ width: "100%" }}>
          <TopbarButton
            onClick={() => {
              setHelpVisible(!helpVisible);
              setGameVisible(false);
            }}
            underscoredLetter={0}
            label="Help"
            id={"helpButton"}
            active={helpVisible}
            onMouseOver={() => undefined}
          />
          <ToolDropdown visible={helpVisible} buttonId={"helpButton"}>
            <HelpDropdown
              setHelpVisible={setHelpVisible}
              setBottomBarText={setBottomBarText}
            />
          </ToolDropdown>
        </div>
      </div>
      </ToolBar>
    </div>
  );
};
