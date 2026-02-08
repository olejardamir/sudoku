import { useRef, useState } from "react";
import { SudokuBoard } from "./components/SudokuBoard";
import type { Cell, Difficulty, SudokuBoardHandle } from "./features/sudoku/types";
import { Controls } from "./components/Controls";
import { NewGameModal } from "./features/sudoku/components/modals/NewGameModal";
import { SaveModal } from "./features/sudoku/components/modals/SaveModal";
import { WelcomeModal } from "./features/sudoku/components/modals/WelcomeModal";
import { useAutoVictory } from "./features/sudoku/hooks/useAutoVictory";
import { useSudokuActions } from "./features/sudoku/hooks/useSudokuActions";
import type { ActiveModal, ViewMode } from "./features/sudoku/hooks/useSudokuActions";
import { useBodyTheme } from "./shared/hooks/useBodyTheme";
import { useAudioController } from "./shared/hooks/useAudioController";
import { useLocalStorageState } from "./shared/hooks/useLocalStorageState";

export default function App() {
  const [difficulty, setDifficulty] = useLocalStorageState<Difficulty>("difficulty", "EASY");
  const [pendingDifficulty, setPendingDifficulty] =
    useState<Difficulty>(difficulty);
  const [loadedGrid, setLoadedGrid] = useState<Cell[][] | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("start");
  const [activeModal, setActiveModal] = useState<ActiveModal>("welcome");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const boardRef = useRef<SudokuBoardHandle | null>(null);
  const [isBackgroundOn, setIsBackgroundOn] = useState(true);
  const [isMusicOn, setIsMusicOn] = useState(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const getCurrentGrid = () => {
    if (boardRef.current) {
      return boardRef.current.getGrid();
    }
    return loadedGrid;
  };

  const autoVictory = useAutoVictory({
    viewMode,
    onVictory: (solvedGrid) => {
      setLoadedGrid(solvedGrid);
      setViewMode("victory");
    },
  });

  const {
    newGame,
    confirmNewGame,
    solve,
    saveAsIs,
    saveWithMetadata,
    handleFileChosen,
  } = useSudokuActions({
    getGrid: getCurrentGrid,
    setLoadedGrid,
    setDifficulty,
    setPendingDifficulty,
    setViewMode,
    setActiveModal,
    skipNextAutoVictory: autoVictory.skipNextAutoVictory,
    resetSkip: autoVictory.resetSkip,
  });

  useBodyTheme({ viewMode, difficulty, isBackgroundOn });
  useAudioController({ audioRef, viewMode, difficulty, isMusicOn });

  const isSolvedView = viewMode === "victory";
  const isStartView = viewMode === "start";

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
          onGridUpdate={autoVictory.onGridUpdate}
        />
      )}
      {!isSolvedView && !isStartView && (
        <textarea className="notes" placeholder="Notes..." rows={4} />
      )}
      <Controls
        isStartView={isStartView}
        isSolvedView={isSolvedView}
        onNewGame={() => newGame(difficulty)}
        onLoad={() => fileInputRef.current?.click()}
        onSave={() => setActiveModal("save")}
        onSolve={solve}
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
      />
      <input
        ref={fileInputRef}
        type="file"
        accept=".txt"
        className="file-input"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          await handleFileChosen(file ?? null);
          e.target.value = "";
        }}
      />
      <NewGameModal
        isOpen={activeModal === "newGame"}
        pendingDifficulty={pendingDifficulty}
        onChangeDifficulty={setPendingDifficulty}
        onConfirm={() => confirmNewGame(pendingDifficulty)}
        onCancel={() => setActiveModal(null)}
      />
      <SaveModal
        isOpen={activeModal === "save"}
        onSaveWithMetadata={saveWithMetadata}
        onSaveAsIs={saveAsIs}
        onCancel={() => setActiveModal(null)}
      />
      {isStartView && (
        <WelcomeModal
          isOpen={activeModal === "welcome"}
          onConfirm={() => {
            setActiveModal(null);
            setIsMusicOn(true);
            audioRef.current?.play().catch(() => {});
          }}
        />
      )}
    </div>
  );
}
