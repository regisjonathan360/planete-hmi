import React, { useContext } from "react";
import styles from "./TopbarButton.module.scss";
import { WindowsOpenedContext } from "../../game-containers";

type TopbarButtonPropTypes = {
  underscoredLetter?: number;
  label?: string;
  onClick: () => void;
  id: string;
  active?: boolean;
  onMouseOver?: () => void;
};

export const TopbarButton: React.FC<TopbarButtonPropTypes> = ({
  underscoredLetter,
  onClick,
  id,
  active,
  onMouseOver,
  label = "",
}) => {
  const { isAnyWindowOpened } = useContext(WindowsOpenedContext);

  return (
    <button
      type="button"
      className={[styles.container, active ? styles.active : ""].join(" ")}
      onClick={onClick}
      role="button"
      id={id}
      onMouseOver={onMouseOver}
      tabIndex={!isAnyWindowOpened ? 0 : -1}
      disabled={isAnyWindowOpened}
      aria-label={label}
    >
      {label
        .split("")
        .map((letter, index) =>
          index === underscoredLetter ? (
            <span key={`${index}${letter}`}>{letter}</span>
          ) : (
            letter
          )
        )}
    </button>
  );
};
