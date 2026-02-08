import type { Difficulty } from "../solver/solver.ts";

export interface BasePuzzle {
  puzzle81: Uint8Array;
  difficulty: Difficulty;
  clues: number;
}

export interface GeneratedPuzzle extends BasePuzzle {
  solution81: Uint8Array;
  seed32: number;
}

export type CarveResult = BasePuzzle;
