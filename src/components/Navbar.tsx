import { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ThemeToggle from './ThemeToggle';
import {
  ChevronDown,
  User,
  LogOut,
  Menu,
  X,
  LayoutDashboard,
  UserPlus,
  History,
  Users,
  Activity,
  Shield,
  CalendarCheck,
  Edit3,
  Trash2,
} from 'lucide-react';

function cn(...classes: (string | boolean | undefined | null)[]) {
  return classes.filter(Boolean).join(' ');
}

export default function Navbar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [hospedesOpen, setHospedesOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const hospedesRef = useRef<HTMLDivElement>(null);
  const adminRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (hospedesRef.current && !hospedesRef.current.contains(e.target as Node)) {
        setHospedesOpen(false);
      }
      if (adminRef.current && !adminRef.current.contains(e.target as Node)) {
        setAdminOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    setHospedesOpen(false);
    setAdminOpen(false);
    setMobileMenuOpen(false);
  }, [location.pathname, location.search]);

  const isActive = (path: string) => location.pathname === path;

  return (
    <header className="sticky top-0 z-30 w-full border-b border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl transition-all duration-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-8">
            <Link
              to="/"
              className="flex flex-col select-none cursor-pointer"
            >
              <span className="text-base font-bold tracking-tight text-slate-900 dark:text-white leading-tight">
                Casa de Apoio
              </span>
              <span className="text-[10px] font-semibold text-brand-600 dark:text-brand-400 uppercase tracking-widest">
                Quirinópolis • GO
              </span>
            </Link>

            <nav className="hidden md:flex items-center gap-1.5">
              <Link
                to="/dashboard"
                className={cn(
                  'flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium transition-all duration-200',
                  isActive('/dashboard') && !location.search.includes('action=')
                    ? 'bg-brand-50 text-brand-700 dark:bg-brand-950/50 dark:text-brand-300 font-semibold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800/60'
                )}
              >
                <LayoutDashboard className="h-4 w-4" />
                Dashboard
              </Link>

              <div className="relative" ref={hospedesRef}>
                <button
                  type="button"
                  onClick={() => setHospedesOpen(!hospedesOpen)}
                  className={cn(
                    'flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer',
                    hospedesOpen || isActive('/cadastro') || isActive('/historico') || location.pathname.startsWith('/hospedes')
                      ? 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800/60'
                  )}
                >
                  <Users className="h-4 w-4" />
                  <span>Hóspedes</span>
                  <ChevronDown
                    className={cn(
                      'h-3.5 w-3.5 opacity-60 transition-transform duration-200',
                      hospedesOpen && 'rotate-180'
                    )}
                  />
                </button>

                {hospedesOpen && (
                  <div className="absolute left-0 mt-2 w-56 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl shadow-xl shadow-slate-900/5 dark:shadow-none p-1.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                    <Link
                      to="/cadastro"
                      className="flex items-center gap-2.5 px-3.5 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-brand-50 hover:text-brand-700 dark:hover:bg-brand-950/40 dark:hover:text-brand-300 rounded-xl transition-colors"
                    >
                      <UserPlus className="h-4 w-4 text-brand-600 dark:text-brand-400" />
                      <span>Cadastrar Novo</span>
                    </Link>
                    <Link
                      to="/historico"
                      className="flex items-center gap-2.5 px-3.5 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60 rounded-xl transition-colors"
                    >
                      <History className="h-4 w-4 text-slate-500" />
                      <span>Histórico Geral</span>
                    </Link>
                    <Link
                      to="/historico?status=finalizado"
                      className="flex items-center gap-2.5 px-3.5 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60 rounded-xl transition-colors"
                    >
                      <CalendarCheck className="h-4 w-4 text-indigo-500" />
                      <span>Estadias Finalizadas</span>
                    </Link>
                    <div className="h-px bg-slate-100 dark:bg-slate-800 my-1" />
                    <Link
                      to="/editar"
                      className="flex items-center gap-2.5 px-3.5 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60 rounded-xl transition-colors"
                    >
                      <Edit3 className="h-4 w-4 text-amber-500" />
                      <span>Editar Registro</span>
                    </Link>
                    <Link
                      to="/excluir"
                      className="flex items-center gap-2.5 px-3.5 py-2.5 text-sm font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors"
                    >
                      <Trash2 className="h-4 w-4 text-rose-500" />
                      <span>Excluir Registro</span>
                    </Link>
                  </div>
                )}
              </div>

              {user?.role === 'admin' && (
                <div className="relative" ref={adminRef}>
                  <button
                    type="button"
                    onClick={() => setAdminOpen(!adminOpen)}
                    className={cn(
                      'flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer',
                      adminOpen || isActive('/admin/usuarios') || isActive('/admin/diagnostics')
                        ? 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white font-semibold'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800/60'
                    )}
                  >
                    <Shield className="h-4 w-4 text-brand-600 dark:text-brand-400" />
                    <span>Administração</span>
                    <ChevronDown
                      className={cn(
                        'h-3.5 w-3.5 opacity-60 transition-transform duration-200',
                        adminOpen && 'rotate-180'
                      )}
                    />
                  </button>

                  {adminOpen && (
                    <div className="absolute left-0 mt-2 w-56 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl shadow-xl shadow-slate-900/5 dark:shadow-none p-1.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                      <Link
                        to="/admin/usuarios"
                        className="flex items-center gap-2.5 px-3.5 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-brand-50 hover:text-brand-700 dark:hover:bg-brand-950/40 dark:hover:text-brand-300 rounded-xl transition-colors"
                      >
                        <Users className="h-4 w-4 text-brand-600 dark:text-brand-400" />
                        <span>Gerenciar Usuários</span>
                      </Link>
                      <Link
                        to="/admin/diagnostics"
                        className="flex items-center gap-2.5 px-3.5 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60 rounded-xl transition-colors"
                      >
                        <Activity className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                        <span>Diagnóstico do Sistema</span>
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </nav>
          </div>

          <div className="hidden md:flex items-center gap-3">
            <ThemeToggle />
            <div className="h-5 w-px bg-slate-200 dark:bg-slate-800 mx-1" />
            {user ? (
              <div className="flex items-center gap-3 pl-1">
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  {user.username}
                </span>
                <button
                  onClick={logout}
                  className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl transition-all cursor-pointer"
                  title="Sair da conta"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <Link to="/login" className="btn-primary py-2 px-4 text-xs font-semibold">
                <User className="h-4 w-4 mr-1.5" />
                Entrar
              </Link>
            )}
          </div>

          <div className="flex md:hidden items-center gap-2">
            <ThemeToggle />
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-slate-600 dark:text-slate-300 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              aria-label="Abrir menu de navegação"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200/80 dark:border-slate-800/80 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl absolute w-full animate-in fade-in slide-in-from-top-2 duration-150 shadow-xl">
          <div className="px-4 py-4 space-y-4">
            {user && (
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <span className="text-sm font-semibold text-slate-900 dark:text-white">
                  {user.username}
                </span>
                <span className="text-xs font-medium text-slate-500 capitalize px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800">
                  {user.role}
                </span>
              </div>
            )}

            <nav className="flex flex-col gap-1">
              <Link
                to="/dashboard"
                className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-brand-50 hover:text-brand-600 dark:hover:bg-brand-950/30 transition-colors"
              >
                <LayoutDashboard className="h-4 w-4" />
                Dashboard
              </Link>

              <div className="px-3.5 pt-2 pb-1 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Hóspedes
              </div>
              <Link
                to="/cadastro"
                className="flex items-center gap-3 px-3.5 py-2 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-brand-50 hover:text-brand-600 dark:hover:bg-brand-950/30 transition-colors"
              >
                <UserPlus className="h-4 w-4 text-brand-600 dark:text-brand-400" />
                Cadastrar Hóspede
              </Link>
              <Link
                to="/historico"
                className="flex items-center gap-3 px-3.5 py-2 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-brand-50 hover:text-brand-600 dark:hover:bg-brand-950/30 transition-colors"
              >
                <History className="h-4 w-4 text-slate-500" />
                Histórico Geral
              </Link>
              <Link
                to="/historico?status=finalizado"
                className="flex items-center gap-3 px-3.5 py-2 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-brand-50 hover:text-brand-600 dark:hover:bg-brand-950/30 transition-colors"
              >
                <CalendarCheck className="h-4 w-4 text-indigo-500" />
                Estadias Finalizadas
              </Link>
              <Link
                to="/editar"
                className="flex items-center gap-3 px-3.5 py-2 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-brand-50 hover:text-brand-600 dark:hover:bg-brand-950/30 transition-colors"
              >
                <Edit3 className="h-4 w-4 text-amber-500" />
                Editar Registro
              </Link>
              <Link
                to="/excluir"
                className="flex items-center gap-3 px-3.5 py-2 rounded-xl text-sm font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
              >
                <Trash2 className="h-4 w-4 text-rose-500" />
                Excluir Registro
              </Link>

              {user?.role === 'admin' && (
                <>
                  <div className="h-px bg-slate-100 dark:bg-slate-800 my-2" />
                  <div className="px-3.5 pt-1 pb-1 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    Administração
                  </div>
                  <Link
                    to="/admin/usuarios"
                    className="flex items-center gap-3 px-3.5 py-2 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-brand-50 hover:text-brand-600 dark:hover:bg-brand-950/30 transition-colors"
                  >
                    <Users className="h-4 w-4" />
                    Gerenciar Usuários
                  </Link>
                  <Link
                    to="/admin/diagnostics"
                    className="flex items-center gap-3 px-3.5 py-2 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-brand-50 hover:text-brand-600 dark:hover:bg-brand-950/30 transition-colors"
                  >
                    <Activity className="h-4 w-4" />
                    Diagnóstico do Sistema
                  </Link>
                </>
              )}
            </nav>

            {user ? (
              <button
                onClick={logout}
                className="w-full mt-2 flex items-center justify-center gap-2 px-4 py-2.5 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 font-medium rounded-xl hover:bg-rose-100 transition-colors cursor-pointer"
              >
                <LogOut className="h-4 w-4" />
                Sair da Conta
              </button>
            ) : (
              <Link to="/login" className="btn-primary w-full text-center py-2.5">
                Entrar
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}