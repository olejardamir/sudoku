import { Modal } from "../../../../shared/components/Modal/Modal";

type SaveModalProps = {
  isOpen: boolean;
  onSaveWithMetadata: () => void;
  onSaveAsIs: () => void;
  onCancel: () => void;
};

export function SaveModal({
  isOpen,
  onSaveWithMetadata,
  onSaveAsIs,
  onCancel,
}: SaveModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onCancel} titleId="save-title">
      <h2 id="save-title">Save Puzzle</h2>
      <p className="modal-note">
        Choose how to save. "With Metadata" adds 0/1 rows for static
        cells so difficulty can be computed later. "As-Is" keeps
        everything, which may be unsolvable and will open as UNKNOWN.
      </p>
      <div className="modal-actions">
        <button className="modal-ok" onClick={onSaveWithMetadata}>
          With Metadata
        </button>
        <button className="modal-as-is" onClick={onSaveAsIs}>
          As-Is
        </button>
        <button className="modal-cancel" onClick={onCancel}>
          CANCEL
        </button>
      </div>
    </Modal>
  );
}
