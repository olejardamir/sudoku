"use strict";
/* ========================================================
   SUDOKU GENERATOR — ENGINE (V4.1 SOLVER-SYNC)
   ======================================================== */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Symmetry = void 0;
exports.generateSudoku = generateSudoku;
const solver_1 = require("./solver");
/* ------------------ CONSTANTS ------------------ */
const EMPTY = 0;
const MAX_GEN_ATTEMPTS = 1000;
const THEORETICAL_MIN_CLUES = 17;
const MIN_CLUES_PER_DIFF = {
    [solver_1.Difficulty.EASY]: 32,
    [solver_1.Difficulty.MEDIUM]: 27,
    [solver_1.Difficulty.HARD]: 22,
    [solver_1.Difficulty.SAMURAI]: 17,
};
const PROBE_GATE = {
    [solver_1.Difficulty.EASY]: 45,
    [solver_1.Difficulty.MEDIUM]: 40,
    [solver_1.Difficulty.HARD]: 35,
    [solver_1.Difficulty.SAMURAI]: 30,
};
const PROBE_EVERY = {
    [solver_1.Difficulty.EASY]: 1,
    [solver_1.Difficulty.MEDIUM]: 3,
    [solver_1.Difficulty.HARD]: 2,
    [solver_1.Difficulty.SAMURAI]: 2,
};
const UNIQUE_NODE_LIMIT = 20000;
const DIFF_NODE_LIMIT = 8000;
const ALLOW_HARD_TO_ACCEPT_SAMURAI = true;
const ALLOW_BEST_SO_FAR_FALLBACK = true;
/* ------------------ TYPES ------------------ */
var Symmetry;
(function (Symmetry) {
    Symmetry["NONE"] = "NONE";
    Symmetry["ROT180"] = "ROT180";
    Symmetry["ROT90"] = "ROT90";
    Symmetry["MIRROR_XY"] = "MIRROR_XY";
})(Symmetry || (exports.Symmetry = Symmetry = {}));
/* ------------------ INDEX UTILITIES ------------------ */
const row = (i) => (i / 9) | 0;
const col = (i) => i % 9;
const idx = (r, c) => r * 9 + c;
/* ------------------ DIFFICULTY ------------------ */
function difficultyRank(d) {
    if (d === solver_1.Difficulty.EASY)
        return 0;
    if (d === solver_1.Difficulty.MEDIUM)
        return 1;
    if (d === solver_1.Difficulty.HARD)
        return 2;
    return 3;
}
function acceptsDifficulty(target, diff) {
    if (diff === target)
        return true;
    if (target === solver_1.Difficulty.HARD &&
        diff === solver_1.Difficulty.SAMURAI &&
        ALLOW_HARD_TO_ACCEPT_SAMURAI) {
        return true;
    }
    return false;
}
function scoreToTarget(target, diff, clues) {
    const dist = Math.abs(difficultyRank(diff) - difficultyRank(target)) * 1000;
    const minClues = MIN_CLUES_PER_DIFF[target];
    const penalty = clues < minClues ? minClues - clues : 0;
    return dist + penalty;
}
/* ------------------ SOLVER CONFIG ------------------ */
function configGen(s) {
    s.clearStats();
    s.clearLimits();
    s.enableHeavyRules(true);
    s.enableRandomMRVTieBreak(true);
    s.enableRandomValueChoice(true);
}
function configDeterministic(s) {
    s.clearStats();
    s.clearLimits();
    s.enableHeavyRules(true);
    s.enableRandomMRVTieBreak(false);
    s.enableRandomValueChoice(false);
}
/* ------------------ SYMMETRY ------------------ */
function mapCell(sym, i) {
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
function getSymmetryOrbits(sym) {
    const seen = new Array(81).fill(false);
    const orbits = [];
    for (let i = 0; i < 81; i++) {
        if (seen[i])
            continue;
        const orbit = [];
        let cur = i;
        let steps = 0;
        while (!orbit.includes(cur)) {
            orbit.push(cur);
            seen[cur] = true;
            cur = mapCell(sym, cur);
            if (++steps > 8)
                throw new Error("Orbit did not close");
        }
        orbits.push(orbit);
    }
    return orbits;
}
/* ------------------ SOLVED GRID ------------------ */
function generateSolvedGrid(solver, seed32) {
    const empty = new Uint8Array(81);
    configGen(solver);
    solver.setRandomSeed(seed32);
    solver.loadGrid81(empty);
    const res = solver.countSolutions(1);
    if (res.status !== solver_1.SolveStatus.UNIQUE || !res.solution81) {
        throw new Error("Failed to generate solved grid");
    }
    return res.solution81;
}
/* ------------------ UNIQUENESS ------------------ */
function hasUniqueSolution(solver, grid) {
    configDeterministic(solver);
    solver.loadGrid81(grid);
    solver.setNodeLimit(UNIQUE_NODE_LIMIT);
    const res = solver.countSolutions(2);
    switch (res.status) {
        case solver_1.SolveStatus.UNIQUE:
            return true;
        case solver_1.SolveStatus.MULTIPLE:
        case solver_1.SolveStatus.NO_SOLUTION:
            return false;
        default:
            return false;
    }
}
/* ------------------ DIFFICULTY ------------------ */
function probeDifficulty(solver, grid) {
    configDeterministic(solver);
    solver.loadGrid81(grid);
    solver.setNodeLimit(DIFF_NODE_LIMIT);
    const res = solver.solveStopAtOne();
    if (res.status === solver_1.SolveStatus.UNIQUE && res.difficulty !== null) {
        return res.difficulty;
    }
    if (res.status === solver_1.SolveStatus.NODE_LIMIT || res.status === solver_1.SolveStatus.TIMEOUT) {
        return solver_1.Difficulty.SAMURAI;
    }
    return null;
}
/* ------------------ CARVING ------------------ */
function carvePuzzle(solverUniq, solverDiff, solved, target, symmetry, seed32) {
    const puzzle = new Uint8Array(solved);
    let clueCount = 81;
    const floorClues = Math.max(THEORETICAL_MIN_CLUES, MIN_CLUES_PER_DIFF[target]);
    const orbits = shuffleOrbits(getSymmetryOrbits(symmetry), seed32);
    let best = null;
    let bestScore = Infinity;
    let probeStep = 0;
    let uniqueRejects = 0;
    let probeCount = 0;
    let overshootRejects = 0;
    let nullProbeRejects = 0;
    const sampleLogs = [];
    for (const orbit of orbits) {
        if (clueCount - orbit.length < floorClues)
            continue;
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
            sampleLogs.push(`probe clues=${clueCount} diff=${diff !== null ? solver_1.Difficulty[diff] : "null"}`);
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
        console.log(`  carveSummary target=${solver_1.Difficulty[target]} probes=${probeCount} ` +
            `uniqueRejects=${uniqueRejects} nullProbe=${nullProbeRejects} ` +
            `overshoot=${overshootRejects} samples=[${sampleLogs.join("; ")}]`);
    }
    return best;
}
/* ------------------ HASH ------------------ */
function hash32(base, attempt) {
    let x = (base ^ (attempt * 0x9e3779b9)) >>> 0;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return x >>> 0;
}
function shuffleOrbits(orbits, seed32) {
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
function generateSudoku(target, symmetry, baseSeed32) {
    console.log(`generateSudoku: target=${solver_1.Difficulty[target]} symmetry=${symmetry} baseSeed=${baseSeed32}`);
    const masks = (0, solver_1.generateMasks)();
    const solverGen = new solver_1.SudokuSolver(masks);
    const solverUniq = new solver_1.SudokuSolver(masks);
    const solverDiff = new solver_1.SudokuSolver(masks);
    let best = null;
    let bestScore = Infinity;
    for (let attempt = 1; attempt <= MAX_GEN_ATTEMPTS; attempt++) {
        const seed32 = hash32(baseSeed32, attempt);
        const solved = generateSolvedGrid(solverGen, seed32);
        const carved = carvePuzzle(solverUniq, solverDiff, solved, target, symmetry, seed32);
        if (!carved) {
            console.log(`  attempt=${attempt} seed32=${seed32} -> carved=null`);
        }
        else {
            console.log(`  attempt=${attempt} seed32=${seed32} -> diff=${solver_1.Difficulty[carved.difficulty]} clues=${carved.clues}`);
        }
        if (!carved)
            continue;
        const finalDiff = probeDifficulty(solverDiff, carved.puzzle81);
        if (finalDiff === null)
            continue;
        const score = scoreToTarget(target, finalDiff, carved.clues);
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
            return best;
        }
    }
    if (ALLOW_BEST_SO_FAR_FALLBACK && best)
        return best;
    throw new Error("Generation failed");
}
