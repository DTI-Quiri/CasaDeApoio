import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { findGuestByCPF } from '../services/guests';
import { formatCPF, onlyDigits, validateCPF } from '../utils/cpf';
import type { Guest } from '../types';
import { Loader2, CheckCircle2, UserPlus, AlertCircle, X, ShieldAlert } from 'lucide-react';

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
  const [cpf, setCpf] = useState('');
  const [status, setStatus] = useState<'idle' | 'checking' | 'found' | 'not_found' | 'invalid'>('idle');
  const [guestName, setGuestName] = useState<string | null>(null);
  const [foundGuest, setFoundGuest] = useState<Guest | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const debounceTimer = useRef<number | null>(null);

  useEffect(() => {
    if (!open) {
      setCpf('');
      setStatus('idle');
      setGuestName(null);
      setFoundGuest(null);
      setErrorMessage(null);
    }
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
        if (onlyDigits(cpf).length < 11) {
          setStatus('invalid');
        }
      }, 1500);
    }
  }

  function handleConfirm() {
    const formatted = formatCPF(cpf);
    const digits = onlyDigits(formatted);

    if (digits.length !== 11 && status !== 'found') {
      setErrorMessage('CPF inválido ou incompleto.');
      return;
    }

    onConfirm(formatted, foundGuest);
  }

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200/80 dark:border-slate-800/80 p-6 sm:p-7 animate-in zoom-in-95 duration-200">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Informe o CPF
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Se já houver cadastro, buscamos e preenchemos os dados. Você também pode pular e preencher manualmente.
            </p>
          </div>
          <button
            onClick={onSkip}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="py-2 space-y-3">
          <div>
            <label className="label">CPF do Hóspede</label>
            <input
              className="input text-base"
              placeholder="000.000.000-00"
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
              <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>
                  Cadastro encontrado: <strong>{guestName}</strong>.
                </span>
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
          >
            Continuar sem CPF
          </button>
          <button
            type="button"
            className="btn-primary py-2 px-4 text-xs font-semibold shadow-sm cursor-pointer"
            onClick={handleConfirm}
            disabled={status === 'checking'}
          >
            {status === 'found' ? 'Preencher Cadastro' : 'Usar este CPF'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
