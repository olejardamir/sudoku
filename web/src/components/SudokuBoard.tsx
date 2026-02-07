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
  loadedGrid: Cell[][] | null;
  newGameSignal: number;
  solveSignal: number;
};

export const SudokuBoard: React.FC<BoardProps> = ({
  loadedGrid,
  newGameSignal,
  solveSignal
}) => {
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

  useEffect(() => {
    if (newGameSignal === 0) {
      return;
    }
    setGrid(randomGrid());
    setSelectedBlock(null);
  }, [newGameSignal]);

  useEffect(() => {
    if (!loadedGrid) {
      return;
    }
    setGrid(loadedGrid);
    setSelectedBlock(null);
  }, [loadedGrid]);

  const updateCell = (r: number, c: number, value: number | null) => {
    setGrid((prev) =>
      prev.map((row, ri) =>
        row.map((cell, ci) =>
          ri === r && ci === c ? { ...cell, value } : cell
        )
      )
    );
  };

  const getConflicts = () => {
    const conflicts = new Set<string>();

    for (let r = 0; r < 9; r += 1) {
      const seen = new Map<number, number[]>();
      for (let c = 0; c < 9; c += 1) {
        const v = grid[r][c].value;
        if (v === null) {
          continue;
        }
        const list = seen.get(v) ?? [];
        list.push(c);
        seen.set(v, list);
      }
      seen.forEach((cols) => {
        if (cols.length > 1) {
          cols.forEach((c) => conflicts.add(`${r}-${c}`));
        }
      });
    }

    for (let c = 0; c < 9; c += 1) {
      const seen = new Map<number, number[]>();
      for (let r = 0; r < 9; r += 1) {
        const v = grid[r][c].value;
        if (v === null) {
          continue;
        }
        const list = seen.get(v) ?? [];
        list.push(r);
        seen.set(v, list);
      }
      seen.forEach((rows) => {
        if (rows.length > 1) {
          rows.forEach((r) => conflicts.add(`${r}-${c}`));
        }
      });
    }

    for (let br = 0; br < 3; br += 1) {
      for (let bc = 0; bc < 3; bc += 1) {
        const seen = new Map<number, Array<{ r: number; c: number }>>();
        for (let r = br * 3; r < br * 3 + 3; r += 1) {
          for (let c = bc * 3; c < bc * 3 + 3; c += 1) {
            const v = grid[r][c].value;
            if (v === null) {
              continue;
            }
            const list = seen.get(v) ?? [];
            list.push({ r, c });
            seen.set(v, list);
          }
        }
        seen.forEach((cells) => {
          if (cells.length > 1) {
            cells.forEach(({ r, c }) => conflicts.add(`${r}-${c}`));
          }
        });
      }
    }

    return conflicts;
  };

  const conflicts = getConflicts();

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
              isInvalid={conflicts.has(`${r}-${c}`)}
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
