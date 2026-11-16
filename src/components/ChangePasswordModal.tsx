import React, { useState, useRef, useId } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../context/AuthContext';
import { KeyRound, Lock, Eye, EyeOff, Loader2, LogOut, CheckCircle2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useModalA11y } from '../utils/useModalA11y';

export default function ChangePasswordModal() {
  const { user, updatePassword, logout } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  const isOpen = Boolean(user && user.mustChangePassword);
  useModalA11y(isOpen, dialogRef);

  if (!user || !user.mustChangePassword) {
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 6) {
      setError('A nova senha deve ter no mínimo 6 caracteres.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('As senhas digitadas não coincidem.');
      return;
    }

    try {
      setLoading(true);
      const success = await updatePassword(newPassword);
      if (success) {
        toast.success('Senha definida com sucesso! Bem-vindo(a) ao sistema.');
      } else {
        setError('Erro ao atualizar a senha. Tente novamente.');
      }
    } catch {
      setError('Ocorreu um erro inesperado ao salvar a senha.');
    } finally {
      setLoading(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/50">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-lg shadow-xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 outline-none"
      >
        <div className="flex items-center gap-3 mb-4 pb-3.5 border-b border-slate-100 dark:border-slate-800">
          <div className="h-9 w-9 rounded-md bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <KeyRound className="h-4 w-4" />
          </div>
          <div>
            <h2 id={titleId} className="text-base font-semibold text-slate-900 dark:text-white">
              Definir Nova Senha
            </h2>
            <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
              Primeiro acesso de {user.username}
            </p>
          </div>
        </div>

        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-4">
          Por medida de segurança, como este é seu primeiro acesso, é obrigatório cadastrar uma nova senha pessoal definitiva.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label" htmlFor="new-password-input">Nova Senha</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Lock className="h-4 w-4" />
              </div>
              <input
                id="new-password-input"
                type={showPassword ? 'text' : 'password'}
                className="input !pl-10 !pr-10 text-sm"
                placeholder="Mínimo 6 caracteres"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                autoFocus
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="label" htmlFor="confirm-password-input">Confirmar Nova Senha</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <input
                id="confirm-password-input"
                type={showPassword ? 'text' : 'password'}
                className="input !pl-10 !pr-10 text-sm"
                placeholder="Repita a nova senha"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
              />
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-md bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-600 dark:text-rose-400 font-medium">
              {error}
            </div>
          )}

          <div className="pt-2 flex flex-col gap-2">
            <button
              type="submit"
              disabled={loading || !newPassword || !confirmPassword}
              className="btn-primary w-full py-2.5 text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Salvando nova senha...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Salvar Senha e Acessar</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={logout}
              className="btn-secondary w-full py-2 text-xs font-medium text-slate-500 hover:text-rose-600 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Sair da conta</span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
