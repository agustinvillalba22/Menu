import React, { useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title?: string;
  itemName?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title = '¿Estás seguro que quieres eliminar?',
  itemName,
  description = 'Esta acción no se puede deshacer y el elemento se eliminará permanentemente.',
  confirmText = 'Sí, eliminar',
  cancelText = 'Cancelar',
  isDestructive = true,
  onConfirm,
  onCancel,
}) => {
  // Listen for Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-neutral-950/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        className="bg-white rounded-xl shadow-2xl border border-neutral-200 w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-150"
      >
        <div className="p-5">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-full bg-red-50 border border-red-100 flex items-center justify-center text-red-600 shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>

            <div className="flex-1 min-w-0">
              <h3
                id="confirm-dialog-title"
                className="text-sm font-semibold text-neutral-900 leading-snug"
              >
                {title}
              </h3>
              {itemName && (
                <p className="text-xs font-semibold text-neutral-800 mt-1 truncate font-mono bg-neutral-100 px-2 py-0.5 rounded">
                  {itemName}
                </p>
              )}
              <p className="text-xs text-neutral-500 mt-1.5 leading-relaxed">
                {description}
              </p>
            </div>

            <button
              type="button"
              onClick={onCancel}
              className="text-neutral-400 hover:text-neutral-600 p-1 -mr-1 -mt-1 rounded-md transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="px-5 py-3.5 bg-neutral-50/80 border-t border-neutral-100 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            className="px-3.5 py-1.5 text-xs font-medium text-neutral-700 bg-white border border-neutral-300 rounded-lg hover:bg-neutral-50 transition-colors shadow-2xs"
          >
            {cancelText}
          </button>

          <button
            type="button"
            onClick={onConfirm}
            className={`px-4 py-1.5 text-xs font-medium text-white rounded-lg transition-colors shadow-xs ${
              isDestructive
                ? 'bg-red-600 hover:bg-red-700 focus-visible:ring-2 focus-visible:ring-red-500'
                : 'bg-neutral-900 hover:bg-neutral-800'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};
