import { Difficulty as EngineDifficulty } from "../../../engine/solver/solver.ts";
import type { Difficulty } from "../types";

export function toEngineDifficulty(d: Difficulty): EngineDifficulty {
  switch (d) {
    case "EASY":
      return EngineDifficulty.EASY;
    case "MEDIUM":
      return EngineDifficulty.MEDIUM;
    case "HARD":
      return EngineDifficulty.HARD;
    case "SAMURAI":
      return EngineDifficulty.SAMURAI;
    case "NEUTRAL":
    default:
      return EngineDifficulty.MEDIUM;
  }
}

export function fromEngineDifficulty(d: EngineDifficulty): Difficulty {
  switch (d) {
    case EngineDifficulty.EASY:
      return "EASY";
    case EngineDifficulty.MEDIUM:
      return "MEDIUM";
    case EngineDifficulty.HARD:
      return "HARD";
    case EngineDifficulty.SAMURAI:
    default:
      return "SAMURAI";
  }
}
