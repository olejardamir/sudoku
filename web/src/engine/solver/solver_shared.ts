/* -----------------------------
   CONSTANTS / TYPES / HELPERS
----------------------------- */

export const CELLS = 81;
export const WORDS = 3;
export const UNITS = 27;

export const SolveStatus = {
  NO_SOLUTION: 0,
  UNIQUE: 1,
  MULTIPLE: 2,
  NODE_LIMIT: 3,
  TIMEOUT: 4,
} as const;

export type SolveStatus = (typeof SolveStatus)[keyof typeof SolveStatus];

export const Difficulty = {
  EASY: 0,
  MEDIUM: 1,
  HARD: 2,
  SAMURAI: 3,
} as const;

export type Difficulty = (typeof Difficulty)[keyof typeof Difficulty];

export type Masks = {
  UNIT_MASK: Uint32Array; // UNITS*3
  PEER_MASK: Uint32Array; // CELLS*3
  CELL_TO_UNITS: Uint8Array; // CELLS*3 (row, col, box)
};

type U32 = number;

export const ALL_WORD_MASK0 = 0xFFFFFFFF >>> 0;
export const ALL_WORD_MASK1 = 0xFFFFFFFF >>> 0;
export const ALL_WORD_MASK2 = 0x0001FFFF >>> 0;
export const ALL_UNITS_DIRTY = 0x07FFFFFF >>> 0; // 27 ones

export const u32 = (x: number): U32 => (x >>> 0);
export const u32not = (x: number): U32 => ((~x) >>> 0);

export const lowbit32 = (x: number): U32 => u32(x & -x);

export const bitIndexLow = (singleBit: number): number => {
  singleBit = u32(singleBit);
  if (singleBit === 0) return -1;
  return 31 - Math.clz32(singleBit);
};

export const isSingle32 = (x: number): boolean => {
  x = u32(x);
  return x !== 0 && u32(x & (x - 1)) === 0;
};

export const popcount32 = (x: number): number => {
  x = u32(x);
  let c = 0;
  while (x !== 0) {
    x = u32(x & (x - 1));
    c++;
  }
  return c;
};

const POPCOUNT_9BIT = buildPopcount9Lut();

function buildPopcount9Lut(): Uint8Array {
  const lut = new Uint8Array(512);
  for (let m = 0; m < lut.length; m++) {
    let x = m;
    let c = 0;
    while (x !== 0) {
      c += x & 1;
      x >>>= 1;
    }
    lut[m] = c;
  }
  return lut;
}
export const popcount9 = (mask9: number): number => POPCOUNT_9BIT[mask9 & 0x1FF];

export const cellWord = (cell: number): number => (cell >>> 5); // 0..2
export const cellBit = (cell: number): U32 => ((1 << (cell & 31)) >>> 0);
export const wordCellOffset = (w: number): number => (w << 5);

export const xorshift32 = (state: U32): U32 => {
  let x = u32(state);
  x ^= x << 13;
  x = u32(x);
  x ^= x >>> 17;
  x = u32(x);
  x ^= x << 5;
  return u32(x);
};

export function generateMasks(): Masks {
  const UNIT_MASK = new Uint32Array(UNITS * WORDS);
  const PEER_MASK = new Uint32Array(CELLS * WORDS);
  const CELL_TO_UNITS = new Uint8Array(CELLS * 3);

  buildUnitMasks(UNIT_MASK);
  buildCellToUnits(CELL_TO_UNITS);
  buildPeerMasks(PEER_MASK, CELL_TO_UNITS);

  return { UNIT_MASK, PEER_MASK, CELL_TO_UNITS };
}

function setBitArr(arr: Uint32Array, base: number, cell: number): void {
  const w = cellWord(cell);
  const b = cellBit(cell);
  arr[base + w] = u32(arr[base + w] | b);
}

function buildUnitMasks(UNIT_MASK: Uint32Array): void {
  for (let cell = 0; cell < 81; cell++) {
    const r = (cell / 9) | 0;
    const c = cell % 9;
    const b = (((r / 3) | 0) * 3) + ((c / 3) | 0);
    setBitArr(UNIT_MASK, r * 3, cell);
    setBitArr(UNIT_MASK, (9 + c) * 3, cell);
    setBitArr(UNIT_MASK, (18 + b) * 3, cell);
  }
}

function buildCellToUnits(CELL_TO_UNITS: Uint8Array): void {
  for (let cell = 0; cell < 81; cell++) {
    const r = (cell / 9) | 0;
    const c = cell % 9;
    const b = (((r / 3) | 0) * 3) + ((c / 3) | 0);
    CELL_TO_UNITS[cell * 3] = r;
    CELL_TO_UNITS[cell * 3 + 1] = 9 + c;
    CELL_TO_UNITS[cell * 3 + 2] = 18 + b;
  }
}

function buildPeerMasks(
  PEER_MASK: Uint32Array,
  CELL_TO_UNITS: Uint8Array
): void {
  for (let cell = 0; cell < 81; cell++) {
    const r = (cell / 9) | 0;
    const c = cell % 9;
    const box = CELL_TO_UNITS[cell * 3 + 2] - 18;

    const base = cell * 3;

    for (let c2 = 0; c2 < 9; c2++) {
      if (c2 !== c) setBitArr(PEER_MASK, base, r * 9 + c2);
    }

    for (let r2 = 0; r2 < 9; r2++) {
      if (r2 !== r) setBitArr(PEER_MASK, base, r2 * 9 + c);
    }

    const br = ((box / 3) | 0);
    const bc = (box % 3);
    const r0 = br * 3;
    const c0 = bc * 3;
    for (let i = 0; i < 9; i++) {
      const p = (r0 + ((i / 3) | 0)) * 9 + (c0 + (i % 3));
      if (p !== cell) setBitArr(PEER_MASK, base, p);
    }
  }
}
