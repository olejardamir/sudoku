export interface TrailStateAccess {
  CELL_MASK: Uint16Array;
  adjustAssignedCount: (oldMask: number, newMask: number) => void;
  restoreCellPlanesFromMask: (cell: number, mask9: number) => void;
  markDirtyCell: (cell: number) => void;
  markDirtyUnitsForCell: (cell: number) => void;
}

export class TrailManager {
  private readonly trailCell: Int16Array;
  private readonly trailMask: Uint16Array;
  private trailPtr: number;
  private readonly maxTrail: number;

  constructor(maxTrail: number) {
    this.maxTrail = maxTrail;
    this.trailCell = new Int16Array(maxTrail);
    this.trailMask = new Uint16Array(maxTrail);
    this.trailPtr = 0;
  }

  public reset(): void {
    this.trailPtr = 0;
  }

  public trailMark(): number {
    return this.trailPtr;
  }

  public pushTrail(cell: number, oldMask: number): boolean {
    if (this.trailPtr >= this.maxTrail) return false;
    this.trailCell[this.trailPtr] = cell;
    this.trailMask[this.trailPtr] = oldMask;
    this.trailPtr++;
    return true;
  }

  public undoTo(mark: number, state: TrailStateAccess): void {
    while (this.trailPtr > mark) {
      this.trailPtr--;
      const cell = this.trailCell[this.trailPtr];
      const oldMask = this.trailMask[this.trailPtr];

      const curMask = state.CELL_MASK[cell];
      state.adjustAssignedCount(curMask, oldMask);

      state.CELL_MASK[cell] = oldMask;
      state.restoreCellPlanesFromMask(cell, oldMask);

      state.markDirtyCell(cell);
      state.markDirtyUnitsForCell(cell);
    }
  }
}
