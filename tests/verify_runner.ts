"use strict";

import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";

import {
  SudokuSolver,
  generateMasks,
  Difficulty,
  SolveStatus,
} from "./solver";

/* ========================================================
   CSV SCHEMA (generated_puzzles.csv)

   base_seed,
   solution_seed32,
   symmetry,
   difficulty_target,
   difficulty_generated,
   clue_count,
   solution_81,
   puzzle_81
   ======================================================== */

/* ------------------ HELPERS ------------------ */

function parseGrid81(s: string): Uint8Array {
  const grid = new Uint8Array(81);
  for (let i = 0; i < 81; i++) {
    const ch = s[i];
    grid[i] = ch === "." ? 0 : ch.charCodeAt(0) - 48;
  }
  return grid;
}

function difficultyName(d: Difficulty): string {
  return Difficulty[d];
}

function parseDifficulty(raw: string | undefined): Difficulty | null {
  if (!raw) return null;
  const t = raw.trim();
  if (t === "") return null;
  const asNum = Number(t);
  if (!Number.isNaN(asNum)) {
    const n = asNum | 0;
    if (Difficulty[n] !== undefined) return n as Difficulty;
  }
  const key = t.toUpperCase();
  if ((Difficulty as any)[key] !== undefined) return (Difficulty as any)[key] as Difficulty;
  return null;
}

/* ------------------ SOLVER SETUP ------------------ */

const masks = generateMasks();
const solver = new SudokuSolver(masks);

// deterministic verification mode
solver.enableRandomMRVTieBreak(false);
solver.enableRandomValueChoice(false);
solver.enableHeavyRules(true);
solver.clearLimits();

const DIFF_NODE_LIMIT = 8_000;

/* ------------------ STATS ------------------ */

let total = 0;
let ok = 0;
let bad = 0;

let diffMatchGenerated = 0;
let diffMatchTarget = 0;
let solutionChecked = 0;
let solutionSkipped = 0;

const diffConfusion: Record<Difficulty, Record<Difficulty, number>> = {
  [Difficulty.EASY]: {
    [Difficulty.EASY]: 0,
    [Difficulty.MEDIUM]: 0,
    [Difficulty.HARD]: 0,
    [Difficulty.SAMURAI]: 0,
  },
  [Difficulty.MEDIUM]: {
    [Difficulty.EASY]: 0,
    [Difficulty.MEDIUM]: 0,
    [Difficulty.HARD]: 0,
    [Difficulty.SAMURAI]: 0,
  },
  [Difficulty.HARD]: {
    [Difficulty.EASY]: 0,
    [Difficulty.MEDIUM]: 0,
    [Difficulty.HARD]: 0,
    [Difficulty.SAMURAI]: 0,
  },
  [Difficulty.SAMURAI]: {
    [Difficulty.EASY]: 0,
    [Difficulty.MEDIUM]: 0,
    [Difficulty.HARD]: 0,
    [Difficulty.SAMURAI]: 0,
  },
};

/* ------------------ CSV STREAM ------------------ */

const LOCAL_FILE = "generated_puzzles.csv";
const GENERATOR_FILE = path.join(__dirname, "..", "generator", "generated_puzzles.csv");
const INPUT_FILE = fs.existsSync(GENERATOR_FILE) ? GENERATOR_FILE : LOCAL_FILE;

let idxDifficultyTarget = -1;
let idxDifficultyGenerated = -1;
let idxSolution = -1;
let idxPuzzle = -1;

const rl = readline.createInterface({
  input: fs.createReadStream(INPUT_FILE),
  crlfDelay: Infinity,
});

let isHeader = true;

