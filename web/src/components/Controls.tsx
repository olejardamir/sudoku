import React from "react";

type Props = {
  isStartView: boolean;
  isSolvedView: boolean;
  onNewGame: () => void;
  onSolve: () => void;
};

export const Controls: React.FC<Props> = ({
  isStartView,
  isSolvedView,
  onNewGame,
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
                <button disabled>Load Puzzle</button>
              </div>
            ) : (
              <>
                <button disabled>Load Puzzle</button>
                <button disabled>Save Puzzle</button>
                <button onClick={onSolve}>Solve Puzzle</button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};
