import type { Difficulty } from "../../types";
import { Modal } from "../../../../shared/components/Modal/Modal";

type NewGameModalProps = {
  isOpen: boolean;
  pendingDifficulty: Difficulty;
  onChangeDifficulty: (difficulty: Difficulty) => void;
  onConfirm: () => void;
  onCancel: () => void;
};

const DIFFICULTIES: Difficulty[] = ["EASY", "MEDIUM", "HARD", "SAMURAI"];

export function NewGameModal({
  isOpen,
  pendingDifficulty,
  onChangeDifficulty,
  onConfirm,
  onCancel,
}: NewGameModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      titleId="new-game-title"
    >
      <h2 id="new-game-title">Select difficulty and press OK</h2>
      <div className="difficulty">
        {DIFFICULTIES.map((d) => (
          <label key={d}>
            <input
              type="radio"
              checked={pendingDifficulty === d}
              onChange={() => onChangeDifficulty(d)}
            />
            {d}
          </label>
        ))}
      </div>
      <div className="modal-actions">
        <button className="modal-ok" onClick={onConfirm}>
          OK
        </button>
        <button className="modal-cancel" onClick={onCancel}>
          CANCEL
        </button>
      </div>
    </Modal>
  );
}
