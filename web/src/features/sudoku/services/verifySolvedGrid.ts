import type { Cell } from "../types";
import { createDeterministicSolver } from "../engine/solverFactory";

export function verifySolvedGrid(grid: Cell[][]): Cell[][] | null {
  const grid81 = new Uint8Array(81);
  for (let r = 0; r < 9; r += 1) {
    for (let c = 0; c < 9; c += 1) {
      const cell = grid[r][c];
      const i = r * 9 + c;
      grid81[i] = cell.value ? cell.value : 0;
    }
  }
  const solver = createDeterministicSolver();
  if (!solver.loadGrid81(grid81)) {
    return null;
  }
  const res = solver.solveStopAtOne();
  const solution = res.solution81;
  if (!solution) {
    return null;
  }
  for (let i = 0; i < 81; i += 1) {
    if (grid81[i] !== solution[i]) {
      return null;
    }
  }
  const cells: Cell[] = Array.from(solution, (v) => ({
    value: v > 0 ? v : null,
    fixed: true
  }));
  return Array.from({ length: 9 }, (_, r) =>
    cells.slice(r * 9, r * 9 + 9)
  );
}
