/* ================================================================
   SUDOKU SOLVER ENGINE (9×9) — COMPLETE TYPESCRIPT IMPLEMENTATION
   Matches your FINAL TS-translatable pseudocode (generator-fit API)
   - Trail-based undo (no grid snapshots)
   - DIGIT_PLANE maintained
   - DIRTY cell + DIRTY_UNIT scheduling
   - Hidden singles + Locked candidates + (Heavy) Hidden pairs
   - Deterministic PRNG (xorshift32)
   - nodeLimit + timeoutMs (TIMEOUT / NODE_LIMIT)
   - stopAtSolutions in DFS (solveStopAtOne / solveStopAtTwo / countSolutions)
   ================================================================ */


/* -----------------------------
   CONSTANTS / TYPES
----------------------------- */
export const CELLS = 81;
export const WORDS = 3;
export const UNITS = 27;
export const DIGITS = 9;

const MAX_DEPTH = 81;
const MAX_TRAIL = 200000;

const DEFAULT_HEAVY_AT_ROOT_ONLY = false;
const DEFAULT_HEAVY_DEPTH_LIMIT = 1;
const DEFAULT_HEAVY_DIRTY_UNITS_ONLY = true;

// 81 bits across 3 words; last word has only 17 valid bits (cells 64..80)
const ALL_WORD_MASK0 = 0xFFFFFFFF >>> 0;
const ALL_WORD_MASK1 = 0xFFFFFFFF >>> 0;
const ALL_WORD_MASK2 = 0x0001FFFF >>> 0;

const ALL_UNITS_DIRTY = 0x07FFFFFF >>> 0; // 27 ones

export enum SolveStatus {
  NO_SOLUTION,
  UNIQUE,
  MULTIPLE,
  NODE_LIMIT,
  TIMEOUT
}

export enum Difficulty {
  EASY,
  MEDIUM,
  HARD,
  SAMURAI
}

export type SolveStats = {
  conflicts: number;
  guessCount: number;
  maxDepth: number;
  nodes: number;
  hiddenSingles: number;
  lockedCandidateElims: number;
  hiddenPairElims: number;
  elapsedMs: number;
};

export type SolveResult = {
  status: SolveStatus;
  solutionCount: number; // up to stopAt
  solution81: Uint8Array | null; // first solution only (digits 1..9)
  difficulty: Difficulty | null;
  stats: SolveStats;
};

type U32 = number;

/* -----------------------------
   UNSIGNED + BIT HELPERS
----------------------------- */
const u32 = (x: number): U32 => (x >>> 0);
const u32not = (x: number): U32 => ((~x) >>> 0);

const lowbit32 = (x: number): U32 => u32(x & -x);

const bitIndexLow = (singleBit: number): number => {
  singleBit = u32(singleBit);
  if (singleBit === 0) return -1;
  return 31 - Math.clz32(singleBit);
};

const isSingle32 = (x: number): boolean => {
  x = u32(x);
  return x !== 0 && u32(x & (x - 1)) === 0;
};

const popcount32 = (x: number): number => {
  x = u32(x);
  let c = 0;
  while (x !== 0) {
    x = u32(x & (x - 1));
    c++;
  }
  return c;
};

// 9-bit popcount LUT
const POPCOUNT_9BIT = new Uint8Array(512);
for (let m = 0; m < 512; m++) {
  let x = m;
  let c = 0;
  while (x !== 0) {
    x = x & (x - 1);
    c++;
  }
  POPCOUNT_9BIT[m] = c;
}
const popcount9 = (mask9: number): number => POPCOUNT_9BIT[mask9 & 0x1FF];

/* -----------------------------
   CELL BIT HELPERS
----------------------------- */
const cellWord = (cell: number): number => (cell >>> 5); // 0..2
const cellBit = (cell: number): U32 => ((1 << (cell & 31)) >>> 0);

/* -----------------------------
   DETERMINISTIC PRNG (xorshift32)
----------------------------- */
const xorshift32 = (state: U32): U32 => {
  let x = state;
  x = u32(x ^ (x << 13));
  x = u32(x ^ (x >>> 17));
  x = u32(x ^ (x << 5));
  return x;
};

/* -----------------------------
   STATIC PRECOMPUTATION
----------------------------- */
export type Masks = {
  UNIT_MASK: Uint32Array;      // UNITS*3
  PEER_MASK: Uint32Array;      // CELLS*3
  CELL_TO_UNITS: Uint8Array;   // CELLS*3 (row, col, box)
};

