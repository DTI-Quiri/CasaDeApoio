import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../context/AuthContext';
import { KeyRound, Lock, Eye, EyeOff, Loader2, LogOut, CheckCircle2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

export default function ChangePasswordModal() {
  const { user, updatePassword, logout } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200/90 dark:border-slate-800/90 p-7 sm:p-8 animate-in zoom-in-95 duration-200">
        <div className="flex items-center gap-3.5 mb-5 pb-4 border-b border-slate-100 dark:border-slate-800/80">
          <div className="h-12 w-12 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 shadow-inner">
            <KeyRound className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Definir Nova Senha
            </h2>
            <p className="text-xs text-amber-600 dark:text-amber-400 font-semibold">
              Primeiro acesso de {user.username}
            </p>
          </div>
        </div>

        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-5">
          Por medida de segurança, como este é seu primeiro acesso, é obrigatório cadastrar uma nova senha pessoal definitiva.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Nova Senha</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Lock className="h-4 w-4" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                className="input !pl-10 !pr-10 text-sm"
                placeholder="Mínimo 6 caracteres"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                autoFocus
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="label">Confirmar Nova Senha</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                className="input !pl-10 !pr-10 text-sm"
                placeholder="Repita a nova senha"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
              />
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-600 dark:text-rose-400 font-medium">
              {error}
            </div>
          )}

          <div className="pt-2 flex flex-col gap-2.5">
            <button
              type="submit"
              disabled={loading || !newPassword || !confirmPassword}
              className="btn-primary w-full py-2.5 text-sm font-bold shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
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
              className="btn-secondary w-full py-2 text-xs font-semibold text-slate-500 hover:text-rose-600 flex items-center justify-center gap-1.5 cursor-pointer"
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
