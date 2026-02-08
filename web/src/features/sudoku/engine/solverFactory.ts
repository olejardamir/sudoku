import { SudokuSolver, generateMasks } from "../../../engine/solver/solver.ts";

export function createDeterministicSolver(): SudokuSolver {
  const solver = new SudokuSolver(generateMasks());
  solver.clearLimits();
  solver.enableHeavyRules(true);
  solver.enableRandomMRVTieBreak(false);
  solver.enableRandomValueChoice(false);
  return solver;
}
