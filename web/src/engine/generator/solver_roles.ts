import { Difficulty, SolveStatus, SudokuSolver } from "../solver/solver.ts";
import { generateSolvedGrid } from "./generator_utils.ts";

const UNIQUE_NODE_LIMIT = 20_000;
const DIFF_NODE_LIMIT = 8_000;

type SolverRoleSet = {
  generator: SudokuSolver;
  uniqueness: SudokuSolver;
  difficulty: SudokuSolver;
};

function configureSolver(solver: SudokuSolver, randomize: boolean): void {
  solver.clearStats();
  solver.clearLimits();
  solver.enableHeavyRules(true);
  solver.enableRandomMRVTieBreak(randomize);
  solver.enableRandomValueChoice(randomize);
}

function configureGenerationSolver(solver: SudokuSolver): void {
  configureSolver(solver, true);
}

function configureDeterministicSolver(
  solver: SudokuSolver,
  grid: Uint8Array,
  nodeLimit: number
): void {
  configureSolver(solver, false);
  solver.loadGrid81(grid);
  solver.setNodeLimit(nodeLimit);
}

export class GeneratorSolvers {
  private readonly roles: SolverRoleSet;

  constructor(roles: SolverRoleSet) {
    this.roles = roles;
  }

  public generateSolved(seed32: number): Uint8Array {
    return generateSolvedGrid(this.roles.generator, seed32, configureGenerationSolver);
  }

  public hasUniqueSolution(grid: Uint8Array): boolean {
    configureDeterministicSolver(this.roles.uniqueness, grid, UNIQUE_NODE_LIMIT);
    const res = this.roles.uniqueness.countSolutions(2);
    return res.status === SolveStatus.UNIQUE;
  }

  public probeDifficulty(grid: Uint8Array): Difficulty | null {
    configureDeterministicSolver(this.roles.difficulty, grid, DIFF_NODE_LIMIT);
    const res = this.roles.difficulty.solveStopAtOne();
    if (res.status === SolveStatus.UNIQUE && res.difficulty !== null) {
      return res.difficulty;
    }
    if (res.status === SolveStatus.NODE_LIMIT || res.status === SolveStatus.TIMEOUT) {
      return Difficulty.SAMURAI;
    }
    return null;
  }
}
