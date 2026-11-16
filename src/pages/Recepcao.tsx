import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { Guest } from '../types';
import { useGuests } from '../hooks/useGuests';
import { useGuestActions } from '../hooks/useGuestActions';
import {
  Users,
  Calendar,
  CheckCircle2,
  XCircle,
  Search,
  X,
  Building2,
  LogOut,
  FileText,
  History,
  Printer,
} from 'lucide-react';
import ConfirmModal from '../components/ConfirmModal';
import WhatsAppButton from '../components/WhatsAppButton';
import CompanionBadge from '../components/CompanionBadge';
import ActionMenu from '../components/ActionMenu';
import { formatAppointmentDisplay, getTodayISO, formatPersonName } from '../utils/cpf';
import { matchGuest } from '../utils/search';
import { companionCount, compareTimeStr, daysSince } from '../utils/labels';
import { printDailySheet } from '../utils/printDailySheet';

type Tab = 'todos' | 'agendado' | 'presente';

export default function RecepcaoPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { guests, setGuests, settings, loading } = useGuests();
  const actions = useGuestActions(setGuests);

  const [query, setQuery] = useState(() => searchParams.get('q') || '');
  const [tab, setTab] = useState<Tab>(() => {
    const t = searchParams.get('tab');
    return t === 'agendado' || t === 'presente' ? t : 'todos';
  });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [guestToCheckout, setGuestToCheckout] = useState<Guest | null>(null);
  const [batchCheckoutOpen, setBatchCheckoutOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const next = new URLSearchParams();
    if (query) next.set('q', query);
    if (tab !== 'todos') next.set('tab', tab);
    setSearchParams(next, { replace: true });
  }, [query, tab, setSearchParams]);

  const todayISO = getTodayISO();

  const searched = useMemo(
    () => (query.trim() ? guests.filter(g => matchGuest(g, query)) : guests),
    [guests, query]
  );

  const arriving = useMemo(
    () =>
      searched
        .filter(g => g.status === 'agendado')
        .sort((a, b) => {
          const d = (a.appointmentDate || '9999-99-99').localeCompare(b.appointmentDate || '9999-99-99');
          if (d !== 0) return d;
          return compareTimeStr(a.appointmentTime, b.appointmentTime);
        }),
    [searched]
  );

  const inHouse = useMemo(
    () =>
      searched
        .filter(g => g.status === 'presente')
        .sort((a, b) => (b.checkInAt || '').localeCompare(a.checkInAt || '')),
    [searched]
  );

  const peopleInHouse = useMemo(
    () => guests.filter(g => g.status === 'presente').reduce((acc, g) => acc + 1 + companionCount(g), 0),
    [guests]
  );

  const arrivingToday = arriving.filter(g => g.appointmentDate === todayISO);
  const selectedArriving = arriving.filter(g => selectedIds.includes(g.id));
  const selectedInHouse = inHouse.filter(g => selectedIds.includes(g.id));

  function toggleOne(id: string) {
    setSelectedIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  }

  function toggleAll(list: Guest[]) {
    const ids = list.map(g => g.id);
    const all = ids.length > 0 && ids.every(id => selectedIds.includes(id));
    setSelectedIds(prev => (all ? prev.filter(id => !ids.includes(id)) : Array.from(new Set([...prev, ...ids]))));
  }

  function clearSection(list: Guest[]) {
    const ids = new Set(list.map(g => g.id));
    setSelectedIds(prev => prev.filter(id => !ids.has(id)));
  }

  function selectTodayArrivals() {
    const ids = arrivingToday.map(g => g.id);
    if (ids.length === 0) return;
    setSelectedIds(prev => Array.from(new Set([...prev, ...ids])));
  }

  async function runBatchCheckin() {
    try {
      setBusy(true);
      await actions.checkinMany(selectedArriving);
      setSelectedIds(prev => prev.filter(id => !selectedArriving.some(g => g.id === id)));
    } catch {
      /* toast já exibido */
    } finally {
      setBusy(false);
    }
  }

  async function runBatchCheckout() {
    try {
      setBusy(true);
      await actions.checkoutMany(selectedInHouse);
      setSelectedIds(prev => prev.filter(id => !selectedInHouse.some(g => g.id === id)));
      setBatchCheckoutOpen(false);
    } catch {
      /* toast já exibido */
    } finally {
      setBusy(false);
    }
  }

  async function runCheckout() {
    if (!guestToCheckout) return;
    try {
      setBusy(true);
      await actions.checkout(guestToCheckout);
      setGuestToCheckout(null);
    } catch {
      /* toast já exibido */
    } finally {
      setBusy(false);
    }
  }

  const tabs: { id: Tab; label: string; count: number; dot?: string }[] = [
    { id: 'todos', label: 'Todos', count: arriving.length + inHouse.length },
    { id: 'agendado', label: 'Aguardando', count: arriving.length, dot: 'bg-blue-600' },
    { id: 'presente', label: 'Na casa', count: inHouse.length, dot: 'bg-emerald-600' },
  ];

  const showArriving = tab === 'todos' || tab === 'agendado';
  const showInHouse = tab === 'todos' || tab === 'presente';
  const single = tab !== 'todos';

  return (
    <div className="container-page py-6 space-y-5">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:min-h-[44px]">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Recepção</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Registre a entrada e a saída dos hóspedes
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => printDailySheet(guests)}
            disabled={loading}
            className="btn-secondary !py-1.5 !px-3 text-xs cursor-pointer"
          >
            <Printer className="h-3.5 w-3.5" />
            <span>Imprimir lista do dia</span>
          </button>
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 tabular-nums">
            <Users className="h-3.5 w-3.5 text-slate-400" />
            <span>
              <strong className="text-slate-900 dark:text-white font-semibold">{peopleInHouse}</strong> pessoas na casa
            </span>
          </div>
        </div>
      </div>

      {/* Barra de filtros */}
      <div className="card p-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div
          role="group"
          aria-label="Filtrar por situação"
          className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-md self-start"
        >
          {tabs.map(t => (
            <button
              key={t.id}
              type="button"
              aria-pressed={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 tabular-nums ${
                tab === t.id
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {t.dot && <span className={`h-1.5 w-1.5 rounded-full ${t.dot}`} />}
              {t.label} ({t.count})
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar por nome, CPF ou hospital..."
            aria-label="Buscar hóspede"
            className="input !pl-9 !pr-8 text-xs"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Limpar busca"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className={`grid grid-cols-1 gap-5 items-start ${tab === 'todos' ? 'lg:grid-cols-2' : ''}`}>
        {showArriving && (
          <Section
            title="Aguardando chegada"
            dot="bg-blue-600"
            list={arriving}
            loading={loading}
            single={single}
            selectedIds={selectedIds}
            onToggleAll={() => toggleAll(arriving)}
            batchButton={
              selectedArriving.length > 0 ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => clearSection(arriving)}
                    className="text-[11px] font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
                  >
                    Limpar
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={runBatchCheckin}
                    className="btn-success !py-1 !px-2.5 text-xs cursor-pointer"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>Registrar entrada ({selectedArriving.length})</span>
                  </button>
                </div>
              ) : arrivingToday.length > 0 ? (
                <button
                  type="button"
                  onClick={selectTodayArrivals}
                  className="text-[11px] font-medium px-2 py-0.5 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/50 dark:text-blue-300 dark:hover:bg-blue-900/60 transition-colors cursor-pointer tabular-nums"
                  title="Selecionar todos com consulta marcada para hoje"
                >
                  Selecionar de hoje ({arrivingToday.length})
                </button>
              ) : null
            }
            emptyTitle="Ninguém aguardando chegada"
            emptyHint="Novos encaminhamentos cadastrados aparecerão aqui automaticamente."
            renderRow={g => {
              const isToday = g.appointmentDate === todayISO;
              const isLate = !!g.appointmentDate && g.appointmentDate < todayISO;
              const consulta = formatAppointmentDisplay(g.appointmentDate, g.appointmentTime);
              return (
                <Row
                  key={g.id}
                  g={g}
                  selected={selectedIds.includes(g.id)}
                  onToggle={() => toggleOne(g.id)}
                  badges={
                    <>
                      {isToday && <span className="badge-blue text-[11px]">Consulta hoje</span>}
                      {isLate && (
                        <span className="badge-red text-[11px]">
                          Consulta já passou
                        </span>
                      )}
                    </>
                  }
                  meta={
                    consulta && (
                      <span className="font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1 whitespace-nowrap">
                        <Calendar className="h-3.5 w-3.5 text-slate-400" />
                        {consulta}
                      </span>
                    )
                  }
                  actions={
                    <>
                      <button
                        type="button"
                        onClick={() => actions.checkin(g)}
                        className="btn-success !py-1.5 !px-3 min-w-[138px] justify-center text-xs cursor-pointer"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>Registrar entrada</span>
                      </button>
                      <ActionMenu
                        label={`Mais ações para ${formatPersonName(g.name)}`}
                        items={[
                          { label: 'Abrir ficha', icon: FileText, to: `/hospedes/${g.id}` },
                          { label: 'Não veio', icon: XCircle, onClick: () => actions.noShow(g), danger: true },
                        ]}
                      />
                    </>
                  }
                />
              );
            }}
          />
        )}

        {showInHouse && (
          <Section
            title="Na casa"
            dot="bg-emerald-600"
            list={inHouse}
            loading={loading}
            single={single}
            selectedIds={selectedIds}
            onToggleAll={() => toggleAll(inHouse)}
            batchButton={
              selectedInHouse.length > 0 && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => clearSection(inHouse)}
                    className="text-[11px] font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
                  >
                    Limpar
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setBatchCheckoutOpen(true)}
                    className="btn-warning !py-1 !px-2.5 text-xs cursor-pointer"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    <span>Registrar saída ({selectedInHouse.length})</span>
                  </button>
                </div>
              )
            }
            emptyTitle="Ninguém na casa no momento"
            emptyHint="Quando o hóspede chegar, registre a entrada na lista de aguardando."
            renderRow={g => {
              const days = Math.floor(daysSince(g.checkInAt));
              const overdue = days > settings.alertDays;
              const consulta = formatAppointmentDisplay(g.appointmentDate, g.appointmentTime);
              return (
                <Row
                  key={g.id}
                  g={g}
                  selected={selectedIds.includes(g.id)}
                  onToggle={() => toggleOne(g.id)}
                  badges={
                    overdue && (
                      <span
                        className="badge-red text-[11px]"
                        title={`Limite de alerta: ${settings.alertDays} dias`}
                      >
                        Há {days} dias
                      </span>
                    )
                  }
                  meta={
                    <>
                      {g.checkInAt && (
                        <span className="whitespace-nowrap">
                          Entrada:{' '}
                          <strong className="text-slate-700 dark:text-slate-300 font-medium">
                            {new Date(g.checkInAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                          </strong>
                        </span>
                      )}
                      {consulta && (
                        <span className="flex items-center gap-1 whitespace-nowrap">
                          <Calendar className="h-3.5 w-3.5 text-slate-400" />
                          {consulta}
                        </span>
                      )}
                    </>
                  }
                  actions={
                    <>
                      <button
                        type="button"
                        onClick={() => setGuestToCheckout(g)}
                        className="btn-warning !py-1.5 !px-3 min-w-[138px] justify-center text-xs cursor-pointer"
                      >
                        <LogOut className="h-3.5 w-3.5" />
                        <span>Registrar saída</span>
                      </button>
                      <ActionMenu
                        label={`Mais ações para ${formatPersonName(g.name)}`}
                        items={[
                          { label: 'Abrir ficha', icon: FileText, to: `/hospedes/${g.id}` },
                          { label: 'Ver histórico', icon: History, to: `/hospedes/${g.id}/historico` },
                        ]}
                      />
                    </>
                  }
                />
              );
            }}
          />
        )}
      </div>

      <ConfirmModal
        open={batchCheckoutOpen}
        title="Saída em lote"
        message={`Registrar a saída de ${selectedInHouse.length} hóspede(s)?\n\n${selectedInHouse
          .map(g => `• ${formatPersonName(g.name)}`)
          .join('\n')}`}
        confirmLabel={`Confirmar saída (${selectedInHouse.length})`}
        cancelLabel="Cancelar"
        variant="warning"
        loading={busy}
        onConfirm={runBatchCheckout}
        onCancel={() => setBatchCheckoutOpen(false)}
      />

      <ConfirmModal
        open={!!guestToCheckout}
        title="Registrar saída"
        message={`Registrar a saída de ${formatPersonName(guestToCheckout?.name)} agora?`}
        confirmLabel="Confirmar saída"
        cancelLabel="Cancelar"
        variant="warning"
        loading={busy}
        onConfirm={runCheckout}
        onCancel={() => setGuestToCheckout(null)}
      />
    </div>
  );
}

