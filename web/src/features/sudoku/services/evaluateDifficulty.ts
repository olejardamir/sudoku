import { SolveStatus } from "../../../engine/solver/solver.ts";
import type { Difficulty } from "../types";
import { fromEngineDifficulty } from "../engine/difficultyAdapter";
import { createDeterministicSolver } from "../engine/solverFactory";

export function evaluateDifficulty(grid81: Uint8Array): Difficulty {
  const solverUniq = createDeterministicSolver();
  if (!solverUniq.loadGrid81(grid81)) {
    return "NEUTRAL";
  }
  const uniq = solverUniq.countSolutions(2);
  if (uniq.status !== SolveStatus.UNIQUE) {
    return "NEUTRAL";
  }
  const solverDiff = createDeterministicSolver();
  if (!solverDiff.loadGrid81(grid81)) {
    return "NEUTRAL";
  }
  const diff = solverDiff.solveStopAtOne();
  if (diff.status !== SolveStatus.UNIQUE || diff.difficulty === null) {
    return "NEUTRAL";
  }
  return fromEngineDifficulty(diff.difficulty);
}