export function generateMasks(): Masks {
  const UNIT_MASK = new Uint32Array(UNITS * WORDS);
  const PEER_MASK = new Uint32Array(CELLS * WORDS);
  const CELL_TO_UNITS = new Uint8Array(CELLS * 3);

  const setBitArr = (arr: Uint32Array, base: number, cell: number) => {
    const w = cellWord(cell);
    const b = cellBit(cell);
    arr[base + w] = u32(arr[base + w] | b);
  };

  // rows (u=0..8)
  for (let r = 0; r < 9; r++) {
    const base = r * 3;
    for (let c = 0; c < 9; c++) setBitArr(UNIT_MASK, base, r * 9 + c);
  }

  // cols (u=9..17)
  for (let c = 0; c < 9; c++) {
    const u = 9 + c;
    const base = u * 3;
    for (let r = 0; r < 9; r++) setBitArr(UNIT_MASK, base, r * 9 + c);
  }

  // boxes (u=18..26)
  for (let br = 0; br < 3; br++) {
    for (let bc = 0; bc < 3; bc++) {
      const box = br * 3 + bc;
      const u = 18 + box;
      const base = u * 3;
      const r0 = br * 3;
      const c0 = bc * 3;
      for (let dr = 0; dr < 3; dr++) {
        for (let dc = 0; dc < 3; dc++) {
          setBitArr(UNIT_MASK, base, (r0 + dr) * 9 + (c0 + dc));
        }
      }
    }
  }

  // CELL_TO_UNITS
  for (let cell = 0; cell < 81; cell++) {
    const r = (cell / 9) | 0;
    const c = cell % 9;
    const b = (((r / 3) | 0) * 3) + ((c / 3) | 0);
    CELL_TO_UNITS[cell * 3 + 0] = r;
    CELL_TO_UNITS[cell * 3 + 1] = 9 + c;
    CELL_TO_UNITS[cell * 3 + 2] = 18 + b;
  }

  // PEER_MASK
  for (let cell = 0; cell < 81; cell++) {
    const r = (cell / 9) | 0;
    const c = cell % 9;
    const b = (((r / 3) | 0) * 3) + ((c / 3) | 0);

    const base = cell * 3;

    // row peers
    for (let c2 = 0; c2 < 9; c2++) {
      if (c2 === c) continue;
      setBitArr(PEER_MASK, base, r * 9 + c2);
    }

    // col peers
    for (let r2 = 0; r2 < 9; r2++) {
      if (r2 === r) continue;
      setBitArr(PEER_MASK, base, r2 * 9 + c);
    }

    // box peers
    const br = ((b / 3) | 0);
    const bc = (b % 3);
    const r0 = br * 3;
    const c0 = bc * 3;
    for (let dr = 0; dr < 3; dr++) {
      for (let dc = 0; dc < 3; dc++) {
        const p = (r0 + dr) * 9 + (c0 + dc);
        if (p === cell) continue;
        setBitArr(PEER_MASK, base, p);
      }
    }
  }

  return { UNIT_MASK, PEER_MASK, CELL_TO_UNITS };
}

/* ================================================================
   SOLVER CLASS
   ================================================================ */
export class SudokuSolver {
  // ---- static masks ----
  private readonly UNIT_MASK: Uint32Array;
  private readonly PEER_MASK: Uint32Array;
  private readonly CELL_TO_UNITS: Uint8Array;

  // ---- core state ----
  private readonly CELL_MASK: Uint16Array;   // 9-bit domain per cell
  private readonly DIGIT_PLANE: Uint32Array; // 9*3: cells where digit allowed

  private readonly DIRTY: Uint32Array;       // 3 words
  private readonly DIRTY_UNIT: Uint32Array;  // length 1 (27-bit)

  private assignedCount: number;
  private propChanged: boolean;

  // ---- activity heuristic ----
  private readonly ACTIVITY: Float64Array;
  private ACTIVITY_INC: number;
  private readonly ACTIVITY_DECAY = 0.95;
  private readonly RESCALE_THRESHOLD = 1e150;
  private readonly RESCALE_FACTOR = 1e-100;

  // ---- trail ----
  private readonly trailCell: Int16Array;
  private readonly trailMask: Uint16Array;
  private trailPtr: number;

  // ---- decision stack ----
  private readonly decCell: Int16Array;
  private readonly decDomain: Uint16Array;
  private readonly decMark: Int32Array;
  private decPtr: number;

  // ---- solution capture ----
  private readonly SOLUTION: Uint8Array; // digits 0..8
  private solutionCount: number;

  // ---- stats ----
  private conflicts: number;
  private maxDepth: number;
  private guessCount: number;
  private nodes: number;
  private initialGivens: number;
  private hiddenSingles: number;
  private lockedCandidateElims: number;
  private hiddenPairElims: number;

  // ---- deterministic random ----
  private rngState: U32;

  // ---- limits ----
  private nodeLimit: number;   // 0 => no limit
  private timeoutMs: number;   // 0 => no timeout
  private startTimeMs: number;

  // ---- behavior toggles ----
  private heavyEnabled: boolean;
  private heavyAtRootOnly: boolean;
  private heavyDepthLimit: number;
  private heavyDirtyUnitsOnly: boolean;

  private randomMRVTieBreak: boolean;
  private randomValueChoice: boolean;

  private selectSeed: number;

  // ---- hidden pairs scratch ----
  private readonly hpCand0: Uint32Array;
  private readonly hpCand1: Uint32Array;
  private readonly hpCand2: Uint32Array;
  private readonly hpCnt: Uint8Array;

  // ---- early status from limits ----
  private earlyStatus: SolveStatus | null;

  constructor(masks: Masks) {
    this.UNIT_MASK = masks.UNIT_MASK;
    this.PEER_MASK = masks.PEER_MASK;
    this.CELL_TO_UNITS = masks.CELL_TO_UNITS;

    this.CELL_MASK = new Uint16Array(81);
    this.DIGIT_PLANE = new Uint32Array(9 * 3);

    this.DIRTY = new Uint32Array(3);
    this.DIRTY_UNIT = new Uint32Array(1);

    this.ACTIVITY = new Float64Array(81);
    this.ACTIVITY_INC = 1.0;

    this.trailCell = new Int16Array(MAX_TRAIL);
    this.trailMask = new Uint16Array(MAX_TRAIL);
    this.trailPtr = 0;

    this.decCell = new Int16Array(MAX_DEPTH);
    this.decDomain = new Uint16Array(MAX_DEPTH);
    this.decMark = new Int32Array(MAX_DEPTH);
    this.decPtr = 0;

    this.SOLUTION = new Uint8Array(81);
    this.solutionCount = 0;

    this.conflicts = 0;
    this.maxDepth = 0;
    this.guessCount = 0;
    this.nodes = 0;
    this.initialGivens = 0;
    this.hiddenSingles = 0;
    this.lockedCandidateElims = 0;
    this.hiddenPairElims = 0;

    this.rngState = u32(0x9E3779B9);
    this.nodeLimit = 0;
    this.timeoutMs = 0;
    this.startTimeMs = 0;

    this.heavyEnabled = true;
    this.heavyAtRootOnly = DEFAULT_HEAVY_AT_ROOT_ONLY;
    this.heavyDepthLimit = DEFAULT_HEAVY_DEPTH_LIMIT;
    this.heavyDirtyUnitsOnly = DEFAULT_HEAVY_DIRTY_UNITS_ONLY;

    this.randomMRVTieBreak = false;
    this.randomValueChoice = false;

    this.selectSeed = 0;
    this.assignedCount = 0;
    this.propChanged = false;

    this.hpCand0 = new Uint32Array(9);
    this.hpCand1 = new Uint32Array(9);
    this.hpCand2 = new Uint32Array(9);
    this.hpCnt = new Uint8Array(9);

    this.earlyStatus = null;
  }

