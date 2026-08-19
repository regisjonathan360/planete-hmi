import React from "react";
import styles from "./RadioButton.module.scss";

type RadiobuttonPropTypes = {
  label: string;
  onClick: () => void;
  currentValue: string;
  underscoredLetter?: number;
};

export const Radiobutton: React.FC<RadiobuttonPropTypes> = ({
  label,
  onClick,
  currentValue,
  underscoredLetter,
}) => {
  return (
    <button
      type="button"
      className={styles.radioWrapper}
      onClick={onClick}
      role="radio"
      id={label}
      aria-label={label}
      aria-checked={currentValue === label}
    >
      <div className={styles.customRadio__outer}>
        <div className={styles.customRadio__inner}>
          <div
            className={styles.customRadio__circle}
            style={{ visibility: currentValue === label ? "visible" : "hidden" }}
          />
        </div>
      </div>
      <span className={styles.radioLabel}>
        {label
          .split("")
          .map((letter, index) =>
            index === underscoredLetter ? (
              <span key={`${index}${letter}`}>{letter}</span>
            ) : (
              letter
            )
          )}
      </span>
    </button>
  );
};
