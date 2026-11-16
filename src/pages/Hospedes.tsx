import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import type { Guest } from '../types';
import { useGuests } from '../hooks/useGuests';
import Filters from '../components/Filters';
import type { FiltersValue } from '../components/Filters';
import { StatusBadge } from '../components/StatusBadge';
import WhatsAppButton from '../components/WhatsAppButton';
import CompanionBadge from '../components/CompanionBadge';
import TablePagination from '../components/TablePagination';
import { UserCheck, ChevronRight } from 'lucide-react';
import { calculateAge, formatAppointmentDisplay, formatPersonName, formatDateTimeParts } from '../utils/cpf';
import { matchGuest } from '../utils/search';
import { compareTimeStr, daysSince } from '../utils/labels';

const VALID_STATUS: FiltersValue['status'][] = ['ativos', 'agendado', 'presente', 'finalizado', 'todos'];
const STATUS_ORDER: Record<Guest['status'], number> = { agendado: 0, presente: 1, finalizado: 2 };

/** Consulta de hóspedes: somente leitura. Clicar na linha abre a ficha. */
export default function HospedesPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { guests, settings, loading } = useGuests();

  const [filters, setFilters] = useState<FiltersValue>(() => {
    const s = searchParams.get('status') as FiltersValue['status'] | null;
    return { query: searchParams.get('q') || '', status: s && VALID_STATUS.includes(s) ? s : 'todos' };
  });
  const [currentPage, setCurrentPage] = useState(() => {
    const p = parseInt(searchParams.get('page') || '1', 10);
    return Number.isFinite(p) && p > 0 ? p : 1;
  });
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    const next = new URLSearchParams();
    if (filters.query) next.set('q', filters.query);
    if (filters.status !== 'todos') next.set('status', filters.status);
    if (currentPage > 1) next.set('page', String(currentPage));
    setSearchParams(next, { replace: true });
  }, [filters, currentPage, setSearchParams]);

  const filtered = useMemo(() => {
    let list = guests;
    if (filters.query.trim()) list = list.filter(g => matchGuest(g, filters.query));
    if (filters.status === 'ativos') list = list.filter(g => g.status !== 'finalizado');
    else if (filters.status !== 'todos') list = list.filter(g => g.status === filters.status);

    return [...list].sort((a, b) => {
      if (a.status !== b.status) return STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
      if (a.status === 'agendado') {
        const d = (a.appointmentDate || '9999-99-99').localeCompare(b.appointmentDate || '9999-99-99');
        return d !== 0 ? d : compareTimeStr(a.appointmentTime, b.appointmentTime);
      }
      if (a.status === 'presente') return (b.checkInAt || '').localeCompare(a.checkInAt || '');
      return (b.checkOutAt || '').localeCompare(a.checkOutAt || '');
    });
  }, [guests, filters]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const pageRows = useMemo(
    () => filtered.slice((safePage - 1) * pageSize, safePage * pageSize),
    [filtered, safePage, pageSize]
  );

  function openRow(e: React.MouseEvent, g: Guest) {
    if ((e.target as HTMLElement).closest('a,button,input')) return;
    navigate(`/hospedes/${g.id}`);
  }

  return (
    <div className="container-page py-6 space-y-5">
      <div className="sm:min-h-[48px] flex flex-col justify-center">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Hóspedes</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Consulte qualquer hóspede cadastrado. Clique em uma linha para abrir a ficha.
        </p>
      </div>

      <Filters
        value={filters}
        onChange={next => {
          setFilters(next);
          setCurrentPage(1);
        }}
      />

      <div className="card overflow-hidden">
        <div className="px-4 py-2.5 bg-slate-50/80 dark:bg-slate-800/40 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between min-h-[42px]">
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Lista de hóspedes</span>
          <span className="text-xs text-slate-500 tabular-nums">
            {filtered.length} {filtered.length === 1 ? 'registro' : 'registros'}
          </span>
        </div>

        <table className="w-full text-sm text-left table-fixed">
          <thead className="bg-slate-50/50 dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800 text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-medium whitespace-nowrap">
            <tr>
              <th className="py-2.5 pl-4 pr-2 w-[62%] sm:w-[40%] md:w-[32%] lg:w-[29%]">Hóspede</th>
              <th className="py-2.5 px-2 w-[38%] sm:w-[18%] md:w-[15%] lg:w-[12%]">Situação</th>
              <th className="py-2.5 px-2 hidden sm:table-cell sm:w-[42%] md:w-[29%] lg:w-[25%]">Consulta / Local</th>
              <th className="py-2.5 px-2 hidden md:table-cell md:w-[14%] lg:w-[11%]">Entrada</th>
              <th className="py-2.5 px-2 hidden lg:table-cell lg:w-[11%]">Saída</th>
              <th className="py-2.5 px-2 hidden lg:table-cell lg:w-[6%]">Idade</th>
              <th className="py-2.5 pl-2 pr-4 hidden md:table-cell md:w-[10%] lg:w-[6%]">Acomp.</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800/70 bg-white dark:bg-slate-900">
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td className="py-3.5 pl-4 pr-2">
                    <div className="h-4 w-40 max-w-full bg-slate-200 dark:bg-slate-800 rounded" />
                  </td>
                  <td className="py-3.5 px-2">
                    <div className="h-5 w-20 bg-slate-200 dark:bg-slate-800 rounded" />
                  </td>
                  <td className="py-3.5 px-2 hidden sm:table-cell">
                    <div className="h-4 w-32 bg-slate-200 dark:bg-slate-800 rounded" />
                  </td>
                  <td className="py-3.5 px-2 hidden md:table-cell">
                    <div className="h-4 w-16 bg-slate-200 dark:bg-slate-800 rounded" />
                  </td>
                  <td className="py-3.5 px-2 hidden lg:table-cell">
                    <div className="h-4 w-16 bg-slate-200 dark:bg-slate-800 rounded" />
                  </td>
                  <td className="py-3.5 px-2 hidden lg:table-cell">
                    <div className="h-4 w-8 bg-slate-200 dark:bg-slate-800 rounded" />
                  </td>
                  <td className="py-3.5 pl-2 pr-4 hidden md:table-cell">
                    <div className="h-4 w-8 bg-slate-200 dark:bg-slate-800 rounded" />
                  </td>
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-10 text-center">
                  <div className="flex flex-col items-center gap-1.5">
                    <UserCheck className="h-7 w-7 text-slate-300 dark:text-slate-600" />
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Nenhum hóspede encontrado</p>
                    <p className="text-xs text-slate-400">
                      Ajuste a busca ou{' '}
                      <Link to="/cadastro" className="font-medium">
                        cadastre um novo hóspede
                      </Link>
                      .
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              pageRows.map(g => {
                const name = formatPersonName(g.name);
                const checkIn = formatDateTimeParts(g.checkInAt);
                const checkOut = formatDateTimeParts(g.checkOutAt);
                const consulta = formatAppointmentDisplay(g.appointmentDate, g.appointmentTime);
                const local = g.medicalNotes || g.reason;
                const overdue = g.status === 'presente' && daysSince(g.checkInAt) > settings.alertDays;
                return (
                  <tr
                    key={g.id}
                    tabIndex={0}
                    onClick={e => openRow(e, g)}
                    onKeyDown={e => {
                      if ((e.key === 'Enter' || e.key === ' ') && !(e.target as HTMLElement).closest('a,button,input')) {
                        e.preventDefault();
                        navigate(`/hospedes/${g.id}`);
                      }
                    }}
                    className="group cursor-pointer hover:bg-slate-50/80 dark:hover:bg-slate-800/40 focus:outline-none focus-visible:bg-slate-50 dark:focus-visible:bg-slate-800/60 transition-colors"
                  >
                    <td className="py-3.5 pl-4 pr-2 align-middle">
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Link
                            to={`/hospedes/${g.id}`}
                            title={name}
                            className="font-medium text-slate-900 dark:text-white group-hover:text-brand-700 dark:group-hover:text-brand-400 truncate"
                          >
                            {name}
                          </Link>
                          {overdue && (
                            <span
                              title={`Na casa há mais de ${settings.alertDays} dias`}
                              className="flex h-4 w-4 items-center justify-center rounded bg-rose-100 text-rose-700 text-[10px] font-bold shrink-0"
                            >
                              !
                            </span>
                          )}
                          <WhatsAppButton phone={g.phone} name={name} />
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums truncate mt-0.5">
                          <span>CPF: {g.cpf}</span>
                          {g.phone && (
                            <>
                              <span className="text-slate-300 dark:text-slate-700">•</span>
                              <span>{g.phone}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-2 align-middle whitespace-nowrap">
                      <StatusBadge status={g.status} />
                    </td>
                    <td className="py-3 px-2 align-middle hidden sm:table-cell">
                      <div className="flex flex-col min-w-0">
                        <span
                          className={`text-xs truncate tabular-nums ${
                            consulta ? 'font-medium text-slate-800 dark:text-slate-200' : 'text-slate-400'
                          }`}
                        >
                          {consulta || 'Sem data agendada'}
                        </span>
                        <span
                          className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5"
                          title={[g.medicalNotes, g.reason].filter(Boolean).join(' • ') || undefined}
                        >
                          {local || 'Local não informado'}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-2 align-middle hidden md:table-cell whitespace-nowrap tabular-nums">
                      <DateCell parts={checkIn} />
                    </td>
                    <td className="py-3 px-2 align-middle hidden lg:table-cell whitespace-nowrap tabular-nums">
                      <DateCell parts={checkOut} />
                    </td>
                    <td className="py-3 px-2 align-middle text-xs text-slate-600 dark:text-slate-300 hidden lg:table-cell whitespace-nowrap tabular-nums">
                      {g.dateOfBirth ? calculateAge(g.dateOfBirth) : '-'}
                    </td>
                    <td className="py-3 pl-2 pr-4 align-middle hidden md:table-cell whitespace-nowrap">
                      <div className="flex items-center justify-between gap-1">
                        <CompanionBadge hasCompanion={g.hasCompanion} companions={g.companions} />
                        <ChevronRight className="h-3.5 w-3.5 text-slate-300 group-hover:text-slate-500 shrink-0 hidden lg:block" />
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        <TablePagination
          currentPage={safePage}
          totalItems={filtered.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={size => {
            setPageSize(size);
            setCurrentPage(1);
          }}
        />
      </div>
    </div>
  );
}

function DateCell({ parts }: { parts: { date: string; time: string } | null }) {
  if (!parts) return <span className="text-xs text-slate-400">-</span>;
  return (
    <div className="flex flex-col leading-tight">
      <span className="text-xs font-medium text-slate-700 dark:text-slate-200">{parts.date}</span>
      <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">às {parts.time}</span>
    </div>
  );
}
