import { useState, useEffect, useRef, useId } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { findGuestByCPF } from '../services/guests';
import { formatCPF, onlyDigits, validateCPF } from '../utils/cpf';
import type { Guest } from '../types';
import { Loader2, CheckCircle2, UserPlus, AlertCircle, X, ShieldAlert } from 'lucide-react';
import { useModalA11y } from '../utils/useModalA11y';

interface CpfPreCheckModalProps {
  open: boolean;
  onSkip: () => void;
  onConfirm: (cpf: string, foundGuest: Guest | null) => void;
}

export default function CpfPreCheckModal({
  open,
  onSkip,
  onConfirm,
}: CpfPreCheckModalProps) {
  const nav = useNavigate();
  const [cpf, setCpf] = useState('');
  const [status, setStatus] = useState<'idle' | 'checking' | 'found' | 'not_found' | 'invalid'>('idle');
  const [guestName, setGuestName] = useState<string | null>(null);
  const [foundGuest, setFoundGuest] = useState<Guest | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const debounceTimer = useRef<number | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const inputId = useId();

  useModalA11y(open, dialogRef, onSkip);

  useEffect(() => {
    if (!open) {
      if (debounceTimer.current) {
        window.clearTimeout(debounceTimer.current);
        debounceTimer.current = null;
      }
      setCpf('');
      setStatus('idle');
      setGuestName(null);
      setFoundGuest(null);
      setErrorMessage(null);
    }
    return () => {
      if (debounceTimer.current) {
        window.clearTimeout(debounceTimer.current);
        debounceTimer.current = null;
      }
    };
  }, [open]);

  function handleCpfChange(value: string) {
    const formatted = formatCPF(value);
    setCpf(formatted);
    setErrorMessage(null);
    setGuestName(null);
    setFoundGuest(null);
    setStatus('idle');

    if (debounceTimer.current) {
      window.clearTimeout(debounceTimer.current);
      debounceTimer.current = null;
    }

    const digits = onlyDigits(formatted);
    if (digits.length === 11) {
      if (!validateCPF(formatted)) {
        setStatus('invalid');
        return;
      }

      setStatus('checking');
      debounceTimer.current = window.setTimeout(async () => {
        try {
          const g = await findGuestByCPF(formatted);
          if (g) {
            setStatus('found');
            setGuestName(g.name || null);
            setFoundGuest(g);
          } else {
            setStatus('not_found');
            setFoundGuest(null);
          }
        } catch {
          setStatus('not_found');
        }
      }, 300);
    } else if (digits.length > 0 && digits.length < 11) {
      debounceTimer.current = window.setTimeout(() => {
        setStatus('invalid');
      }, 1500);
    }
  }

  function handleConfirm() {
    const formatted = formatCPF(cpf);
    const digits = onlyDigits(formatted);

    if (digits.length !== 11 || !validateCPF(formatted)) {
      setStatus('invalid');
      return;
    }

    onConfirm(formatted, foundGuest);
  }

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/50"
      onMouseDown={e => {
        if (e.target === e.currentTarget) onSkip();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-lg shadow-xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 outline-none"
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 id={titleId} className="text-base font-semibold text-slate-900 dark:text-white">
              Consultar CPF do Hóspede
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Se já houver cadastro, preenchemos os dados automaticamente. O CPF é obrigatório no cadastro.
            </p>
          </div>
          <button
            type="button"
            onClick={onSkip}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="Fechar"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="py-2 space-y-3">
          <div>
            <label className="label" htmlFor={inputId}>CPF do Hóspede</label>
            <input
              id={inputId}
              className="input text-base"
              value={cpf}
              onChange={e => handleCpfChange(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleConfirm();
              }}
              autoFocus
            />
          </div>

          {/* Status Feedback */}
          <div className="min-h-[1.5rem] flex items-center text-xs">
            {status === 'checking' && (
              <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-brand-600" />
                <span>Verificando cadastro no sistema...</span>
              </div>
            )}

            {status === 'found' && (
              <div className="w-full space-y-2">
                <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>
                    Cadastro encontrado: <strong>{guestName}</strong>.
                  </span>
                </div>
                {foundGuest?.status === 'presente' && (
                  <div className="p-2.5 rounded-md bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-200 flex items-center justify-between gap-2">
                    <span className="leading-snug">
                      Este hóspede já está <strong>Presente na Casa</strong>.
                    </span>
                    <button
                      type="button"
                      onClick={() => nav(`/hospedes/${foundGuest.id}`)}
                      className="btn-secondary !py-1 !px-2.5 text-[11px] shrink-0 cursor-pointer"
                    >
                      Ver Ficha
                    </button>
                  </div>
                )}
              </div>
            )}

            {status === 'not_found' && (
              <div className="flex items-center gap-1.5 text-brand-600 dark:text-brand-400 font-medium">
                <UserPlus className="h-4 w-4 shrink-0" />
                <span>CPF não cadastrado. Você pode cadastrar um novo hóspede.</span>
              </div>
            )}

            {status === 'invalid' && (
              <div className="flex items-center gap-1.5 text-rose-500 font-medium">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>CPF inválido ou incompleto. Digite os 11 dígitos.</span>
              </div>
            )}

            {errorMessage && (
              <div className="flex items-center gap-1.5 text-rose-500 font-medium">
                <ShieldAlert className="h-4 w-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            className="btn-secondary py-2 px-4 text-xs font-semibold cursor-pointer"
            onClick={onSkip}
            title="Fechar esta consulta e preencher o CPF diretamente no formulário"
          >
            Pular consulta
          </button>
          <button
            type="button"
            className="btn-primary py-2 px-4 text-xs font-semibold shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleConfirm}
            disabled={status === 'checking' || status === 'invalid' || onlyDigits(cpf).length !== 11}
          >
            {status === 'found' ? 'Preencher Cadastro' : 'Usar este CPF'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
