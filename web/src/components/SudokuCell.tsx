import React from "react";
import type { Cell } from "../features/sudoku/types";

type Props = {
  cell: Cell;
  isInSelectedBlock: boolean;
  isInvalid: boolean;
  allowEditFixed: boolean;
  onChange: (value: number | null) => void;
  onFocus: () => void;
};

export const SudokuCell: React.FC<Props> = ({
  cell,
  isInSelectedBlock,
  isInvalid,
  allowEditFixed,
  onChange,
  onFocus
}) => {
  return (
    <input
      className={`cell ${cell.fixed ? "fixed" : ""} ${
        isInSelectedBlock ? "block-highlight" : ""
      } ${isInvalid ? "invalid" : ""}`}
      value={cell.value ?? ""}
      readOnly={cell.fixed && !allowEditFixed}
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
