/* ========================================================
   SUDOKU GENERATOR — ENGINE (V4.1 SOLVER-SYNC)
   ======================================================== */

import { SudokuSolver, generateMasks, Difficulty } from "../solver/solver.ts";
import { hash32 } from "./generator_utils.ts";
import type { Symmetry } from "./generator_utils.ts";
import { CandidateSelector } from "./candidate_selector.ts";
import { CarveInstrumentation } from "./carve_instrumentation.ts";
import { carvePuzzle } from "./carving.ts";
import { DifficultyPolicy } from "./difficulty_policy.ts";
import { type GeneratedPuzzle } from "./generator_types.ts";
import { GeneratorSolvers } from "./solver_roles.ts";

/* ------------------ CONSTANTS ------------------ */

const MAX_GEN_ATTEMPTS = 1000;
const ALLOW_BEST_SO_FAR_FALLBACK = true;

/* ------------------ TYPES ------------------ */

export { Symmetry } from "./generator_utils.ts";
export type { GeneratedPuzzle } from "./generator_types.ts";

/* ------------------ PUBLIC API ------------------ */

export function generateSudoku(
  target: Difficulty,
  symmetry: Symmetry,
  baseSeed32: number
): GeneratedPuzzle {
  const policy = new DifficultyPolicy();
  console.log(
    `generateSudoku: target=${policy.label(target)} symmetry=${symmetry} baseSeed=${baseSeed32}`
  );
  const masks = generateMasks();
  const solvers = new GeneratorSolvers({
    generator: new SudokuSolver(masks),
    uniqueness: new SudokuSolver(masks),
    difficulty: new SudokuSolver(masks),
  });

  const selector = new CandidateSelector<GeneratedPuzzle>();

  for (let attempt = 1; attempt <= MAX_GEN_ATTEMPTS; attempt++) {
    const seed32 = hash32(baseSeed32, attempt);
    const solved = solvers.generateSolved(seed32);

    const instrumentation = new CarveInstrumentation();
    const { result: carved, summary } = carvePuzzle(
      solvers,
      solved,
      target,
      symmetry,
      seed32,
      policy,
      instrumentation
    );
    if (!carved) {
      console.log(`  attempt=${attempt} seed32=${seed32} -> carved=null`);
      console.log(
        `  carveSummary target=${policy.label(target)} probes=${summary.probeCount} ` +
        `uniqueRejects=${summary.uniqueRejects} nullProbe=${summary.nullProbeRejects} ` +
        `overshoot=${summary.overshootRejects} samples=[${summary.samples.join("; ")}]`
      );
    } else {
      console.log(
        `  attempt=${attempt} seed32=${seed32} -> diff=${policy.label(carved.difficulty)} clues=${carved.clues}`
      );
    }
    if (!carved) continue;

    const finalDiff = solvers.probeDifficulty(carved.puzzle81);
    if (finalDiff === null) continue;

    const score = policy.score(target, finalDiff, carved.clues);
    selector.update(
      {
        puzzle81: carved.puzzle81,
        solution81: solved,
        seed32,
        difficulty: finalDiff,
        clues: carved.clues,
      },
      score
    );

    const best = selector.getBest();
    if (best && policy.accepts(target, finalDiff)) {
      return best;
    }
  }

  const best = selector.getBest();
  if (ALLOW_BEST_SO_FAR_FALLBACK && best) return best;
  throw new Error("Generation failed");
}
