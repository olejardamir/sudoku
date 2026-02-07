import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { SudokuBoard } from "./components/SudokuBoard";
import type { Cell, Difficulty } from "./components/SudokuBoard";
import { Controls } from "./components/Controls";
import "./styles/sudoku.css";
import "./styles/easy.css";
import "./styles/medium.css";
import "./styles/hard.css";
import "./styles/samurai.css";
import "./styles/victory.css";
import "./styles/start.css";

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
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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
      "theme-start"
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
  }, [difficulty, isSolvedView, isStartView]);

  return (
    <div className="app">
      <h1 className="title">Sudoku Master 2026</h1>
      {isSolvedView ? (
        <div className="difficulty victory-text">VICTORY</div>
      ) : (
        <div className="difficulty">
          {(["EASY", "MEDIUM", "HARD", "SAMURAI"] as Difficulty[]).map((d) => (
            <label key={d}>
              <input
                type="radio"
                checked={difficulty === d}
                onChange={() => {
                  setDifficulty(d);
                  setIsStartView(false);
                }}
              />
              {d}
            </label>
          ))}
        </div>
      )}
      {!isStartView && (
        <SudokuBoard
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
          const cells: Cell[] = Array.from({ length: 81 }, (_, i) => {
            const ch = normalized[i] ?? "";
            if (/^[1-9]$/.test(ch)) {
              return { value: Number(ch), fixed: true };
            }
            return { value: null, fixed: false };
          });
          const grid: Cell[][] = Array.from({ length: 9 }, (_, r) =>
            cells.slice(r * 9, r * 9 + 9)
          );
          const difficulties: Difficulty[] = [
            "EASY",
            "MEDIUM",
            "HARD",
            "SAMURAI"
          ];
          setDifficulty(
            difficulties[Math.floor(Math.random() * difficulties.length)]
          );
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
                    setDifficulty(pendingDifficulty);
                    setIsSolvedView(false);
                    setIsStartView(false);
                    setNewGameSignal((v) => v + 1);
                    setShowNewGameModal(false);
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
    </div>
  );
}
