import { ReactNode } from "react";
interface ModalProps {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}
export default function Modal({
  visible,
  title,
  onClose,
  children,
  footer,
}: ModalProps) {
  if (!visible) return null;
  return (
    <div className="modal-mask" onClick={onClose}>
      {" "}
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        {" "}
        <div className="modal-header">
          {" "}
          <span className="modal-title">{title}</span>{" "}
          <button className="modal-close" onClick={onClose}>
            ×
          </button>{" "}
        </div>{" "}
        <div className="modal-body">{children}</div>{" "}
        {footer && <div className="modal-footer">{footer}</div>}{" "}
      </div>{" "}
      <style>{`        .modal-mask {          position: fixed; inset: 0;          background: rgba(30, 27, 75, 0.5);          backdrop-filter: blur(4px);          display: flex; align-items: center; justify-content: center;          z-index: 1000;          animation: fadeIn 0.2s;        }        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }        .modal-box {          background: white;          border-radius: 16px;          width: 420px;          max-width: 90vw;          box-shadow: 0 16px 48px rgba(30, 27, 75, 0.25);          overflow: hidden;          animation: slideUp 0.25s cubic-bezier(0.4, 0, 0.2, 1);        }        @keyframes slideUp { from { transform: translateY(20px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }        .modal-header {          padding: 16px 20px;          border-bottom: 1px solid #F3F4F6;          display: flex; align-items: center; justify-content: space-between;        }        .modal-title { font-size: 16px; font-weight: 600; color: #1E1B4B; }        .modal-close {          width: 28px; height: 28px;          border-radius: 6px;          font-size: 22px;          color: #9CA3AF;          transition: all 0.15s;        }        .modal-close:hover { background: #F1F0F7; color: #1E1B4B; }        .modal-body { padding: 20px; }        .modal-footer {          padding: 12px 20px 16px;          display: flex; justify-content: flex-end; gap: 8px;        }      `}</style>{" "}
    </div>
  );
}
