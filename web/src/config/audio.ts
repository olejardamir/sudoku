import type { Difficulty } from "../features/sudoku/types";

export type AudioView = "START" | "UNKNOWN" | "EASY" | "MEDIUM" | "HARD" | "SAMURAI" | "VICTORY";

export const AUDIO_SOURCES: Record<AudioView, string> = {
  START: "/music/START.mp3",
  UNKNOWN: "/music/START.mp3",
  EASY: "/music/EASY.mp3",
  MEDIUM: "/music/MEDIUM.mp3",
  HARD: "/music/HARD.mp3",
  SAMURAI: "/music/SAMURAI.mp3",
  VICTORY: "/music/VICTORY.mp3",
};

export const AUDIO_FALLBACKS: Record<AudioView, string> = {
  START:
    "https://github.com/olejardamir/sudoku/raw/refs/heads/main/web/public/music/START.mp3",
  UNKNOWN:
    "https://github.com/olejardamir/sudoku/raw/refs/heads/main/web/public/music/START.mp3",
  EASY:
    "https://github.com/olejardamir/sudoku/raw/refs/heads/main/web/public/music/EASY.mp3",
  MEDIUM:
    "https://github.com/olejardamir/sudoku/raw/refs/heads/main/web/public/music/MEDIUM.mp3",
  HARD:
    "https://github.com/olejardamir/sudoku/raw/refs/heads/main/web/public/music/HARD.mp3",
  SAMURAI:
    "https://github.com/olejardamir/sudoku/raw/refs/heads/main/web/public/music/SAMURAI.mp3",
  VICTORY:
    "https://github.com/olejardamir/sudoku/raw/refs/heads/main/web/public/music/VICTORY.mp3",
};

export function getAudioView(viewMode: "start" | "playing" | "victory", difficulty: Difficulty): AudioView {
  if (viewMode === "victory") return "VICTORY";
  if (viewMode === "start") return "START";
  if (difficulty === "NEUTRAL") return "UNKNOWN";
  return difficulty;
}
