import React from "react";

type Props = {
  isSolvedView: boolean;
  onNewGame: () => void;
  onSolve: () => void;
};

export const Controls: React.FC<Props> = ({
  isSolvedView,
  onNewGame,
  onSolve
}) => {
  return (
    <div className="controls">
      <div className="buttons">
        <button onClick={onNewGame}>New Puzzle</button>
        {!isSolvedView && (
          <>
            <button disabled>Load Puzzle</button>
            <button disabled>Save Puzzle</button>
            <button onClick={onSolve}>Solve Puzzle</button>
          </>
        )}
      </div>
    </div>
  );
};