  /* ============================================================
     PUBLIC CONFIG API (generator-fit)
     ============================================================ */
  public clearStats(): void {
    this.conflicts = 0;
    this.maxDepth = 0;
    this.guessCount = 0;
    this.nodes = 0;
    this.solutionCount = 0;
    this.initialGivens = 0;
    this.hiddenSingles = 0;
    this.lockedCandidateElims = 0;
    this.hiddenPairElims = 0;
  }

  public clearLimits(): void {
    this.nodeLimit = 0;
    this.timeoutMs = 0;
  }

  public setNodeLimit(limit: number): void {
    this.nodeLimit = limit > 0 ? (limit | 0) : 0;
  }

  public setTimeoutMs(ms: number): void {
    this.timeoutMs = ms > 0 ? (ms | 0) : 0;
  }

  public setRandomSeed(seed: number): void {
    const s = u32(seed);
    this.rngState = (s !== 0) ? s : u32(0xA5A5A5A5);
  }

  public enableRandomMRVTieBreak(on: boolean): void {
    this.randomMRVTieBreak = !!on;
  }

  public enableRandomValueChoice(on: boolean): void {
    this.randomValueChoice = !!on;
  }

  public enableHeavyRules(on: boolean): void {
    this.heavyEnabled = !!on;
  }

  public setHeavySchedule(atRootOnly: boolean, depthLimit: number, dirtyUnitsOnly: boolean): void {
    this.heavyAtRootOnly = !!atRootOnly;
    this.heavyDepthLimit = (depthLimit | 0);
    this.heavyDirtyUnitsOnly = !!dirtyUnitsOnly;
  }

  /* ============================================================
     PRNG
     ============================================================ */
  private rngNextU32(): U32 {
    this.rngState = xorshift32(this.rngState);
    return this.rngState;
  }

  private rngNextInt(n: number): number {
    if (n <= 1) return 0;
    return (this.rngNextU32() % (n >>> 0)) | 0;
  }

  /* ============================================================
     LIMITS
     ============================================================ */
  private nowMs(): number {
    return performance.now();
  }

  private limitHit(): SolveStatus | null {
    if (this.timeoutMs > 0 && (this.nowMs() - this.startTimeMs) >= this.timeoutMs) {
      return SolveStatus.TIMEOUT;
    }
    if (this.nodeLimit > 0 && this.nodes >= this.nodeLimit) {
      return SolveStatus.NODE_LIMIT;
    }
    return null;
  }

  /* ============================================================
     DIRTY CELLS
     ============================================================ */
  private markDirtyCell(cell: number): void {
    const w = cellWord(cell);
    this.DIRTY[w] = u32(this.DIRTY[w] | cellBit(cell));
  }

  private popDirtyCell(): number {
    for (let w = 0; w < 3; w++) {
      const m = u32(this.DIRTY[w]);
      if (m !== 0) {
        const b = lowbit32(m);
        this.DIRTY[w] = u32(this.DIRTY[w] & u32not(b));
        return (w << 5) + bitIndexLow(b);
      }
    }
    return -1;
  }

  /* ============================================================
     DIRTY UNITS
     ============================================================ */
  private markDirtyUnitsForCell(cell: number): void {
    const u0 = this.CELL_TO_UNITS[cell * 3 + 0];
    const u1 = this.CELL_TO_UNITS[cell * 3 + 1];
    const u2 = this.CELL_TO_UNITS[cell * 3 + 2];
    const mask = u32((1 << u0) | (1 << u1) | (1 << u2));
    this.DIRTY_UNIT[0] = u32(this.DIRTY_UNIT[0] | mask);
  }

  private takeDirtyUnits(): U32 {
    const m = u32(this.DIRTY_UNIT[0]);
    this.DIRTY_UNIT[0] = 0;
    return m;
  }

  private unitIsInMask(unitMask: U32, u: number): boolean {
    return (((unitMask >>> u) & 1) !== 0);
  }

  /* ============================================================
     TRAIL
     ============================================================ */
  private trailMark(): number {
    return this.trailPtr;
  }

  private pushTrail(cell: number, oldMask: number): boolean {
    if (this.trailPtr >= MAX_TRAIL) return false;
    this.trailCell[this.trailPtr] = cell;
    this.trailMask[this.trailPtr] = oldMask;
    this.trailPtr++;
    return true;
  }

  private adjustAssignedCount(oldMask: number, newMask: number): void {
    const oldSingle = isSingle32(oldMask);
    const newSingle = isSingle32(newMask);
    if (oldSingle && !newSingle) this.assignedCount--;
    else if (!oldSingle && newSingle) this.assignedCount++;
  }

