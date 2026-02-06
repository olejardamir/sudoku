/* ========================================================
   SUDOKU GENERATOR — ENGINE (V4.1 SOLVER-SYNC)
   ======================================================== */

import {
  SudokuSolver,
  generateMasks,
  Difficulty,
  SolveStatus,
  SolveResult,
} from "./solver";

/* ------------------ CONSTANTS ------------------ */

const EMPTY = 0;

const MAX_GEN_ATTEMPTS = 1000;
const THEORETICAL_MIN_CLUES = 17;

const MIN_CLUES_PER_DIFF: Record<Difficulty, number> = {
  [Difficulty.EASY]: 32,
  [Difficulty.MEDIUM]: 27,
  [Difficulty.HARD]: 22,
  [Difficulty.SAMURAI]: 17,
};

const PROBE_GATE: Record<Difficulty, number> = {
  [Difficulty.EASY]: 45,
  [Difficulty.MEDIUM]: 40,
  [Difficulty.HARD]: 35,
  [Difficulty.SAMURAI]: 30,
};

const PROBE_EVERY: Record<Difficulty, number> = {
  [Difficulty.EASY]: 1,
  [Difficulty.MEDIUM]: 3,
  [Difficulty.HARD]: 2,
  [Difficulty.SAMURAI]: 2,
};

const UNIQUE_NODE_LIMIT = 20_000;
const DIFF_NODE_LIMIT = 8_000;

const ALLOW_HARD_TO_ACCEPT_SAMURAI = true;
const ALLOW_BEST_SO_FAR_FALLBACK = true;

/* ------------------ TYPES ------------------ */

export enum Symmetry {
  NONE = "NONE",
  ROT180 = "ROT180",
  ROT90 = "ROT90",
  MIRROR_XY = "MIRROR_XY",
}

export interface GeneratedPuzzle {
  puzzle81: Uint8Array;
  solution81: Uint8Array;
  seed32: number;
  difficulty: Difficulty;
  clues: number;
}

interface CarveResult {
  puzzle81: Uint8Array;
  difficulty: Difficulty;
  clues: number;
}

/* ------------------ INDEX UTILITIES ------------------ */

const row = (i: number) => (i / 9) | 0;
const col = (i: number) => i % 9;
const idx = (r: number, c: number) => r * 9 + c;

/* ------------------ DIFFICULTY ------------------ */

function difficultyRank(d: Difficulty): number {
  if (d === Difficulty.EASY) return 0;
  if (d === Difficulty.MEDIUM) return 1;
  if (d === Difficulty.HARD) return 2;
  return 3;
}

function acceptsDifficulty(target: Difficulty, diff: Difficulty): boolean {
  if (diff === target) return true;
  if (
    target === Difficulty.HARD &&
    diff === Difficulty.SAMURAI &&
    ALLOW_HARD_TO_ACCEPT_SAMURAI
  ) {
    return true;
  }
  return false;
}

function scoreToTarget(
  target: Difficulty,
  diff: Difficulty,
  clues: number
): number {
  const dist =
    Math.abs(difficultyRank(diff) - difficultyRank(target)) * 1000;
  const minClues = MIN_CLUES_PER_DIFF[target];
  const penalty = clues < minClues ? minClues - clues : 0;
  return dist + penalty;
}

/* ------------------ SOLVER CONFIG ------------------ */

function configGen(s: SudokuSolver) {
  s.clearStats();
  s.clearLimits();
  s.enableHeavyRules(true);
  s.enableRandomMRVTieBreak(true);
  s.enableRandomValueChoice(true);
}

function configDeterministic(s: SudokuSolver) {
  s.clearStats();
  s.clearLimits();
  s.enableHeavyRules(true);
  s.enableRandomMRVTieBreak(false);
  s.enableRandomValueChoice(false);
}

/* ------------------ SYMMETRY ------------------ */

function mapCell(sym: Symmetry, i: number): number {
  const r = row(i);
  const c = col(i);
  switch (sym) {
    case Symmetry.ROT180:
      return idx(8 - r, 8 - c);
    case Symmetry.ROT90:
      return idx(c, 8 - r);
    case Symmetry.MIRROR_XY:
      return idx(c, r);
    default:
      return i;
  }
}

function getSymmetryOrbits(sym: Symmetry): number[][] {
  const seen = new Array(81).fill(false);
  const orbits: number[][] = [];

  for (let i = 0; i < 81; i++) {
    if (seen[i]) continue;
    const orbit: number[] = [];
    let cur = i;
    let steps = 0;

    while (!orbit.includes(cur)) {
      orbit.push(cur);
      seen[cur] = true;
      cur = mapCell(sym, cur);
      if (++steps > 8) throw new Error("Orbit did not close");
    }
    orbits.push(orbit);
  }
  return orbits;
}

/* ------------------ SOLVED GRID ------------------ */

