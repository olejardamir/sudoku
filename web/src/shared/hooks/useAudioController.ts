import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import { AUDIO_FALLBACKS, AUDIO_SOURCES, getAudioView } from "../../config/audio";
import type { Difficulty } from "../../features/sudoku/types";

type UseAudioControllerOptions = {
  audioRef: RefObject<HTMLAudioElement | null>;
  viewMode: "start" | "playing" | "victory";
  difficulty: Difficulty;
  isMusicOn: boolean;
};

export function useAudioController({
  audioRef,
  viewMode,
  difficulty,
  isMusicOn,
}: UseAudioControllerOptions): void {
  const pauseTimerRef = useRef<number | null>(null);

  const clearPauseTimer = () => {
    if (pauseTimerRef.current !== null) {
      window.clearTimeout(pauseTimerRef.current);
      pauseTimerRef.current = null;
    }
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }
    const view = getAudioView(viewMode, difficulty);
    audio.src = AUDIO_SOURCES[view];
    audio.dataset.fallback = AUDIO_FALLBACKS[view];
    audio.dataset.triedFallback = "false";
    audio.load();
    clearPauseTimer();
    if (isMusicOn) {
      audio.play().catch(() => {});
    }
  }, [audioRef, difficulty, isMusicOn, viewMode]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }
    if (isMusicOn) {
      audio.play().catch(() => {});
    } else {
      audio.pause();
      clearPauseTimer();
    }
  }, [audioRef, isMusicOn]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !isMusicOn) {
      return;
    }
    const handleFirstInteraction = () => {
      audio.play().catch(() => {});
      window.removeEventListener("pointerdown", handleFirstInteraction);
      window.removeEventListener("keydown", handleFirstInteraction);
      window.removeEventListener("touchstart", handleFirstInteraction);
      window.removeEventListener("mouseover", handleFirstInteraction);
      window.removeEventListener("focusin", handleFirstInteraction);
    };
    window.addEventListener("pointerdown", handleFirstInteraction, { once: true });
    window.addEventListener("keydown", handleFirstInteraction, { once: true });
    window.addEventListener("touchstart", handleFirstInteraction, { once: true });
    window.addEventListener("mouseover", handleFirstInteraction, { once: true });
    window.addEventListener("focusin", handleFirstInteraction, { once: true });
    return () => {
      window.removeEventListener("pointerdown", handleFirstInteraction);
      window.removeEventListener("keydown", handleFirstInteraction);
      window.removeEventListener("touchstart", handleFirstInteraction);
      window.removeEventListener("mouseover", handleFirstInteraction);
      window.removeEventListener("focusin", handleFirstInteraction);
    };
  }, [audioRef, difficulty, isMusicOn, viewMode]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }
    const handleEnded = () => {
      clearPauseTimer();
      pauseTimerRef.current = window.setTimeout(() => {
        const el = audioRef.current;
        if (!el || !isMusicOn) {
          return;
        }
        el.currentTime = 0;
        el.play().catch(() => {});
      }, 3 * 60 * 1000);
    };
    const handleError = (event: Event) => {
      const target = event.currentTarget as HTMLAudioElement;
      const fallback = target.dataset.fallback;
      const tried = target.dataset.triedFallback === "true";
      if (!fallback || tried) {
        return;
      }
      target.dataset.triedFallback = "true";
      target.src = fallback;
      target.load();
      if (isMusicOn) {
        target.play().catch(() => {});
      }
    };
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("error", handleError);
    return () => {
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("error", handleError);
    };
  }, [audioRef, isMusicOn]);
}
