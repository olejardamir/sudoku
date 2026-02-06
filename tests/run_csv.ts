import * as fs from "fs";
import * as readline from "readline";
import {
  SudokuSolver,
  generateMasks,
  SolveStatus,
  Difficulty
} from "./solver";

/* ---------- helpers ---------- */
function parsePuzzle(p: string): Uint8Array {
  const grid = new Uint8Array(81);
  for (let i = 0; i < 81; i++) {
    const ch = p[i];
    grid[i] = ch === "." ? 0 : (ch.charCodeAt(0) - 48);
  }
  return grid;
}

/* ---------- setup ---------- */
const masks = generateMasks();
const solver = new SudokuSolver(masks);

const scanCsv = !process.argv.includes("--no-scan-csv");
const debugDifficulty = process.argv.includes("--debug-difficulty");

// deterministic verification mode
solver.enableRandomMRVTieBreak(false);
solver.enableRandomValueChoice(false);
solver.enableHeavyRules(true);
solver.clearLimits();

const assignmentExamples = [
  {
    label: "Easy",
    puzzle:
      "51.....83" +
      "8..416..5" +
      "........." +
      ".985.461." +
      "...9.1..." +
      ".642.357." +
      "........." +
      "6..157..4" +
      "78.....96",
    expected: Difficulty.EASY
  },
  {
    label: "Medium",
    puzzle:
      "7...9...3" +
      "2..468..1" +
      "..8...6.." +
      ".4..2..9." +
      "...3.4..." +
      ".8..1..3." +
      "..9...7.." +
      "5..142..6" +
      "8...5...2",
    expected: Difficulty.MEDIUM
  },
  {
    label: "Hard",
    puzzle:
      ".523..6.." +
      "6...4...3" +
      "........." +
      "...63..1." +
      "47.....35" +
      ".2..58..." +
      "........." +
      "1...9...6" +
      "..5..172.",
    expected: Difficulty.HARD
  },
  {
    label: "Samurai",
    puzzle:
      "5.....1.7" +
      "..43..5.." +
      "...2...8." +
      ".9.4.2..." +
      "4.......6" +
      "...1.3.5." +
      ".8...4..." +
      "..2..67.." +
      "3.9.....1",
    expected: Difficulty.SAMURAI
  }
];

/* ---------- stats ---------- */
let total = 0;
let ok = 0;
let bad = 0;

// CSV difficulty ranges per solver bucket
type Range = { min: number; max: number };

const diffRanges: Record<Difficulty, Range> = {
  [Difficulty.EASY]:    { min: +Infinity, max: -Infinity },
  [Difficulty.MEDIUM]:  { min: +Infinity, max: -Infinity },
  [Difficulty.HARD]:    { min: +Infinity, max: -Infinity },
  [Difficulty.SAMURAI]: { min: +Infinity, max: -Infinity }
};

if (!scanCsv) {
  let matches = 0;
  let mismatches = 0;

  for (const ex of assignmentExamples) {
    const grid = parsePuzzle(ex.puzzle);
    solver.loadGrid81(grid);
    const res = solver.solveStopAtOne();

    if (res.status !== SolveStatus.UNIQUE || res.difficulty === null) {
      mismatches++;
      console.log(`❌ ${ex.label}: solver failed (${SolveStatus[res.status]})`);
      continue;
    }

    const match = res.difficulty === ex.expected;
    if (match) {
      matches++;
      console.log(`✅ ${ex.label}: ${Difficulty[res.difficulty]} (match)`);
    } else {
      mismatches++;
      console.log(
        `❌ ${ex.label}: ${Difficulty[res.difficulty]} (expected ${Difficulty[ex.expected]})`
      );
    }

    if (debugDifficulty) {
      const s = res.stats;
      const logicScore =
        s.hiddenSingles +
        s.lockedCandidateElims * 2 +
        s.hiddenPairElims * 4 +
        s.guessCount * 10 +
        s.maxDepth * 3 +
        s.conflicts;
      console.log(
        `   stats: guesses=${s.guessCount} depth=${s.maxDepth} conflicts=${s.conflicts} ` +
        `hiddenSingles=${s.hiddenSingles} lockedElims=${s.lockedCandidateElims} ` +
        `hiddenPairElims=${s.hiddenPairElims} score=${logicScore}`
      );
    }
  }

  console.log("====================================");
  console.log("DONE");
  console.log(`Matches  : ${matches}`);
  console.log(`Mismatch : ${mismatches}`);
  console.log("====================================");
} else {
  /* ---------- stream CSV ---------- */
  const rl = readline.createInterface({
    input: fs.createReadStream("sudoku-3m.csv"),
    crlfDelay: Infinity
  });

  let isHeader = true;

  rl.on("line", (line) => {
    if (isHeader) {
      isHeader = false;
      return;
    }

    const parts = line.split(",");
    if (parts.length < 5) return;

    const puzzle = parts[1];
    const expectedSolution = parts[2];
    const csvDifficulty = parseFloat(parts[4]);

    const grid = parsePuzzle(puzzle);

    solver.loadGrid81(grid);
    const res = solver.solveStopAtOne();

    total++;

    if (res.status !== SolveStatus.UNIQUE || !res.solution81 || res.difficulty === null) {
      bad++;
      console.error(`❌ Row ${total}: solver failed (${SolveStatus[res.status]})`);
      return;
    }

    // verify solution correctness
    const sol = res.solution81;
    let match = true;
    for (let i = 0; i < 81; i++) {
      if (sol[i] !== (expectedSolution.charCodeAt(i) - 48)) {
        match = false;
        break;
      }
    }

    if (!match) {
      bad++;
      console.error(`❌ Row ${total}: solution mismatch`);
      return;
    }

    ok++;

    // record CSV difficulty range for solver bucket
    const bucket = res.difficulty;
    const r = diffRanges[bucket];
    if (csvDifficulty < r.min) r.min = csvDifficulty;
    if (csvDifficulty > r.max) r.max = csvDifficulty;

    if (total % 1000 === 0) {
      console.log(`✔ processed ${total} | ok=${ok} bad=${bad}`);
    }
  });

  rl.on("close", () => {
    console.log("====================================");
    console.log("DONE");
    console.log(`Processed: ${total}`);
    console.log(`Verified : ${ok}`);
    console.log(`Failed   : ${bad}`);
    console.log("");

    console.log("CSV difficulty ranges by solver bucket:");
    for (const d of [
      Difficulty.EASY,
      Difficulty.MEDIUM,
      Difficulty.HARD,
      Difficulty.SAMURAI
    ]) {
      const r = diffRanges[d];
      console.log(
        `${Difficulty[d].padEnd(8)} : ` +
        (r.min === Infinity ? "no samples" : `${r.min.toFixed(2)} – ${r.max.toFixed(2)}`)
      );
    }
    console.log("====================================");
  });
}