/* ---------- Componentes de apoio ---------- */

function Section({
  title,
  dot,
  list,
  loading,
  single,
  selectedIds,
  onToggleAll,
  batchButton,
  emptyTitle,
  emptyHint,
  renderRow,
}: {
  title: string;
  dot: string;
  list: Guest[];
  loading: boolean;
  single: boolean;
  selectedIds: string[];
  onToggleAll: () => void;
  batchButton: React.ReactNode;
  emptyTitle: string;
  emptyHint: string;
  renderRow: (g: Guest) => React.ReactNode;
}) {
  const allSelected = list.length > 0 && list.every(g => selectedIds.includes(g.id));
  return (
    <section className="card overflow-hidden" aria-label={title}>
      <div className="px-4 py-2.5 bg-slate-50/80 dark:bg-slate-800/40 border-b border-slate-200/80 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 min-h-[44px]">
        <div className="flex items-center gap-2.5">
          {list.length > 0 && (
            <input
              type="checkbox"
              checked={allSelected}
              onChange={onToggleAll}
              className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
              aria-label={`Selecionar todos em ${title}`}
              title="Selecionar todos"
            />
          )}
          <span className={`h-2 w-2 rounded-full ${dot}`} />
          <h2 className="text-xs font-semibold text-slate-800 dark:text-slate-200 tabular-nums">
            {title} ({list.length})
          </h2>
        </div>
        {batchButton}
      </div>

      {loading ? (
        <div className="p-8 text-center text-xs text-slate-400">Carregando...</div>
      ) : list.length === 0 ? (
        <div className="p-8 text-center space-y-1">
          <p className="text-xs font-medium text-slate-600 dark:text-slate-300">{emptyTitle}</p>
          <p className="text-xs text-slate-400">{emptyHint}</p>
        </div>
      ) : (
        <div
          className={
            single
              ? 'grid grid-cols-1 lg:grid-cols-2 gap-px bg-slate-200/60 dark:bg-slate-800/70'
              : 'divide-y divide-slate-200/60 dark:divide-slate-800/70'
          }
        >
          {list.map(renderRow)}
        </div>
      )}
    </section>
  );
}

