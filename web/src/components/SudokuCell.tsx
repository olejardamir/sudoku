import React from "react";
import type { Cell } from "./SudokuBoard";

type Props = {
  cell: Cell;
  isInSelectedBlock: boolean;
  onChange: (value: number | null) => void;
  onFocus: () => void;
};

export const SudokuCell: React.FC<Props> = ({
  cell,
  isInSelectedBlock,
  onChange,
  onFocus
}) => {
  return (
    <input
      className={`cell ${cell.fixed ? "fixed" : ""} ${
        isInSelectedBlock ? "block-highlight" : ""
      }`}
      value={cell.value ?? ""}
      readOnly={cell.fixed}
      onFocus={onFocus}
      onChange={(e) => {
        const v = e.target.value;
        if (v === "") {
          onChange(null);
          return;
        }
        if (/^[1-9]$/.test(v)) {
          onChange(Number(v));
        }
      }}
      maxLength={1}
    />
  );
};
