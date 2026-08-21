import { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  listGuests,
  changeStatus as changeStatusSvc,
  getSettings,
  deleteGuest as deleteGuestSvc,
  listAllAudit,
  undoCheckout as undoCheckoutSvc,
  startNewStay as startNewStaySvc,
  batchCheckout as batchCheckoutSvc,
  batchUndoCheckout as batchUndoCheckoutSvc,
} from '../services/guests';
import type { Guest, AuditEntry } from '../types';
import Filters from '../components/Filters';
import type { FiltersValue } from '../components/Filters';
import { StatusBadge } from '../components/StatusBadge';
import { exportGuestsToCSV, exportGuestsToPDF } from '../components/ExportButtons';
import { parseCompanions } from '../utils/companion';
import { subscribeToDataChanges } from '../utils/sync';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import {
  Users,
  UserPlus,
  Activity,
  CalendarCheck,
  X,
  AlertCircle,
  Plus,
  ArrowUpRight,
  Clock,
  UserCheck,
  Calendar,
  Trash2,
  Edit3,
  FileSpreadsheet,
  FileText,
  RotateCcw,
  CheckCircle2,
} from 'lucide-react';
import ConfirmModal from '../components/ConfirmModal';
import WhatsAppButton from '../components/WhatsAppButton';
import { calculateAge } from '../utils/cpf';
import { matchGuest } from '../utils/search';

function ymd(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function currentMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { start: ymd(start), end: ymd(end) };
}

function todayRange() {
  const t = ymd(new Date());
  return { start: t, end: t };
}

