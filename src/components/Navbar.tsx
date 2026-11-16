import { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ThemeToggle from './ThemeToggle';
import FontSizeToggle from './FontSizeToggle';
import QuickSearchModal from './QuickSearchModal';
import { getSyncStatus, subscribeSyncStatus, type SyncStatusState } from '../utils/sync';
import {
  ChevronDown,
  User,
  LogOut,
  Menu,
  X,
  LayoutDashboard,
  CheckCircle2,
  Users,
  BarChart3,
  UserPlus,
  Activity,
  Shield,
  Sliders,
  Search,
  WifiOff,
} from 'lucide-react';

function cn(...classes: (string | boolean | undefined | null)[]) {
  return classes.filter(Boolean).join(' ');
}

export default function Navbar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [adminOpen, setAdminOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatusState>(() => getSyncStatus());

  const adminRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return subscribeSyncStatus(setSyncStatus);
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (adminRef.current && !adminRef.current.contains(e.target as Node)) {
        setAdminOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        if (!user) return;
        e.preventDefault();
        setSearchOpen(prev => !prev);
        return;
      }
      if (e.key === 'Escape') {
        setAdminOpen(false);
        setMobileMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [user]);

  useEffect(() => {
    setAdminOpen(false);
    setMobileMenuOpen(false);
  }, [location.pathname, location.search]);

  const isActive = (path: string) => location.pathname === path;

  const navItemClass = (active: boolean) =>
    cn(
      'relative flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors duration-150',
      active
        ? 'bg-brand-50/90 text-brand-800 dark:bg-brand-950/60 dark:text-brand-300 after:hidden lg:after:block after:absolute after:inset-x-2.5 after:-bottom-[13px] after:h-[2px] after:bg-brand-700 dark:after:bg-brand-400 after:rounded-full'
        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800/60'
    );

  const navIconClass = (active: boolean) =>
    cn(
      'h-3.5 w-3.5 shrink-0',
      active ? 'text-brand-700 dark:text-brand-400' : 'text-slate-400 dark:text-slate-500'
    );

  const painActive = isActive('/painel') || isActive('/dashboard');
  const recepcaoActive = isActive('/recepcao') || isActive('/operacao');
  const hospedesActive = isActive('/hospedes') || location.pathname.startsWith('/hospedes/');
  const relatoriosActive = isActive('/relatorios') || isActive('/historico');
  const cadastroActive = isActive('/cadastro');
  const adminActive =
    adminOpen ||
    isActive('/admin/usuarios') ||
    isActive('/admin/diagnostics') ||
    isActive('/admin/configuracoes');

  return (
    <header className="sticky top-0 z-30 w-full border-b border-slate-200/90 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-6">
            <Link to="/painel" className="flex items-center gap-3 select-none cursor-pointer group">
              <div className="h-9 w-9 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 p-1 flex items-center justify-center shrink-0">
                <img
                  src="/Brasao-Quirinopolis.png"
                  alt="Brasão de Quirinópolis"
                  className="h-full w-full object-contain"
                />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold tracking-tight text-slate-900 dark:text-white leading-tight group-hover:text-brand-700 dark:group-hover:text-brand-300 transition-colors">
                  Casa de Apoio
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
                  Quirinópolis • GO
                </span>
              </div>
            </Link>

            <div className="hidden md:block h-6 w-px bg-slate-200/90 dark:bg-slate-800" />

            <nav className="hidden md:flex items-center gap-1">
              <Link to="/painel" className={navItemClass(painActive)}>
                <LayoutDashboard className={navIconClass(painActive)} />
                <span>Painel</span>
              </Link>

              <Link to="/recepcao" className={navItemClass(recepcaoActive)}>
                <CheckCircle2 className={navIconClass(recepcaoActive)} />
                <span>Recepção</span>
              </Link>

              <Link to="/hospedes" className={navItemClass(hospedesActive)}>
                <Users className={navIconClass(hospedesActive)} />
                <span>Hóspedes</span>
              </Link>

              <Link to="/relatorios" className={navItemClass(relatoriosActive)}>
                <BarChart3 className={navIconClass(relatoriosActive)} />
                <span>Relatórios</span>
              </Link>

              <Link
                to="/cadastro"
                className={cn(
                  'ml-1 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all duration-150',
                  cadastroActive
                    ? 'bg-brand-800 text-white shadow-soft'
                    : 'bg-brand-700 text-white hover:bg-brand-800 dark:bg-brand-600 dark:hover:bg-brand-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.14)]'
                )}
              >
                <UserPlus className="h-3.5 w-3.5 shrink-0 text-white" />
                <span>Cadastrar</span>
              </Link>

              {user?.role === 'admin' && (
                <div className="relative" ref={adminRef}>
                  <button
                    type="button"
                    aria-expanded={adminOpen}
                    aria-haspopup="menu"
                    onClick={() => setAdminOpen(!adminOpen)}
                    className={cn(navItemClass(adminActive), 'cursor-pointer')}
                  >
                    <Shield className={navIconClass(adminActive)} />
                    <span>Admin</span>
                    <ChevronDown
                      className={cn(
                        'h-3 w-3 opacity-60 transition-transform duration-150',
                        adminOpen && 'rotate-180'
                      )}
                    />
                  </button>

                  {adminOpen && (
                    <div className="absolute left-0 mt-1.5 w-52 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-lg p-1 z-50">
                      <Link
                        to="/admin/usuarios"
                        className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors"
                      >
                        <Users className="h-3.5 w-3.5 text-slate-500" />
                        <span>Gerenciar Usuários</span>
                      </Link>
                      <Link
                        to="/admin/configuracoes"
                        className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors"
                      >
                        <Sliders className="h-3.5 w-3.5 text-slate-500" />
                        <span>Configurações da Casa</span>
                      </Link>
                      <Link
                        to="/admin/diagnostics"
                        className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors"
                      >
                        <Activity className="h-3.5 w-3.5 text-slate-500" />
                        <span>Diagnóstico do Sistema</span>
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </nav>
          </div>

          <div className="hidden md:flex items-center gap-2">
            {user && (
              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                title="Buscar hóspede por nome, CPF, telefone ou hospital (Ctrl+K)"
                className="inline-flex items-center justify-between gap-2.5 h-8 w-40 lg:w-60 xl:w-72 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/90 dark:bg-slate-800/70 text-xs text-slate-400 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-white dark:hover:bg-slate-800 hover:text-slate-600 dark:hover:text-slate-200 transition-all cursor-text shadow-[inset_0_1px_2px_rgba(15,23,42,0.03)]"
              >
                <span className="flex items-center gap-2 min-w-0">
                  <Search className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <span className="truncate lg:hidden">Buscar...</span>
                  <span className="hidden lg:inline truncate">Buscar hóspede...</span>
                </span>
                <kbd className="hidden xl:inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded border border-slate-200/90 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-400 shrink-0">
                  Ctrl+K
                </kbd>
              </button>
            )}
            {user && (!syncStatus.online || syncStatus.hasError) && (
              <span
                title={
                  !syncStatus.online
                    ? 'Sem conexão com a internet'
                    : 'Falha ao sincronizar com o servidor'
                }
                className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium border bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60"
              >
                <WifiOff className="h-3 w-3 shrink-0" />
                <span className="hidden xl:inline">
                  {!syncStatus.online ? 'Sem conexão' : 'Erro de conexão'}
                </span>
              </span>
            )}
            <FontSizeToggle />
            <ThemeToggle />
            <div className="h-4 w-px bg-slate-200 dark:bg-slate-800 mx-0.5" />
            {user ? (
              <div className="flex items-center gap-2 pl-1">
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  {user.username}
                </span>
                <button
                  onClick={logout}
                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors cursor-pointer"
                  title="Sair da conta"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <Link to="/login" className="btn-primary py-1.5 px-3 text-xs font-medium">
                <User className="h-3.5 w-3.5 mr-1" />
                Entrar
              </Link>
            )}
          </div>

          <div className="flex md:hidden items-center gap-1.5">
            {user && (
              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                aria-label="Busca rápida de hóspede"
                className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <Search className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                <span className="hidden min-[390px]:inline">Buscar</span>
              </button>
            )}
            <FontSizeToggle />
            <ThemeToggle />
            <button
              type="button"
              aria-expanded={mobileMenuOpen}
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-slate-600 dark:text-slate-300 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              aria-label="Abrir menu de navegação"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 absolute w-full shadow-lg">
          <div className="px-4 py-4 space-y-3">
            {user && (
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <span className="text-sm font-semibold text-slate-900 dark:text-white">
                  {user.username}
                </span>
                <span className="text-xs font-medium text-slate-500 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800">
                  {user.role === 'admin' ? 'Administrador' : 'Equipe'}
                </span>
              </div>
            )}

            {user && (!syncStatus.online || syncStatus.hasError) && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60">
                <WifiOff className="h-3.5 w-3.5 shrink-0" />
                <span>{!syncStatus.online ? 'Sem conexão com a internet' : 'Erro ao sincronizar dados'}</span>
              </div>
            )}

            {user && (
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  setSearchOpen(true);
                }}
                className="w-full flex items-center gap-2.5 h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-xs text-slate-500 dark:text-slate-300 text-left cursor-pointer"
              >
                <Search className="h-4 w-4 text-slate-400 shrink-0" />
                <span>Buscar hóspede por nome, CPF ou hospital...</span>
              </button>
            )}

            <nav className="grid grid-cols-2 gap-1.5">
              <Link
                to="/painel"
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-50/70 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <LayoutDashboard className="h-4 w-4 text-slate-500 shrink-0" />
                <span>Painel</span>
              </Link>

              <Link
                to="/recepcao"
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-50/70 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>Recepção</span>
              </Link>

              <Link
                to="/hospedes"
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-50/70 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <Users className="h-4 w-4 text-slate-500 shrink-0" />
                <span>Hóspedes</span>
              </Link>

              <Link
                to="/relatorios"
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-50/70 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <BarChart3 className="h-4 w-4 text-slate-500 shrink-0" />
                <span>Relatórios</span>
              </Link>

              <Link
                to="/cadastro"
                className="col-span-2 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-xs font-semibold text-brand-700 dark:text-brand-300 bg-brand-50/80 dark:bg-brand-950/30 border border-brand-200/70 dark:border-brand-800/50 hover:bg-brand-100/70 dark:hover:bg-brand-900/40 transition-colors"
              >
                <UserPlus className="h-4 w-4 shrink-0" />
                <span>Cadastrar novo hóspede</span>
              </Link>

              {user?.role === 'admin' && (
                <>
                  <div className="col-span-2 h-px bg-slate-100 dark:bg-slate-800 my-1" />
                  <div className="col-span-2 px-1 pt-0.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    Administração
                  </div>
                  <Link
                    to="/admin/usuarios"
                    className="col-span-2 flex items-center gap-3 px-3 py-2 rounded-md text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <Users className="h-4 w-4 text-slate-500" />
                    Gerenciar Usuários
                  </Link>
                  <Link
                    to="/admin/configuracoes"
                    className="col-span-2 flex items-center gap-3 px-3 py-2 rounded-md text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <Sliders className="h-4 w-4 text-slate-500" />
                    Configurações da Casa
                  </Link>
                  <Link
                    to="/admin/diagnostics"
                    className="col-span-2 flex items-center gap-3 px-3 py-2 rounded-md text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <Activity className="h-4 w-4 text-slate-500" />
                    Diagnóstico do Sistema
                  </Link>
                </>
              )}
            </nav>

            {user ? (
              <button
                type="button"
                onClick={logout}
                className="w-full mt-2 flex items-center justify-center gap-2 px-4 py-2 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 text-xs font-medium rounded-md hover:bg-rose-100 transition-colors cursor-pointer"
              >
                <LogOut className="h-4 w-4" />
                Sair da Conta
              </button>
            ) : (
              <Link to="/login" className="btn-primary w-full text-center py-2">
                Entrar
              </Link>
            )}
          </div>
        </div>
      )}
      <QuickSearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
    </header>
  );
}
