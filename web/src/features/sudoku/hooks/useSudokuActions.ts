import { useCallback } from "react";
import { generateSudoku, Symmetry } from "../../../engine/generator/generator.ts";
import type { Cell, Difficulty } from "../types";
import { toEngineDifficulty, fromEngineDifficulty } from "../engine/difficultyAdapter";
import { evaluateDifficulty } from "../services/evaluateDifficulty";
import { solveFromFixed } from "../services/solveFromFixed";
import {
  buildMetadataSaveText,
  buildSaveText,
  parsePuzzleText,
} from "../serialization/puzzleText";
import { saveTextFile } from "../../../shared/services/fileSave";

export type ViewMode = "start" | "playing" | "victory";
export type ActiveModal = "welcome" | "newGame" | "save" | null;

type UseSudokuActionsOptions = {
  getGrid: () => Cell[][] | null;
  setLoadedGrid: (grid: Cell[][] | null) => void;
  setDifficulty: (difficulty: Difficulty) => void;
  setPendingDifficulty: (difficulty: Difficulty) => void;
  setViewMode: (mode: ViewMode) => void;
  setActiveModal: (modal: ActiveModal) => void;
  skipNextAutoVictory: () => void;
  resetSkip: () => void;
};

function puzzleToGrid(puzzle81: Uint8Array): Cell[][] {
  const cells: Cell[] = Array.from(puzzle81, (v) => ({
    value: v > 0 ? v : null,
    fixed: v > 0,
  }));
  return Array.from({ length: 9 }, (_, r) =>
    cells.slice(r * 9, r * 9 + 9)
  );
}

export function useSudokuActions({
  getGrid,
  setLoadedGrid,
  setDifficulty,
  setPendingDifficulty,
  setViewMode,
  setActiveModal,
  skipNextAutoVictory,
  resetSkip,
}: UseSudokuActionsOptions) {
  const newGame = useCallback(
    (currentDifficulty: Difficulty) => {
      setPendingDifficulty(currentDifficulty);
      setActiveModal("newGame");
    },
    [setActiveModal, setPendingDifficulty]
  );

  const confirmNewGame = useCallback(
    (pendingDifficulty: Difficulty) => {
      try {
        skipNextAutoVictory();
        const result = generateSudoku(
          toEngineDifficulty(pendingDifficulty),
          Symmetry.NONE,
          Date.now() >>> 0
        );
        const grid = puzzleToGrid(result.puzzle81);
        setLoadedGrid(grid);
        setDifficulty(fromEngineDifficulty(result.difficulty));
        setViewMode("playing");
        setActiveModal(null);
      } catch (err) {
        console.error(err);
      }
    },
    [setActiveModal, setDifficulty, setLoadedGrid, setViewMode, skipNextAutoVictory]
  );

  const solve = useCallback(() => {
    const grid = getGrid();
    if (!grid) {
      return;
    }
    const solved = solveFromFixed(grid);
    if (!solved) {
      return;
    }
    resetSkip();
    setLoadedGrid(solved);
    setViewMode("victory");
  }, [getGrid, resetSkip, setLoadedGrid, setViewMode]);

  const saveAsIs = useCallback(async () => {
    const grid = getGrid();
    if (!grid) return;
    await saveTextFile(buildSaveText(grid), "sudoku.txt");
    setActiveModal(null);
  }, [getGrid, setActiveModal]);

  const saveWithMetadata = useCallback(async () => {
    const grid = getGrid();
    if (!grid) return;
    await saveTextFile(buildMetadataSaveText(grid), "sudoku.txt");
    setActiveModal(null);
  }, [getGrid, setActiveModal]);

  const handleFileChosen = useCallback(
    async (file: File | null) => {
      if (!file) return;
      const text = await file.text();
      const parsed = parsePuzzleText(text);
      const evalGrid = parsed.hasMetadata && parsed.fixedMask
        ? Uint8Array.from(
            parsed.grid81.map((v, i) => (parsed.fixedMask![i] === 1 ? v : 0))
          )
        : parsed.grid81;
      setDifficulty(evaluateDifficulty(evalGrid));
      skipNextAutoVictory();
      setViewMode("playing");
      setLoadedGrid(parsed.grid);
    },
    [setDifficulty, setLoadedGrid, setViewMode, skipNextAutoVictory]
  );

  return {
    newGame,
    confirmNewGame,
    solve,
    saveAsIs,
    saveWithMetadata,
    handleFileChosen,
  };
}
