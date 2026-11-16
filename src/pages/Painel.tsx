import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import type { Guest } from '../types';
import { useGuests } from '../hooks/useGuests';
import {
  Clock,
  Users,
  LogIn,
  LogOut,
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ArrowRight,
  Activity,
  BarChart3,
  Printer,
} from 'lucide-react';
import { formatPersonName, getTodayISO, isoToBrDate } from '../utils/cpf';
import { classifyAuditEvent, companionCount, compareTimeStr, daysSince, isSameLocalDay, ymd } from '../utils/labels';
import { printDailySheet } from '../utils/printDailySheet';

type Severity = 'alta' | 'media' | 'info';
interface AttentionItem {
  id: string;
  severity: Severity;
  title: string;
  detail: string;
  to: string;
}

function shortDate(iso: string) {
  const [y, m, d] = iso.split('-');
  return y && m && d ? `${d}/${m}` : iso;
}

/** Painel: somente informação. Nenhum botão aqui altera dados. */
export default function PainelPage() {
  const { guests, settings, auditLogs, loading } = useGuests({ withAudit: true, auditDays: 14 });
  const today = getTodayISO();
  const todayYmd = ymd(new Date());

  const waiting = useMemo(() => guests.filter(g => g.status === 'agendado'), [guests]);
  const inHouse = useMemo(() => guests.filter(g => g.status === 'presente'), [guests]);
  const companionsInHouse = useMemo(() => inHouse.reduce((a, g) => a + companionCount(g), 0), [inHouse]);
  const peopleInHouse = inHouse.length + companionsInHouse;
  const maxCapacity = settings?.maxCapacity && settings.maxCapacity > 0 ? settings.maxCapacity : undefined;
  const occupancyPct = maxCapacity ? Math.min(100, Math.round((peopleInHouse / maxCapacity) * 100)) : undefined;
  const waitingToday = waiting.filter(g => g.appointmentDate === today).length;

  const todayLogs = useMemo(
    () =>
      auditLogs
        .filter(l => isSameLocalDay(l.at, todayYmd))
        .sort((a, b) => b.at.localeCompare(a.at)),
    [auditLogs, todayYmd]
  );
  const checkinsToday = todayLogs.filter(l => l.fromStatus === 'agendado' && l.toStatus === 'presente').length;
  const checkoutsToday = todayLogs.filter(l => l.fromStatus === 'presente' && l.toStatus === 'finalizado').length;

  const nameById = useMemo(() => new Map(guests.map(g => [g.id, formatPersonName(g.name)])), [guests]);

  const attention = useMemo<AttentionItem[]>(() => {
    const items: AttentionItem[] = [];
    for (const g of waiting) {
      if (g.appointmentDate && g.appointmentDate < today) {
        items.push({
          id: `late-${g.id}`,
          severity: 'alta',
          title: formatPersonName(g.name),
          detail: `Consulta em ${shortDate(g.appointmentDate)} já passou e não houve entrada. Confirme se veio.`,
          to: `/recepcao?tab=agendado&q=${encodeURIComponent(g.cpf || g.name)}`,
        });
      }
    }
    for (const g of inHouse) {
      const d = Math.floor(daysSince(g.checkInAt));
      if (d > settings.alertDays) {
        items.push({
          id: `long-${g.id}`,
          severity: 'media',
          title: formatPersonName(g.name),
          detail: `Na casa há ${d} dias (limite de alerta: ${settings.alertDays}).`,
          to: `/hospedes/${g.id}`,
        });
      }
    }
    for (const g of waiting) {
      if (g.appointmentDate === today) {
        items.push({
          id: `today-${g.id}`,
          severity: 'info',
          title: formatPersonName(g.name),
          detail: `Consulta hoje${g.appointmentTime ? ` às ${g.appointmentTime}` : ''} e ainda não chegou.`,
          to: `/recepcao?tab=agendado&q=${encodeURIComponent(g.cpf || g.name)}`,
        });
      }
    }
    const order: Record<Severity, number> = { alta: 0, media: 1, info: 2 };
    return items.sort((a, b) => order[a.severity] - order[b.severity]);
  }, [waiting, inHouse, settings.alertDays, today]);

  const upcoming = useMemo(
    () =>
      waiting
        .filter(g => !g.appointmentDate || g.appointmentDate >= today)
        .sort((a, b) => {
          const d = (a.appointmentDate || '9999').localeCompare(b.appointmentDate || '9999');
          return d !== 0 ? d : compareTimeStr(a.appointmentTime, b.appointmentTime);
        })
        .slice(0, 6),
    [waiting, today]
  );

  const chart = useMemo(() => {
    const days: { key: string; label: string; count: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push({ key: ymd(d), label: `${String(d.getDate()).padStart(2, '0')}`, count: 0 });
    }
    const idx = new Map(days.map((d, i) => [d.key, i]));
    for (const l of auditLogs) {
      if (l.fromStatus !== 'presente' || l.toStatus !== 'finalizado') continue;
      const i = idx.get(ymd(new Date(l.at)));
      if (i !== undefined) days[i].count++;
    }
    const max = Math.max(1, ...days.map(d => d.count));
    const total = days.reduce((a, d) => a + d.count, 0);
    return { days, max, total };
  }, [auditLogs]);

  const todayLabel = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="container-page py-6 space-y-5">
      <div className="sm:min-h-[48px] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Painel</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 first-letter:uppercase mt-0.5">
            Situação da Casa de Apoio · {todayLabel}
          </p>
        </div>
        <button
          type="button"
          onClick={() => printDailySheet(guests)}
          disabled={loading}
          className="btn-secondary self-start sm:self-auto !py-2 !px-3.5 text-xs cursor-pointer"
        >
          <Printer className="h-3.5 w-3.5" />
          <span>Imprimir lista do dia</span>
        </button>
      </div>

      {/* Indicadores */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi
          to="/recepcao?tab=agendado"
          label="Aguardando chegada"
          icon={Clock}
          accent="blue"
          value={waiting.length}
          hint={waitingToday > 0 ? `${waitingToday} com consulta hoje` : 'Nenhuma consulta hoje'}
          loading={loading}
        />
        <Kpi
          to="/recepcao?tab=presente"
          label="Pessoas na casa (Refeições)"
          icon={Users}
          accent="emerald"
          value={
            maxCapacity ? (
              <span className="inline-flex items-baseline gap-1">
                <span>{peopleInHouse}</span>
                <span className="text-sm font-medium text-slate-400 dark:text-slate-500">
                  / {maxCapacity} vagas
                </span>
              </span>
            ) : (
              peopleInHouse
            )
          }
          hint={`${inHouse.length} ${inHouse.length === 1 ? 'hóspede' : 'hóspedes'} + ${companionsInHouse} ${companionsInHouse === 1 ? 'acompanhante' : 'acompanhantes'}${
            occupancyPct !== undefined ? ` · ${occupancyPct}%` : ''
          }`}
          progress={occupancyPct}
          loading={loading}
        />
        <Kpi
          to="/relatorios?periodo=hoje"
          label="Entradas hoje"
          icon={LogIn}
          accent="brand"
          value={checkinsToday}
          hint="Chegadas registradas hoje"
          loading={loading}
        />
        <Kpi
          to="/relatorios?periodo=hoje"
          label="Saídas hoje"
          icon={LogOut}
          accent="amber"
          value={checkoutsToday}
          hint="Saídas registradas hoje"
          loading={loading}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
        {/* Precisa de atenção */}
        <Panel
          className="lg:col-span-2"
          icon={AlertTriangle}
          title="Precisa de atenção"
          count={attention.length}
        >
          {loading ? (
            <Empty text="Carregando..." />
          ) : attention.length === 0 ? (
            <div className="py-8 flex flex-col items-center gap-1.5 text-center">
              <CheckCircle2 className="h-7 w-7 text-emerald-500" />
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Tudo em ordem</p>
              <p className="text-xs text-slate-400">Nenhuma pendência no momento.</p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[340px] overflow-y-auto">
              {attention.map(item => (
                <li key={item.id}>
                  <Link
                    to={item.to}
                    className={`flex items-start gap-3 px-4 py-3 border-l-[3px] hover:bg-slate-50/90 dark:hover:bg-slate-800/50 transition-colors group ${
                      item.severity === 'alta'
                        ? 'border-l-rose-500'
                        : item.severity === 'media'
                          ? 'border-l-amber-500'
                          : 'border-l-blue-500'
                    }`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-slate-900 dark:text-white truncate">
                        {item.title}
                      </span>
                      <span className="block text-xs text-slate-500 dark:text-slate-400 mt-0.5">{item.detail}</span>
                    </span>
                    <ArrowRight className="h-3.5 w-3.5 mt-1 text-slate-300 group-hover:text-slate-600 dark:group-hover:text-slate-300 shrink-0 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {/* Movimento de hoje */}
        <Panel icon={Activity} title="Movimento de hoje" count={todayLogs.length}>
          {loading ? (
            <Empty text="Carregando..." />
          ) : todayLogs.length === 0 ? (
            <Empty text="Nenhuma movimentação registrada hoje." />
          ) : (
            <ul className="px-4 py-2 space-y-2.5 max-h-[340px] overflow-y-auto">
              {todayLogs.map(l => {
                const ev = classifyAuditEvent(l);
                return (
                  <li key={l.id} className="flex items-start gap-2.5 text-xs">
                    <span className="w-10 shrink-0 tabular-nums text-slate-400 pt-px">
                      {new Date(l.at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className="min-w-0">
                      <span className={`font-semibold ${ev.toneText}`}>{ev.label}</span>{' '}
                      <Link
                        to={`/hospedes/${l.guestId}`}
                        className="text-slate-700 dark:text-slate-200 hover:text-brand-700"
                      >
                        {nameById.get(l.guestId) || 'Hóspede removido'}
                      </Link>
                      <span className="block text-[11px] text-slate-400">por {l.byUser}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        {/* Próximas chegadas */}
        <Panel
          className="lg:col-span-2"
          icon={CalendarClock}
          title="Próximas chegadas"
          action={
            <Link to="/recepcao?tab=agendado" className="text-xs font-medium inline-flex items-center gap-1">
              Ver na Recepção <ArrowRight className="h-3 w-3" />
            </Link>
          }
        >
          {loading ? (
            <Empty text="Carregando..." />
          ) : upcoming.length === 0 ? (
            <Empty text="Nenhuma chegada prevista." />
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {upcoming.map((g: Guest) => (
                <li key={g.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <Link
                    to={`/hospedes/${g.id}`}
                    className="text-sm font-medium text-slate-900 dark:text-white hover:text-brand-700 truncate"
                  >
                    {formatPersonName(g.name)}
                  </Link>
                  <span className="text-xs text-slate-500 tabular-nums whitespace-nowrap">
                    {g.appointmentDate === today ? (
                      <span className="badge-blue text-[11px]">Consulta hoje</span>
                    ) : g.appointmentDate ? (
                      `Consulta ${isoToBrDate(g.appointmentDate)}`
                    ) : (
                      'Sem data'
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {/* Gráfico */}
        <Panel icon={BarChart3} title="Visitas finalizadas · 14 dias" count={chart.total}>
          <div className="px-4 pt-3 pb-4">
            <div
              className="flex items-end gap-1.5 h-28 pb-1 border-b border-slate-200/80 dark:border-slate-800"
              role="img"
              aria-label={`${chart.total} visitas finalizadas nos últimos 14 dias`}
            >
              {chart.days.map(d => (
                <div key={d.key} className="flex-1 flex flex-col items-center justify-end h-full">
                  <div
                    className="w-full rounded-t-[4px] bg-brand-600/85 hover:bg-brand-700 dark:bg-brand-500/80 dark:hover:bg-brand-400 transition-colors min-h-[2px]"
                    style={{ height: `${(d.count / chart.max) * 100}%` }}
                    title={`${d.key.split('-').reverse().join('/')}: ${d.count}`}
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-1.5 mt-1.5">
              {chart.days.map((d, i) => (
                <span key={d.key} className="flex-1 text-center text-[10px] text-slate-400 tabular-nums">
                  {i % 2 === 1 ? d.label : ''}
                </span>
              ))}
            </div>
            <Link to="/relatorios" className="mt-3 text-xs font-medium inline-flex items-center gap-1">
              Abrir relatórios <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </Panel>
      </div>
    </div>
  );
}

/* ---------- Componentes de apoio ---------- */

type KpiAccent = 'brand' | 'emerald' | 'blue' | 'amber';

const KPI_ACCENT: Record<KpiAccent, { top: string; iconBg: string }> = {
  brand: {
    top: 'border-t-2 border-t-brand-600',
    iconBg: 'bg-brand-50 text-brand-700 dark:bg-brand-950/60 dark:text-brand-300',
  },
  emerald: {
    top: 'border-t-2 border-t-emerald-600',
    iconBg: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300',
  },
  blue: {
    top: 'border-t-2 border-t-blue-600',
    iconBg: 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300',
  },
  amber: {
    top: 'border-t-2 border-t-amber-500',
    iconBg: 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300',
  },
};

function Kpi({
  to,
  label,
  icon: Icon,
  accent = 'brand',
  value,
  hint,
  progress,
  loading,
}: {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  accent?: KpiAccent;
  value: React.ReactNode;
  hint: string;
  progress?: number;
  loading: boolean;
}) {
  const theme = KPI_ACCENT[accent];
  return (
    <Link
      to={to}
      className={`card p-5 ${theme.top} group hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-card-hover transition-all !text-inherit`}
    >
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
      {!loading && progress !== undefined && (
        <div className="mt-3 h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              progress >= 95
                ? 'bg-rose-500'
                : progress >= 80
                ? 'bg-amber-500'
                : 'bg-emerald-500'
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
      <div className="mt-2 text-xs text-slate-500 dark:text-slate-400 leading-tight">{hint}</div>
    </Link>
  );
}

function Panel({
  icon: Icon,
  title,
  count,
  action,
  className = '',
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  count?: number;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`card overflow-hidden ${className}`} aria-label={title}>
      <div className="px-4 py-2.5 bg-slate-50/80 dark:bg-slate-800/40 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-2 min-h-[42px]">
        <h2 className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-200">
          <Icon className="h-3.5 w-3.5 text-slate-400" />
          {title}
          {count !== undefined && (
            <span className="tabular-nums text-slate-400 font-medium">({count})</span>
          )}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="py-8 text-center text-xs text-slate-400">{text}</p>;
}
