import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { AuditEntry } from '../types';
import { useGuests } from '../hooks/useGuests';
import { listAuditBetween } from '../services/guests';
import { exportGuestsToCSV, exportGuestsToPDF } from '../components/ExportButtons';
import TablePagination from '../components/TablePagination';
import DateInput from '../components/DateInput';
import { subscribeToDataChanges } from '../utils/sync';
import { formatPersonName } from '../utils/cpf';
import { classifyAuditEvent, ymd } from '../utils/labels';
import { toast } from 'sonner';
import { Calendar, AlertCircle, FileSpreadsheet, FileText, LogIn, LogOut, XCircle, Users } from 'lucide-react';

type Preset = 'hoje' | '7d' | '30d' | 'mes' | 'custom';
type EventFilter = 'todos' | 'checkin' | 'checkout' | 'noshow' | 'edit';

function presetRange(p: Exclude<Preset, 'custom'>) {
  const now = new Date();
  if (p === 'hoje') return { start: ymd(now), end: ymd(now) };
  if (p === 'mes') {
    return {
      start: ymd(new Date(now.getFullYear(), now.getMonth(), 1)),
      end: ymd(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
    };
  }
  const past = new Date();
  past.setDate(now.getDate() - ((p === '7d' ? 7 : 30) - 1));
  return { start: ymd(past), end: ymd(now) };
}

/** Relatórios: indicadores por período, movimentações e exportação. */
export default function RelatoriosPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { guests } = useGuests();

  const initialPreset = (searchParams.get('periodo') as Preset) || 'mes';
  const [preset, setPreset] = useState<Preset>(
    ['hoje', '7d', '30d', 'mes', 'custom'].includes(initialPreset) ? initialPreset : 'mes'
  );
  const [range, setRange] = useState(() => {
    const s = searchParams.get('de');
    const e = searchParams.get('ate');
    if (preset === 'custom' && s && e) return { start: s, end: e };
    return presetRange(preset === 'custom' ? 'mes' : preset);
  });
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [eventFilter, setEventFilter] = useState<EventFilter>('todos');
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const invalid = !!range.start && !!range.end && range.start > range.end;
  const incomplete = !range.start || !range.end;

  useEffect(() => {
    const next = new URLSearchParams();
    next.set('periodo', preset);
    if (preset === 'custom') {
      next.set('de', range.start);
      next.set('ate', range.end);
    }
    setSearchParams(next, { replace: true });
  }, [preset, range, setSearchParams]);

  const load = useCallback(
    async (initial = false) => {
      if (invalid || incomplete) {
        if (incomplete) setLogs([]);
        return;
      }
      if (initial) setLoading(true);
      try {
        const startIso = new Date(`${range.start}T00:00:00`).toISOString();
        const endIso = new Date(`${range.end}T23:59:59.999`).toISOString();
        setLogs(await listAuditBetween(startIso, endIso));
      } catch {
        if (initial) toast.error('Erro ao carregar movimentações do período.');
      } finally {
        if (initial) setLoading(false);
      }
    },
    [range, invalid, incomplete]
  );

  useEffect(() => {
    load(true);
    setPage(1);
    return subscribeToDataChanges(() => load(false));
  }, [load]);

  function choose(p: Exclude<Preset, 'custom'>) {
    setPreset(p);
    setRange(presetRange(p));
  }

  const stats = useMemo(() => {
    // Considera apenas transições de estadia para parear corretamente com Desfazer (ignorando edições intermediárias)
    const byGuest = new Map<string, AuditEntry[]>();
    for (const l of logs) {
      const kind = classifyAuditEvent(l).kind;
      if (kind === 'edit' || kind === 'other') continue;
      if (!byGuest.has(l.guestId)) byGuest.set(l.guestId, []);
      byGuest.get(l.guestId)!.push(l);
    }
    let checkins = 0;
    let checkouts = 0;
    let noShows = 0;
    const attended = new Set<string>();
    byGuest.forEach((list, guestId) => {
      list.sort((a, b) => a.at.localeCompare(b.at));
      list.forEach((l, i) => {
        const next = list[i + 1];
        const nextKind = next ? classifyAuditEvent(next).kind : null;
        const kind = classifyAuditEvent(l).kind;
        if (kind === 'checkin' && nextKind !== 'undo_checkin') {
          checkins++;
          attended.add(guestId);
        }
        if (kind === 'checkout' && nextKind !== 'undo_checkout') {
          checkouts++;
          attended.add(guestId);
        }
        if (kind === 'noshow') noShows++;
      });
    });
    return { checkins, checkouts, noShows, attended };
  }, [logs]);

  const guestById = useMemo(() => new Map(guests.map(g => [g.id, g])), [guests]);
  const attendedGuests = useMemo(
    () => [...stats.attended].map(id => guestById.get(id)).filter((g): g is NonNullable<typeof g> => !!g),
    [stats.attended, guestById]
  );

  const eventCounts = useMemo(() => {
    const counts: Record<EventFilter, number> = {
      todos: logs.length,
      checkin: 0,
      checkout: 0,
      noshow: 0,
      edit: 0,
    };
    for (const l of logs) {
      const k = classifyAuditEvent(l).kind;
      if (k === 'checkin' || k === 'checkout' || k === 'noshow' || k === 'edit') {
        counts[k]++;
      }
    }
    return counts;
  }, [logs]);

  const filteredLogs = useMemo(() => {
    if (eventFilter === 'todos') return logs;
    return logs.filter(l => classifyAuditEvent(l).kind === eventFilter);
  }, [logs, eventFilter]);

  const pageLogs = filteredLogs.slice((page - 1) * pageSize, page * pageSize);

  const presets: { id: Exclude<Preset, 'custom'>; label: string }[] = [
    { id: 'hoje', label: 'Hoje' },
    { id: '7d', label: '7 dias' },
    { id: '30d', label: '30 dias' },
    { id: 'mes', label: 'Mês atual' },
  ];

  const eventFilters: { id: EventFilter; label: string }[] = [
    { id: 'todos', label: 'Todos' },
    { id: 'checkin', label: 'Entradas' },
    { id: 'checkout', label: 'Saídas' },
    { id: 'noshow', label: 'Não vieram' },
    { id: 'edit', label: 'Edições' },
  ];

  return (
    <div className="container-page py-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:min-h-[44px]">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Relatórios</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Atendimentos e movimentações por período, com exportação dos hóspedes atendidos
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="btn-secondary cursor-pointer"
            disabled={attendedGuests.length === 0}
            onClick={() => exportGuestsToCSV(attendedGuests)}
            title="Exportar lista dos hóspedes atendidos no período (CSV)"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-slate-500" />
            <span>Exportar atendidos (CSV)</span>
          </button>
          <button
            type="button"
            className="btn-secondary cursor-pointer"
            disabled={attendedGuests.length === 0}
            onClick={() => exportGuestsToPDF(attendedGuests)}
            title="Exportar lista dos hóspedes atendidos no período (PDF)"
          >
            <FileText className="h-3.5 w-3.5 text-slate-500" />
            <span>Exportar atendidos (PDF)</span>
          </button>
        </div>
      </div>

      {/* Período */}
      <div className="card p-3.5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-slate-400" />
              Período:
            </span>
            <DateInput
              id="rel-start"
              ariaLabel="Data inicial"
              value={range.start}
              onChange={iso => {
                setPreset('custom');
                setRange(r => ({ ...r, start: iso }));
              }}
              defaultToToday
              hasError={invalid}
              wrapperClassName="w-[155px] sm:w-[165px] shrink-0"
              className="!h-8 py-1 text-xs tabular-nums"
            />
            <span className="text-xs text-slate-400">até</span>
            <DateInput
              id="rel-end"
              ariaLabel="Data final"
              value={range.end}
              onChange={iso => {
                setPreset('custom');
                setRange(r => ({ ...r, end: iso }));
              }}
              defaultToToday
              hasError={invalid}
              wrapperClassName="w-[155px] sm:w-[165px] shrink-0"
              className="!h-8 py-1 text-xs tabular-nums"
            />
          </div>
          <div role="group" aria-label="Períodos rápidos" className="flex flex-wrap items-center gap-1">
            {presets.map(p => (
              <button
                key={p.id}
                type="button"
                aria-pressed={preset === p.id}
                onClick={() => choose(p.id)}
                className={`text-xs font-medium px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                  preset === p.id
                    ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
        {invalid && (
          <div className="mt-2 text-xs font-medium text-rose-600 flex items-center gap-1" role="alert">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            A data final é anterior à data inicial.
          </div>
        )}
        {!invalid && incomplete && (
          <div className="mt-2 text-xs font-medium text-amber-700 dark:text-amber-400 flex items-center gap-1" role="status">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            Informe a data inicial e a data final para consultar o período.
          </div>
        )}
      </div>

      {/* Indicadores do período */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat icon={Users} accent="brand" label="Hóspedes atendidos" value={stats.attended.size} loading={loading} />
        <Stat icon={LogIn} accent="emerald" label="Entradas" value={stats.checkins} loading={loading} />
        <Stat icon={LogOut} accent="amber" label="Saídas (visitas finalizadas)" value={stats.checkouts} loading={loading} />
        <Stat icon={XCircle} accent="rose" label="Não vieram" value={stats.noShows} loading={loading} />
      </div>

      {/* Movimentações */}
      <div className="card overflow-hidden">
        <div className="px-4 py-2.5 bg-slate-50/80 dark:bg-slate-800/40 border-b border-slate-200/80 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 min-h-[42px]">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Movimentações no período
            </span>
            <div role="group" aria-label="Filtrar por tipo de movimentação" className="flex flex-wrap items-center gap-1">
              {eventFilters.map(f => (
                <button
                  key={f.id}
                  type="button"
                  aria-pressed={eventFilter === f.id}
                  onClick={() => {
                    setEventFilter(f.id);
                    setPage(1);
                  }}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer tabular-nums ${
                    eventFilter === f.id
                      ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/70 dark:hover:bg-slate-700'
                  }`}
                >
                  {f.label} ({eventCounts[f.id]})
                </button>
              ))}
            </div>
          </div>
          <span className="text-xs text-slate-500 tabular-nums">{filteredLogs.length} registros</span>
        </div>

        {/* Lista responsiva no mobile */}
        <div className="sm:hidden divide-y divide-slate-200/60 dark:divide-slate-800/70 bg-white dark:bg-slate-900">
          {loading ? (
            <p className="py-10 text-center text-xs text-slate-400">Carregando...</p>
          ) : filteredLogs.length === 0 ? (
            <p className="py-10 text-center text-xs text-slate-400">
              Nenhuma movimentação encontrada neste período.
            </p>
          ) : (
            pageLogs.map(l => {
              const ev = classifyAuditEvent(l);
              const g = guestById.get(l.guestId);
              const d = new Date(l.at);
              return (
                <div key={l.id} className="p-3.5 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`${ev.toneBadge} text-[11px]`}>{ev.label}</span>
                    <span className="text-[11px] tabular-nums text-slate-500 dark:text-slate-400">
                      {d.toLocaleDateString('pt-BR')}{' '}
                      {d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="text-sm truncate">
                    {g ? (
                      <Link
                        to={`/hospedes/${g.id}`}
                        className="font-medium text-slate-900 dark:text-white hover:text-brand-700"
                      >
                        {formatPersonName(g.name)}
                      </Link>
                    ) : (
                      <span className="text-xs text-slate-400">Hóspede removido</span>
                    )}
                  </div>
                  {l.byUser && (
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      Por: <strong className="font-medium">{l.byUser}</strong>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Tabela no desktop */}
        <table className="hidden sm:table w-full text-sm text-left table-fixed">
          <thead className="bg-slate-50/50 dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800 text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-medium whitespace-nowrap">
            <tr>
              <th className="py-2.5 pl-4 pr-2 w-[30%] sm:w-[18%]">Data</th>
              <th className="py-2.5 px-2 w-[40%] sm:w-[37%]">Hóspede</th>
              <th className="py-2.5 px-2 w-[30%] sm:w-[20%]">Evento</th>
              <th className="py-2.5 pl-2 pr-4 hidden sm:table-cell sm:w-[25%]">Registrado por</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800/70 bg-white dark:bg-slate-900">
            {loading ? (
              <tr>
                <td colSpan={4} className="py-10 text-center text-xs text-slate-400">
                  Carregando...
                </td>
              </tr>
            ) : filteredLogs.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-10 text-center text-xs text-slate-400">
                  Nenhuma movimentação encontrada neste período.
                </td>
              </tr>
            ) : (
              pageLogs.map(l => {
                const ev = classifyAuditEvent(l);
                const g = guestById.get(l.guestId);
                const d = new Date(l.at);
                return (
                  <tr key={l.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    <td className="py-2.5 pl-4 pr-2 text-xs tabular-nums text-slate-600 dark:text-slate-300 whitespace-nowrap">
                      {d.toLocaleDateString('pt-BR')}{' '}
                      <span className="text-slate-400">
                        {d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </td>
                    <td className="py-2.5 px-2 truncate">
                      {g ? (
                        <Link
                          to={`/hospedes/${g.id}`}
                          className="font-medium text-slate-900 dark:text-white hover:text-brand-700"
                        >
                          {formatPersonName(g.name)}
                        </Link>
                      ) : (
                        <span className="text-xs text-slate-400">Hóspede removido</span>
                      )}
                    </td>
                    <td className="py-2.5 px-2 whitespace-nowrap">
                      <span className={`${ev.toneBadge} text-[11px]`}>{ev.label}</span>
                    </td>
                    <td className="py-2.5 pl-2 pr-4 text-xs text-slate-500 hidden sm:table-cell truncate">{l.byUser}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        <TablePagination
          currentPage={page}
          totalItems={filteredLogs.length}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={s => {
            setPageSize(s);
            setPage(1);
          }}
        />
      </div>
    </div>
  );
}

const STAT_ACCENT = {
  brand: {
    top: 'border-t-2 border-t-brand-600',
    iconBg: 'bg-brand-50 text-brand-700 dark:bg-brand-950/60 dark:text-brand-300',
  },
  emerald: {
    top: 'border-t-2 border-t-emerald-600',
    iconBg: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300',
  },
  amber: {
    top: 'border-t-2 border-t-amber-500',
    iconBg: 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300',
  },
  rose: {
    top: 'border-t-2 border-t-rose-500',
    iconBg: 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300',
  },
};

function Stat({
  icon: Icon,
  accent = 'brand',
  label,
  value,
  loading,
}: {
  icon: React.ComponentType<{ className?: string }>;
  accent?: keyof typeof STAT_ACCENT;
  label: string;
  value: number;
  loading: boolean;
}) {
  const theme = STAT_ACCENT[accent];
  return (
    <div className={`card p-5 ${theme.top}`}>
      <div className="flex items-center justify-between gap-2 mb-3">
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate">
          {label}
        </span>
        <span className={`h-8 w-8 rounded-lg ${theme.iconBg} flex items-center justify-center shrink-0`}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <div className="text-3xl font-bold leading-none tracking-tight text-slate-900 dark:text-white tabular-nums">
        {loading ? <span className="inline-block h-8 w-14 rounded bg-slate-200 dark:bg-slate-800 animate-pulse" /> : value}
      </div>
    </div>
  );
}
