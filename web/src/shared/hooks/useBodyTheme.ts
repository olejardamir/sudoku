import { useEffect } from "react";
import { getThemeClass, THEME_CLASSES } from "../../config/themes";
import type { Difficulty } from "../../features/sudoku/types";

type UseBodyThemeOptions = {
  viewMode: "start" | "playing" | "victory";
  difficulty: Difficulty;
  isBackgroundOn: boolean;
};

export function useBodyTheme({
  viewMode,
  difficulty,
  isBackgroundOn,
}: UseBodyThemeOptions): void {
  useEffect(() => {
    document.body.classList.remove(...THEME_CLASSES);
    document.body.classList.toggle("bg-off", !isBackgroundOn);
    document.body.classList.add(getThemeClass(viewMode, difficulty));
  }, [difficulty, isBackgroundOn, viewMode]);
}
