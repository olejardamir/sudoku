import { useRef } from "react";
import type { Cell } from "../types";
import { verifySolvedGrid } from "../services/verifySolvedGrid";

type AutoVictoryOptions = {
  viewMode: "start" | "playing" | "victory";
  onVictory: (solvedGrid: Cell[][]) => void;
};

export function useAutoVictory({ viewMode, onVictory }: AutoVictoryOptions) {
  const skipAutoVictoryRef = useRef(false);

  const onGridUpdate = (grid: Cell[][], hasConflicts: boolean, isComplete: boolean) => {
    if (viewMode !== "playing") {
      return;
    }
    if (!isComplete || hasConflicts) {
      skipAutoVictoryRef.current = false;
      return;
    }
    if (skipAutoVictoryRef.current) {
      skipAutoVictoryRef.current = false;
      return;
    }
    const solved = verifySolvedGrid(grid);
    if (!solved) {
      return;
    }
    onVictory(solved);
  };

  return {
    onGridUpdate,
    skipNextAutoVictory: () => {
      skipAutoVictoryRef.current = true;
    },
    resetSkip: () => {
      skipAutoVictoryRef.current = false;
    },
  };
}
