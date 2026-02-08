/* ========================================================
   SUDOKU GENERATOR — ENGINE (V4.1 SOLVER-SYNC)
   ======================================================== */

import { SudokuSolver, generateMasks, Difficulty, SolveStatus } from "./solver";
import { generateSolvedGrid, getSymmetryOrbits, hash32, shuffleOrbits } from "./generator_utils";
import type { Symmetry } from "./generator_utils";

/* ------------------ CONSTANTS ------------------ */

const EMPTY = 0;

const MAX_GEN_ATTEMPTS = 1000;
const THEORETICAL_MIN_CLUES = 17;

type DifficultyConfig = {
  minClues: number;
  probeGate: number;
  probeEvery: number;
};

const DIFFICULTY_CONFIG: Record<Difficulty, DifficultyConfig> = {
  [Difficulty.EASY]: { minClues: 32, probeGate: 45, probeEvery: 1 },
  [Difficulty.MEDIUM]: { minClues: 27, probeGate: 40, probeEvery: 3 },
  [Difficulty.HARD]: { minClues: 22, probeGate: 35, probeEvery: 2 },
  [Difficulty.SAMURAI]: { minClues: 17, probeGate: 30, probeEvery: 2 },
};

const UNIQUE_NODE_LIMIT = 20_000;
const DIFF_NODE_LIMIT = 8_000;

const ALLOW_HARD_TO_ACCEPT_SAMURAI = true;
const ALLOW_BEST_SO_FAR_FALLBACK = true;

/* ------------------ TYPES ------------------ */

export { Symmetry } from "./generator_utils";

interface BasePuzzle {
  puzzle81: Uint8Array;
  difficulty: Difficulty;
  clues: number;
}

export interface GeneratedPuzzle extends BasePuzzle {
  solution81: Uint8Array;
  seed32: number;
}

type CarveResult = BasePuzzle;

/* ------------------ DIFFICULTY ------------------ */

function difficultyRank(d: Difficulty): number {
  if (d === Difficulty.EASY) return 0;
  if (d === Difficulty.MEDIUM) return 1;
  if (d === Difficulty.HARD) return 2;
  return 3;
}

const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  [Difficulty.EASY]: "EASY",
  [Difficulty.MEDIUM]: "MEDIUM",
  [Difficulty.HARD]: "HARD",
  [Difficulty.SAMURAI]: "SAMURAI",
};

function difficultyLabel(d: Difficulty): string {
  return DIFFICULTY_LABEL[d];
}

function acceptsDifficulty(target: Difficulty, diff: Difficulty): boolean {
  return (
    diff === target ||
    (target === Difficulty.HARD &&
      diff === Difficulty.SAMURAI &&
      ALLOW_HARD_TO_ACCEPT_SAMURAI)
  );
}

function scoreToTarget(
  target: Difficulty,
  diff: Difficulty,
  clues: number
): number {
  const dist =
    Math.abs(difficultyRank(diff) - difficultyRank(target)) * 1000;
  const minClues = DIFFICULTY_CONFIG[target].minClues;
  const penalty = clues < minClues ? minClues - clues : 0;
  return dist + penalty;
}

function maybeUpdateBest<T>(
  best: T | null,
  bestScore: number,
  candidate: T,
  score: number
): { best: T | null; bestScore: number } {
  if (score < bestScore) {
    return { best: candidate, bestScore: score };
  }
  return { best, bestScore };
}

/* ------------------ SOLVER CONFIG ------------------ */

function configureSolver(s: SudokuSolver, randomize: boolean) {
  s.clearStats();
  s.clearLimits();
  s.enableHeavyRules(true);
  s.enableRandomMRVTieBreak(randomize);
  s.enableRandomValueChoice(randomize);
}

function configGen(s: SudokuSolver) {
  configureSolver(s, true);
}

function configDeterministic(s: SudokuSolver) {
  configureSolver(s, false);
}

/* ------------------ UNIQUENESS ------------------ */

function prepareDeterministicSolve(
  solver: SudokuSolver,
  grid: Uint8Array,
  nodeLimit: number
) {
  configDeterministic(solver);
  solver.loadGrid81(grid);
  solver.setNodeLimit(nodeLimit);
}

function hasUniqueSolution(
  solver: SudokuSolver,
  grid: Uint8Array
): boolean {
  prepareDeterministicSolve(solver, grid, UNIQUE_NODE_LIMIT);
  const res = solver.countSolutions(2);
  switch (res.status) {
    case SolveStatus.UNIQUE:
      return true;
    case SolveStatus.MULTIPLE:
    case SolveStatus.NO_SOLUTION:
      return false;
    default:
      return false;
  }
}

/* ------------------ DIFFICULTY ------------------ */

function probeDifficulty(
  solver: SudokuSolver,
  grid: Uint8Array
): Difficulty | null {
  prepareDeterministicSolve(solver, grid, DIFF_NODE_LIMIT);
  const res = solver.solveStopAtOne();

  if (res.status === SolveStatus.UNIQUE && res.difficulty !== null) {
    return res.difficulty;
  }
  if (res.status === SolveStatus.NODE_LIMIT || res.status === SolveStatus.TIMEOUT) {
    return Difficulty.SAMURAI;
  }
  return null;
}

/* ------------------ CARVING ------------------ */

