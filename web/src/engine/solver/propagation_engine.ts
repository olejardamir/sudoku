import { bitIndexLow, isSingle32, lowbit32 } from "./solver_shared.ts";
import { SolverMetrics } from "./solver_metrics.ts";
import { RuleSet } from "./solver_rules.ts";
import { SolverState } from "./solver_state.ts";

export const PropagationResult = {
  OK: 0,
  CONTRADICTION: 1,
  LIMIT_HIT: 2,
} as const;

export type PropagationResult = (typeof PropagationResult)[keyof typeof PropagationResult];

export class PropagationEngine {
  private readonly state: SolverState;
  private readonly rules: RuleSet;
  private readonly metrics: SolverMetrics;

  constructor(state: SolverState, rules: RuleSet, metrics: SolverMetrics) {
    this.state = state;
    this.rules = rules;
    this.metrics = metrics;
  }

  public propagate(heavy: boolean): PropagationResult {
    do {
      this.state.propChanged = false;

      if (this.metrics.checkLimitAndRemember()) return PropagationResult.LIMIT_HIT;

      while (true) {
        const c = this.state.popDirtyCell();
        if (c === -1) break;

        if (this.metrics.checkLimitAndRemember()) return PropagationResult.LIMIT_HIT;

        const m = this.state.CELL_MASK[c];
        if (m === 0) return PropagationResult.CONTRADICTION;

        if (isSingle32(m)) {
          const d = bitIndexLow(lowbit32(m));
          if (!this.state.eliminateDigitFromPeers(c, d)) return PropagationResult.CONTRADICTION;
        }
      }

      const unitsToCheck = this.state.takeDirtyUnits();

      let limitHit = false;
      const checkLimit = () => {
        if (this.metrics.checkLimitAndRemember()) {
          limitHit = true;
          return true;
        }
        return false;
      };

      if (!this.rules.applyHiddenSingles(unitsToCheck, checkLimit)) {
        return PropagationResult.CONTRADICTION;
      }
      if (limitHit) return PropagationResult.LIMIT_HIT;

      if (!this.rules.applyLockedCandidates(unitsToCheck)) {
        return PropagationResult.CONTRADICTION;
      }

      if (heavy) {
        if (!this.rules.applyHiddenPairs(unitsToCheck)) {
          return PropagationResult.CONTRADICTION;
        }
      }
    } while (this.state.propChanged);

    return PropagationResult.OK;
  }
}