  private restoreCellPlanesFromMask(cell: number, mask9: number): void {
    const w = cellWord(cell);
    const bitC = cellBit(cell);

    // clear this cell from all digit planes
    for (let d = 0; d < 9; d++) {
      const idx = ((d * 3 + w) | 0);
      this.DIGIT_PLANE[idx] = u32(this.DIGIT_PLANE[idx] & u32not(bitC));
    }

    // re-add digits allowed by mask9
    let mm = u32(mask9);
    while (mm !== 0) {
      const b = lowbit32(mm);
      mm = u32(mm & (mm - 1));
      const d = bitIndexLow(b); // 0..8
      const idx = ((d * 3 + w) | 0);
      this.DIGIT_PLANE[idx] = u32(this.DIGIT_PLANE[idx] | bitC);
    }
  }

  private undoTo(mark: number): void {
    while (this.trailPtr > mark) {
      this.trailPtr--;
      const cell = this.trailCell[this.trailPtr];
      const oldMask = this.trailMask[this.trailPtr];

      const curMask = this.CELL_MASK[cell];
      this.adjustAssignedCount(curMask, oldMask);

      this.CELL_MASK[cell] = oldMask;
      this.restoreCellPlanesFromMask(cell, oldMask);

      this.markDirtyCell(cell);
      this.markDirtyUnitsForCell(cell);
    }
  }

  /* ============================================================
     ACTIVITY (bounded)
     ============================================================ */
  private maybeRescaleActivities(): void {
    if (this.ACTIVITY_INC < this.RESCALE_THRESHOLD) return;
    for (let c = 0; c < 81; c++) this.ACTIVITY[c] = this.ACTIVITY[c] * this.RESCALE_FACTOR;
    this.ACTIVITY_INC = this.ACTIVITY_INC * this.RESCALE_FACTOR;
  }

  private bumpActivity(cell: number): void {
    this.ACTIVITY[cell] = this.ACTIVITY[cell] + this.ACTIVITY_INC;
    if (this.ACTIVITY[cell] >= this.RESCALE_THRESHOLD) this.maybeRescaleActivities();
  }

  private decayActivities(): void {
    this.ACTIVITY_INC = this.ACTIVITY_INC / this.ACTIVITY_DECAY;
    this.maybeRescaleActivities();
  }

  /* ============================================================
     RESET / LOAD
     ============================================================ */
  private resetBase(): void {
    this.trailPtr = 0;
    this.decPtr = 0;
    this.solutionCount = 0;

    this.DIRTY.fill(0);
    this.DIRTY_UNIT[0] = 0;

    this.ACTIVITY_INC = 1.0;
    this.selectSeed = 0;

    this.CELL_MASK.fill(0x1FF);
    this.ACTIVITY.fill(0.0);

    this.assignedCount = 0;
    this.propChanged = false;

    // initialize digit planes to “all cells allowed”
    for (let d = 0; d < 9; d++) {
      this.DIGIT_PLANE[(d * 3 + 0) | 0] = u32(ALL_WORD_MASK0);
      this.DIGIT_PLANE[(d * 3 + 1) | 0] = u32(ALL_WORD_MASK1);
      this.DIGIT_PLANE[(d * 3 + 2) | 0] = u32(ALL_WORD_MASK2);
    }

    // run unit-based logic at root once
    this.DIRTY_UNIT[0] = u32(ALL_UNITS_DIRTY);
  }

  public resetFromGivens(givens: Array<[number, number]>): boolean {
    this.resetBase();
    this.initialGivens = givens.length | 0;
    for (const [cell, value] of givens) {
      if (value < 1 || value > 9) return false;
      if (!this.assign(cell | 0, (value - 1) | 0)) return false;
    }
    return true;
  }

  public loadGrid81(grid81: Uint8Array): boolean {
    this.resetBase();
    let givens = 0;
    for (let c = 0; c < 81; c++) {
      const v = grid81[c];
      if (v === 0) continue;
      givens++;
      if (v < 1 || v > 9) return false;
      if (!this.assign(c, (v - 1) | 0)) return false;
    }
    this.initialGivens = givens;
    return true;
  }

  /* ============================================================
     DOMAIN UPDATES
     ============================================================ */
  private remove(cell: number, digit: number): boolean {
    const bitD = u32(1 << digit);
    const old = this.CELL_MASK[cell];
    if ((old & bitD) === 0) return true;

    const newMask = u32(old & u32not(bitD));
    if (newMask === 0) return false;

    if (!this.pushTrail(cell, old)) return false;
    this.adjustAssignedCount(old, newMask);

    this.CELL_MASK[cell] = newMask;
    this.propChanged = true;

    const w = cellWord(cell);
    const bitC = cellBit(cell);
    const idx = ((digit * 3 + w) | 0);
    this.DIGIT_PLANE[idx] = u32(this.DIGIT_PLANE[idx] & u32not(bitC));

    this.markDirtyCell(cell);
    this.markDirtyUnitsForCell(cell);
    return true;
  }

  private assign(cell: number, digit: number): boolean {
    const bitD = u32(1 << digit);
    const old = this.CELL_MASK[cell];
    if ((old & bitD) === 0) return false;
    if (old === bitD) return true;

    if (!this.pushTrail(cell, old)) return false;
    this.adjustAssignedCount(old, bitD);

    this.CELL_MASK[cell] = bitD;
    this.propChanged = true;

    const w = cellWord(cell);
    const bitC = cellBit(cell);

    // clear from all digits, then set assigned digit
    for (let d = 0; d < 9; d++) {
      const idx = ((d * 3 + w) | 0);
      this.DIGIT_PLANE[idx] = u32(this.DIGIT_PLANE[idx] & u32not(bitC));
    }
    this.DIGIT_PLANE[(digit * 3 + w) | 0] = u32(this.DIGIT_PLANE[(digit * 3 + w) | 0] | bitC);

    this.markDirtyCell(cell);
    this.markDirtyUnitsForCell(cell);

    // eliminate digit from peers
    const basePeer = cell * 3;
    for (let ww = 0; ww < 3; ww++) {
      let peers = u32(this.PEER_MASK[basePeer + ww]);
      while (peers !== 0) {
        const b = lowbit32(peers);
        peers = u32(peers & (peers - 1));
        const p = (ww << 5) + bitIndexLow(b);
        if (!this.remove(p, digit)) return false;
      }
    }

    return true;
  }