function carvePuzzle(
  solverUniq: SudokuSolver,
  solverDiff: SudokuSolver,
  solved: Uint8Array,
  target: Difficulty,
  symmetry: Symmetry,
  seed32: number
): CarveResult | null {
  const puzzle = new Uint8Array(solved);
  let clueCount = 81;

  const floorClues = Math.max(
    THEORETICAL_MIN_CLUES,
    DIFFICULTY_CONFIG[target].minClues
  );

  const orbits = shuffleOrbits(getSymmetryOrbits(symmetry), seed32);
  let best: CarveResult | null = null;
  let bestScore = Infinity;
  let probeStep = 0;
  let uniqueRejects = 0;
  let probeCount = 0;
  let overshootRejects = 0;
  let nullProbeRejects = 0;
  const sampleLogs: string[] = [];

  const makeCarveResult = (
    puzzle81: Uint8Array,
    difficulty: Difficulty,
    clues: number
  ): CarveResult => ({
    puzzle81: new Uint8Array(puzzle81),
    difficulty,
    clues,
  });

  const restoreOrbit = (orbit: number[], saved: number[]) => {
    orbit.forEach((i, k) => (puzzle[i] = saved[k]));
  };

  const undoRemoval = (orbit: number[], saved: number[]) => {
    restoreOrbit(orbit, saved);
    clueCount += orbit.length;
  };

  for (const orbit of orbits) {
    if (clueCount - orbit.length < floorClues) continue;

    const saved = orbit.map((i) => puzzle[i]);
    orbit.forEach((i) => (puzzle[i] = EMPTY));

    if (!hasUniqueSolution(solverUniq, puzzle)) {
      restoreOrbit(orbit, saved);
      uniqueRejects++;
      continue;
    }

    clueCount -= orbit.length;
    probeStep++;

    if (
      probeStep % DIFFICULTY_CONFIG[target].probeEvery !== 0 ||
      clueCount > DIFFICULTY_CONFIG[target].probeGate
    ) {
      continue;
    }

    const diff = probeDifficulty(solverDiff, puzzle);
    probeCount++;
    if (sampleLogs.length < 5) {
      sampleLogs.push(
        `probe clues=${clueCount} diff=${diff !== null ? difficultyLabel(diff) : "null"}`
      );
    }
    if (diff === null) {
      nullProbeRejects++;
      undoRemoval(orbit, saved);
      continue;
    }
    if (difficultyRank(diff) > difficultyRank(target)) {
      overshootRejects++;
      undoRemoval(orbit, saved);
      continue;
    }

    const score = scoreToTarget(target, diff, clueCount);
    ({ best, bestScore } = maybeUpdateBest(
      best,
      bestScore,
      makeCarveResult(puzzle, diff, clueCount),
      score
    ));

    if (diff === target && clueCount <= DIFFICULTY_CONFIG[target].minClues) {
      return makeCarveResult(puzzle, diff, clueCount);
    }
  }
  if (!best) {
    console.log(
      `  carveSummary target=${difficultyLabel(target)} probes=${probeCount} ` +
      `uniqueRejects=${uniqueRejects} nullProbe=${nullProbeRejects} ` +
      `overshoot=${overshootRejects} samples=[${sampleLogs.join("; ")}]`
    );
  }
  return best;
}

/* ------------------ PUBLIC API ------------------ */

export function generateSudoku(
  target: Difficulty,
  symmetry: Symmetry,
  baseSeed32: number
): GeneratedPuzzle {
  console.log(
    `generateSudoku: target=${difficultyLabel(target)} symmetry=${symmetry} baseSeed=${baseSeed32}`
  );
  const masks = generateMasks();
  const solverGen = new SudokuSolver(masks);
  const solverUniq = new SudokuSolver(masks);
  const solverDiff = new SudokuSolver(masks);

  let best: GeneratedPuzzle | null = null;
  let bestScore = Infinity;

  const makeGeneratedPuzzle = (
    puzzle81: Uint8Array,
    solution81: Uint8Array,
    seed32: number,
    difficulty: Difficulty,
    clues: number
  ): GeneratedPuzzle => ({
    puzzle81,
    solution81,
    seed32,
    difficulty,
    clues,
  });

  for (let attempt = 1; attempt <= MAX_GEN_ATTEMPTS; attempt++) {
    const seed32 = hash32(baseSeed32, attempt);
    const solved = generateSolvedGrid(solverGen, seed32, configGen);

    const carved = carvePuzzle(
      solverUniq,
      solverDiff,
      solved,
      target,
      symmetry,
      seed32
    );
    if (!carved) {
      console.log(`  attempt=${attempt} seed32=${seed32} -> carved=null`);
    } else {
      console.log(
        `  attempt=${attempt} seed32=${seed32} -> diff=${difficultyLabel(carved.difficulty)} clues=${carved.clues}`
      );
    }
    if (!carved) continue;

    const finalDiff = probeDifficulty(solverDiff, carved.puzzle81);
    if (finalDiff === null) continue;

    const score = scoreToTarget(
      target,
      finalDiff,
      carved.clues
    );
    ({ best, bestScore } = maybeUpdateBest(
      best,
      bestScore,
      makeGeneratedPuzzle(
        carved.puzzle81,
        solved,
        seed32,
        finalDiff,
        carved.clues
      ),
      score
    ));

    if (acceptsDifficulty(target, finalDiff)) {
      return best!;
    }
  }

  if (ALLOW_BEST_SO_FAR_FALLBACK && best) return best;
  throw new Error("Generation failed");
}
