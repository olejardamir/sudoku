import {
  ALL_WORD_MASK0,
  ALL_WORD_MASK1,
  ALL_WORD_MASK2,
  bitIndexLow,
  lowbit32,
  popcount32,
  u32,
  u32not,
} from "./solver_shared";
import { SolverMetrics } from "./solver_metrics";
import { SolverState } from "./solver_state";

type U32 = number;

export class RuleSet {
  private readonly state: SolverState;
  private readonly metrics: SolverMetrics;

  private heavyEnabled = true;
  private heavyDirtyUnitsOnly = true;

  private readonly hpCand0 = new Uint32Array(9);
  private readonly hpCand1 = new Uint32Array(9);
  private readonly hpCand2 = new Uint32Array(9);
  private readonly hpCnt = new Uint8Array(9);

  constructor(state: SolverState, metrics: SolverMetrics) {
    this.state = state;
    this.metrics = metrics;
  }

  public setHeavyEnabled(on: boolean): void {
    this.heavyEnabled = on;
  }

  public setHeavyDirtyUnitsOnly(on: boolean): void {
    this.heavyDirtyUnitsOnly = on;
  }

  public isHeavyEnabled(): boolean {
    return this.heavyEnabled;
  }

  private forEachCellInWordMask(w: number, mask: U32, fn: (cell: number) => boolean): boolean {
    let mm = u32(mask);
    const base = (w << 5);
    while (mm !== 0) {
      const bb = lowbit32(mm);
      mm = u32(mm & (mm - 1));
      const cell = base + bitIndexLow(bb);
      if (!fn(cell)) return false;
    }
    return true;
  }

  private forEachCellInTripleMask(m0: U32, m1: U32, m2: U32, fn: (cell: number) => boolean): boolean {
    return (
      this.forEachCellInWordMask(0, m0, fn) &&
      this.forEachCellInWordMask(1, m1, fn) &&
      this.forEachCellInWordMask(2, m2, fn)
    );
  }

  private triplePopcount(m0: U32, m1: U32, m2: U32): number {
    return popcount32(m0) + popcount32(m1) + popcount32(m2);
  }

  private tripleSingleCell(m0: U32, m1: U32, m2: U32): number {
    if (m0 !== 0) return bitIndexLow(lowbit32(m0));
    if (m1 !== 0) return 32 + bitIndexLow(lowbit32(m1));
    return 64 + bitIndexLow(lowbit32(m2));
  }

  public applyHiddenSingles(unitsToCheck: U32, checkLimit: () => boolean): boolean {
    for (let u = 0; u < 27; u++) {
      if (!this.state.unitIsInMask(unitsToCheck, u)) continue;
      if (checkLimit()) return true;

      const baseU = u * 3;
      for (let d = 0; d < 9; d++) {
        const m0 = u32(this.state.DIGIT_PLANE[(d * 3) | 0] & this.state.UNIT_MASK[baseU]);
        const m1 = u32(this.state.DIGIT_PLANE[(d * 3 + 1) | 0] & this.state.UNIT_MASK[baseU + 1]);
        const m2 = u32(this.state.DIGIT_PLANE[(d * 3 + 2) | 0] & this.state.UNIT_MASK[baseU + 2]);

        const total = this.triplePopcount(m0, m1, m2);
        if (total === 0) return false;

        if (total === 1) {
          const cell = this.tripleSingleCell(m0, m1, m2);
          this.metrics.hiddenSingles++;
          if (!this.state.assign(cell, d)) return false;
        }
      }
    }
    return true;
  }

  private eliminateDigitFromTriple(d: number, m0: U32, m1: U32, m2: U32): boolean {
    const bitD = u32(1 << d);
    return this.forEachCellInTripleMask(m0, m1, m2, (cell) => {
      if ((this.state.CELL_MASK[cell] & bitD) !== 0) {
        if (!this.state.remove(cell, d)) return false;
        this.metrics.lockedCandidateElims++;
      }
      return true;
    });
  }

