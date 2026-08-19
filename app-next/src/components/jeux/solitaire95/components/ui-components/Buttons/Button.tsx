import React, { useState } from "react";
import styles from "./Button.module.scss";

type ButtonPropTypes = {
  text: string;
  onClick?: () => void;
  underscoredLetter?: number;
  disabled?: boolean;
};

export const Button: React.FC<ButtonPropTypes> = ({
  text,
  onClick,
  underscoredLetter,
  disabled,
}) => {
  const [buttonActive, setButtonActive] = useState(false);

  return (
    <button
      type="button"
      className={[
        styles.button,
        buttonActive ? styles["button--active"] : undefined,
        disabled ? styles["button--disabled"] : undefined,
      ].join(" ")}
      tabIndex={!disabled ? 0 : -1}
      disabled={disabled}
      onMouseDown={() => {
        !disabled && setButtonActive(true);
      }}
      onMouseUp={() => {
        !disabled && setButtonActive(false);
      }}
      onMouseLeave={() => {
        !disabled && setButtonActive(false);
      }}
      onClick={() => !disabled && onClick?.()}
      aria-label={text}
    >
      <div className={buttonActive ? styles.button__activeBorder : undefined}>
        {text
          .split("")
          .map((letter, index) =>
            index === underscoredLetter ? (
              <span key={`${index}${letter}`}>{letter}</span>
            ) : (
              letter
            )
          )}
      </div>
    </button>
  );
};
