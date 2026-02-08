import type { Difficulty } from "../features/sudoku/types";

export const THEME_CLASSES = [
  "theme-easy",
  "theme-medium",
  "theme-hard",
  "theme-samurai",
  "theme-victory",
  "theme-start",
  "theme-neutral",
];

export function getThemeClass(
  viewMode: "start" | "playing" | "victory",
  difficulty: Difficulty
): string {
  if (viewMode === "victory") return "theme-victory";
  if (viewMode === "start") return "theme-start";
  if (difficulty === "EASY") return "theme-easy";
  if (difficulty === "MEDIUM") return "theme-medium";
  if (difficulty === "HARD") return "theme-hard";
  if (difficulty === "SAMURAI") return "theme-samurai";
  return "theme-neutral";
}