function lastDaysRange(days: number) {
  const now = new Date();
  const past = new Date();
  past.setDate(now.getDate() - (days - 1));
  return { start: ymd(past), end: ymd(now) };
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [settings, setSettings] = useState(() => ({ alertDays: 7 }));
  const [filters, setFilters] = useState<FiltersValue>({ query: '', status: 'presente' });
  const [guests, setGuests] = useState<Guest[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);
  const [rangeStart, setRangeStart] = useState<string>('');
  const [rangeEnd, setRangeEnd] = useState<string>('');
  const [newActionOpen, setNewActionOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [drawerDetail, setDrawerDetail] = useState<null | 'presentGuests' | 'presentCompanions'>(null);
  const [autoMonth, setAutoMonth] = useState<boolean>(true);
  const [selectedGuestIds, setSelectedGuestIds] = useState<Set<string>>(new Set());
  const [batchCheckoutModalOpen, setBatchCheckoutModalOpen] = useState(false);
  const [batchCheckoutLoading, setBatchCheckoutLoading] = useState(false);

  const newActionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (newActionRef.current && !newActionRef.current.contains(e.target as Node)) {
        setNewActionOpen(false);
      }
    }
    if (newActionOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [newActionOpen]);

  const filtered = useMemo(() => {
    let list = guests;
    if (filters.query.trim()) {
      list = list.filter(g => matchGuest(g, filters.query));
    }
    if (filters.status !== 'todos') {
      list = list.filter(g => g.status === filters.status);
    }
    return list;
  }, [filters, guests]);

  const inRange = useMemo(() => {
    return (iso?: string) => {
      if (!iso) return false;
      const d = new Date(iso);
      if (rangeStart) {
        const s = new Date(`${rangeStart}T00:00:00`);
        if (d < s) return false;
      }
      if (rangeEnd) {
        const e = new Date(`${rangeEnd}T23:59:59`);
        if (d > e) return false;
      }
      return true;
    };
  }, [rangeStart, rangeEnd]);

  useEffect(() => {
    let interval: number | undefined;
    const setRangeToCurrentMonth = () => {
      const { start, end } = currentMonthRange();
      setRangeStart(start);
      setRangeEnd(end);
    };
    if (autoMonth) {
      setRangeToCurrentMonth();
      interval = window.setInterval(setRangeToCurrentMonth, 6 * 60 * 60 * 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoMonth]);

  const presentNow = useMemo(() => guests.filter(g => g.status === 'presente').length, [guests]);
  const presentCompanions = useMemo(() => {
    return guests
      .filter(g => g.status === 'presente')
      .reduce(
        (acc, g) =>
          acc +
          (g.hasCompanion
            ? parseCompanions(g.companions).length > 0
              ? parseCompanions(g.companions).length
              : 1
            : 0),
        0
      );
  }, [guests]);
  const totalPeopleNow = useMemo(() => presentNow + presentCompanions, [presentNow, presentCompanions]);

  const visitasFinalizadasPeriodo = useMemo(() => {
    const byGuest = new Map<string, AuditEntry[]>();
    for (const log of auditLogs) {
      if (!byGuest.has(log.guestId)) byGuest.set(log.guestId, []);
      byGuest.get(log.guestId)!.push(log);
    }
    let count = 0;
    byGuest.forEach(logs => {
      logs.sort((a, b) => a.at.localeCompare(b.at));
      for (let i = 0; i < logs.length; i++) {
        const log = logs[i];
        if (log.fromStatus === 'presente' && log.toStatus === 'finalizado' && inRange(log.at)) {
          let reopened = false;
          for (let j = i + 1; j < logs.length; j++) {
            if (logs[j].toStatus === 'presente') {
              if (logs[j].note !== 'Nova estadia iniciada (Cadastro atualizado)') {
                reopened = true;
              }
              break;
            }
          }
          if (!reopened) count++;
        }
      }
    });
    return count;
  }, [auditLogs, inRange]);

  const presentGuestsList = useMemo(() => guests.filter(g => g.status === 'presente'), [guests]);
  const presentCompanionsList = useMemo(() => {
    const list: { companion: string; guest: string; cpf?: string }[] = [];
    for (const g of guests) {
      if (g.status !== 'presente' || !g.hasCompanion) continue;
      const comps = parseCompanions(g.companions);
      if (comps.length > 0) {
        for (const c of comps) {
          list.push({ companion: c.name || 'Sem nome informado', cpf: c.cpf, guest: g.name });
        }
      } else {
        list.push({ companion: 'Sem nome informado', guest: g.name });
      }
    }
    return list;
  }, [guests]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const statusParam = params.get('status');
    if (statusParam === 'presente' || statusParam === 'finalizado' || statusParam === 'todos') {
      setFilters(prev => ({ ...prev, status: statusParam }));
    }
  }, [location.search]);

  const [guestToDelete, setGuestToDelete] = useState<Guest | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [guestToCheckout, setGuestToCheckout] = useState<Guest | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  async function handleConfirmCheckout() {
    if (!guestToCheckout || !user) return;
    const g = guestToCheckout;
    try {
      setCheckoutLoading(true);
      const next = await changeStatusSvc(g, 'finalizado', user.username);
      setGuests(prev => prev.map(x => (x.id === g.id ? next : x)));
      setGuestToCheckout(null);
      toast.success(`Estadia de "${g.name}" finalizada.`, {
        action: {
          label: 'Desfazer',
          onClick: () => handleUndoCheckout(next),
        },
        duration: 8000,
      });
    } catch {
      toast.error('Erro ao finalizar estadia.');
    } finally {
      setCheckoutLoading(false);
    }
  }

  async function handleUndoCheckout(g: Guest) {
    if (!user) return;
    try {
      const next = await undoCheckoutSvc(g, user.username);
      setGuests(prev => prev.map(x => (x.id === g.id ? next : x)));
      toast.success(`Finalização desfeita! "${g.name}" está marcado como Presente.`);
    } catch {
      toast.error('Erro ao desfazer finalização.');
    }
  }

  const selectedGuests = useMemo(() => {
    return guests.filter(g => selectedGuestIds.has(g.id));
  }, [guests, selectedGuestIds]);

  const presentFilteredGuests = useMemo(() => {
    return filtered.filter(g => g.status === 'presente');
  }, [filtered]);

  const isAllPresentSelected = useMemo(() => {
    if (presentFilteredGuests.length === 0) return false;
    return presentFilteredGuests.every(g => selectedGuestIds.has(g.id));
  }, [presentFilteredGuests, selectedGuestIds]);

  function toggleSelectGuest(id: string) {
    setSelectedGuestIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (isAllPresentSelected) {
      setSelectedGuestIds(prev => {
        const next = new Set(prev);
        presentFilteredGuests.forEach(g => next.delete(g.id));
        return next;
      });
    } else {
      setSelectedGuestIds(prev => {
        const next = new Set(prev);
        presentFilteredGuests.forEach(g => next.add(g.id));
        return next;
      });
    }
  }

  function clearSelection() {
    setSelectedGuestIds(new Set());
  }

  async function handleConfirmBatchCheckout() {
    if (selectedGuests.length === 0 || !user) return;
    const guestsToProcess = selectedGuests.filter(g => g.status === 'presente');
    if (guestsToProcess.length === 0) {
      toast.error('Nenhum hóspede presente selecionado para finalização.');
      setBatchCheckoutModalOpen(false);
      return;
    }

    try {
      setBatchCheckoutLoading(true);
      const updated = await batchCheckoutSvc(guestsToProcess, user.username);
      const updatedMap = new Map(updated.map(u => [u.id, u]));
      setGuests(prev => prev.map(x => updatedMap.get(x.id) || x));
      setSelectedGuestIds(new Set());
      setBatchCheckoutModalOpen(false);

      toast.success(`Estadia de ${guestsToProcess.length} hóspedes finalizada com sucesso!`, {
        action: {
          label: 'Desfazer',
          onClick: () => handleUndoBatchCheckout(updated),
        },
        duration: 8000,
      });
    } catch {
      toast.error('Erro ao realizar finalização em lote.');
    } finally {
      setBatchCheckoutLoading(false);
    }
  }

  async function handleUndoBatchCheckout(guestsToRevert: Guest[]) {
    if (!user || guestsToRevert.length === 0) return;
    try {
      const reverted = await batchUndoCheckoutSvc(guestsToRevert, user.username);
      const revertedMap = new Map(reverted.map(r => [r.id, r]));
      setGuests(prev => prev.map(x => revertedMap.get(x.id) || x));
      toast.success(`Finalização em lote desfeita! ${reverted.length} hóspedes reabertos.`);
    } catch {
      toast.error('Erro ao desfazer finalização em lote.');
    }
  }

  async function handleStartNewStay(g: Guest) {
    if (!user) return;
    try {
      const next = await startNewStaySvc(g, user.username);
      setGuests(prev => prev.map(x => (x.id === g.id ? next : x)));
      toast.success(`Nova estadia iniciada para "${g.name}".`);
    } catch {
      toast.error('Erro ao iniciar nova estadia.');
    }
  }

  async function executeDeleteGuest() {
    if (!guestToDelete) return;
    try {
      setDeleteLoading(true);
      await deleteGuestSvc(guestToDelete.id);
      setGuests(prev => prev.filter(x => x.id !== guestToDelete.id));
      setAuditLogs(prev => prev.filter(x => x.guestId !== guestToDelete.id));
      toast.success(`Hóspede "${guestToDelete.name}" excluído com sucesso.`);
      setGuestToDelete(null);
    } catch {
      toast.error('Erro ao excluir hóspede do banco de dados.');
    } finally {
      setDeleteLoading(false);
    }
  }

  function isStayOverdue(g: Guest) {
    if (g.status !== 'presente' || !g.checkInAt) return false;
    const days = (Date.now() - new Date(g.checkInAt).getTime()) / (1000 * 60 * 60 * 24);
    return days > settings.alertDays;
  }

  const fetchData = useCallback(async (isInitial = false) => {
    if (isInitial) setLoading(true);

    try {
      const [list, s, logs] = await Promise.all([listGuests(), getSettings(), listAllAudit()]);
      setGuests(list);
      setSettings(s);
      setAuditLogs(logs);
    } catch {
      if (isInitial) {
        toast.error('Erro ao carregar dados do painel.');
      }
    } finally {
      if (isInitial) setLoading(false);
    }
  }, []);

  useEffect(() => {
    // 1. Initial load
    fetchData(true);

    // 2. Real-time broadcast channel subscriber (instant multi-tab sync)
    const unsubscribe = subscribeToDataChanges(() => {
      fetchData(false);
    });

    // 3. Periodic background polling (every 8 seconds when visible)
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchData(false);
      }
    }, 8000);

    // 4. Focus / Visibility change listener (instant sync on tab return)
    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        fetchData(false);
      }
    };
    window.addEventListener('focus', handleVisibilityOrFocus);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);

    return () => {
      unsubscribe();
      clearInterval(interval);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
    };
  }, [fetchData]);

  return (
    <div className="container-page py-8 space-y-6 animate-in fade-in duration-300">
      {/* Top Header / Welcome */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Painel de Hóspedes
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative" ref={newActionRef}>
            <button
              type="button"
              className="btn-primary shadow-sm cursor-pointer"
              onClick={() => setNewActionOpen(v => !v)}
            >
              <Plus className="h-4 w-4" />
              <span>Nova Ação</span>
            </button>

            {newActionOpen && (
              <div className="absolute right-0 z-20 mt-2 w-60 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl shadow-xl p-1.5 animate-in fade-in slide-in-from-top-2 duration-150">
                <Link
                  className="flex items-center gap-2.5 px-3.5 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-brand-50 hover:text-brand-700 dark:hover:bg-brand-950/40 dark:hover:text-brand-300 rounded-xl transition-colors"
                  to="/cadastro"
                  onClick={() => setNewActionOpen(false)}
                >
                  <UserPlus className="h-4 w-4 text-brand-600 dark:text-brand-400" />
                  Cadastrar Hóspede
                </Link>
                <Link
                  className="flex items-center gap-2.5 px-3.5 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/70 rounded-xl transition-colors"
                  to="/editar"
                  onClick={() => setNewActionOpen(false)}
                >
                  <Edit3 className="h-4 w-4 text-amber-500" />
                  Editar Registro
                </Link>
                <Link
                  className="flex items-center gap-2.5 px-3.5 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/70 rounded-xl transition-colors"
                  to="/historico"
                  onClick={() => setNewActionOpen(false)}
                >
                  <Calendar className="h-4 w-4 text-slate-500" />
                  Ver Histórico Geral
                </Link>
                <div className="h-px bg-slate-100 dark:bg-slate-800 my-1" />
                <button
                  type="button"
                  className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm font-medium text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 rounded-xl transition-colors text-left cursor-pointer"
                  onClick={() => {
                    exportGuestsToCSV(filtered);
                    setNewActionOpen(false);
                  }}
                >
                  <FileSpreadsheet className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  Exportar Relatório CSV
                </button>
                <button
                  type="button"
                  className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm font-medium text-brand-700 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-950/30 rounded-xl transition-colors text-left cursor-pointer"
                  onClick={() => {
                    exportGuestsToPDF(filtered);
                    setNewActionOpen(false);
                  }}
                >
                  <FileText className="h-4 w-4 text-brand-600 dark:text-brand-400" />
                  Exportar Relatório PDF
                </button>
                <div className="h-px bg-slate-100 dark:bg-slate-800 my-1" />
                <Link
                  className="flex items-center gap-2.5 px-3.5 py-2.5 text-sm font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl transition-colors"
                  to="/excluir"
                  onClick={() => setNewActionOpen(false)}
                >
                  <Trash2 className="h-4 w-4 text-rose-500" />
                  Excluir Registro
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          className="glass-card p-5 cursor-pointer group hover:bg-white/95 dark:hover:bg-slate-900/95 hover:shadow-card-hover hover:-translate-y-1 transition-all duration-300 relative overflow-hidden"
          onClick={() => setDrawerDetail('presentGuests')}
          title="Ver lista de hóspedes presentes"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                Hóspedes Presentes
              </p>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-slate-900 dark:text-white">
                  {presentNow}
                </span>
                <span className="text-xs font-medium text-brand-600 dark:text-brand-400 inline-flex items-center">
                  ver lista <ArrowUpRight className="h-3 w-3 ml-0.5" />
                </span>
              </div>
            </div>
            <div className="p-3 bg-brand-50 dark:bg-brand-900/30 rounded-2xl text-brand-600 dark:text-brand-400 group-hover:scale-110 transition-transform shadow-xs">
              <Users className="h-6 w-6" />
            </div>
          </div>
        </div>

        <div
          className="glass-card p-5 cursor-pointer group hover:bg-white/95 dark:hover:bg-slate-900/95 hover:shadow-card-hover hover:-translate-y-1 transition-all duration-300 relative overflow-hidden"
          onClick={() => setDrawerDetail('presentCompanions')}
          title="Ver lista de acompanhantes e hóspedes"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                Acompanhantes
              </p>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-slate-900 dark:text-white">
                  {presentCompanions}
                </span>
                <span className="text-xs font-medium text-amber-600 dark:text-amber-400 inline-flex items-center">
                  ver lista <ArrowUpRight className="h-3 w-3 ml-0.5" />
                </span>
              </div>
            </div>
            <div className="p-3 bg-amber-50 dark:bg-amber-900/30 rounded-2xl text-amber-600 dark:text-amber-400 group-hover:scale-110 transition-transform shadow-xs">
              <UserPlus className="h-6 w-6" />
            </div>
          </div>
        </div>

        <div className="glass-card p-5 relative overflow-hidden">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                Total Ativos (Agora)
              </p>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-slate-900 dark:text-white">
                  {totalPeopleNow}
                </span>
                <span className="text-xs text-slate-400">pessoas na casa</span>
              </div>
            </div>
            <div className="p-3 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl text-indigo-600 dark:text-indigo-400 shadow-xs">
              <Activity className="h-6 w-6" />
            </div>
          </div>
        </div>

        <div
          className="glass-card p-5 cursor-pointer group hover:bg-white/95 dark:hover:bg-slate-900/95 hover:shadow-card-hover hover:-translate-y-1 transition-all duration-300 relative overflow-hidden"
          onClick={() => navigate('/historico')}
          title="Ver histórico geral de visitas"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                Visitas Finalizadas
              </p>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-slate-900 dark:text-white">
                  {visitasFinalizadasPeriodo}
                </span>
                <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 inline-flex items-center">
                  histórico <ArrowUpRight className="h-3 w-3 ml-0.5" />
                </span>
              </div>
            </div>
            <div className="p-3 bg-emerald-50 dark:bg-emerald-900/30 rounded-2xl text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform shadow-xs">
              <CalendarCheck className="h-6 w-6" />
            </div>
          </div>
        </div>
      </div>

      {/* Date Period Filter Bar */}
      <div className="glass-card p-5 border-slate-200/70 dark:border-slate-800/70">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-brand-600" />
              Período:
            </span>
            <div className="flex items-center gap-2">
              <input
                className="input py-1.5 px-3 max-w-[150px] text-xs font-medium"
                type="date"
                value={rangeStart}
                max={ymd(new Date())}
                onChange={e => {
                  setRangeStart(e.target.value);
                  setAutoMonth(false);
                }}
                aria-label="Data inicial"
              />
              <span className="text-xs font-semibold text-slate-400">até</span>
              <input
                className="input py-1.5 px-3 max-w-[150px] text-xs font-medium"
                type="date"
                value={rangeEnd}
                max={ymd(new Date())}
                onChange={e => {
                  setRangeEnd(e.target.value);
                  setAutoMonth(false);
                }}
                aria-label="Data final"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              onClick={() => {
                const { start, end } = todayRange();
                setRangeStart(start);
                setRangeEnd(end);
                setAutoMonth(false);
              }}
            >
              Hoje
            </button>
            <button
              type="button"
              className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              onClick={() => {
                const { start, end } = lastDaysRange(7);
                setRangeStart(start);
                setRangeEnd(end);
                setAutoMonth(false);
              }}
            >
              Últimos 7 dias
            </button>
            <button
              type="button"
              className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              onClick={() => {
                const { start, end } = lastDaysRange(30);
                setRangeStart(start);
                setRangeEnd(end);
                setAutoMonth(false);
              }}
            >
              Últimos 30 dias
            </button>
            <button
              type="button"
              className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-brand-50 dark:bg-brand-950/40 text-brand-700 dark:text-brand-300 hover:bg-brand-100 dark:hover:bg-brand-900/50 transition-colors"
              onClick={() => setAutoMonth(true)}
            >
              Mês atual
            </button>
            {(rangeStart || rangeEnd) && (
              <button
                type="button"
                className="text-xs font-semibold px-2.5 py-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                onClick={() => {
                  setRangeStart('');
                  setRangeEnd('');
                  setAutoMonth(false);
                }}
              >
                Limpar
              </button>
            )}
          </div>
        </div>
        {rangeStart && rangeEnd && new Date(rangeStart) > new Date(rangeEnd) && (
          <div className="mt-2 text-xs font-medium text-rose-500 flex items-center gap-1">
            <AlertCircle className="h-3.5 w-3.5" />
            Data final anterior à data inicial.
          </div>
        )}
      </div>

      {/* Drawer: Hóspedes Presentes */}
      {drawerDetail === 'presentGuests' && (
        <div className="glass-card p-6 border-brand-200 dark:border-brand-800/30 animate-in fade-in duration-200">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-xl bg-brand-100 dark:bg-brand-900/40 text-brand-600 dark:text-brand-400 flex items-center justify-center font-bold">
                <Users className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Hóspedes Atualmente na Casa ({presentGuestsList.length})
                </h2>
                <p className="text-xs text-slate-500">Lista completa dos hóspedes com estadia ativa</p>
              </div>
            </div>
            <button
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              onClick={() => setDrawerDetail(null)}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {presentGuestsList.length === 0 ? (
            <p className="text-sm text-slate-500 py-6 text-center">
              Nenhum hóspede presente no momento.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {presentGuestsList.map(g => (
                <div
                  key={g.id}
                  className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white/70 dark:bg-slate-900/70 hover:shadow-sm transition-shadow flex items-start justify-between gap-3"
                >
                  <div className="flex flex-col">
                    <div className="flex items-center gap-1.5">
                      <Link
                        to={`/hospedes/${g.id}`}
                        className="font-bold text-slate-900 dark:text-white hover:text-brand-600 dark:hover:text-brand-400 transition-colors text-sm"
                      >
                        {g.name}
                      </Link>
                      <WhatsAppButton phone={g.phone} name={g.name} />
                    </div>
                    <span className="text-xs text-slate-500 mt-1">CPF: {g.cpf}</span>
                    <span className="text-xs text-slate-500">Cel: {g.phone || '-'}</span>
                    <span className="text-xs text-slate-500">Idade: {calculateAge(g.dateOfBirth)}</span>
                  </div>
                  <Link
                    to={`/hospedes/${g.id}`}
                    className="btn-secondary py-1 px-2.5 text-xs font-semibold shrink-0"
                  >
                    Ver
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Drawer: Acompanhantes Presentes */}
      {drawerDetail === 'presentCompanions' && (
        <div className="glass-card p-6 border-amber-200 dark:border-amber-800/30 animate-in fade-in duration-200">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-xl bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
                <UserPlus className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Acompanhantes na Casa ({presentCompanionsList.length})
                </h2>
                <p className="text-xs text-slate-500">Lista dos acompanhantes ativos e seus respectivos hóspedes</p>
              </div>
            </div>
            <button
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              onClick={() => setDrawerDetail(null)}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {presentCompanionsList.length === 0 ? (
            <p className="text-sm text-slate-500 py-6 text-center">
              Nenhum acompanhante na casa no momento.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {presentCompanionsList.map((item, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-xl border border-amber-200/60 dark:border-amber-800/40 bg-white/70 dark:bg-slate-900/70 flex flex-col justify-between"
                >
                  <div>
                    <span className="font-bold text-slate-900 dark:text-white text-sm">
                      {item.companion}
                    </span>
                    {item.cpf && (
                      <span className="block text-xs font-medium text-slate-500 mt-0.5">
                        CPF: {item.cpf}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-slate-500 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    Acompanhando:{' '}
                    <strong className="text-slate-700 dark:text-slate-300 font-semibold">
                      {item.guest}
                    </strong>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Search & Status Filters */}
      <Filters value={filters} onChange={setFilters} />

      {/* Main Guests Table */}
      <div className="card overflow-hidden shadow-card">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm text-left">
            <thead className="bg-slate-50/90 dark:bg-slate-900/90 border-b border-slate-200/80 dark:border-slate-800/80 text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold">
              <tr>
                <th className="py-3.5 pl-5 pr-2 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={isAllPresentSelected}
                    onChange={toggleSelectAll}
                    title={isAllPresentSelected ? 'Desmarcar todos os presentes' : 'Selecionar todos os presentes'}
                    className="rounded border-slate-300 dark:border-slate-700 text-brand-600 focus:ring-brand-500 cursor-pointer h-4 w-4"
                  />
                </th>
                <th className="py-3.5 px-4">Hóspede</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Check-in</th>
                <th className="py-3.5 px-4">Check-out</th>
                <th className="py-3.5 px-4">Idade</th>
                <th className="py-3.5 px-4 hidden lg:table-cell">+18</th>
                <th className="py-3.5 px-4 hidden lg:table-cell">Acomp.</th>
                <th className="py-3.5 px-5 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 bg-white/40 dark:bg-slate-900/40">
              {loading ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={idx} className="animate-pulse">
                    <td className="py-4 px-5">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 bg-slate-200 dark:bg-slate-800 rounded-xl" />
                        <div className="h-4 w-36 bg-slate-200 dark:bg-slate-800 rounded" />
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="h-6 w-20 bg-slate-200 dark:bg-slate-800 rounded-full" />
                    </td>
                    <td className="py-4 px-4">
                      <div className="h-4 w-24 bg-slate-200 dark:bg-slate-800 rounded" />
                    </td>
                    <td className="py-4 px-4">
                      <div className="h-4 w-24 bg-slate-200 dark:bg-slate-800 rounded" />
                    </td>
                    <td className="py-4 px-4">
                      <div className="h-4 w-8 bg-slate-200 dark:bg-slate-800 rounded" />
                    </td>
                    <td className="py-4 px-4 hidden lg:table-cell">
                      <div className="h-4 w-8 bg-slate-200 dark:bg-slate-800 rounded" />
                    </td>
                    <td className="py-4 px-4 hidden lg:table-cell">
                      <div className="h-4 w-8 bg-slate-200 dark:bg-slate-800 rounded" />
                    </td>
                    <td className="py-4 px-5">
                      <div className="flex justify-end gap-2">
                        <div className="h-8 w-20 bg-slate-200 dark:bg-slate-800 rounded-xl" />
                        <div className="h-8 w-20 bg-slate-200 dark:bg-slate-800 rounded-xl" />
                      </div>
                    </td>
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <UserCheck className="h-10 w-10 text-slate-300 dark:text-slate-600" />
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                        Nenhum hóspede encontrado
                      </p>
                      <p className="text-xs text-slate-400">
                        Tente ajustar os filtros ou a busca por nome/CPF
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map(g => {
                  const isSelected = selectedGuestIds.has(g.id);

                  return (
                    <tr
                      key={g.id}
                      className={`hover:bg-slate-50/90 dark:hover:bg-slate-800/50 transition-colors group ${
                        isSelected ? 'bg-brand-50/60 dark:bg-brand-950/40' : ''
                      }`}
                    >
                      <td className="py-3.5 pl-5 pr-2 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectGuest(g.id)}
                          className="rounded border-slate-300 dark:border-slate-700 text-brand-600 focus:ring-brand-500 cursor-pointer h-4 w-4"
                        />
                      </td>
                      <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center font-bold text-xs shrink-0 group-hover:bg-brand-50 group-hover:text-brand-600 dark:group-hover:bg-brand-950/40 dark:group-hover:text-brand-400 transition-colors">
                          {g.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex flex-col">
                          <div className="flex items-center gap-1.5 leading-tight">
                            <Link
                              to={`/hospedes/${g.id}`}
                              className="font-bold text-slate-900 dark:text-white group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors flex items-center gap-1.5"
                            >
                              <span>{g.name}</span>
                              {isStayOverdue(g) && (
                                <span
                                  title={`Há mais de ${settings.alertDays} dias presente`}
                                  className="flex h-5 w-5 items-center justify-center rounded-full bg-rose-100 text-rose-600 text-[10px] font-bold animate-pulse"
                                >
                                  !
                                </span>
                              )}
                            </Link>
                            <WhatsAppButton phone={g.phone} name={g.name} />
                          </div>
                          <span className="text-xs text-slate-400 mt-0.5">
                            CPF: {g.cpf}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <StatusBadge status={g.status} />
                    </td>

                    <td className="py-3.5 px-4 text-xs font-medium text-slate-600 dark:text-slate-300">
                      {g.checkInAt
                        ? new Date(g.checkInAt).toLocaleString('pt-BR', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })
                        : '-'}
                    </td>

                    <td className="py-3.5 px-4 text-xs font-medium text-slate-600 dark:text-slate-300">
                      {g.checkOutAt
                        ? new Date(g.checkOutAt).toLocaleString('pt-BR', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })
                        : '-'}
                    </td>

                    <td className="py-3.5 px-4 text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {calculateAge(g.dateOfBirth)} anos
                    </td>

                    <td className="py-3.5 px-4 hidden lg:table-cell text-xs text-slate-500">
                      {new Date().getFullYear() - new Date(g.dateOfBirth).getFullYear() >= 18 ? (
                        <span className="text-slate-600 dark:text-slate-400 font-medium">Sim</span>
                      ) : (
                        <span className="text-rose-500 font-semibold">Menor</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 hidden lg:table-cell text-xs text-slate-500">
                      {g.hasCompanion ? (
                        <span className="badge-yellow">Sim</span>
                      ) : (
                        <span className="text-slate-400">Não</span>
                      )}
                    </td>

                    <td className="py-3.5 px-5">
                      <div className="flex items-center justify-end gap-1.5">
                        {g.status !== 'presente' ? (
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              className="btn-secondary text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 py-1 px-2.5 text-xs font-semibold rounded-lg inline-flex items-center gap-1"
                              onClick={() => handleUndoCheckout(g)}
                              title="Reabrir estadia (desfazer check-out que foi feito por engano)"
                            >
                              <RotateCcw className="h-3 w-3" />
                              <span>Reabrir</span>
                            </button>
                            <button
                              type="button"
                              className="btn-success py-1 px-2.5 text-xs font-semibold rounded-lg inline-flex items-center gap-1"
                              onClick={() => handleStartNewStay(g)}
                              title="Iniciar nova estadia com data de hoje"
                            >
                              <CheckCircle2 className="h-3 w-3" />
                              <span>Nova</span>
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="btn-secondary text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 py-1 px-3 text-xs font-semibold rounded-lg"
                            onClick={() => setGuestToCheckout(g)}
                            title="Registrar saída / Finalizar estadia com confirmação"
                          >
                            Finalizar
                          </button>
                        )}
                        <Link
                          className="btn-secondary py-1 px-3 text-xs font-semibold rounded-lg"
                          to={`/hospedes/${g.id}`}
                        >
                          Ver Ficha
                        </Link>
                        <button
                          type="button"
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors"
                          onClick={() => setGuestToDelete(g)}
                          title="Excluir hóspede"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Floating Batch Actions Bar */}
      {selectedGuestIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-900/95 dark:bg-slate-800/95 text-white backdrop-blur-xl border border-slate-700/80 shadow-2xl rounded-2xl py-3 px-5 flex items-center gap-4 animate-in slide-in-from-bottom-5 duration-200">
          <div className="flex items-center gap-2 border-r border-slate-700 pr-4">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-500 text-white text-xs font-bold shadow-xs">
              {selectedGuestIds.size}
            </span>
            <span className="text-sm font-semibold whitespace-nowrap">
              {selectedGuestIds.size === 1
                ? '1 selecionado'
                : `${selectedGuestIds.size} selecionados`}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setBatchCheckoutModalOpen(true)}
              className="btn bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs py-2 px-4 rounded-xl shadow-sm flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Clock className="h-4 w-4" />
              <span>Finalizar Selecionados (Check-out)</span>
            </button>

            <button
              type="button"
              onClick={clearSelection}
              className="text-xs font-medium text-slate-400 hover:text-white px-2 py-1 transition-colors cursor-pointer"
            >
              Desmarcar
            </button>
          </div>
        </div>
      )}

      {/* Batch Checkout Confirmation Modal */}
      <ConfirmModal
        open={batchCheckoutModalOpen}
        title="Finalizar Estadias em Lote"
        message={`Tem certeza que deseja finalizar a estadia de ${selectedGuests.filter(g => g.status === 'presente').length} hóspede(s) selecionado(s)? Todos serão marcados como Finalizados com data e hora de saída registradas agora.`}
        confirmLabel={`Sim, Finalizar ${selectedGuests.filter(g => g.status === 'presente').length} Hóspedes`}
        cancelLabel="Cancelar"
        loading={batchCheckoutLoading}
        onConfirm={handleConfirmBatchCheckout}
        onCancel={() => setBatchCheckoutModalOpen(false)}
      />

      {/* Confirmation Modal for Guest Checkout */}
      <ConfirmModal
        open={!!guestToCheckout}
        title="Finalizar Estadia (Check-out)"
        message={`Deseja realmente finalizar a estadia de "${guestToCheckout?.name}"? O hóspede será marcado como Finalizado com data e hora de saída registradas agora.`}
        confirmLabel="Sim, Finalizar Estadia"
        cancelLabel="Cancelar"
        loading={checkoutLoading}
        onConfirm={handleConfirmCheckout}
        onCancel={() => setGuestToCheckout(null)}
      />

      {/* Confirmation Modal for Guest Deletion */}
      <ConfirmModal
        open={!!guestToDelete}
        title="Excluir Hóspede"
        message={`Tem certeza que deseja excluir o cadastro de "${guestToDelete?.name}"? Esta ação removerá o hóspede e todos os seus registros de histórico.`}
        confirmLabel="Sim, Excluir Hóspede"
        cancelLabel="Cancelar"
        loading={deleteLoading}
        onConfirm={executeDeleteGuest}
        onCancel={() => setGuestToDelete(null)}
      />
    </div>
  );
}