function generateSolvedGrid(
  solver: SudokuSolver,
  seed32: number
): Uint8Array {
  const empty = new Uint8Array(81);
  configGen(solver);
  solver.setRandomSeed(seed32);

  solver.loadGrid81(empty);
  const res = solver.countSolutions(1);

  if (res.status !== SolveStatus.UNIQUE || !res.solution81) {
    throw new Error("Failed to generate solved grid");
  }
  return res.solution81;
}

/* ------------------ UNIQUENESS ------------------ */

function hasUniqueSolution(
  solver: SudokuSolver,
  grid: Uint8Array
): boolean {
  configDeterministic(solver);
  solver.loadGrid81(grid);
  solver.setNodeLimit(UNIQUE_NODE_LIMIT);
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
  configDeterministic(solver);
  solver.loadGrid81(grid);
  solver.setNodeLimit(DIFF_NODE_LIMIT);
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
    MIN_CLUES_PER_DIFF[target]
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

  for (const orbit of orbits) {
    if (clueCount - orbit.length < floorClues) continue;

    const saved = orbit.map((i) => puzzle[i]);
    orbit.forEach((i) => (puzzle[i] = EMPTY));

    if (!hasUniqueSolution(solverUniq, puzzle)) {
      orbit.forEach((i, k) => (puzzle[i] = saved[k]));
      uniqueRejects++;
      continue;
    }

    clueCount -= orbit.length;
    probeStep++;

    if (probeStep % PROBE_EVERY[target] !== 0 || clueCount > PROBE_GATE[target]) {
      continue;
    }

    const diff = probeDifficulty(solverDiff, puzzle);
    probeCount++;
    if (sampleLogs.length < 5) {
      sampleLogs.push(
        `probe clues=${clueCount} diff=${diff !== null ? Difficulty[diff] : "null"}`
      );
    }
    if (diff === null) {
      nullProbeRejects++;
      orbit.forEach((i, k) => (puzzle[i] = saved[k]));
      clueCount += orbit.length;
      continue;
    }
    if (difficultyRank(diff) > difficultyRank(target)) {
      overshootRejects++;
      orbit.forEach((i, k) => (puzzle[i] = saved[k]));
      clueCount += orbit.length;
      continue;
    }

    const score = scoreToTarget(target, diff, clueCount);
    if (score < bestScore) {
      bestScore = score;
      best = {
        puzzle81: new Uint8Array(puzzle),
        difficulty: diff,
        clues: clueCount,
      };
    }

    if (diff === target && clueCount <= MIN_CLUES_PER_DIFF[target]) {
      return {
        puzzle81: new Uint8Array(puzzle),
        difficulty: diff,
        clues: clueCount,
      };
    }
  }
  if (!best) {
    console.log(
      `  carveSummary target=${Difficulty[target]} probes=${probeCount} ` +
      `uniqueRejects=${uniqueRejects} nullProbe=${nullProbeRejects} ` +
      `overshoot=${overshootRejects} samples=[${sampleLogs.join("; ")}]`
    );
  }
  return best;
}

/* ------------------ HASH ------------------ */

function hash32(base: number, attempt: number): number {
  let x = (base ^ (attempt * 0x9e3779b9)) >>> 0;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  return x >>> 0;
}

function shuffleOrbits(orbits: number[][], seed32: number): number[][] {
  const out = orbits.slice();
  let state = seed32 >>> 0;
  for (let i = out.length - 1; i > 0; i--) {
    state = hash32(state, i + 1);
    const j = state % (i + 1);
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}

/* ------------------ PUBLIC API ------------------ */

export function generateSudoku(
  target: Difficulty,
  symmetry: Symmetry,
  baseSeed32: number
): GeneratedPuzzle {
  console.log(
    `generateSudoku: target=${Difficulty[target]} symmetry=${symmetry} baseSeed=${baseSeed32}`
  );
  const masks = generateMasks();
  const solverGen = new SudokuSolver(masks);
  const solverUniq = new SudokuSolver(masks);
  const solverDiff = new SudokuSolver(masks);

  let best: GeneratedPuzzle | null = null;
  let bestScore = Infinity;

  for (let attempt = 1; attempt <= MAX_GEN_ATTEMPTS; attempt++) {
    const seed32 = hash32(baseSeed32, attempt);
    const solved = generateSolvedGrid(solverGen, seed32);

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
        `  attempt=${attempt} seed32=${seed32} -> diff=${Difficulty[carved.difficulty]} clues=${carved.clues}`
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
    if (score < bestScore) {
      bestScore = score;
      best = {
        puzzle81: carved.puzzle81,
        solution81: solved,
        seed32,
        difficulty: finalDiff,
        clues: carved.clues,
      };
    }

    if (acceptsDifficulty(target, finalDiff)) {
      return best!;
    }
  }

  if (ALLOW_BEST_SO_FAR_FALLBACK && best) return best;
  throw new Error("Generation failed");
}
