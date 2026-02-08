import {
  bitIndexLow,
  isSingle32,
  lowbit32,
  popcount9,
  SolveStatus,
  u32,
  u32not,
  xorshift32,
} from "./solver_shared";
import { PropagationEngine, PropagationResult } from "./propagation_engine";
import { SolverMetrics } from "./solver_metrics";
import { RuleSet } from "./solver_rules";
import { SolverState } from "./solver_state";
import { TrailManager } from "./trail_manager";

type U32 = number;

export class SearchEngine {
  private readonly state: SolverState;
  private readonly trail: TrailManager;
  private readonly metrics: SolverMetrics;
  private readonly propagation: PropagationEngine;
  private readonly rules: RuleSet;

  private readonly ACTIVITY: Float64Array;
  private ACTIVITY_INC: number;
  private readonly ACTIVITY_DECAY = 0.95;
  private readonly RESCALE_THRESHOLD = 1e150;
  private readonly RESCALE_FACTOR = 1e-100;

  private readonly decCell: Int16Array;
  private readonly decDomain: Uint16Array;
  private readonly decMark: Int32Array;
  private decPtr: number;

  private readonly SOLUTION: Uint8Array;
  private solutionCount: number;

  private rngState: U32;
  private randomMRVTieBreak = false;
  private randomValueChoice = false;

  private selectSeed: number;

  private heavyAtRootOnly = false;
  private heavyDepthLimit = 1;

  constructor(
    state: SolverState,
    trail: TrailManager,
    metrics: SolverMetrics,
    rules: RuleSet,
    propagation: PropagationEngine,
    maxDepth: number
  ) {
    this.state = state;
    this.trail = trail;
    this.metrics = metrics;
    this.rules = rules;
    this.propagation = propagation;

    this.ACTIVITY = new Float64Array(81);
    this.ACTIVITY_INC = 1.0;

    this.decCell = new Int16Array(maxDepth);
    this.decDomain = new Uint16Array(maxDepth);
    this.decMark = new Int32Array(maxDepth);
    this.decPtr = 0;

    this.SOLUTION = new Uint8Array(81);
    this.solutionCount = 0;

    this.rngState = u32(0x9E3779B9);
    this.selectSeed = 0;
  }

  public resetSearchState(): void {
    this.decPtr = 0;
    this.solutionCount = 0;
    this.ACTIVITY.fill(0.0);
    this.ACTIVITY_INC = 1.0;
    this.selectSeed = 0;
  }

  public getSolutionCount(): number {
    return this.solutionCount;
  }

  public getSolution81(): Uint8Array | null {
    if (this.solutionCount <= 0) return null;
    const out = new Uint8Array(81);
    for (let c = 0; c < 81; c++) out[c] = this.SOLUTION[c] + 1;
    return out;
  }

  public setRandomSeed(seed: number): void {
    const s = u32(seed);
    this.rngState = (s !== 0) ? s : u32(0xA5A5A5A5);
  }

  public enableRandomMRVTieBreak(on: boolean): void {
    this.randomMRVTieBreak = on;
  }

  public enableRandomValueChoice(on: boolean): void {
    this.randomValueChoice = on;
  }

  public setHeavySchedule(atRootOnly: boolean, depthLimit: number): void {
    this.heavyAtRootOnly = atRootOnly;
    this.heavyDepthLimit = (depthLimit | 0);
  }

  private rngNextU32(): U32 {
    this.rngState = xorshift32(this.rngState);
    return this.rngState;
  }

  private rngNextInt(n: number): number {
    if (n <= 1) return 0;
    return (this.rngNextU32() % (n >>> 0)) | 0;
  }

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

  private noteConflict(): void {
    this.metrics.conflicts++;
    this.decayActivities();
  }

  private noteConflictAndUndo(mark: number): void {
    this.noteConflict();
    this.trail.undoTo(mark, this.state);
  }

  private selectCell(): number {
    let best = -1;
    let bestCandidates = 999;
    let bestActivity = -Infinity;

    const start = this.selectSeed;

    for (let k = 0; k < 81; k++) {
      const c = (start + k) % 81;
      const m = this.state.CELL_MASK[c];
      if (m === 0) continue;
      if (isSingle32(m)) continue;

      const candidateCount = popcount9(m);
      if (candidateCount < bestCandidates) {
        bestCandidates = candidateCount;
        bestActivity = this.ACTIVITY[c];
        best = c;
        continue;
      }

      if (candidateCount !== bestCandidates) continue;

      const take =
        this.randomMRVTieBreak ?
          ((this.rngNextU32() & 1) === 0) :
          (this.ACTIVITY[c] > bestActivity);
      if (take) {
        bestActivity = this.ACTIVITY[c];
        best = c;
      }
    }

    return best;
  }

