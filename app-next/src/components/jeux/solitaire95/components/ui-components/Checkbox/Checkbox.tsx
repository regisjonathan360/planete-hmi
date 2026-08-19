import React from "react";
import styles from "./Checkbox.module.scss";

type CheckboxPropTypes = {
  id: string;
  checked: boolean;
  onClick: () => void;
  disabled?: boolean;
  label?: string;
  underscoredLetter?: number;
};

export const Checkbox: React.FC<CheckboxPropTypes> = ({
  id,
  label = "",
  checked,
  onClick,
  disabled,
  underscoredLetter,
}) => {
  return (
    <div className={styles.checkbox}>
      <input
        type="checkbox"
        id={id}
        checked={checked}
        onChange={onClick}
        disabled={disabled}
        aria-label={label}
      />
      <label
        htmlFor={id}
        className={[styles.label, disabled ? styles.disabled : null].join(" ")}
      >
        <span
          className={[
            styles.doubleBorder,
            checked ? styles["doubleBorder__selected"] : null,
          ].join(" ")}
          aria-hidden="true"
        />
        {label
          .split("")
          .map((letter, index) =>
            index === underscoredLetter ? (
              <span key={`${index}${letter}`}>{letter}</span>
            ) : (
              letter
            )
          )}
      </label>
    </div>
  );
};
