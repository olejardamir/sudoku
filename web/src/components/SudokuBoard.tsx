import React, { useEffect, useRef, useState } from "react";
import { SudokuCell } from "./SudokuCell";

export type Difficulty = "EASY" | "MEDIUM" | "HARD" | "SAMURAI";

export type Cell = {
  value: number | null;
  fixed: boolean;
};

function randomGrid(): Cell[][] {
  return Array.from({ length: 9 }, () =>
    Array.from({ length: 9 }, () => {
      const isFixed = Math.random() < 0.25;
      return {
        value: isFixed ? Math.floor(Math.random() * 9) + 1 : null,
        fixed: isFixed
      };
    })
  );
}

type BoardProps = {
  solveSignal: number;
};

export const SudokuBoard: React.FC<BoardProps> = ({ solveSignal }) => {
  const [grid, setGrid] = useState<Cell[][]>(() => randomGrid());
  const [selectedBlock, setSelectedBlock] = useState<{
    row: number;
    col: number;
  } | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (gridRef.current && !gridRef.current.contains(e.target as Node)) {
        setSelectedBlock(null);
      }
    };

    document.addEventListener("mousedown", handleMouseDown);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
    };
  }, []);

  useEffect(() => {
    if (solveSignal === 0) {
      return;
    }
    setGrid((prev) =>
      prev.map((row) =>
        row.map((cell) => ({
          ...cell,
          value: Math.floor(Math.random() * 9) + 1
        }))
      )
    );
  }, [solveSignal]);

  const updateCell = (r: number, c: number, value: number | null) => {
    setGrid((prev) =>
      prev.map((row, ri) =>
        row.map((cell, ci) =>
          ri === r && ci === c ? { ...cell, value } : cell
        )
      )
    );
  };

  return (
    <div className="sudoku-wrapper">
      <div className="grid" ref={gridRef}>
        {grid.map((row, r) =>
          row.map((cell, c) => (
            <SudokuCell
              key={`${r}-${c}`}
              cell={cell}
              isInSelectedBlock={
                selectedBlock !== null &&
                Math.floor(r / 3) === selectedBlock.row &&
                Math.floor(c / 3) === selectedBlock.col
              }
              onChange={(v) => updateCell(r, c, v)}
              onFocus={() =>
                setSelectedBlock({
                  row: Math.floor(r / 3),
                  col: Math.floor(c / 3)
                })
              }
            />
          ))
        )}
      </div>
    </div>
  );
};
