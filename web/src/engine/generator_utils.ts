/* ------------------ SYMMETRY + HELPERS ------------------ */

import { SudokuSolver, SolveStatus } from "./solver";

export const Symmetry = {
  NONE: "NONE",
  ROT180: "ROT180",
  ROT90: "ROT90",
  MIRROR_XY: "MIRROR_XY",
} as const;

export type Symmetry = (typeof Symmetry)[keyof typeof Symmetry];

const row = (i: number) => (i / 9) | 0;
const col = (i: number) => i % 9;
const idx = (r: number, c: number) => r * 9 + c;

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

function buildOrbit(
  sym: Symmetry,
  start: number,
  seen: boolean[]
): number[] {
  const orbit: number[] = [];
  let cur = start;
  let steps = 0;
  do {
    orbit.push(cur);
    seen[cur] = true;
    cur = mapCell(sym, cur);
    if (++steps > 8) throw new Error("Orbit did not close");
  } while (cur !== start);
  return orbit;
}

export function getSymmetryOrbits(sym: Symmetry): number[][] {
  const seen = new Array(81).fill(false);
  const orbits: number[][] = [];

  for (let i = 0; i < 81; i++) {
    if (seen[i]) continue;
    orbits.push(buildOrbit(sym, i, seen));
  }
  return orbits;
}

export function generateSolvedGrid(
  solver: SudokuSolver,
  seed32: number,
  configure: (solver: SudokuSolver) => void
): Uint8Array {
  const empty = new Uint8Array(81);
  configure(solver);
  solver.setRandomSeed(seed32);

  solver.loadGrid81(empty);
  const res = solver.countSolutions(1);

  if (res.status !== SolveStatus.UNIQUE || !res.solution81) {
    throw new Error("Failed to generate solved grid");
  }
  return res.solution81;
}

export function hash32(base: number, attempt: number): number {
  let x = (base ^ (attempt * 0x9e3779b9)) >>> 0;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  return x >>> 0;
}

export function shuffleOrbits(orbits: number[][], seed32: number): number[][] {
  const out = orbits.slice();
  let state = seed32 >>> 0;
  const swap = (a: number, b: number) => {
    const tmp = out[a];
    out[a] = out[b];
    out[b] = tmp;
  };
  for (let i = out.length; i > 1; i--) {
    state = hash32(state, i);
    const j = state % i;
    swap(i - 1, j);
  }
  return out;
}
