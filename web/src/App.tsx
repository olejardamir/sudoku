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

export default function App() {
  const [difficulty, setDifficulty] = useState<Difficulty>(() => {
    return (localStorage.getItem("difficulty") as Difficulty) || "EASY";
  });
  const [solveSignal, setSolveSignal] = useState(0);
  const [isSolvedView, setIsSolvedView] = useState(false);

  useEffect(() => {
    localStorage.setItem("difficulty", difficulty);
  }, [difficulty]);

  useEffect(() => {
    document.body.classList.remove(
      "theme-easy",
      "theme-medium",
      "theme-hard",
      "theme-samurai",
      "theme-victory"
    );
    if (isSolvedView) {
      document.body.classList.add("theme-victory");
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
  }, [difficulty, isSolvedView]);

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
                onChange={() => setDifficulty(d)}
              />
              {d}
            </label>
          ))}
        </div>
      )}
      <SudokuBoard solveSignal={solveSignal} />
      {!isSolvedView && (
        <textarea className="notes" placeholder="Notes..." rows={4} />
      )}
      <Controls
        isSolvedView={isSolvedView}
        onNewGame={() => window.location.reload()}
        onSolve={() => {
          setSolveSignal((v) => v + 1);
          setIsSolvedView(true);
        }}
      />
    </div>
  );
}
