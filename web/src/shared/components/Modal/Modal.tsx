import { useEffect } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";

type ModalProps = {
  isOpen: boolean;
  onClose?: () => void;
  titleId: string;
  children: ReactNode;
  closeOnEsc?: boolean;
  closeOnOverlayClick?: boolean;
};

export function Modal({
  isOpen,
  onClose,
  titleId,
  children,
  closeOnEsc = true,
  closeOnOverlayClick = true,
}: ModalProps) {
  useEffect(() => {
    if (!isOpen || !closeOnEsc) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose?.();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [closeOnEsc, isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="modal-overlay"
      onClick={closeOnOverlayClick ? onClose : undefined}
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}
