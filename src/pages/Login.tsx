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

  const from = (loc.state as { from?: { pathname?: string } })?.from?.pathname || '/painel';

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

      if (res.error === 'USER_NOT_FOUND' || res.error === 'INVALID_PASSWORD') {
        if (lockResult.attempts >= 5) {
          setError(`Credenciais inválidas. IP bloqueado temporariamente (${lockResult.attempts} tentativas).`);
        } else if (lockResult.attempts >= 3) {
          setError(`Usuário ou senha incorretos. Tentativa ${lockResult.attempts} de 5 antes do bloqueio.`);
        } else {
          setError('Usuário ou senha incorretos. Verifique os dados digitados.');
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
    <div className="min-h-screen w-full flex items-center justify-center p-4 sm:p-6 bg-[#eef2f6] dark:bg-[#090d16]">
      <div className="w-full max-w-[780px] rounded-2xl overflow-hidden border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-glass grid grid-cols-1 md:grid-cols-12">
        {/* Coluna Institucional */}
        <div className="md:col-span-5 bg-brand-800 dark:bg-brand-950 text-white p-7 sm:p-8 flex flex-col justify-between gap-8">
          <div className="flex md:flex-col items-center md:items-start gap-4 md:gap-5">
            <div className="h-14 w-14 rounded-2xl bg-white p-2 flex items-center justify-center shadow-sm shrink-0">
              <img
                src="/Brasao-Quirinopolis.png"
                alt="Brasão de Quirinópolis"
                className="h-full w-full object-contain"
              />
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-brand-200">
                Prefeitura de Quirinópolis
              </p>
              <h1 className="text-xl font-bold tracking-tight text-white mt-0.5">
                Casa de Apoio
              </h1>
              <p className="text-xs text-brand-100/85 mt-1 leading-relaxed">
                Secretaria Municipal de Saúde · Controle de acolhimento, consultas e estadias.
              </p>
            </div>
          </div>

          <div className="hidden md:block pt-5 border-t border-white/15">
            <p className="text-[11px] text-brand-200/80">
              Acesso restrito à equipe autorizada da recepção e administração.
            </p>
          </div>
        </div>

        {/* Coluna Formulário */}
        <div className="md:col-span-7 p-7 sm:p-9">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white">
                Entrar no sistema
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Informe seu usuário e senha para continuar
              </p>
            </div>
            <ThemeToggle />
          </div>

          {/* Database-backed IP Lockout Banner */}
          {isLockedOut && (
            <div className="mb-4 p-3.5 rounded-md bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-200 text-xs">
              <div className="flex items-center gap-2 font-semibold mb-1">
                <ShieldAlert className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>Acesso Bloqueado Temporariamente</span>
              </div>
              <p className="text-xs text-amber-700 dark:text-amber-300">
                Este IP/usuário errou as credenciais <strong>{attempts} vezes</strong> consecutivas.
              </p>
              <div className="mt-2.5 flex items-center justify-between bg-white/70 dark:bg-slate-900/60 rounded px-2.5 py-1.5 border border-amber-200/80 dark:border-amber-800/50">
                <span className="flex items-center gap-1.5 font-medium text-[11px]">
                  <Clock className="h-3.5 w-3.5" />
                  Liberando em:
                </span>
                <span className="font-mono font-semibold text-xs tabular-nums">
                  {remainingSeconds}s
                </span>
              </div>
            </div>
          )}

          {/* Feedback error alert */}
          {error && !isLockedOut && (
            <div className="mb-4 p-3 rounded-md bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 text-xs font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0" />
              <span className="leading-snug">{error}</span>
            </div>
          )}

          {/* Login Form */}
          <form noValidate onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="label" htmlFor="username-input">
                Usuário
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <User className="h-4 w-4" />
                </div>
                <input
                  id="username-input"
                  className={`input !pl-9 ${
                    error && !username.trim()
                      ? 'border-rose-400 dark:border-rose-500 ring-2 ring-rose-500/15'
                      : ''
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
              <label className="label" htmlFor="password-input">
                Senha
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  id="password-input"
                  className={`input !pl-9 !pr-9 ${
                    error && !password
                      ? 'border-rose-400 dark:border-rose-500 ring-2 ring-rose-500/15'
                      : ''
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
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors cursor-pointer"
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
              className="btn-primary w-full py-2.5 mt-1 text-xs font-semibold cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Entrando...</span>
                </>
              ) : isLockedOut ? (
                <>
                  <Clock className="h-4 w-4" />
                  <span>Aguarde {remainingSeconds}s...</span>
                </>
              ) : (
                <>
                  <span>Entrar no Sistema</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 text-center md:hidden">
            <p className="text-[11px] text-slate-400 dark:text-slate-500">
              Sistema Interno de Controle de Estadias
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}