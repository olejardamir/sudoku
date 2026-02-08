/* ================================================================
   SUDOKU SOLVER ENGINE (9×9) — REFACTORED STRUCTURE
   Preserves behavior and API from the monolithic implementation.
   ================================================================ */

import {
  CELLS,
  WORDS,
  UNITS,
  Difficulty,
  generateMasks,
  SolveStatus,
  type Masks,
} from "./solver_shared.ts";
import { PropagationEngine } from "./propagation_engine.ts";
import { RuleSet } from "./solver_rules.ts";
import { SearchEngine } from "./search_engine.ts";
import { SolverMetrics, type SolveResult, type SolveStats } from "./solver_metrics.ts";
import { SolverState } from "./solver_state.ts";
import { TrailManager } from "./trail_manager.ts";

export { CELLS, WORDS, UNITS, SolveStatus, Difficulty, generateMasks };
export type { Masks, SolveResult, SolveStats };

const MAX_DEPTH = 81;
const MAX_TRAIL = 200000;

const DEFAULT_HEAVY_AT_ROOT_ONLY = false;
const DEFAULT_HEAVY_DEPTH_LIMIT = 1;
const DEFAULT_HEAVY_DIRTY_UNITS_ONLY = true;

// noinspection JSUnusedGlobalSymbols
export class SudokuSolver {
  private readonly trail: TrailManager;
  private readonly state: SolverState;
  private readonly metrics: SolverMetrics;
  private readonly rules: RuleSet;
  private readonly propagation: PropagationEngine;
  private readonly search: SearchEngine;

  constructor(masks: Masks) {
    this.trail = new TrailManager(MAX_TRAIL);
    this.state = new SolverState(masks, this.trail);
    this.metrics = new SolverMetrics();
    this.rules = new RuleSet(this.state, this.metrics);
    this.propagation = new PropagationEngine(this.state, this.rules, this.metrics);
    this.search = new SearchEngine(
      this.state,
      this.trail,
      this.metrics,
      this.rules,
      this.propagation,
      MAX_DEPTH
    );

    this.rules.setHeavyEnabled(true);
    this.rules.setHeavyDirtyUnitsOnly(DEFAULT_HEAVY_DIRTY_UNITS_ONLY);
    this.search.setHeavySchedule(DEFAULT_HEAVY_AT_ROOT_ONLY, DEFAULT_HEAVY_DEPTH_LIMIT);
  }

  public clearStats(): void {
    this.metrics.clearStats();
    this.search.resetSearchState();
  }

  public clearLimits(): void {
    this.metrics.clearLimits();
  }

  public setNodeLimit(limit: number): void {
    this.metrics.setNodeLimit(limit);
  }

  public setTimeoutMs(ms: number): void {
    this.metrics.setTimeoutMs(ms);
  }

  public setRandomSeed(seed: number): void {
    this.search.setRandomSeed(seed);
  }

  public enableRandomMRVTieBreak(on: boolean): void {
    this.search.enableRandomMRVTieBreak(on);
  }

  public enableRandomValueChoice(on: boolean): void {
    this.search.enableRandomValueChoice(on);
  }

  public enableHeavyRules(on: boolean): void {
    this.rules.setHeavyEnabled(on);
  }

  public setHeavySchedule(atRootOnly: boolean, depthLimit: number, dirtyUnitsOnly: boolean): void {
    this.search.setHeavySchedule(atRootOnly, depthLimit);
    this.rules.setHeavyDirtyUnitsOnly(dirtyUnitsOnly);
  }

  public resetFromGivens(givens: Array<[number, number]>): boolean {
    this.state.resetBase();
    this.search.resetSearchState();
    this.metrics.resetCounters(givens.length | 0);
    for (const [cell, value] of givens) {
      if (value < 1 || value > 9) return false;
      if (!this.state.assign(cell | 0, (value - 1) | 0)) return false;
    }
    return true;
  }

  public loadGrid81(grid81: Uint8Array): boolean {
    this.state.resetBase();
    this.search.resetSearchState();
    let givens = 0;
    for (let c = 0; c < 81; c++) {
      const v = grid81[c];
      if (v === 0) continue;
      givens++;
      if (v < 1 || v > 9) return false;
      if (!this.state.assign(c, (v - 1) | 0)) return false;
    }
    this.metrics.resetCounters(givens);
    return true;
  }

  public getSolution81(): Uint8Array | null {
    return this.search.getSolution81();
  }

  public getStats(): SolveStats {
    return this.metrics.buildStats(this.metrics.nowMs() - this.metrics.startTimeMs);
  }

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
    this.metrics.startTimeMs = this.metrics.nowMs();

    const early = this.search.solveInternal(stopAt);
    const elapsed = this.metrics.nowMs() - this.metrics.startTimeMs;
    const solutionCount = this.search.getSolutionCount();

    if (early === SolveStatus.TIMEOUT || early === SolveStatus.NODE_LIMIT) {
      const sol = (solutionCount > 0 ? this.search.getSolution81() : null);
      return this.metrics.makeResult(early, solutionCount, sol, null, elapsed);
    }

    if (solutionCount === 0) {
      return this.metrics.makeResult(SolveStatus.NO_SOLUTION, 0, null, null, elapsed);
    }

    if (solutionCount >= 2) {
      return this.metrics.makeResult(SolveStatus.MULTIPLE, solutionCount, null, null, elapsed);
    }

    let diff: Difficulty | null = null;
    if (computeDifficulty) {
      const logicScore =
        this.metrics.hiddenSingles +
        this.metrics.lockedCandidateElims * 2 +
        this.metrics.hiddenPairElims * 4 +
        this.metrics.guessCount * 10 +
        this.metrics.maxDepth * 3 +
        this.metrics.conflicts;

      const givensBonus = Math.max(0, this.metrics.initialGivens - 17) * 3;
      const adjustedScore = Math.max(0, logicScore - givensBonus);

      if (adjustedScore <= 300) diff = Difficulty.EASY;
      else if (adjustedScore <= 500) diff = Difficulty.MEDIUM;
      else if (adjustedScore <= 900) diff = Difficulty.HARD;
      else diff = Difficulty.SAMURAI;
    }

    return this.metrics.makeResult(
      SolveStatus.UNIQUE,
      1,
      this.search.getSolution81(),
      diff,
      elapsed
    );
  }

  public SOLVE(givens: Array<[number, number]>): [SolveStatus, Difficulty | null, Uint8Array | null] {
    if (!this.resetFromGivens(givens)) {
      return [SolveStatus.NO_SOLUTION, null, null];
    }

    const res = this.solveWithStopAt(2, true);
    return res.status === SolveStatus.UNIQUE ?
      [SolveStatus.UNIQUE, res.difficulty, res.solution81] :
      [res.status, null, null];
  }
}
