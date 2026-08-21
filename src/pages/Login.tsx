import { useState, useEffect, useRef } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { User, Lock, ArrowRight, Loader2, Eye, EyeOff, ShieldAlert, Clock, AlertTriangle } from 'lucide-react';
import ThemeToggle from '../components/ThemeToggle';
import { getClientPublicIP } from '../utils/clientIp';
import { checkLockout, recordFailedLogin, recordSuccessfulLogin } from '../services/guests';

export default function LoginPage() {
  const { login } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [clientIp, setClientIp] = useState<string>('');

  // Lockout State from Database / IP
  const [attempts, setAttempts] = useState<number>(0);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const from = (loc.state as { from?: { pathname?: string } })?.from?.pathname || '/dashboard';

  // 1. Resolve client IP and check database lockout on mount
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const ip = await getClientPublicIP();
        if (mounted) {
          setClientIp(ip);
          const lockInfo = await checkLockout(ip);
          if (mounted && lockInfo.locked && lockInfo.remainingSeconds > 0) {
            setRemainingSeconds(lockInfo.remainingSeconds);
            setAttempts(lockInfo.attempts);
          }
        }
      } catch (err) {
        console.warn('Erro ao checar IP no login:', err);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  // 2. Active countdown interval whenever remainingSeconds > 0
  useEffect(() => {
    if (remainingSeconds > 0) {
      timerRef.current = setInterval(() => {
        setRemainingSeconds(prev => {
          if (prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    }
  }, [remainingSeconds]);

  const isLockedOut = remainingSeconds > 0;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const ip = clientIp || (await getClientPublicIP());

    // Check DB lockout before attempting
    const preCheck = await checkLockout(ip, username.trim());
    if (preCheck.locked && preCheck.remainingSeconds > 0) {
      setRemainingSeconds(preCheck.remainingSeconds);
      setAttempts(preCheck.attempts);
      setError(`Acesso bloqueado por excesso de tentativas. Aguarde ${preCheck.remainingSeconds}s.`);
      return;
    }

    if (!username.trim() || !password) {
      setError('Informe o usuário e a senha para continuar.');
      return;
    }

    try {
      setLoading(true);
      const res = await login(username.trim(), password);

      if (res.success) {
        await recordSuccessfulLogin(ip, username.trim());
        setAttempts(0);
        setRemainingSeconds(0);
        nav(from, { replace: true });
        return;
      }

      // Record failed attempt in Database (blocks IP and Username across all tabs/incognito)
      const lockResult = await recordFailedLogin(ip, username.trim());
      setAttempts(lockResult.attempts);

      if (lockResult.locked && lockResult.remainingSeconds > 0) {
        setRemainingSeconds(lockResult.remainingSeconds);
      }

      if (res.error === 'USER_NOT_FOUND') {
        if (lockResult.attempts >= 5) {
          setError(`Usuário não encontrado. IP bloqueado temporariamente (${lockResult.attempts} erros).`);
        } else if (lockResult.attempts >= 3) {
          setError(`Usuário não encontrado. Tentativa ${lockResult.attempts} de 5 antes do bloqueio.`);
        } else {
          setError('Usuário incorreto ou não encontrado no sistema.');
        }
      } else if (res.error === 'INVALID_PASSWORD') {
        if (lockResult.attempts >= 5) {
          setError(`Senha incorreta. IP bloqueado temporariamente (${lockResult.attempts} erros).`);
        } else if (lockResult.attempts >= 3) {
          setError(`Senha incorreta. Tentativa ${lockResult.attempts} de 5 antes do bloqueio.`);
        } else {
          setError('Senha incorreta. Verifique os dados digitados.');
        }
      } else {
        setError('Erro ao conectar ao servidor. Tente novamente.');
      }
    } catch {
      setError('Erro ao validar credenciais. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center p-4 sm:p-6 bg-slate-50/60 dark:bg-slate-950 overflow-hidden selection:bg-blue-500/20">
      {/* Ambient glow lights */}
      <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[550px] h-[350px] bg-gradient-to-tr from-blue-400/10 to-indigo-300/10 dark:from-blue-600/10 dark:to-indigo-500/10 blur-[100px] pointer-events-none rounded-full" />
      <div className="absolute -bottom-20 right-1/4 w-[400px] h-[300px] bg-slate-200/40 dark:bg-blue-900/5 blur-[90px] pointer-events-none rounded-full" />

      {/* Main Card */}
      <div className="relative w-full max-w-[420px] z-10">
        <div className="bg-white/95 dark:bg-slate-900/90 backdrop-blur-xl border border-slate-200/70 dark:border-slate-800/80 rounded-3xl p-8 sm:p-10 shadow-xl shadow-slate-200/50 dark:shadow-2xl dark:shadow-black/40 transition-all duration-300">
          {/* Top Theme Toggle */}
          <div className="flex justify-end -mt-2 -mr-2 mb-2">
            <ThemeToggle />
          </div>

          {/* Logo & Title */}
          <div className="flex flex-col items-center text-center mb-8">
            <div className="relative mb-4 transition-transform duration-300 hover:scale-105">
              <img
                src="/Brasao-Quirinopolis.png"
                alt="Brasão de Quirinópolis"
                className="h-16 w-auto object-contain drop-shadow-sm"
              />
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-slate-800 dark:text-white">
              Casa de Apoio
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
              Acesse sua conta para gerenciar estadias e hóspedes
            </p>
          </div>

          {/* Database-backed IP Lockout Banner */}
          {isLockedOut && (
            <div className="mb-5 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 dark:border-amber-500/20 text-amber-700 dark:text-amber-300 text-xs animate-in fade-in duration-200 shadow-sm">
              <div className="flex items-center gap-2.5 font-bold text-sm mb-1 text-amber-800 dark:text-amber-200">
                <ShieldAlert className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 animate-pulse" />
                <span>Acesso Bloqueado Temporariamente</span>
              </div>
              <p className="text-xs text-amber-700/90 dark:text-amber-300/90 leading-relaxed">
                Este IP/usuário errou as credenciais <strong>{attempts} vezes</strong> consecutivas.
              </p>
              <div className="mt-3 flex items-center justify-between bg-amber-500/15 dark:bg-amber-950/40 rounded-xl px-3 py-2 border border-amber-500/20">
                <span className="flex items-center gap-1.5 font-medium text-[11px]">
                  <Clock className="h-3.5 w-3.5" />
                  Liberando em:
                </span>
                <span className="font-mono font-bold text-sm text-amber-900 dark:text-amber-100">
                  {remainingSeconds}s
                </span>
              </div>
            </div>
          )}

          {/* Feedback error alert */}
          {error && !isLockedOut && (
            <div className="mb-5 p-3.5 rounded-2xl bg-rose-50/90 dark:bg-rose-950/40 border border-rose-200/70 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 text-xs font-medium flex items-center gap-2.5 animate-in fade-in duration-200">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-100 dark:bg-rose-900/80 text-rose-600 dark:text-rose-200 font-bold text-[11px]">
                {attempts >= 3 ? <AlertTriangle className="h-3.5 w-3.5" /> : '!'}
              </span>
              <span className="leading-snug">{error}</span>
            </div>
          )}

          {/* Login Form */}
          <form noValidate onSubmit={onSubmit} className="space-y-4">
            <div>
              <label
                className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5 ml-0.5"
                htmlFor="username-input"
              >
                Usuário
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
                  <User className="h-4 w-4" />
                </div>
                <input
                  id="username-input"
                  className={`w-full rounded-2xl border bg-slate-50/70 dark:bg-slate-950/60 pl-10 pr-3.5 py-3 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 outline-none transition-all duration-200 focus:bg-white dark:focus:bg-slate-900 disabled:opacity-50 disabled:cursor-not-allowed ${
                    error && !username.trim()
                      ? 'border-rose-400 dark:border-rose-500 bg-rose-50/20 ring-4 ring-rose-500/10'
                      : 'border-slate-200/80 dark:border-slate-800 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10'
                  }`}
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  autoComplete="username"
                  disabled={isLockedOut}
                  autoFocus
                />
              </div>
            </div>

            <div>
              <label
                className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5 ml-0.5"
                htmlFor="password-input"
              >
                Senha
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  id="password-input"
                  className={`w-full rounded-2xl border bg-slate-50/70 dark:bg-slate-950/60 pl-10 pr-10 py-3 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 outline-none transition-all duration-200 focus:bg-white dark:focus:bg-slate-900 disabled:opacity-50 disabled:cursor-not-allowed ${
                    error && !password
                      ? 'border-rose-400 dark:border-rose-500 bg-rose-50/20 ring-4 ring-rose-500/10'
                      : 'border-slate-200/80 dark:border-slate-800 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10'
                  }`}
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete="current-password"
                  disabled={isLockedOut}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors cursor-pointer"
                  aria-label={showPassword ? 'Ocultar senha' : 'Exibir senha'}
                  disabled={isLockedOut}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || isLockedOut}
              className="w-full py-3 px-4 mt-2 rounded-2xl bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white text-sm font-semibold shadow-md shadow-blue-500/20 hover:shadow-lg hover:shadow-blue-500/25 transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Entrando...</span>
                </>
              ) : isLockedOut ? (
                <>
                  <Clock className="h-4 w-4 animate-spin" />
                  <span>Aguarde {remainingSeconds}s...</span>
                </>
              ) : (
                <>
                  <span>Entrar no Sistema</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          {/* Minimalist footer */}
          <div className="mt-8 pt-5 border-t border-slate-100/90 dark:border-slate-800/60 text-center">
            <p className="text-[11px] text-slate-400 dark:text-slate-500 font-normal">
              Controle de Estadias • Quirinópolis - GO
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}