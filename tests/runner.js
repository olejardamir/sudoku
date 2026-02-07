"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const path = require("path");
const generator_1 = require("./generator");
const solver_1 = require("./solver");
const OUTPUT_FILE = path.join(__dirname, "generated_puzzles.csv");
const ATTEMPTS_FILE = path.join(__dirname, "generated_attempts.csv");
const TARGET_ROWS = 1000000;
const LOG_EVERY = 1000;
const BASE_SEED = 0x12345678;
const SYMMETRIES = [
    generator_1.Symmetry.NONE,
    generator_1.Symmetry.ROT180,
    generator_1.Symmetry.ROT90,
    generator_1.Symmetry.MIRROR_XY,
];
const DIFFICULTIES = [
    solver_1.Difficulty.EASY,
    solver_1.Difficulty.MEDIUM,
    solver_1.Difficulty.HARD,
    solver_1.Difficulty.SAMURAI,
];
function gridToString(g) {
    return Array.from(g).join("");
}
async function run() {
    const header = [
        "base_seed",
        "symmetry",
        "difficulty_target",
        "difficulty_generated",
        "clue_count",
        "solution_81",
        "puzzle_81",
    ].join(",") + "\n";
    fs.writeFileSync(OUTPUT_FILE, header, "utf8");
    console.log("Writing CSV to:", OUTPUT_FILE);
    const attemptsHeader = [
        "attempt",
        "base_seed",
        "symmetry",
        "difficulty_target",
        "difficulty_generated",
        "clue_count",
        "accepted",
        "status",
    ].join(",") + "\n";
    fs.writeFileSync(ATTEMPTS_FILE, attemptsHeader, "utf8");
    console.log("Writing attempts to:", ATTEMPTS_FILE);
    const appendPuzzle = (line) => {
        fs.appendFileSync(OUTPUT_FILE, line, "utf8");
    };
    const logAttempt = (line) => {
        fs.appendFileSync(ATTEMPTS_FILE, line, "utf8");
    };
    let produced = 0;
    let attempts = 0;
    while (produced < TARGET_ROWS) {
        const baseSeed = (BASE_SEED + attempts) >>> 0;
        const sym = SYMMETRIES[attempts % SYMMETRIES.length];
        const diff = DIFFICULTIES[Math.floor(attempts / SYMMETRIES.length) % DIFFICULTIES.length];
        attempts++;
        if (attempts % LOG_EVERY === 0) {
            console.log(`attempts=${attempts} produced=${produced}`);
        }
        const startLine = [
            attempts,
            baseSeed.toString(),
            sym,
            diff,
            "",
            "",
            "",
            "start",
        ].join(",") + "\n";
        logAttempt(startLine);
        let res;
        try {
            res = (0, generator_1.generateSudoku)(diff, sym, baseSeed);
        }
        catch (err) {
            console.error(`FAIL seed=${baseSeed.toString(16)} sym=${sym} target=${diff}: ${String(err)}`);
            continue;
        }
        const accepted = res.difficulty === diff;
        const attemptLine = [
            attempts,
            baseSeed.toString(),
            sym,
            diff,
            res.difficulty,
            res.clues.toString(),
            accepted ? "1" : "0",
            "done",
        ].join(",") + "\n";
        logAttempt(attemptLine);
        if (!accepted) {
            if (attempts % LOG_EVERY === 0) {
                console.log(`skip rows=${produced} attempts=${attempts} seed=${baseSeed.toString(16)} sym=${sym} target=${diff} got=${res.difficulty}`);
            }
            continue;
        }
        const line = [
            baseSeed.toString(),
            sym,
            diff,
            res.difficulty,
            res.clues.toString(),
            gridToString(res.solution81),
            gridToString(res.puzzle81),
        ].join(",") + "\n";
        appendPuzzle(line);
        produced++;
        if (produced % LOG_EVERY === 0) {
            console.log(`rows=${produced} attempts=${attempts} seed=${baseSeed.toString(16)} sym=${sym} target=${diff} got=${res.difficulty}`);
        }
    }
    console.log("CSV written:", OUTPUT_FILE);
}
run().catch((err) => {
    console.error(err);
    process.exitCode = 1;
});
