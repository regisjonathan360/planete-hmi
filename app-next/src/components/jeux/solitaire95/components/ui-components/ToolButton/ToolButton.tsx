import React from "react";
import styles from "./ToolButton.module.scss";

type ToolButtonPropTypes = {
  onClick?: undefined | (() => void);
  onMouseOver?: () => void;
  onMouseLeave?: () => void;
  disabled?: boolean;
  label?: string;
  underscoredLetter?: number;
};

export const ToolButton: React.FC<ToolButtonPropTypes> = (props) => {
  const {
    onClick,
    onMouseOver,
    onMouseLeave,
    underscoredLetter,
    disabled,
    label = "",
  } = props;

  return (
    <button
      type="button"
      onClick={!disabled ? onClick : undefined}
      className={[
        styles.shortcutLetter,
        disabled && styles.disabled,
        styles.toolElement,
      ].join(" ")}
      onMouseOver={onMouseOver}
      onMouseLeave={onMouseLeave}
      role="button"
      tabIndex={!disabled ? 0 : -1}
      disabled={disabled}
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
