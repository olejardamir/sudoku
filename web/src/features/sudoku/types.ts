export type Difficulty = "EASY" | "MEDIUM" | "HARD" | "SAMURAI" | "NEUTRAL";

export type Cell = {
  value: number | null;
  fixed: boolean;
};

export type SudokuBoardHandle = {
  getGrid: () => Cell[][];
  hasConflicts: () => boolean;
};
