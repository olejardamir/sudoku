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
  const [solveSignal, setSolveSignal] = useState(0);
  const [newGameSignal, setNewGameSignal] = useState(0);
  const [loadedGrid, setLoadedGrid] = useState<Cell[][] | null>(null);
  const [isSolvedView, setIsSolvedView] = useState(false);
  const [isStartView, setIsStartView] = useState(true);
  const [showNewGameModal, setShowNewGameModal] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const boardRef = useRef<SudokuBoardHandle | null>(null);

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

  const buildSaveText = () => {
    const board = boardRef.current;
    if (!board) {
      return null;
    }
    const grid = board.getGrid();
    return grid
      .map((row) =>
        row
          .map((cell) =>
            cell.value && cell.value >= 1 && cell.value <= 9
              ? String(cell.value)
              : "."
          )
          .join("")
      )
      .join("\n");
  };

  const savePuzzle = async () => {
    const text = buildSaveText();
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
  }, [difficulty, isSolvedView, isStartView]);

  return (
    <div className="app">
      <h1 className="title">Sudoku Master 2026</h1>
      {isSolvedView && <div className="difficulty victory-text">VICTORY</div>}
      {!isStartView && (
        <SudokuBoard
          ref={boardRef}
          allowEditFixed={difficulty === "NEUTRAL"}
          loadedGrid={loadedGrid}
          newGameSignal={newGameSignal}
          solveSignal={solveSignal}
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
          setSolveSignal((v) => v + 1);
          setIsSolvedView(true);
          setIsStartView(false);
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
          const normalized = text.replace(/\s+/g, "");
          const grid81 = new Uint8Array(81);
          const cells: Cell[] = Array.from({ length: 81 }, (_, i) => {
            const ch = normalized[i] ?? "";
            if (/^[1-9]$/.test(ch)) {
              const value = Number(ch);
              grid81[i] = value;
              return { value, fixed: true };
            }
            grid81[i] = 0;
            return { value: null, fixed: false };
          });
          const grid: Cell[][] = Array.from({ length: 9 }, (_, r) =>
            cells.slice(r * 9, r * 9 + 9)
          );
          setDifficulty(evaluateDifficulty(grid81));
          setLoadedGrid(grid);
          setIsSolvedView(false);
          setIsStartView(false);
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
                      setIsSolvedView(false);
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
                Difficulty will be relevant to the saved puzzle (not the chosen
                difficulty).
              </p>
              <div className="modal-actions">
                <button
                  className="modal-ok"
                  onClick={async () => {
                    await savePuzzle();
                    setShowSaveModal(false);
                  }}
                >
                  OK
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
    </div>
  );
}
