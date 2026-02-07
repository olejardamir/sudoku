import React, { useEffect, useState } from "react";
import { SudokuBoard } from "./components/SudokuBoard";
import type { Difficulty } from "./components/SudokuBoard";
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
  const [isSolvedView, setIsSolvedView] = useState(false);
  const [isStartView, setIsStartView] = useState(true);
  const [showNewGameModal, setShowNewGameModal] = useState(false);

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
        onSolve={() => {
          setSolveSignal((v) => v + 1);
          setIsSolvedView(true);
          setIsStartView(false);
        }}
      />
      {showNewGameModal && (
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
        </div>
      )}
    </div>
  );
}
