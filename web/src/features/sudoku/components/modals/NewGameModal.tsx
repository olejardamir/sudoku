import type { Difficulty } from "../../types";
import { Modal } from "../../../../shared/components/Modal/Modal";
import type { Symmetry } from "../../../../engine/generator/generator_utils.ts";

type NewGameModalProps = {
  isOpen: boolean;
  pendingDifficulty: Difficulty;
  pendingSymmetry: Symmetry;
  onChangeDifficulty: (difficulty: Difficulty) => void;
  onChangeSymmetry: (symmetry: Symmetry) => void;
  onConfirm: () => void;
  onCancel: () => void;
};

const DIFFICULTIES: Difficulty[] = ["EASY", "MEDIUM", "HARD", "SAMURAI"];
const SYMMETRIES: Array<{ label: string; value: Symmetry }> = [
  { label: "NONE", value: "NONE" },
  { label: "ROT180", value: "ROT180" },
  { label: "ROT90", value: "ROT90" },
  { label: "MIRROR_XY", value: "MIRROR_XY" },
];

export function NewGameModal({
  isOpen,
  pendingDifficulty,
  pendingSymmetry,
  onChangeDifficulty,
  onChangeSymmetry,
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
      <div className="difficulty">
        {SYMMETRIES.map((sym) => (
          <label key={sym.value}>
            <input
              type="radio"
              checked={pendingSymmetry === sym.value}
              onChange={() => onChangeSymmetry(sym.value)}
            />
            {sym.label}
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
