import {
  ALL_UNITS_DIRTY,
  ALL_WORD_MASK0,
  ALL_WORD_MASK1,
  ALL_WORD_MASK2,
  bitIndexLow,
  cellBit,
  cellWord,
  isSingle32,
  lowbit32,
  popcount32,
  u32,
  u32not,
  wordCellOffset,
} from "./solver_shared.ts";
import type { Masks } from "./solver_shared.ts";
import { TrailManager } from "./trail_manager.ts";

export class SolverState {
  public readonly UNIT_MASK: Uint32Array;
  public readonly PEER_MASK: Uint32Array;
  public readonly CELL_TO_UNITS: Uint8Array;

  public readonly CELL_MASK: Uint16Array;
  public readonly DIGIT_PLANE: Uint32Array;

  private readonly DIRTY: Uint32Array;
  private readonly DIRTY_UNIT: Uint32Array;

  public assignedCount: number;
  public propChanged: boolean;

  private readonly trail: TrailManager;

  constructor(masks: Masks, trail: TrailManager) {
    const { UNIT_MASK, PEER_MASK, CELL_TO_UNITS } = masks;
    this.UNIT_MASK = UNIT_MASK;
    this.PEER_MASK = PEER_MASK;
    this.CELL_TO_UNITS = CELL_TO_UNITS;

    this.CELL_MASK = new Uint16Array(81);
    this.DIGIT_PLANE = new Uint32Array(9 * 3);

    this.DIRTY = new Uint32Array(3);
    this.DIRTY_UNIT = new Uint32Array(1);

    this.assignedCount = 0;
    this.propChanged = false;

    this.trail = trail;
  }

  public resetBase(): void {
    this.trail.reset();
    this.DIRTY.fill(0);
    this.DIRTY_UNIT[0] = 0;

    this.CELL_MASK.fill(0x1FF);
    this.assignedCount = 0;
    this.propChanged = false;

    for (let d = 0; d < 9; d++) {
      this.DIGIT_PLANE[(d * 3) | 0] = u32(ALL_WORD_MASK0);
      this.DIGIT_PLANE[(d * 3 + 1) | 0] = u32(ALL_WORD_MASK1);
      this.DIGIT_PLANE[(d * 3 + 2) | 0] = u32(ALL_WORD_MASK2);
    }

    this.DIRTY_UNIT[0] = u32(ALL_UNITS_DIRTY);
  }

  public markAllUnitsDirty(): void {
    this.DIRTY_UNIT[0] = u32(this.DIRTY_UNIT[0] | ALL_UNITS_DIRTY);
  }

  public markDirtyCell(cell: number): void {
    const w = cellWord(cell);
    this.DIRTY[w] = u32(this.DIRTY[w] | cellBit(cell));
  }

  public popDirtyCell(): number {
    for (let w = 0; w < 3; w++) {
      const m = u32(this.DIRTY[w]);
      if (m !== 0) {
        const b = lowbit32(m);
        this.DIRTY[w] = u32(this.DIRTY[w] & u32not(b));
        return wordCellOffset(w) + bitIndexLow(b);
      }
    }
    return -1;
  }

  public markDirtyUnitsForCell(cell: number): void {
    const base = cell * 3;
    const u0 = this.CELL_TO_UNITS[base];
    const u1 = this.CELL_TO_UNITS[base + 1];
    const u2 = this.CELL_TO_UNITS[base + 2];
    const mask = u32((1 << u0) | (1 << u1) | (1 << u2));
    this.DIRTY_UNIT[0] = u32(this.DIRTY_UNIT[0] | mask);
  }

  public takeDirtyUnits(): number {
    const m = u32(this.DIRTY_UNIT[0]);
    this.DIRTY_UNIT[0] = 0;
    return m;
  }

  public unitIsInMask(unitMask: number, u: number): boolean {
    return (((unitMask >>> u) & 1) !== 0);
  }