  private restrictTo(cell: number, keepMask9: number): boolean {
    const old = this.CELL_MASK[cell];
    const newMask = u32(old & keepMask9);
    if (newMask === 0) return false;
    if (newMask === old) return true;

    if (!this.pushTrail(cell, old)) return false;
    this.adjustAssignedCount(old, newMask);

    this.CELL_MASK[cell] = newMask;
    this.propChanged = true;

    const w = cellWord(cell);
    const bitC = cellBit(cell);

    let removed = u32(old & u32not(newMask));
    let removedCount = 0;
    while (removed !== 0) {
      const b = lowbit32(removed);
      removed = u32(removed & (removed - 1));
      const d = bitIndexLow(b);
      removedCount++;
      const idx = ((d * 3 + w) | 0);
      this.DIGIT_PLANE[idx] = u32(this.DIGIT_PLANE[idx] & u32not(bitC));
    }
    this.hiddenPairElims += removedCount;

    this.markDirtyCell(cell);
    this.markDirtyUnitsForCell(cell);
    return true;
  }

  /* ============================================================
     CHEAP RULE: LOCKED CANDIDATES (Pointing/Claiming)
     ============================================================ */
  private applyLockedCandidates(unitMaskBits: U32): boolean {
    for (let boxU = 18; boxU <= 26; boxU++) {
      if (!this.unitIsInMask(unitMaskBits, boxU)) continue;

      const baseBox = boxU * 3;
      const box = boxU - 18;
      const br = ((box / 3) | 0);
      const bc = (box % 3);

      const rowU0 = br * 3 + 0;
      const rowU1 = br * 3 + 1;
      const rowU2 = br * 3 + 2;

      const colU0 = 9 + (bc * 3 + 0);
      const colU1 = 9 + (bc * 3 + 1);
      const colU2 = 9 + (bc * 3 + 2);

      for (let d = 0; d < 9; d++) {
        const b0 = u32(this.DIGIT_PLANE[(d * 3 + 0) | 0] & this.UNIT_MASK[baseBox + 0]);
        const b1 = u32(this.DIGIT_PLANE[(d * 3 + 1) | 0] & this.UNIT_MASK[baseBox + 1]);
        const b2 = u32(this.DIGIT_PLANE[(d * 3 + 2) | 0] & this.UNIT_MASK[baseBox + 2]);

        if ((b0 | b1 | b2) === 0) return false;

        // pointing rows
        const rowUs = [rowU0, rowU1, rowU2];
        for (let i = 0; i < 3; i++) {
          const rU = rowUs[i];
          const baseRow = rU * 3;

          const outsideRow0 = u32(b0 & u32not(this.UNIT_MASK[baseRow + 0]));
          const outsideRow1 = u32(b1 & u32not(this.UNIT_MASK[baseRow + 1]));
          const outsideRow2 = u32(b2 & u32not(this.UNIT_MASK[baseRow + 2]));

          // all candidates in this box lie within this row => remove from row outside the box
          if (outsideRow0 === 0 && outsideRow1 === 0 && outsideRow2 === 0) {
            let out0 = u32(this.UNIT_MASK[baseRow + 0] & u32not(this.UNIT_MASK[baseBox + 0])) & ALL_WORD_MASK0;
            let out1 = u32(this.UNIT_MASK[baseRow + 1] & u32not(this.UNIT_MASK[baseBox + 1])) & ALL_WORD_MASK1;
            let out2 = u32(this.UNIT_MASK[baseRow + 2] & u32not(this.UNIT_MASK[baseBox + 2])) & ALL_WORD_MASK2;

            out0 = u32(out0 & this.DIGIT_PLANE[(d * 3 + 0) | 0]);
            out1 = u32(out1 & this.DIGIT_PLANE[(d * 3 + 1) | 0]);
            out2 = u32(out2 & this.DIGIT_PLANE[(d * 3 + 2) | 0]);

            for (let ww = 0; ww < 3; ww++) {
              let mm = ww === 0 ? out0 : (ww === 1 ? out1 : out2);
              while (mm !== 0) {
                const bb = lowbit32(mm);
                mm = u32(mm & (mm - 1));
                const cell = (ww << 5) + bitIndexLow(bb);
                const bitD = u32(1 << d);
                if ((this.CELL_MASK[cell] & bitD) !== 0) {
                  if (!this.remove(cell, d)) return false;
                  this.lockedCandidateElims++;
                }
              }
            }
          }
        }

        // pointing cols
        const colUs = [colU0, colU1, colU2];
        for (let i = 0; i < 3; i++) {
          const cU = colUs[i];
          const baseCol = cU * 3;

          const outsideCol0 = u32(b0 & u32not(this.UNIT_MASK[baseCol + 0]));
          const outsideCol1 = u32(b1 & u32not(this.UNIT_MASK[baseCol + 1]));
          const outsideCol2 = u32(b2 & u32not(this.UNIT_MASK[baseCol + 2]));

          if (outsideCol0 === 0 && outsideCol1 === 0 && outsideCol2 === 0) {
            let out0 = u32(this.UNIT_MASK[baseCol + 0] & u32not(this.UNIT_MASK[baseBox + 0])) & ALL_WORD_MASK0;
            let out1 = u32(this.UNIT_MASK[baseCol + 1] & u32not(this.UNIT_MASK[baseBox + 1])) & ALL_WORD_MASK1;
            let out2 = u32(this.UNIT_MASK[baseCol + 2] & u32not(this.UNIT_MASK[baseBox + 2])) & ALL_WORD_MASK2;

            out0 = u32(out0 & this.DIGIT_PLANE[(d * 3 + 0) | 0]);
            out1 = u32(out1 & this.DIGIT_PLANE[(d * 3 + 1) | 0]);
            out2 = u32(out2 & this.DIGIT_PLANE[(d * 3 + 2) | 0]);

            for (let ww = 0; ww < 3; ww++) {
              let mm = ww === 0 ? out0 : (ww === 1 ? out1 : out2);
              while (mm !== 0) {
                const bb = lowbit32(mm);
                mm = u32(mm & (mm - 1));
                const cell = (ww << 5) + bitIndexLow(bb);
                const bitD = u32(1 << d);
                if ((this.CELL_MASK[cell] & bitD) !== 0) {
                  if (!this.remove(cell, d)) return false;
                  this.lockedCandidateElims++;
                }
              }
            }
          }
        }
      }
    }

    return true;
  }

