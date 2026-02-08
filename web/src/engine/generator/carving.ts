import { Difficulty } from "../solver/solver.ts";
import { getSymmetryOrbits, shuffleOrbits } from "./generator_utils.ts";
import type { Symmetry } from "./generator_utils.ts";
import { CandidateSelector } from "./candidate_selector.ts";
import { CarveInstrumentation, type CarveSummary } from "./carve_instrumentation.ts";
import { DifficultyPolicy } from "./difficulty_policy.ts";
import { type CarveResult } from "./generator_types.ts";
import { GeneratorSolvers } from "./solver_roles.ts";

const EMPTY = 0;

export type CarveOutcome = {
  result: CarveResult | null;
  summary: CarveSummary;
};

function makeCarveResult(
  puzzle81: Uint8Array,
  difficulty: Difficulty,
  clues: number
): CarveResult {
  return {
    puzzle81: new Uint8Array(puzzle81),
    difficulty,
    clues,
  };
}

export function carvePuzzle(
  solvers: GeneratorSolvers,
  solved: Uint8Array,
  target: Difficulty,
  symmetry: Symmetry,
  seed32: number,
  policy: DifficultyPolicy,
  instrumentation: CarveInstrumentation
): CarveOutcome {
  const puzzle = new Uint8Array(solved);
  let clueCount = 81;
  let probeStep = 0;

  const floorClues = policy.floorClues(target);
  const orbits = shuffleOrbits(getSymmetryOrbits(symmetry), seed32);
  const selector = new CandidateSelector<CarveResult>();

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

    if (!solvers.hasUniqueSolution(puzzle)) {
      restoreOrbit(orbit, saved);
      instrumentation.recordUniqueReject();
      continue;
    }

    clueCount -= orbit.length;
    probeStep++;

    if (!policy.shouldProbe(target, probeStep, clueCount)) {
      continue;
    }

    const diff = solvers.probeDifficulty(puzzle);
    instrumentation.recordProbe(clueCount, diff, (d) => policy.label(d));

    if (diff === null) {
      instrumentation.recordNullProbeReject();
      undoRemoval(orbit, saved);
      continue;
    }

    if (policy.isOvershoot(target, diff)) {
      instrumentation.recordOvershootReject();
      undoRemoval(orbit, saved);
      continue;
    }

    const score = policy.score(target, diff, clueCount);
    selector.update(makeCarveResult(puzzle, diff, clueCount), score);

    if (diff === target && clueCount <= policy.minClues(target)) {
      return { result: makeCarveResult(puzzle, diff, clueCount), summary: instrumentation.summary() };
    }
  }

  return { result: selector.getBest(), summary: instrumentation.summary() };
}