  private tryPointingElim(d: number, baseBox: number, baseLine: number, b0: U32, b1: U32, b2: U32): boolean {
    const outside0 = u32(b0 & u32not(this.state.UNIT_MASK[baseLine]));
    const outside1 = u32(b1 & u32not(this.state.UNIT_MASK[baseLine + 1]));
    const outside2 = u32(b2 & u32not(this.state.UNIT_MASK[baseLine + 2]));
    if ((outside0 | outside1 | outside2) !== 0) return true;

    let out0 = u32(this.state.UNIT_MASK[baseLine] & u32not(this.state.UNIT_MASK[baseBox])) & ALL_WORD_MASK0;
    let out1 = u32(this.state.UNIT_MASK[baseLine + 1] & u32not(this.state.UNIT_MASK[baseBox + 1])) & ALL_WORD_MASK1;
    let out2 = u32(this.state.UNIT_MASK[baseLine + 2] & u32not(this.state.UNIT_MASK[baseBox + 2])) & ALL_WORD_MASK2;

    out0 = u32(out0 & this.state.DIGIT_PLANE[(d * 3) | 0]);
    out1 = u32(out1 & this.state.DIGIT_PLANE[(d * 3 + 1) | 0]);
    out2 = u32(out2 & this.state.DIGIT_PLANE[(d * 3 + 2) | 0]);

    return this.eliminateDigitFromTriple(d, out0, out1, out2);
  }

  public applyLockedCandidates(unitMaskBits: U32): boolean {
    const rowUsForBox = (box: number): [number, number, number] => {
      const br = ((box / 3) | 0);
      const r0 = br * 3;
      return [r0, r0 + 1, r0 + 2];
    };

    const colUsForBox = (box: number): [number, number, number] => {
      const bc = (box % 3);
      const c0 = 9 + (bc * 3);
      return [c0, c0 + 1, c0 + 2];
    };

    for (let boxU = 18; boxU <= 26; boxU++) {
      if (!this.state.unitIsInMask(unitMaskBits, boxU)) continue;

      const baseBox = boxU * 3;
      const box = boxU - 18;

      const rowUs = rowUsForBox(box);
      const colUs = colUsForBox(box);

      for (let d = 0; d < 9; d++) {
        const b0 = u32(this.state.DIGIT_PLANE[(d * 3) | 0] & this.state.UNIT_MASK[baseBox]);
        const b1 = u32(this.state.DIGIT_PLANE[(d * 3 + 1) | 0] & this.state.UNIT_MASK[baseBox + 1]);
        const b2 = u32(this.state.DIGIT_PLANE[(d * 3 + 2) | 0] & this.state.UNIT_MASK[baseBox + 2]);

        if ((b0 | b1 | b2) === 0) return false;

        for (let i = 0; i < 3; i++) {
          const baseRow = rowUs[i] * 3;
          if (!this.tryPointingElim(d, baseBox, baseRow, b0, b1, b2)) return false;
        }

        for (let i = 0; i < 3; i++) {
          const baseCol = colUs[i] * 3;
          if (!this.tryPointingElim(d, baseBox, baseCol, b0, b1, b2)) return false;
        }
      }
    }

    return true;
  }

  public applyHiddenPairs(unitMaskBits: U32): boolean {
    if (!this.heavyEnabled) return true;

    for (let u = 0; u < 27; u++) {
      if (this.heavyDirtyUnitsOnly && !this.state.unitIsInMask(unitMaskBits, u)) continue;

      const baseU = u * 3;

      for (let d = 0; d < 9; d++) {
        this.hpCand0[d] = u32(this.state.DIGIT_PLANE[(d * 3) | 0] & this.state.UNIT_MASK[baseU]);
        this.hpCand1[d] = u32(this.state.DIGIT_PLANE[(d * 3 + 1) | 0] & this.state.UNIT_MASK[baseU + 1]);
        this.hpCand2[d] = u32(this.state.DIGIT_PLANE[(d * 3 + 2) | 0] & this.state.UNIT_MASK[baseU + 2]);
        this.hpCnt[d] = this.triplePopcount(this.hpCand0[d], this.hpCand1[d], this.hpCand2[d]) & 0xff;
      }

      for (let d1 = 0; d1 < 9; d1++) {
        if (this.hpCnt[d1] !== 2) continue;

        for (let d2 = d1 + 1; d2 < 9; d2++) {
          if (this.hpCnt[d2] !== 2) continue;

          if (
            this.hpCand0[d1] !== this.hpCand0[d2] ||
            this.hpCand1[d1] !== this.hpCand1[d2] ||
            this.hpCand2[d1] !== this.hpCand2[d2]
          ) {
            continue;
          }

          const keepMask9 = u32((1 << d1) | (1 << d2));
          const ok = this.forEachCellInTripleMask(
            this.hpCand0[d1],
            this.hpCand1[d1],
            this.hpCand2[d1],
            (cell) => {
              const res = this.state.restrictTo(cell, keepMask9);
              if (res.removed > 0) this.metrics.hiddenPairElims += res.removed;
              return res.ok;
            }
          );
          if (!ok) return false;
        }
      }
    }

    return true;
  }
}