  /* ============================================================
     HEAVY RULE: HIDDEN PAIRS
     ============================================================ */
  private applyHiddenPairs(unitMaskBits: U32): boolean {
    for (let u = 0; u < 27; u++) {
      if (this.heavyDirtyUnitsOnly && !this.unitIsInMask(unitMaskBits, u)) continue;

      const baseU = u * 3;

      for (let d = 0; d < 9; d++) {
        this.hpCand0[d] = u32(this.DIGIT_PLANE[(d * 3 + 0) | 0] & this.UNIT_MASK[baseU + 0]);
        this.hpCand1[d] = u32(this.DIGIT_PLANE[(d * 3 + 1) | 0] & this.UNIT_MASK[baseU + 1]);
        this.hpCand2[d] = u32(this.DIGIT_PLANE[(d * 3 + 2) | 0] & this.UNIT_MASK[baseU + 2]);
        this.hpCnt[d] = (popcount32(this.hpCand0[d]) + popcount32(this.hpCand1[d]) + popcount32(this.hpCand2[d])) as any;
      }

      for (let d1 = 0; d1 < 9; d1++) {
        if (this.hpCnt[d1] !== 2) continue;
        for (let d2 = d1 + 1; d2 < 9; d2++) {
          if (this.hpCnt[d2] !== 2) continue;
          if (this.hpCand0[d1] !== this.hpCand0[d2]) continue;
          if (this.hpCand1[d1] !== this.hpCand1[d2]) continue;
          if (this.hpCand2[d1] !== this.hpCand2[d2]) continue;

          const keepMask9 = u32((1 << d1) | (1 << d2));

          for (let ww = 0; ww < 3; ww++) {
            let mm = ww === 0 ? this.hpCand0[d1] : (ww === 1 ? this.hpCand1[d1] : this.hpCand2[d1]);
            while (mm !== 0) {
              const bb = lowbit32(mm);
              mm = u32(mm & (mm - 1));
              const cell = (ww << 5) + bitIndexLow(bb);
              if (!this.restrictTo(cell, keepMask9)) return false;
            }
          }
        }
      }
    }

    return true;
  }

  /* ============================================================
     PROPAGATION (fixpoint)
     ============================================================ */
  private propagate(heavy: boolean): boolean {
    do {
      this.propChanged = false;

      this.earlyStatus = this.limitHit();
      if (this.earlyStatus !== null) return true; // not contradiction

      // (A) cell-dirty: naked singles -> peer eliminations
      while (true) {
        const c = this.popDirtyCell();
        if (c === -1) break;

        this.earlyStatus = this.limitHit();
        if (this.earlyStatus !== null) return true;

        const m = this.CELL_MASK[c];
        if (m === 0) return false;

        if (isSingle32(m)) {
          const d = bitIndexLow(m);
          const basePeer = c * 3;

          for (let ww = 0; ww < 3; ww++) {
            let mask = u32(this.DIGIT_PLANE[(d * 3 + ww) | 0] & this.PEER_MASK[basePeer + ww]);
            while (mask !== 0) {
              const bb = lowbit32(mask);
              mask = u32(mask & (mask - 1));
              const p = (ww << 5) + bitIndexLow(bb);
              if (!this.remove(p, d)) return false;
            }
          }
        }
      }

      // (B) unit-dirty snapshot
      const unitsToCheck = this.takeDirtyUnits();

      // hidden singles (dirty units only)
      for (let u = 0; u < 27; u++) {
        if (!this.unitIsInMask(unitsToCheck, u)) continue;

        this.earlyStatus = this.limitHit();
        if (this.earlyStatus !== null) return true;

        const baseU = u * 3;

        for (let d = 0; d < 9; d++) {
          const m0 = u32(this.DIGIT_PLANE[(d * 3 + 0) | 0] & this.UNIT_MASK[baseU + 0]);
          const m1 = u32(this.DIGIT_PLANE[(d * 3 + 1) | 0] & this.UNIT_MASK[baseU + 1]);
          const m2 = u32(this.DIGIT_PLANE[(d * 3 + 2) | 0] & this.UNIT_MASK[baseU + 2]);

          const total = popcount32(m0) + popcount32(m1) + popcount32(m2);
          if (total === 0) return false;

          if (total === 1) {
            let cell = -1;
            if (m0 !== 0) cell = bitIndexLow(lowbit32(m0));
            else if (m1 !== 0) cell = 32 + bitIndexLow(lowbit32(m1));
            else cell = 64 + bitIndexLow(lowbit32(m2));
            this.hiddenSingles++;
            if (!this.assign(cell, d)) return false;
          }
        }
      }

      // locked candidates
      if (!this.applyLockedCandidates(unitsToCheck)) return false;

      // heavy rules scheduled
      if (heavy && this.heavyEnabled) {
        if (!this.applyHiddenPairs(unitsToCheck)) return false;
      }

    } while (this.propChanged);

    return true;
  }