function Row({
  g,
  selected,
  onToggle,
  badges,
  meta,
  actions,
}: {
  g: Guest;
  selected: boolean;
  onToggle: () => void;
  badges?: React.ReactNode;
  meta?: React.ReactNode;
  actions: React.ReactNode;
}) {
  const name = formatPersonName(g.name);
  const local = g.medicalNotes || g.reason;
  const hasTags = Boolean(badges) || Boolean(g.hasCompanion);
  return (
    <div
      className={`p-4 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
        selected
          ? 'bg-brand-50/60 dark:bg-brand-950/30'
          : 'bg-white dark:bg-slate-900 hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
      }`}
    >
      <div className="flex items-start gap-2.5 min-w-0 flex-1">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer shrink-0"
          aria-label={`Selecionar ${name}`}
        />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <Link
              to={`/hospedes/${g.id}`}
              title={name}
              className="font-medium text-sm text-slate-900 dark:text-white hover:text-brand-700 dark:hover:text-brand-400 transition-colors truncate"
            >
              {name}
            </Link>
            <WhatsAppButton phone={g.phone} name={name} />
          </div>
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            <span className="whitespace-nowrap">CPF: {g.cpf}</span>
            {meta}
          </div>
          <div className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 min-w-0">
            <Building2 className="h-3 w-3 text-slate-400 shrink-0" />
            <span
              className="truncate"
              title={[g.medicalNotes, g.reason].filter(Boolean).join(' • ') || undefined}
            >
              {local || 'Local não informado'}
            </span>
          </div>
          {hasTags && (
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              {badges}
              {g.hasCompanion && (
                <CompanionBadge mode="card" hasCompanion={g.hasCompanion} companions={g.companions} />
              )}
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center justify-end gap-1.5 shrink-0">{actions}</div>
    </div>
  );
}