rl.on("line", (line: string) => {
  if (isHeader) {
    isHeader = false;
    const header = line.split(",");
    idxDifficultyTarget = header.indexOf("difficulty_target");
    idxDifficultyGenerated = header.indexOf("difficulty_generated");
    idxSolution = header.indexOf("solution_81");
    idxPuzzle = header.indexOf("puzzle_81");
    if (idxPuzzle === -1 && header.length === 6) {
      idxDifficultyTarget = 2;
      idxDifficultyGenerated = 3;
      idxPuzzle = 5;
    }
    return;
  }

  const parts = line.split(",");
  if (parts.length < 6) return;

  const difficultyTarget = parseDifficulty(parts[idxDifficultyTarget]);
  const difficultyGenerated = parseDifficulty(parts[idxDifficultyGenerated]);
  const solutionStr = idxSolution >= 0 ? parts[idxSolution] : "";
  const puzzleStr = idxPuzzle >= 0 ? parts[idxPuzzle] : "";

  if (!puzzleStr || puzzleStr.length < 81) {
    bad++;
    console.error(`❌ Row ${total + 1}: missing puzzle_81`);
    return;
  }

  const puzzle = parseGrid81(puzzleStr);
  const expectedSolution = solutionStr && solutionStr.length >= 81 ? parseGrid81(solutionStr) : null;

  solver.loadGrid81(puzzle);
  solver.setNodeLimit(DIFF_NODE_LIMIT);
  const res = solver.solveStopAtOne();

  total++;

  /* ---------- solver must succeed ---------- */
  if (
    res.status !== SolveStatus.UNIQUE ||
    res.solution81 === null ||
    res.difficulty === null
  ) {
    bad++;
    console.error(
      `❌ Row ${total}: solver failed (${SolveStatus[res.status]})`
    );
    return;
  }

  /* ---------- verify solution ---------- */
  if (expectedSolution) {
    const sol = res.solution81;
    for (let i = 0; i < 81; i++) {
      if (sol[i] !== expectedSolution[i]) {
        bad++;
        console.error(`❌ Row ${total}: solution mismatch`);
        return;
      }
    }
    solutionChecked++;
  } else {
    solutionSkipped++;
  }

  /* ---------- verify difficulty ---------- */
  const solverDiff = res.difficulty;

  if (difficultyGenerated !== null && solverDiff === difficultyGenerated) diffMatchGenerated++;
  if (difficultyTarget !== null && solverDiff === difficultyTarget) diffMatchTarget++;
  if (difficultyTarget !== null) diffConfusion[difficultyTarget][solverDiff]++;

  ok++;

  if (total % 10 === 0) {
    console.log(
      `✔ processed ${total} | ok=${ok} bad=${bad}`
    );
  }
});

/* ------------------ FINAL REPORT ------------------ */

rl.on("close", () => {
  console.log("====================================");
  console.log("VERIFICATION COMPLETE");
  console.log("------------------------------------");
  console.log(`Total rows          : ${total}`);
  console.log(`Verified OK         : ${ok}`);
  console.log(`Failed              : ${bad}`);
  console.log("");
  console.log(`Solution verified   : ${solutionChecked}`);
  console.log(`Solution skipped    : ${solutionSkipped}`);
  console.log("");
  console.log(
    `Difficulty match (generated) : ${diffMatchGenerated}/${total}`
  );
  console.log(
    `Difficulty match (target)    : ${diffMatchTarget}/${total}`
  );
  console.log("");
  console.log("Difficulty confusion matrix (target → solver):");

  for (const t of [
    Difficulty.EASY,
    Difficulty.MEDIUM,
    Difficulty.HARD,
    Difficulty.SAMURAI,
  ]) {
    const row = diffConfusion[t];
    console.log(
      `${difficultyName(t).padEnd(8)} → ` +
        `${row[Difficulty.EASY].toString().padStart(4)} ` +
        `${row[Difficulty.MEDIUM].toString().padStart(4)} ` +
        `${row[Difficulty.HARD].toString().padStart(4)} ` +
        `${row[Difficulty.SAMURAI].toString().padStart(4)}`
    );
  }

  console.log("====================================");
});