  /* ============================================================
     SELECT CELL (MRV + activity OR MRV + deterministic random tie-break)
     ============================================================ */
  private selectCell(): number {
    let best = -1;
    let bestCandidates = 999;
    let bestActivity = -Infinity;

    const start = this.selectSeed;

    for (let k = 0; k < 81; k++) {
      const c = (start + k) % 81;
      const m = this.CELL_MASK[c];
      if (m === 0) continue;
      if (isSingle32(m)) continue;

      const cand = popcount9(m);
      if (cand < bestCandidates) {
        bestCandidates = cand;
        bestActivity = this.ACTIVITY[c];
        best = c;
      } else if (cand === bestCandidates) {
        if (this.randomMRVTieBreak) {
          if ((this.rngNextU32() & 1) === 0) {
            bestActivity = this.ACTIVITY[c];
            best = c;
          }
        } else {
          if (this.ACTIVITY[c] > bestActivity) {
            bestActivity = this.ACTIVITY[c];
            best = c;
          }
        }
      }
    }

    return best;
  }

  /* ============================================================
     SELECT VALUE (digit) FROM domain
     ============================================================ */
  private pickDigitFromDomain(domain9: number): number {
    if (!this.randomValueChoice) {
      const bit = lowbit32(domain9);
      return bitIndexLow(bit);
    }

    const k = popcount9(domain9);
    let idx = this.rngNextInt(k);
    let mm = u32(domain9);

    while (true) {
      const b = lowbit32(mm);
      mm = u32(mm & (mm - 1));
      if (idx === 0) return bitIndexLow(b);
      idx--;
    }
  }

  /* ============================================================
     SOLUTION SAVE / EXPORT
     ============================================================ */
  private saveSolution(): void {
    for (let c = 0; c < 81; c++) {
      this.SOLUTION[c] = bitIndexLow(this.CELL_MASK[c]); // 0..8
    }
  }

  public getSolution81(): Uint8Array | null {
    if (this.solutionCount <= 0) return null;
    const out = new Uint8Array(81);
    for (let c = 0; c < 81; c++) out[c] = this.SOLUTION[c] + 1;
    return out;
  }

  public getStats(): SolveStats {
    const elapsed = this.nowMs() - this.startTimeMs;
    return {
      conflicts: this.conflicts,
      guessCount: this.guessCount,
      maxDepth: this.maxDepth,
      nodes: this.nodes,
      hiddenSingles: this.hiddenSingles,
      lockedCandidateElims: this.lockedCandidateElims,
      hiddenPairElims: this.hiddenPairElims,
      elapsedMs: elapsed
    };
  }

  /* ============================================================
     CORE DFS (iterative), stopAtSolutions
     - returns SolveStatus if early-exit by limit else null
     ============================================================ */
  private solveInternal(stopAt: number): SolveStatus | null {
    const rootMark = this.trailMark();

    // ensure unit checks run fully at root
    this.DIRTY_UNIT[0] = u32(this.DIRTY_UNIT[0] | ALL_UNITS_DIRTY);

    this.earlyStatus = null;
    if (!this.propagate(true)) {
      this.conflicts++;
      this.decayActivities();
      this.undoTo(rootMark);
      return null;
    }
    if (this.earlyStatus !== null) {
      this.undoTo(rootMark);
      return this.earlyStatus;
    }

    if (this.assignedCount === 81) {
      this.saveSolution();
      this.solutionCount = 1;
      this.undoTo(rootMark);
      return null;
    }

    const cell0 = this.selectCell();
    if (cell0 === -1) {
      this.conflicts++;
      this.decayActivities();
      this.undoTo(rootMark);
      return null;
    }

    this.decCell[0] = cell0;
    this.decDomain[0] = this.CELL_MASK[cell0];
    this.decMark[0] = this.trailMark();
    this.decPtr = 1;

    this.guessCount++;
    this.bumpActivity(cell0);
    if (this.decPtr > this.maxDepth) this.maxDepth = this.decPtr;

    while (this.decPtr > 0 && this.solutionCount < stopAt) {
      const s = this.limitHit();
      if (s !== null) {
        this.undoTo(rootMark);
        return s;
      }

      const top = this.decPtr - 1;
      const cell = this.decCell[top];
      let domain = this.decDomain[top];
      const enterMark = this.decMark[top];

      this.undoTo(enterMark);

      if (domain === 0) {
        this.decPtr--;
        this.conflicts++;
        this.decayActivities();
        continue;
      }

      const digit = this.pickDigitFromDomain(domain);

      const bit = u32(1 << digit);
      domain = u32(domain & u32not(bit));
      this.decDomain[top] = domain;

      // node = one branching attempt
      this.nodes++;

      const attemptMark = this.trailMark();
      if (!this.assign(cell, digit)) {
        this.conflicts++;
        this.decayActivities();
        this.undoTo(attemptMark);
        continue;
      }

      const depthNow = this.decPtr;
      const heavyNow =
        (this.heavyEnabled &&
          (this.heavyAtRootOnly ? false : (depthNow <= this.heavyDepthLimit)));

      this.earlyStatus = null;
      if (!this.propagate(heavyNow)) {
        this.conflicts++;
        this.decayActivities();
        this.undoTo(attemptMark);
        continue;
      }
      if (this.earlyStatus !== null) {
        this.undoTo(rootMark);
        return this.earlyStatus;
      }

      if (this.assignedCount === 81) {
        if (this.solutionCount === 0) this.saveSolution();
        this.solutionCount++;
        this.undoTo(attemptMark);
        continue;
      }

      const nextCell = this.selectCell();
      if (nextCell === -1) {
        this.conflicts++;
        this.decayActivities();
        this.undoTo(attemptMark);
        continue;
      }

      this.decCell[this.decPtr] = nextCell;
      this.decDomain[this.decPtr] = this.CELL_MASK[nextCell];
      this.decMark[this.decPtr] = this.trailMark();
      this.decPtr++;

      this.guessCount++;
      this.bumpActivity(nextCell);
      if (this.decPtr > this.maxDepth) this.maxDepth = this.decPtr;
    }

    this.undoTo(rootMark);
    return null;
  }

