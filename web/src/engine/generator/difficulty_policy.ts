import { Difficulty } from "../solver/solver.ts";

type DifficultyConfig = {
  minClues: number;
  probeGate: number;
  probeEvery: number;
};

const THEORETICAL_MIN_CLUES = 17;

const DIFFICULTY_CONFIG: Record<Difficulty, DifficultyConfig> = {
  [Difficulty.EASY]: { minClues: 32, probeGate: 45, probeEvery: 1 },
  [Difficulty.MEDIUM]: { minClues: 27, probeGate: 40, probeEvery: 3 },
  [Difficulty.HARD]: { minClues: 22, probeGate: 35, probeEvery: 2 },
  [Difficulty.SAMURAI]: { minClues: 17, probeGate: 30, probeEvery: 2 },
};

const ALLOW_HARD_TO_ACCEPT_SAMURAI = true;

const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  [Difficulty.EASY]: "EASY",
  [Difficulty.MEDIUM]: "MEDIUM",
  [Difficulty.HARD]: "HARD",
  [Difficulty.SAMURAI]: "SAMURAI",
};

function difficultyRank(d: Difficulty): number {
  if (d === Difficulty.EASY) return 0;
  if (d === Difficulty.MEDIUM) return 1;
  if (d === Difficulty.HARD) return 2;
  return 3;
}

export class DifficultyPolicy {
  public label(d: Difficulty): string {
    return DIFFICULTY_LABEL[d];
  }

  public minClues(target: Difficulty): number {
    return DIFFICULTY_CONFIG[target].minClues;
  }

  public floorClues(target: Difficulty): number {
    return Math.max(THEORETICAL_MIN_CLUES, this.minClues(target));
  }

  public shouldProbe(target: Difficulty, probeStep: number, clueCount: number): boolean {
    const config = DIFFICULTY_CONFIG[target];
    return probeStep % config.probeEvery === 0 && clueCount <= config.probeGate;
  }

  public isOvershoot(target: Difficulty, diff: Difficulty): boolean {
    return difficultyRank(diff) > difficultyRank(target);
  }

  public score(target: Difficulty, diff: Difficulty, clues: number): number {
    const dist = Math.abs(difficultyRank(diff) - difficultyRank(target)) * 1000;
    const minClues = this.minClues(target);
    const penalty = clues < minClues ? minClues - clues : 0;
    return dist + penalty;
  }

  public accepts(target: Difficulty, diff: Difficulty): boolean {
    return (
      diff === target ||
      (target === Difficulty.HARD &&
        diff === Difficulty.SAMURAI &&
        ALLOW_HARD_TO_ACCEPT_SAMURAI)
    );
  }
}