  public adjustAssignedCount(oldMask: number, newMask: number): void {
    const oldSingle = isSingle32(oldMask);
    const newSingle = isSingle32(newMask);
    if (oldSingle && !newSingle) this.assignedCount--;
    else if (!oldSingle && newSingle) this.assignedCount++;
  }

  public restoreCellPlanesFromMask(cell: number, mask9: number): void {
    const w = cellWord(cell);
    const bitC = cellBit(cell);
    this.clearCellFromDigitPlanes(w, bitC);
    this.addDigitsFromMask(w, bitC, mask9);
  }

  private updateDigitPlanesForMaskChange(cell: number, oldMask9: number, newMask9: number): void {
    if (oldMask9 === newMask9) return;
    this.restoreCellPlanesFromMask(cell, newMask9);
  }

  private clearCellFromDigitPlanes(word: number, bitC: number): void {
    for (let d = 0; d < 9; d++) {
      const idx = ((d * 3 + word) | 0);
      this.DIGIT_PLANE[idx] = u32(this.DIGIT_PLANE[idx] & u32not(bitC));
    }
  }

  private addDigitsFromMask(word: number, bitC: number, mask9: number): void {
    let mm = u32(mask9);
    while (mm !== 0) {
      const b = lowbit32(mm);
      mm = u32(mm & (mm - 1));
      const d = bitIndexLow(b);
      const idx = ((d * 3 + word) | 0);
      this.DIGIT_PLANE[idx] = u32(this.DIGIT_PLANE[idx] | bitC);
    }
  }

  public applyCellMaskChangeWithTrail(cell: number, newMask9: number): boolean {
    if (!this.trail.pushTrail(cell, this.CELL_MASK[cell])) return false;
    const old = this.CELL_MASK[cell];

    this.adjustAssignedCount(old, newMask9);
    this.CELL_MASK[cell] = newMask9;
    this.propChanged = true;

    this.updateDigitPlanesForMaskChange(cell, old, newMask9);

    this.markDirtyCell(cell);
    this.markDirtyUnitsForCell(cell);
    return true;
  }

  private forEachCellInWordMask(w: number, mask: number, fn: (cell: number) => boolean): boolean {
    let mm = u32(mask);
    const base = wordCellOffset(w);
    while (mm !== 0) {
      const bb = lowbit32(mm);
      mm = u32(mm & (mm - 1));
      const cell = base + bitIndexLow(bb);
      if (!fn(cell)) return false;
    }
    return true;
  }

  public remove(cell: number, digit: number): boolean {
    const bitD = u32(1 << digit);
    const old = this.CELL_MASK[cell];
    if ((old & bitD) === 0) return true;

    const newMask = u32(old & u32not(bitD));
    if (newMask === 0) return false;

    return this.applyCellMaskChangeWithTrail(cell, newMask);
  }

  public eliminateDigitFromPeers(cell: number, digit: number): boolean {
    const basePeer = cell * 3;
    for (let ww = 0; ww < 3; ww++) {
      const mm = u32(this.DIGIT_PLANE[(digit * 3 + ww) | 0] & this.PEER_MASK[basePeer + ww]);
      const ok = this.forEachCellInWordMask(ww, mm, (p) => this.remove(p, digit));
      if (!ok) return false;
    }
    return true;
  }

  public assign(cell: number, digit: number): boolean {
    const bitD = u32(1 << digit);
    const old = this.CELL_MASK[cell];
    if ((old & bitD) === 0) return false;
    if (old === bitD) return true;

    if (!this.applyCellMaskChangeWithTrail(cell, bitD)) return false;
    return this.eliminateDigitFromPeers(cell, digit);
  }

  public restrictTo(cell: number, keepMask9: number): { ok: boolean; removed: number } {
    const old = this.CELL_MASK[cell];
    const newMask = u32(old & keepMask9);
    if (newMask === 0) return { ok: false, removed: 0 };
    if (newMask === old) return { ok: true, removed: 0 };

    const removed = popcount32(u32(old & u32not(newMask)));
    const ok = this.applyCellMaskChangeWithTrail(cell, newMask);
    return { ok, removed };
  }
}
