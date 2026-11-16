import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Search, X, ArrowRight, Loader2, Building2, Calendar, Phone, Users } from 'lucide-react';
import type { Guest, Status } from '../types';
import { listGuests } from '../services/guests';
import { matchGuest } from '../utils/search';
import { formatAppointmentDisplay, formatPersonName } from '../utils/cpf';
import { companionCount } from '../utils/labels';
import { StatusBadge } from './StatusBadge';
import { useModalA11y } from '../utils/useModalA11y';

type QuickFilter = 'todos' | Status;

export default function QuickSearchModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const [guests, setGuests] = useState<Guest[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<QuickFilter>('todos');
  const [activeIndex, setActiveIndex] = useState(0);
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const titleId = useId();

  useModalA11y(open, dialogRef, onClose);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setStatusFilter('todos');
      setActiveIndex(0);
      return;
    }
    let active = true;
    setLoading(true);
    listGuests()
      .then(data => {
        if (active) setGuests(data);
      })
      .catch(() => {
        // ignore silent error on quick search
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    const t = window.setTimeout(() => inputRef.current?.focus(), 20);
    return () => {
      active = false;
      window.clearTimeout(t);
    };
  }, [open]);

  const queryMatched = useMemo(() => {
    const statusOrder: Record<Guest['status'], number> = {
      presente: 0,
      agendado: 1,
      finalizado: 2,
    };
    const base = query.trim() ? guests.filter(g => matchGuest(g, query)) : guests;
    return [...base].sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);
  }, [guests, query]);

  const counts = useMemo(() => {
    let presente = 0;
    let agendado = 0;
    let finalizado = 0;
    for (const g of queryMatched) {
      if (g.status === 'presente') presente++;
      else if (g.status === 'agendado') agendado++;
      else finalizado++;
    }
    return {
      todos: queryMatched.length,
      presente,
      agendado,
      finalizado,
    };
  }, [queryMatched]);

  const filtered = useMemo(() => {
    if (statusFilter === 'todos') return queryMatched;
    return queryMatched.filter(g => g.status === statusFilter);
  }, [queryMatched, statusFilter]);

  const results = useMemo(() => filtered.slice(0, 25), [filtered]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, statusFilter]);

  function openGuest(g: Guest) {
    onClose();
    navigate(`/hospedes/${g.id}`);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (results.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(i => (i + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(i => (i - 1 + results.length) % results.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target = results[activeIndex];
      if (target) openGuest(target);
    }
  }

  if (!open) return null;

  const filterTabs: { id: QuickFilter; label: string; count: number; dot?: string }[] = [
    { id: 'todos', label: 'Todos', count: counts.todos },
    { id: 'presente', label: 'Na casa', count: counts.presente, dot: 'bg-emerald-500' },
    { id: 'agendado', label: 'Aguardando', count: counts.agendado, dot: 'bg-blue-500' },
    { id: 'finalizado', label: 'Finalizados', count: counts.finalizado, dot: 'bg-slate-400' },
  ];

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-stretch sm:items-start justify-center p-0 sm:p-5 sm:pt-[6vh] md:pt-[7vh] bg-slate-900/55 backdrop-blur-[2px]"
      onMouseDown={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="w-full sm:max-w-2xl lg:max-w-3xl xl:max-w-4xl h-[100dvh] sm:h-auto sm:max-h-[84vh] rounded-none sm:rounded-xl bg-white dark:bg-slate-900 border-0 sm:border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden outline-none"
      >
        <h2 id={titleId} className="sr-only">
          Busca rápida de hóspedes
        </h2>

        {/* Cabeçalho fixo: input + abas de situação */}
        <div className="shrink-0 p-3 sm:px-4 sm:pt-4 sm:pb-3 border-b border-slate-200/80 dark:border-slate-800 space-y-2.5 bg-white dark:bg-slate-900">
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center gap-2.5 h-11 px-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 focus-within:bg-white dark:focus-within:bg-slate-900 focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/20 transition-all">
              <Search className="h-4 w-4 text-slate-400 shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Buscar por nome, CPF, telefone, SUS, hospital ou acompanhante..."
                aria-label="Buscar hóspede"
                className="flex-1 bg-transparent text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none min-w-0"
              />
              {loading && <Loader2 className="h-4 w-4 animate-spin text-slate-400 shrink-0" />}
              {query && !loading && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery('');
                    inputRef.current?.focus();
                  }}
                  className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded transition-colors cursor-pointer"
                  title="Limpar pesquisa"
                  aria-label="Limpar pesquisa"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="h-11 px-3.5 text-xs font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white bg-slate-100/80 hover:bg-slate-200/70 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer shrink-0"
              aria-label="Fechar busca rápida"
            >
              Fechar
            </button>
          </div>

          <div className="flex items-center justify-between gap-3">
            <div
              role="group"
              aria-label="Filtrar resultados por situação"
              className="flex items-center gap-1.5 overflow-x-auto pb-0.5 sm:pb-0 w-full sm:w-auto"
            >
              {filterTabs.map(t => (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={statusFilter === t.id}
                  onClick={() => {
                    setStatusFilter(t.id);
                    inputRef.current?.focus();
                  }}
                  className={`shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 sm:py-1 rounded-md text-xs font-medium transition-colors cursor-pointer tabular-nums ${
                    statusFilter === t.id
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                      : 'bg-slate-100/80 text-slate-600 hover:bg-slate-200/70 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                  }`}
                >
                  {t.dot && <span className={`h-1.5 w-1.5 rounded-full ${t.dot}`} />}
                  <span>{t.label}</span>
                  <span className="opacity-75">({t.count})</span>
                </button>
              ))}
            </div>

            <span className="hidden md:inline text-[11px] text-slate-400 shrink-0 tabular-nums">
              {filtered.length === results.length
                ? `${results.length} ${results.length === 1 ? 'resultado' : 'resultados'}`
                : `Mostrando ${results.length} de ${filtered.length}`}
            </span>
          </div>
        </div>

        {/* Lista de resultados ocupando todo o espaço restante */}
        <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
          {results.length === 0 && !loading ? (
            <div className="py-14 px-4 text-center space-y-2">
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                {query.trim()
                  ? `Nenhum hóspede encontrado para "${query}".`
                  : 'Nenhum hóspede nesta situação.'}
              </p>
              {(query.trim() || statusFilter !== 'todos') && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery('');
                    setStatusFilter('todos');
                    inputRef.current?.focus();
                  }}
                  className="btn-secondary !py-1.5 !px-3 text-xs cursor-pointer"
                >
                  Limpar filtros
                </button>
              )}
            </div>
          ) : (
            results.map((g, idx) => {
              const compTotal = companionCount(g);
              const consulta = formatAppointmentDisplay(g.appointmentDate, g.appointmentTime);
              return (
                <button
                  key={g.id}
                  type="button"
                  onMouseEnter={() => setActiveIndex(idx)}
                  onClick={() => openGuest(g)}
                  className={`w-full text-left px-4 sm:px-5 py-3.5 sm:py-3 flex items-center justify-between gap-4 transition-colors cursor-pointer ${
                    idx === activeIndex
                      ? 'bg-slate-100/90 dark:bg-slate-800'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <div className="min-w-0 flex-1 space-y-1.5">
                    {/* Linha 1: Nome + Situação + Acompanhantes */}
                    <div className="flex flex-wrap items-center gap-2 min-w-0">
                      <span className="font-semibold text-sm text-slate-900 dark:text-white truncate">
                        {formatPersonName(g.name)}
                      </span>
                      <StatusBadge status={g.status} />
                      {compTotal > 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-200/80 dark:bg-amber-950/50 dark:text-amber-200 dark:border-amber-800/60 tabular-nums">
                          <Users className="h-3 w-3" />
                          +{compTotal} acomp.
                        </span>
                      )}
                    </div>

                    {/* Linha 2: CPF, Celular e Consulta em colunas alinhadas no desktop */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 sm:grid sm:grid-cols-[11.5rem_10.5rem_1fr] sm:items-center sm:gap-3 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                      <span className="truncate">CPF: {g.cpf}</span>
                      <span className="inline-flex items-center gap-1.5 truncate">
                        <Phone className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span className={g.phone ? '' : 'text-slate-400 dark:text-slate-500'}>
                          {g.phone || 'Sem telefone'}
                        </span>
                      </span>
                      <span
                        className={`inline-flex items-center gap-1.5 truncate ${
                          consulta
                            ? 'text-slate-600 dark:text-slate-300'
                            : 'text-slate-400 dark:text-slate-500'
                        }`}
                      >
                        <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{consulta || 'Consulta não informada'}</span>
                      </span>
                    </div>

                    {/* Linha 3: Local de atendimento sempre em linha própria */}
                    <div
                      className={`flex items-center gap-1.5 text-xs min-w-0 ${
                        g.medicalNotes
                          ? 'text-slate-600 dark:text-slate-300'
                          : 'text-slate-400 dark:text-slate-500'
                      }`}
                    >
                      <Building2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">
                        {g.medicalNotes || 'Hospital / clínica não informado'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 text-xs font-medium text-slate-400">
                    <span className="hidden md:inline">Abrir ficha</span>
                    <ArrowRight className="h-4 w-4" />
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Rodapé (apenas telas maiores; mobile aproveita espaço útil acima do teclado) */}
        <div className="hidden sm:flex shrink-0 px-4 py-2.5 bg-slate-50/80 dark:bg-slate-800/40 border-t border-slate-200/80 dark:border-slate-800 items-center justify-between text-[11px] text-slate-400">
          <span>Use ↑ ↓ e Enter para abrir a ficha</span>
          <span>Esc para fechar</span>
        </div>
      </div>
    </div>,
    document.body
  );
}
