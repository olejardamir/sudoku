import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { SudokuBoard } from "./components/SudokuBoard";
import type { SudokuBoardHandle } from "./components/SudokuBoard";
import type { Cell, Difficulty } from "./components/SudokuBoard";
import { Controls } from "./components/Controls";
import { generateSudoku, Symmetry } from "./engine/generator";
import {
  Difficulty as EngineDifficulty,
  SolveStatus,
  SudokuSolver,
  generateMasks
} from "./engine/solver";
import "./styles/sudoku.css";
import "./styles/easy.css";
import "./styles/medium.css";
import "./styles/hard.css";
import "./styles/samurai.css";
import "./styles/victory.css";
import "./styles/start.css";
import "./styles/neutral.css";

export default function App() {
  const [difficulty, setDifficulty] = useState<Difficulty>(() => {
    return (localStorage.getItem("difficulty") as Difficulty) || "EASY";
  });
  const [pendingDifficulty, setPendingDifficulty] =
    useState<Difficulty>(difficulty);
  const [newGameSignal, setNewGameSignal] = useState(0);
  const [loadedGrid, setLoadedGrid] = useState<Cell[][] | null>(null);
  const [isSolvedView, setIsSolvedView] = useState(false);
  const [isStartView, setIsStartView] = useState(true);
  const [showNewGameModal, setShowNewGameModal] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const boardRef = useRef<SudokuBoardHandle | null>(null);
  const [isBackgroundOn, setIsBackgroundOn] = useState(true);
  const [gridStatus, setGridStatus] = useState({
    isComplete: false,
    hasConflicts: false
  });
  const [isMusicOn, setIsMusicOn] = useState(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [showWelcomeModal, setShowWelcomeModal] = useState(true);
  const pauseTimerRef = useRef<number | null>(null);
  const skipAutoVictoryRef = useRef(false);

  const clearPauseTimer = () => {
    if (pauseTimerRef.current !== null) {
      window.clearTimeout(pauseTimerRef.current);
      pauseTimerRef.current = null;
    }
  };

  const toEngineDifficulty = (d: Difficulty): EngineDifficulty => {
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
  };

  const fromEngineDifficulty = (d: EngineDifficulty): Difficulty => {
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
  };

  const createDeterministicSolver = () => {
    const solver = new SudokuSolver(generateMasks());
    solver.clearLimits();
    solver.enableHeavyRules(true);
    solver.enableRandomMRVTieBreak(false);
    solver.enableRandomValueChoice(false);
    return solver;
  };

  const evaluateDifficulty = (grid81: Uint8Array): Difficulty => {
    const solverUniq = createDeterministicSolver();
    if (!solverUniq.loadGrid81(grid81)) {
      return "NEUTRAL";
    }
    const uniq = solverUniq.countSolutions(2);
    if (uniq.status !== SolveStatus.UNIQUE) {
      return "NEUTRAL";
    }
    const solverDiff = createDeterministicSolver();
    if (!solverDiff.loadGrid81(grid81)) {
      return "NEUTRAL";
    }
    const diff = solverDiff.solveStopAtOne();
    if (diff.status !== SolveStatus.UNIQUE || diff.difficulty === null) {
      return "NEUTRAL";
    }
    return fromEngineDifficulty(diff.difficulty);
  };

  const solveFromFixed = (): Cell[][] | null => {
    const board = boardRef.current;
    if (!board) {
      return null;
    }
    const grid = board.getGrid();
    const grid81 = new Uint8Array(81);
    for (let r = 0; r < 9; r += 1) {
      for (let c = 0; c < 9; c += 1) {
        const cell = grid[r][c];
        const i = r * 9 + c;
        grid81[i] = cell.fixed && cell.value ? cell.value : 0;
      }
    }
    const solver = createDeterministicSolver();
    if (!solver.loadGrid81(grid81)) {
      return null;
    }
    const res = solver.solveStopAtOne();
    if (!res.solution81) {
      return null;
    }
    const cells: Cell[] = Array.from(res.solution81, (v) => ({
      value: v > 0 ? v : null,
      fixed: true
    }));
    return Array.from({ length: 9 }, (_, r) =>
      cells.slice(r * 9, r * 9 + 9)
    );
  };

  useEffect(() => {
    if (
      isStartView ||
      isSolvedView ||
      !gridStatus.isComplete ||
      gridStatus.hasConflicts ||
      skipAutoVictoryRef.current
    ) {
      return;
    }
    const board = boardRef.current;
    if (!board) {
      return;
    }
    const grid = board.getGrid();
    const grid81 = new Uint8Array(81);
    for (let r = 0; r < 9; r += 1) {
      for (let c = 0; c < 9; c += 1) {
        const cell = grid[r][c];
        const i = r * 9 + c;
        grid81[i] = cell.value ? cell.value : 0;
      }
    }
    const solver = createDeterministicSolver();
    if (!solver.loadGrid81(grid81)) {
      return;
    }
    const res = solver.solveStopAtOne();
    if (!res.solution81) {
      return;
    }
    for (let i = 0; i < 81; i += 1) {
      if (grid81[i] !== res.solution81[i]) {
        return;
      }
    }
    const cells: Cell[] = Array.from(res.solution81, (v) => ({
      value: v > 0 ? v : null,
      fixed: true
    }));
    const solvedGrid: Cell[][] = Array.from({ length: 9 }, (_, r) =>
      cells.slice(r * 9, r * 9 + 9)
    );
    setLoadedGrid(solvedGrid);
    setIsSolvedView(true);
    setIsStartView(false);
  }, [gridStatus, isStartView, isSolvedView]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }
    const view = isSolvedView
      ? "VICTORY"
      : isStartView
        ? "START"
        : difficulty === "NEUTRAL"
          ? "UNKNOWN"
          : difficulty;
    const sources: Record<string, string> = {
      START: "/music/START.mp3",
      UNKNOWN: "/music/START.mp3",
      EASY: "/music/EASY.mp3",
      MEDIUM: "/music/MEDIUM.mp3",
      HARD: "/music/HARD.mp3",
      SAMURAI: "/music/SAMURAI.mp3",
      VICTORY: "/music/VICTORY.mp3"
    };
    const fallbacks: Record<string, string> = {
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
        "https://github.com/olejardamir/sudoku/raw/refs/heads/main/web/public/music/VICTORY.mp3"
    };
    const localSrc = sources[view];
    const fallbackSrc = fallbacks[view];
    audio.src = localSrc;
    audio.dataset.fallback = fallbackSrc;
    audio.dataset.triedFallback = "false";
    audio.load();
    clearPauseTimer();
    if (isMusicOn) {
      audio.play().catch(() => {});
    }
  }, [difficulty, isSolvedView, isStartView]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }
    if (isMusicOn) {
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
    if (!isMusicOn) {
      clearPauseTimer();
    }
  }, [isMusicOn]);

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
  }, [isMusicOn, difficulty, isSolvedView, isStartView]);

  const getCurrentGrid = (): Cell[][] | null => {
    if (boardRef.current) {
      return boardRef.current.getGrid();
    }
    return loadedGrid;
  };

  const buildSaveText = () => {
    const grid = getCurrentGrid();
    if (!grid) {
      return null;
    }
    return grid
      .map((row) =>
        row
          .map((cell) =>
            cell.value !== null && cell.value >= 1 && cell.value <= 9
              ? String(cell.value)
              : "."
          )
          .join("")
      )
      .join("\n");
  };

  const buildWinningSaveText = () => {
    const grid = getCurrentGrid();
    if (!grid) {
      return null;
    }
    const grid81 = new Uint8Array(81);
    for (let r = 0; r < 9; r += 1) {
      for (let c = 0; c < 9; c += 1) {
        const cell = grid[r][c];
        const i = r * 9 + c;
        grid81[i] = cell.fixed && cell.value ? cell.value : 0;
      }
    }
    const solver = createDeterministicSolver();
    if (!solver.loadGrid81(grid81)) {
      return null;
    }
    const res = solver.solveStopAtOne();
    if (!res.solution81) {
      return null;
    }
    return grid
      .map((row, r) =>
        row
          .map((cell, c) => {
            const i = r * 9 + c;
            const solved = res.solution81[i];
            return cell.value === solved ? String(solved) : ".";
          })
          .join("")
      )
      .join("\n");
  };

  const buildMetadataSaveText = () => {
    const grid = getCurrentGrid();
    if (!grid) {
      return null;
    }
    const puzzleLines = grid.map((row) =>
      row
        .map((cell) =>
          cell.value !== null && cell.value >= 1 && cell.value <= 9
            ? String(cell.value)
            : "."
        )
        .join("")
    );
    const metaLines = grid.map((row) =>
      row.map((cell) => (cell.fixed ? "1" : "0")).join("")
    );
    return [...puzzleLines, ...metaLines].join("\n");
  };

  const savePuzzle = async (text: string | null) => {
    if (text === null) {
      return;
    }
    const fileName = "sudoku.txt";
    // Prefer the native save file picker when available.
    if ("showSaveFilePicker" in window) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const picker = (window as any).showSaveFilePicker;
      const handle = await picker({
        suggestedName: fileName,
        types: [
          {
            description: "Text Files",
            accept: { "text/plain": [".txt"] }
          }
        ]
      });
      const writable = await handle.createWritable();
      await writable.write(text);
      await writable.close();
      return;
    }
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    localStorage.setItem("difficulty", difficulty);
  }, [difficulty]);

  useEffect(() => {
    document.body.classList.remove(
      "theme-easy",
      "theme-medium",
      "theme-hard",
      "theme-samurai",
      "theme-victory",
      "theme-start",
      "theme-neutral"
    );
    document.body.classList.toggle("bg-off", !isBackgroundOn);
    if (isSolvedView) {
      document.body.classList.add("theme-victory");
      return;
    }
    if (isStartView) {
      document.body.classList.add("theme-start");
      return;
    }
    if (difficulty === "EASY") {
      document.body.classList.add("theme-easy");
    }
    if (difficulty === "MEDIUM") {
      document.body.classList.add("theme-medium");
    }
    if (difficulty === "HARD") {
      document.body.classList.add("theme-hard");
    }
    if (difficulty === "SAMURAI") {
      document.body.classList.add("theme-samurai");
    }
    if (difficulty === "NEUTRAL") {
      document.body.classList.add("theme-neutral");
    }
  }, [difficulty, isSolvedView, isStartView, isBackgroundOn]);

  return (
    <div className="app">
      <h1 className="title">Sudoku Master</h1>
      {!isStartView && (
        <div className="difficulty-label">
          Difficulty: {difficulty === "NEUTRAL" ? "UNKNOWN" : difficulty}
        </div>
      )}
      {isSolvedView && <div className="difficulty victory-text">VICTORY</div>}
      {!isStartView && (
        <SudokuBoard
          ref={boardRef}
          allowEditFixed={difficulty === "NEUTRAL"}
          loadedGrid={loadedGrid}
          newGameSignal={newGameSignal}
          onGridUpdate={(grid, hasConflicts, isComplete) => {
            setGridStatus({ hasConflicts, isComplete });
            if (!isComplete || hasConflicts) {
              skipAutoVictoryRef.current = false;
            }
          }}
        />
      )}
      {!isSolvedView && !isStartView && (
        <textarea className="notes" placeholder="Notes..." rows={4} />
      )}
      <Controls
        isStartView={isStartView}
        isSolvedView={isSolvedView}
        onNewGame={() => {
          setPendingDifficulty(difficulty);
          setShowNewGameModal(true);
        }}
        onLoad={() => fileInputRef.current?.click()}
        onSave={() => setShowSaveModal(true)}
        onSolve={() => {
          const solved = solveFromFixed();
          if (!solved) {
            return;
          }
          setLoadedGrid(solved);
          setIsSolvedView(true);
          setIsStartView(false);
        }}
      />
      <div className="toggle-row">
        <button
          className="bg-toggle"
          title="Toggle Background"
          onClick={() => setIsBackgroundOn((v) => !v)}
        >
          {isBackgroundOn ? "Background: ON" : "Background: OFF"}
        </button>
        <button
          className="music-toggle"
          title="Toggle Music"
          onClick={() => setIsMusicOn((v) => !v)}
        >
          {isMusicOn ? "Music: ON" : "Music: OFF"}
        </button>
      </div>
      <audio
        ref={audioRef}
        onEnded={() => {
          clearPauseTimer();
          pauseTimerRef.current = window.setTimeout(() => {
            const audio = audioRef.current;
            if (!audio || !isMusicOn) {
              return;
            }
            audio.currentTime = 0;
            audio.play().catch(() => {});
          }, 3 * 60 * 1000);
        }}
        onError={(e) => {
          const audio = e.currentTarget;
          const fallback = audio.dataset.fallback;
          const tried = audio.dataset.triedFallback === "true";
          if (!fallback || tried) {
            return;
          }
          audio.dataset.triedFallback = "true";
          audio.src = fallback;
          audio.load();
          if (isMusicOn) {
            audio.play().catch(() => {});
          }
        }}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept=".txt"
        className="file-input"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) {
            return;
          }
          const text = await file.text();
          const lines = text
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter((line) => line.length > 0);
          const hasMetadata = lines.length >= 18;
          const puzzleLines = lines.slice(0, 9);
          const metaLines = hasMetadata ? lines.slice(9, 18) : [];
          const grid81 = new Uint8Array(81);
          const fixed81 = new Uint8Array(81);
          const cells: Cell[] = Array.from({ length: 81 }, (_, i) => {
            const r = Math.floor(i / 9);
            const c = i % 9;
            const ch = puzzleLines[r]?.[c] ?? "";
            const meta = metaLines[r]?.[c] ?? "";
            const isFixed = hasMetadata ? meta === "1" : /^[1-9]$/.test(ch);
            fixed81[i] = isFixed ? 1 : 0;
            if (/^[1-9]$/.test(ch)) {
              const value = Number(ch);
              grid81[i] = value;
              return { value, fixed: isFixed };
            }
            grid81[i] = 0;
            return { value: null, fixed: isFixed };
          });
          const grid: Cell[][] = Array.from({ length: 9 }, (_, r) =>
            cells.slice(r * 9, r * 9 + 9)
          );
          const evalGrid = hasMetadata
            ? Uint8Array.from(
                grid81.map((v, i) => (fixed81[i] === 1 ? v : 0))
              )
            : grid81;
          setDifficulty(evaluateDifficulty(evalGrid));
          setGridStatus({ isComplete: false, hasConflicts: false });
          skipAutoVictoryRef.current = true;
          setIsSolvedView(false);
          setIsStartView(false);
          setLoadedGrid(grid);
          e.target.value = "";
        }}
      />
      {showNewGameModal &&
        createPortal(
          <div
            className="modal-overlay"
            onClick={() => setShowNewGameModal(false)}
          >
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <h2>Select difficulty and press OK</h2>
              <div className="difficulty">
                {(["EASY", "MEDIUM", "HARD", "SAMURAI"] as Difficulty[]).map(
                  (d) => (
                    <label key={d}>
                      <input
                        type="radio"
                        checked={pendingDifficulty === d}
                        onChange={() => setPendingDifficulty(d)}
                      />
                      {d}
                    </label>
                  )
                )}
              </div>
              <div className="modal-actions">
                <button
                  className="modal-ok"
                  onClick={() => {
                    try {
                      setIsSolvedView(false);
                      setGridStatus({ isComplete: false, hasConflicts: false });
                      skipAutoVictoryRef.current = true;
                      const result = generateSudoku(
                        toEngineDifficulty(pendingDifficulty),
                        Symmetry.NONE,
                        Date.now() >>> 0
                      );
                      const cells: Cell[] = Array.from(
                        result.puzzle81,
                        (v) => ({
                          value: v > 0 ? v : null,
                          fixed: v > 0
                        })
                      );
                      const grid: Cell[][] = Array.from({ length: 9 }, (_, r) =>
                        cells.slice(r * 9, r * 9 + 9)
                      );
                      setLoadedGrid(grid);
                      setDifficulty(fromEngineDifficulty(result.difficulty));
                      setIsStartView(false);
                      setShowNewGameModal(false);
                    } catch (err) {
                      console.error(err);
                    }
                  }}
                >
                  OK
                </button>
                <button
                  className="modal-cancel"
                  onClick={() => setShowNewGameModal(false)}
                >
                  CANCEL
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
      {showSaveModal &&
        createPortal(
          <div
            className="modal-overlay"
            onClick={() => setShowSaveModal(false)}
          >
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <h2>Save Puzzle</h2>
              <p className="modal-note">
                Choose how to save. "With Metadata" adds 0/1 rows for static
                cells so difficulty can be computed later. "As-Is" keeps
                everything, which may be unsolvable and will open as UNKNOWN.
              </p>
              <div className="modal-actions">
                <button
                  className="modal-ok"
                  onClick={async () => {
                    await savePuzzle(buildMetadataSaveText());
                    setShowSaveModal(false);
                  }}
                >
                  With Metadata
                </button>
                <button
                  className="modal-as-is"
                  onClick={async () => {
                    await savePuzzle(buildSaveText());
                    setShowSaveModal(false);
                  }}
                >
                  As-Is
                </button>
                <button
                  className="modal-cancel"
                  onClick={() => setShowSaveModal(false)}
                >
                  CANCEL
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
      {isStartView &&
        showWelcomeModal &&
        createPortal(
          <div className="modal-overlay">
            <div className="modal">
              <h2>Welcome to Sudoku Master, version 1 by Damir Olejar</h2>
              <div className="modal-actions">
                <button
                  className="modal-ok"
                  onClick={() => {
                    setShowWelcomeModal(false);
                    setIsMusicOn(true);
                    audioRef.current?.play().catch(() => {});
                  }}
                >
                  OK
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