  private pickNthBitIndex(domain9: number, index: number): number {
    let mm = u32(domain9);
    while (true) {
      const b = lowbit32(mm);
      mm = u32(mm & (mm - 1));
      if (index === 0) return bitIndexLow(b);
      index--;
    }
  }

  private pickDigitFromDomain(domain9: number): number {
    if (!this.randomValueChoice) {
      return bitIndexLow(lowbit32(domain9));
    }

    const k = popcount9(domain9);
    return this.pickNthBitIndex(domain9, this.rngNextInt(k));
  }

  private saveSolution(): void {
    for (let c = 0; c < 81; c++) this.SOLUTION[c] = bitIndexLow(this.state.CELL_MASK[c]);
  }

  public solveInternal(stopAt: number): SolveStatus | null {
    const rootMark = this.trail.trailMark();

    this.state.markAllUnitsDirty();
    this.metrics.earlyStatus = null;

    const rootProp = this.propagation.propagate(true);
    if (rootProp === PropagationResult.CONTRADICTION) {
      this.noteConflict();
      this.trail.undoTo(rootMark, this.state);
      return null;
    }
    if (rootProp === PropagationResult.LIMIT_HIT) {
      this.trail.undoTo(rootMark, this.state);
      return this.metrics.earlyStatus;
    }

    if (this.state.assignedCount === 81) {
      this.saveSolution();
      this.solutionCount = 1;
      this.trail.undoTo(rootMark, this.state);
      return null;
    }

    const cell0 = this.selectCell();
    if (cell0 === -1) {
      this.noteConflict();
      this.trail.undoTo(rootMark, this.state);
      return null;
    }

    this.decCell[0] = cell0;
    this.decDomain[0] = this.state.CELL_MASK[cell0];
    this.decMark[0] = this.trail.trailMark();
    this.decPtr = 1;

    this.metrics.guessCount++;
    this.bumpActivity(cell0);
    if (this.decPtr > this.metrics.maxDepth) this.metrics.maxDepth = this.decPtr;

    while (this.decPtr > 0 && this.solutionCount < stopAt) {
      const s = this.metrics.limitHit();
      if (s !== null) {
        this.trail.undoTo(rootMark, this.state);
        return s;
      }

      const top = this.decPtr - 1;
      const cell = this.decCell[top];
      let domain = this.decDomain[top];
      const enterMark = this.decMark[top];

      this.trail.undoTo(enterMark, this.state);

      if (domain === 0) {
        this.decPtr--;
        this.noteConflict();
        continue;
      }

      const digit = this.pickDigitFromDomain(domain);

      const bit = u32(1 << digit);
      domain = u32(domain & u32not(bit));
      this.decDomain[top] = domain;

      this.metrics.nodes++;

      const attemptMark = this.trail.trailMark();
      if (!this.state.assign(cell, digit)) {
        this.noteConflictAndUndo(attemptMark);
        continue;
      }

      const depthNow = this.decPtr;
      const heavyNow = this.rules.isHeavyEnabled() && (this.heavyAtRootOnly ? false : (depthNow <= this.heavyDepthLimit));

      this.metrics.earlyStatus = null;
      const prop = this.propagation.propagate(heavyNow);
      if (prop === PropagationResult.CONTRADICTION) {
        this.noteConflictAndUndo(attemptMark);
        continue;
      }
      if (prop === PropagationResult.LIMIT_HIT) {
        this.trail.undoTo(rootMark, this.state);
        return this.metrics.earlyStatus;
      }

      if (this.state.assignedCount === 81) {
        if (this.solutionCount === 0) this.saveSolution();
        this.solutionCount++;
        this.trail.undoTo(attemptMark, this.state);
        continue;
      }

      const nextCell = this.selectCell();
      if (nextCell === -1) {
        this.noteConflictAndUndo(attemptMark);
        continue;
      }

      this.decCell[this.decPtr] = nextCell;
      this.decDomain[this.decPtr] = this.state.CELL_MASK[nextCell];
      this.decMark[this.decPtr] = this.trail.trailMark();
      this.decPtr++;

      this.metrics.guessCount++;
      this.bumpActivity(nextCell);
      if (this.decPtr > this.metrics.maxDepth) this.metrics.maxDepth = this.decPtr;
    }

    this.trail.undoTo(rootMark, this.state);
    return null;
  }
}
