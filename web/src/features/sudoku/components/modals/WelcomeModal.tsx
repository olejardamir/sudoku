import { Modal } from "../../../../shared/components/Modal/Modal";

type WelcomeModalProps = {
  isOpen: boolean;
  onConfirm: () => void;
};

export function WelcomeModal({ isOpen, onConfirm }: WelcomeModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      titleId="welcome-title"
      closeOnOverlayClick={false}
      closeOnEsc={false}
    >
      <h2 id="welcome-title">Welcome to Sudoku Master, version 1 by Damir Olejar</h2>
      <div className="modal-actions">
        <button className="modal-ok" onClick={onConfirm}>
          OK
        </button>
      </div>
    </Modal>
  );
}
