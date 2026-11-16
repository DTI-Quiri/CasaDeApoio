import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { listUsers, createUser, deleteUser, resetUserPassword } from '../services/guests';
import type { Role, User as UserType } from '../types';
import { UserPlus, Trash2, Loader2, KeyRound, CheckCircle2, Lock, X } from 'lucide-react';
import { toast } from 'sonner';
import { createPortal } from 'react-dom';
import ConfirmModal from '../components/ConfirmModal';
import { useModalA11y } from '../utils/useModalA11y';

export default function UserManagementPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserType[]>([]);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('funcionario');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserType | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Reset Password Modal State
  const [userToReset, setUserToReset] = useState<UserType | null>(null);
  const [tempPassword, setTempPassword] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const resetModalRef = useRef<HTMLDivElement>(null);

  useModalA11y(Boolean(userToReset), resetModalRef, resetLoading ? undefined : () => setUserToReset(null));

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    try {
      setLoading(true);
      const data = await listUsers();
      setUsers(data);
    } catch {
      toast.error('Erro ao carregar usuários.');
    } finally {
      setLoading(false);
    }
  }

  function validate(): boolean {
    const u = username.trim();
    if (!u) {
      toast.error('Informe o nome de usuário.');
      return false;
    }
    if (u.length < 3) {
      toast.error('O usuário deve ter pelo menos 3 caracteres.');
      return false;
    }
    if (password.length < 6) {
      toast.error('A senha inicial deve ter pelo menos 6 caracteres.');
      return false;
    }
    if (users.some(existing => existing.username.toLowerCase() === u.toLowerCase())) {
      toast.error('Este nome de usuário já existe.');
      return false;
    }
    return true;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    if (!currentUser || currentUser.role !== 'admin') {
      toast.error('Acesso restrito a administradores.');
      return;
    }
    if (!validate()) return;

    try {
      setSubmitting(true);
      // New users are created with mustChangePassword = true
      const created = await createUser(username.trim(), password, role, true);
      setUsers(prev => [created, ...prev]);
      setUsername('');
      setPassword('');
      setRole('funcionario');
      setSubmitted(false);
      toast.success(`Usuário "${created.username}" criado! No 1º login, ele definirá a própria senha.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao criar usuário.';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  async function executeDeleteUser() {
    if (!userToDelete || !currentUser || currentUser.role !== 'admin') return;
    if (userToDelete.id === currentUser.id) {
      toast.error('Você não pode excluir a sua própria conta.');
      return;
    }

    try {
      setDeleteLoading(true);
      await deleteUser(userToDelete.id);
      setUsers(prev => prev.filter(u => u.id !== userToDelete.id));
      toast.success(`Usuário "${userToDelete.username}" excluído com sucesso.`);
      setUserToDelete(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao excluir usuário.';
      toast.error(msg);
    } finally {
      setDeleteLoading(false);
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!userToReset) return;
    if (tempPassword.length < 6) {
      toast.error('A nova senha temporária deve ter pelo menos 6 caracteres.');
      return;
    }

    try {
      setResetLoading(true);
      await resetUserPassword(userToReset.id, tempPassword);
      setUsers(prev =>
        prev.map(u => (u.id === userToReset.id ? { ...u, mustChangePassword: true } : u))
      );
      toast.success(`Senha temporária de "${userToReset.username}" definida! Ele deverá trocar no próximo login.`);
      setUserToReset(null);
      setTempPassword('');
    } catch {
      toast.error('Erro ao redefinir senha do usuário.');
    } finally {
      setResetLoading(false);
    }
  }

  return (
    <div className="container-page py-6 space-y-5">
      <div className="sm:min-h-[44px] flex flex-col justify-center">
        <h1 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white">
          Gerenciamento de Usuários
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Controle de acesso e credenciais de login para funcionários e administradores
        </p>
      </div>

      {/* Card: Criar Usuário */}
      <div className="card p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-100 dark:border-slate-800">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            Cadastrar Novo Usuário
          </h2>
          <span className="text-xs text-slate-500">
            O usuário definirá sua senha pessoal no 1º acesso
          </span>
        </div>

        <form noValidate onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          <div>
            <label className="label">Nome de Usuário</label>
            <input
              className={`input ${submitted && !username.trim() ? 'border-rose-400 dark:border-rose-500' : ''}`}
              value={username}
              onChange={e => setUsername(e.target.value)}
            />
            {submitted && !username.trim() && (
              <span className="text-xs font-medium text-rose-500 mt-1 inline-block">
                Informe o nome de usuário.
              </span>
            )}
          </div>

          <div>
            <label className="label">Senha Inicial (Temporária)</label>
            <input
              className={`input ${submitted && password.length < 6 ? 'border-rose-400 dark:border-rose-500' : ''}`}
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="mínimo 6 caracteres"
            />
            {submitted && password.length < 6 && (
              <span className="text-xs font-medium text-rose-500 mt-1 inline-block">
                Mínimo de 6 caracteres.
              </span>
            )}
          </div>

          <div>
            <label className="label">Nível de Permissão</label>
            <select
              className="input"
              value={role}
              onChange={e => setRole(e.target.value as Role)}
            >
              <option value="funcionario">Funcionário</option>
              <option value="admin">Administrador (Total)</option>
            </select>
          </div>

          <div className="sm:col-span-3 flex justify-end gap-2 pt-1">
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary cursor-pointer"
            >
              {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
              <span>Criar Usuário</span>
            </button>
          </div>
        </form>
      </div>

      {/* Card: Lista de Usuários */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 dark:border-slate-800">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            Usuários Registrados ({users.length})
          </h2>
        </div>

        {loading ? (
          <div className="py-8 flex flex-col items-center justify-center gap-2 text-slate-500">
            <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
            <span className="text-xs">Carregando contas...</span>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {users.map(u => (
              <li
                key={u.id}
                className="py-3 flex items-center justify-between gap-4 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 rounded-md px-2.5 transition-colors flex-wrap sm:flex-nowrap"
              >
                <div className="min-w-[180px]">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-slate-900 dark:text-white">
                      {u.username}
                    </span>
                    {u.id === currentUser?.id && (
                      <span className="badge-blue">
                        Você
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-slate-400 tabular-nums">
                    ID: {u.id.slice(0, 8)}...
                  </span>
                </div>

                {/* Status da Senha */}
                <div className="flex items-center gap-2">
                  {u.mustChangePassword ? (
                    <span className="badge-yellow">
                      <KeyRound className="h-3 w-3" />
                      1º Acesso Pendente
                    </span>
                  ) : (
                    <span className="badge-green">
                      <CheckCircle2 className="h-3 w-3" />
                      Senha Ativa
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={
                      u.role === 'admin'
                        ? 'badge-blue'
                        : 'badge-gray'
                    }
                  >
                    {u.role === 'admin' ? 'Administrador' : 'Funcionário'}
                  </span>

                  {currentUser?.role === 'admin' && (
                    <button
                      className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 rounded-md transition-colors cursor-pointer"
                      onClick={() => {
                        setUserToReset(u);
                        setTempPassword('');
                      }}
                      title="Redefinir senha temporária"
                    >
                      <KeyRound className="h-4 w-4" />
                    </button>
                  )}

                  {currentUser?.role === 'admin' && u.id !== currentUser?.id && (
                    <button
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-md transition-colors cursor-pointer"
                      onClick={() => setUserToDelete(u)}
                      title="Excluir usuário"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Modal: Redefinir Senha do Usuário */}
      {userToReset &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/50"
            onMouseDown={e => {
              if (e.target === e.currentTarget && !resetLoading) setUserToReset(null);
            }}
          >
            <div
              ref={resetModalRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="reset-password-modal-title"
              tabIndex={-1}
              className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-lg shadow-xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 outline-none"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h2 id="reset-password-modal-title" className="text-base font-semibold text-slate-900 dark:text-white">
                    Redefinir Senha
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Usuário: <strong className="text-slate-700 dark:text-slate-200">{userToReset.username}</strong>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setUserToReset(null)}
                  className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-md cursor-pointer"
                  aria-label="Fechar"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-4">
                Defina uma nova senha temporária. Ao fazer login, o usuário será solicitado a cadastrar uma nova senha pessoal.
              </p>

              <form onSubmit={handleResetPassword} className="space-y-4">
                <div>
                  <label className="label" htmlFor="temp-password-input">Nova Senha Temporária</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Lock className="h-4 w-4" />
                    </div>
                    <input
                      id="temp-password-input"
                      type="password"
                      className="input !pl-9"
                      placeholder="Mínimo 6 caracteres"
                      value={tempPassword}
                      onChange={e => setTempPassword(e.target.value)}
                      autoFocus
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    className="btn-secondary cursor-pointer"
                    onClick={() => setUserToReset(null)}
                    disabled={resetLoading}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="btn-primary cursor-pointer"
                    disabled={resetLoading || tempPassword.length < 6}
                  >
                    {resetLoading ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                        Salvando...
                      </>
                    ) : (
                      'Salvar Senha Temporária'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* Confirmation Modal for User Deletion */}
      <ConfirmModal
        open={!!userToDelete}
        title="Excluir Usuário"
        message={`Tem certeza que deseja excluir o usuário "${userToDelete?.username}"? Este usuário perderá o acesso ao sistema imediatamente.`}
        confirmLabel="Sim, Excluir Usuário"
        cancelLabel="Cancelar"
        loading={deleteLoading}
        onConfirm={executeDeleteUser}
        onCancel={() => setUserToDelete(null)}
      />
    </div>
  );
}
