import { useRef, useId } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, CheckCircle2, Loader2, LogOut } from 'lucide-react';
import { useModalA11y } from '../utils/useModalA11y';

interface ConfirmModalProps {
  open: boolean;
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'primary';
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  open,
  title = 'Confirmar Exclusão',
  message,
  confirmLabel = 'Sim, Excluir',
  cancelLabel = 'Cancelar',
  variant = 'danger',
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();

  useModalA11y(open, dialogRef, loading ? undefined : onCancel);

  if (!open) return null;

  const iconBoxClass =
    variant === 'warning'
      ? 'bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400'
      : variant === 'primary'
        ? 'bg-brand-100 dark:bg-brand-950/50 text-brand-600 dark:text-brand-400'
        : 'bg-rose-100 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400';

  const confirmBtnClass =
    variant === 'warning'
      ? 'btn bg-amber-600 hover:bg-amber-700 text-white py-2 px-4 text-xs font-semibold shadow-sm cursor-pointer'
      : variant === 'primary'
        ? 'btn-primary py-2 px-4 text-xs font-semibold shadow-sm cursor-pointer'
        : 'btn-danger py-2 px-4 text-xs font-semibold shadow-sm cursor-pointer';

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/50"
      onMouseDown={e => {
        if (e.target === e.currentTarget && !loading) onCancel();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        tabIndex={-1}
        className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-lg shadow-xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 outline-none"
      >
        <div className="flex items-start gap-3.5">
          <div className={`h-9 w-9 rounded-md flex items-center justify-center shrink-0 ${iconBoxClass}`}>
            {variant === 'warning' ? (
              <LogOut className="h-4 w-4" />
            ) : variant === 'primary' ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <AlertTriangle className="h-4 w-4" />
            )}
          </div>
          <div className="space-y-1">
            <h2 id={titleId} className="text-sm font-semibold text-slate-900 dark:text-white">
              {title}
            </h2>
            <p id={descId} className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed whitespace-pre-line max-h-[50vh] overflow-y-auto">
              {message}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 mt-5 pt-4 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            className="btn-secondary cursor-pointer"
            onClick={onCancel}
            disabled={loading}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={confirmBtnClass}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                Processando...
              </>
            ) : (
              confirmLabel
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
