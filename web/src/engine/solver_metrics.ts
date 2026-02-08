import { Difficulty, SolveStatus } from "./solver_shared";

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
  solutionCount: number;
  solution81: Uint8Array | null;
  difficulty: Difficulty | null;
  stats: SolveStats;
};

export class SolverMetrics {
  public conflicts = 0;
  public maxDepth = 0;
  public guessCount = 0;
  public nodes = 0;
  public solutionCount = 0;
  public initialGivens = 0;
  public hiddenSingles = 0;
  public lockedCandidateElims = 0;
  public hiddenPairElims = 0;

  public nodeLimit = 0;
  public timeoutMs = 0;
  public startTimeMs = 0;

  public earlyStatus: SolveStatus | null = null;

  public clearStats(): void {
    this.resetCounters(0);
  }

  public resetCounters(initialGivens: number): void {
    this.conflicts = 0;
    this.maxDepth = 0;
    this.guessCount = 0;
    this.nodes = 0;
    this.solutionCount = 0;
    this.initialGivens = initialGivens;
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

  public nowMs(): number {
    return performance.now();
  }

  public limitHit(): SolveStatus | null {
    if (this.timeoutMs > 0 && (this.nowMs() - this.startTimeMs) >= this.timeoutMs) {
      return SolveStatus.TIMEOUT;
    }
    if (this.nodeLimit > 0 && this.nodes >= this.nodeLimit) {
      return SolveStatus.NODE_LIMIT;
    }
    return null;
  }

  public checkLimitAndRemember(): SolveStatus | null {
    this.earlyStatus = this.limitHit();
    return this.earlyStatus;
  }

  public buildStats(elapsedMs: number): SolveStats {
    return {
      conflicts: this.conflicts,
      guessCount: this.guessCount,
      maxDepth: this.maxDepth,
      nodes: this.nodes,
      hiddenSingles: this.hiddenSingles,
      lockedCandidateElims: this.lockedCandidateElims,
      hiddenPairElims: this.hiddenPairElims,
      elapsedMs,
    };
  }

  public makeResult(
    status: SolveStatus,
    solutionCount: number,
    solution81: Uint8Array | null,
    difficulty: Difficulty | null,
    elapsedMs: number
  ): SolveResult {
    return {
      status,
      solutionCount,
      solution81,
      difficulty,
      stats: this.buildStats(elapsedMs),
    };
  }
}