  /* ============================================================
     PUBLIC SOLVE MODES (generator-fit)
     ============================================================ */
  public solveStopAtOne(): SolveResult {
    return this.solveWithStopAt(1, true);
  }

  public solveUnique(): SolveResult {
    return this.solveWithStopAt(2, true);
  }

  public solveStopAtTwo(): SolveResult {
    return this.solveWithStopAt(2, false);
  }

  public countSolutions(stopAt: number = 2): SolveResult {
    return this.solveWithStopAt(stopAt, false);
  }

  private solveWithStopAt(stopAt: number, computeDifficulty: boolean): SolveResult {
    this.clearStats();
    this.startTimeMs = this.nowMs();

    const early = this.solveInternal(stopAt);

    const elapsed = this.nowMs() - this.startTimeMs;

    if (early === SolveStatus.TIMEOUT) {
      return {
        status: SolveStatus.TIMEOUT,
        solutionCount: this.solutionCount,
        solution81: (this.solutionCount > 0 ? this.getSolution81() : null),
        difficulty: null,
        stats: {
          conflicts: this.conflicts,
          guessCount: this.guessCount,
          maxDepth: this.maxDepth,
          nodes: this.nodes,
          hiddenSingles: this.hiddenSingles,
          lockedCandidateElims: this.lockedCandidateElims,
          hiddenPairElims: this.hiddenPairElims,
          elapsedMs: elapsed
        }
      };
    }

    if (early === SolveStatus.NODE_LIMIT) {
      return {
        status: SolveStatus.NODE_LIMIT,
        solutionCount: this.solutionCount,
        solution81: (this.solutionCount > 0 ? this.getSolution81() : null),
        difficulty: null,
        stats: {
          conflicts: this.conflicts,
          guessCount: this.guessCount,
          maxDepth: this.maxDepth,
          nodes: this.nodes,
          hiddenSingles: this.hiddenSingles,
          lockedCandidateElims: this.lockedCandidateElims,
          hiddenPairElims: this.hiddenPairElims,
          elapsedMs: elapsed
        }
      };
    }

    if (this.solutionCount === 0) {
      return {
        status: SolveStatus.NO_SOLUTION,
        solutionCount: 0,
        solution81: null,
        difficulty: null,
        stats: {
          conflicts: this.conflicts,
          guessCount: this.guessCount,
          maxDepth: this.maxDepth,
          nodes: this.nodes,
          hiddenSingles: this.hiddenSingles,
          lockedCandidateElims: this.lockedCandidateElims,
          hiddenPairElims: this.hiddenPairElims,
          elapsedMs: elapsed
        }
      };
    }

    if (this.solutionCount >= 2) {
      return {
        status: SolveStatus.MULTIPLE,
        solutionCount: this.solutionCount,
        solution81: null,
        difficulty: null,
        stats: {
          conflicts: this.conflicts,
          guessCount: this.guessCount,
          maxDepth: this.maxDepth,
          nodes: this.nodes,
          hiddenSingles: this.hiddenSingles,
          lockedCandidateElims: this.lockedCandidateElims,
          hiddenPairElims: this.hiddenPairElims,
          elapsedMs: elapsed
        }
      };
    }

    // UNIQUE
    let diff: Difficulty | null = null;
    if (computeDifficulty) {
      const logicScore =
        this.hiddenSingles +
        this.lockedCandidateElims * 2 +
        this.hiddenPairElims * 4 +
        this.guessCount * 10 +
        this.maxDepth * 3 +
        this.conflicts;
      const givensBonus = Math.max(0, this.initialGivens - 17) * 3;
      const adjustedScore = Math.max(0, logicScore - givensBonus);

      if (adjustedScore <= 300) diff = Difficulty.EASY;
      else if (adjustedScore <= 500) diff = Difficulty.MEDIUM;
      else if (adjustedScore <= 900) diff = Difficulty.HARD;
      else diff = Difficulty.SAMURAI;
    }

    return {
      status: SolveStatus.UNIQUE,
      solutionCount: 1,
      solution81: this.getSolution81(),
      difficulty: diff,
      stats: {
        conflicts: this.conflicts,
        guessCount: this.guessCount,
        maxDepth: this.maxDepth,
        nodes: this.nodes,
        hiddenSingles: this.hiddenSingles,
        lockedCandidateElims: this.lockedCandidateElims,
        hiddenPairElims: this.hiddenPairElims,
        elapsedMs: elapsed
      }
    };
  }

  /* ============================================================
     LEGACY COMPAT WRAPPER
     ============================================================ */
  public SOLVE(givens: Array<[number, number]>): [SolveStatus, Difficulty | null, Uint8Array | null] {
    if (!this.resetFromGivens(givens)) return [SolveStatus.NO_SOLUTION, null, null];

    const res = this.solveWithStopAt(2, true);
    if (res.status !== SolveStatus.UNIQUE) return [res.status, null, null];

    return [SolveStatus.UNIQUE, res.difficulty, res.solution81];
  }
}
