import React from "react";

type Props = {
  isStartView: boolean;
  isSolvedView: boolean;
  onNewGame: () => void;
  onLoad: () => void;
  onSave: () => void;
  onSolve: () => void;
};

export const Controls: React.FC<Props> = ({
  isStartView,
  isSolvedView,
  onNewGame,
  onLoad,
  onSave,
  onSolve
}) => {
  return (
    <div className={`controls ${isStartView ? "start" : ""}`}>
      <div className="buttons">
        <button onClick={onNewGame}>New Puzzle</button>
        {!isSolvedView && (
          <>
            {isStartView ? (
              <div className="secondary-buttons">
                <button onClick={onLoad}>Load Puzzle</button>
              </div>
            ) : (
              <>
                <button onClick={onLoad}>Load Puzzle</button>
                <button onClick={onSave}>Save Puzzle</button>
                <button onClick={onSolve}>Solve Puzzle</button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};
