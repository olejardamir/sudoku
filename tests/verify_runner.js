"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const path = require("path");
const readline = require("readline");
const solver_1 = require("./solver");
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
function parseGrid81(s) {
    const grid = new Uint8Array(81);
    for (let i = 0; i < 81; i++) {
        const ch = s[i];
        grid[i] = ch === "." ? 0 : ch.charCodeAt(0) - 48;
    }
    return grid;
}
function difficultyName(d) {
    return solver_1.Difficulty[d];
}
function parseDifficulty(raw) {
    if (!raw)
        return null;
    const t = raw.trim();
    if (t === "")
        return null;
    const asNum = Number(t);
    if (!Number.isNaN(asNum)) {
        const n = asNum | 0;
        if (solver_1.Difficulty[n] !== undefined)
            return n;
    }
    const key = t.toUpperCase();
    if (solver_1.Difficulty[key] !== undefined)
        return solver_1.Difficulty[key];
    return null;
}
/* ------------------ SOLVER SETUP ------------------ */
const masks = (0, solver_1.generateMasks)();
const solver = new solver_1.SudokuSolver(masks);
// deterministic verification mode
solver.enableRandomMRVTieBreak(false);
solver.enableRandomValueChoice(false);
solver.enableHeavyRules(true);
solver.clearLimits();
const DIFF_NODE_LIMIT = 8000;
/* ------------------ STATS ------------------ */
let total = 0;
let ok = 0;
let bad = 0;
let diffMatchGenerated = 0;
let diffMatchTarget = 0;
let solutionChecked = 0;
let solutionSkipped = 0;
const diffConfusion = {
    [solver_1.Difficulty.EASY]: {
        [solver_1.Difficulty.EASY]: 0,
        [solver_1.Difficulty.MEDIUM]: 0,
        [solver_1.Difficulty.HARD]: 0,
        [solver_1.Difficulty.SAMURAI]: 0,
    },
    [solver_1.Difficulty.MEDIUM]: {
        [solver_1.Difficulty.EASY]: 0,
        [solver_1.Difficulty.MEDIUM]: 0,
        [solver_1.Difficulty.HARD]: 0,
        [solver_1.Difficulty.SAMURAI]: 0,
    },
    [solver_1.Difficulty.HARD]: {
        [solver_1.Difficulty.EASY]: 0,
        [solver_1.Difficulty.MEDIUM]: 0,
        [solver_1.Difficulty.HARD]: 0,
        [solver_1.Difficulty.SAMURAI]: 0,
    },
    [solver_1.Difficulty.SAMURAI]: {
        [solver_1.Difficulty.EASY]: 0,
        [solver_1.Difficulty.MEDIUM]: 0,
        [solver_1.Difficulty.HARD]: 0,
        [solver_1.Difficulty.SAMURAI]: 0,
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
rl.on("line", (line) => {
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
    if (parts.length < 6)
        return;
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
    if (res.status !== solver_1.SolveStatus.UNIQUE ||
        res.solution81 === null ||
        res.difficulty === null) {
        bad++;
        console.error(`❌ Row ${total}: solver failed (${solver_1.SolveStatus[res.status]})`);
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
    }
    else {
        solutionSkipped++;
    }
    /* ---------- verify difficulty ---------- */
    const solverDiff = res.difficulty;
    if (difficultyGenerated !== null && solverDiff === difficultyGenerated)
        diffMatchGenerated++;
    if (difficultyTarget !== null && solverDiff === difficultyTarget)
        diffMatchTarget++;
    if (difficultyTarget !== null)
        diffConfusion[difficultyTarget][solverDiff]++;
    ok++;
    if (total % 10 === 0) {
        console.log(`✔ processed ${total} | ok=${ok} bad=${bad}`);
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
    console.log(`Difficulty match (generated) : ${diffMatchGenerated}/${total}`);
    console.log(`Difficulty match (target)    : ${diffMatchTarget}/${total}`);
    console.log("");
    console.log("Difficulty confusion matrix (target → solver):");
    for (const t of [
        solver_1.Difficulty.EASY,
        solver_1.Difficulty.MEDIUM,
        solver_1.Difficulty.HARD,
        solver_1.Difficulty.SAMURAI,
    ]) {
        const row = diffConfusion[t];
        console.log(`${difficultyName(t).padEnd(8)} → ` +
            `${row[solver_1.Difficulty.EASY].toString().padStart(4)} ` +
            `${row[solver_1.Difficulty.MEDIUM].toString().padStart(4)} ` +
            `${row[solver_1.Difficulty.HARD].toString().padStart(4)} ` +
            `${row[solver_1.Difficulty.SAMURAI].toString().padStart(4)}`);
    }
    console.log("====================================");
});
