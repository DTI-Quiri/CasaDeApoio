import { useEffect, useMemo, useState, useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getGuest, listAudit } from '../services/guests';
import type { AuditEntry, Guest } from '../types';
import { formatCompanionsList } from '../utils/companion';
import { subscribeToDataChanges } from '../utils/sync';
import {
  ArrowLeft,
  History,
  Calendar,
  Stethoscope,
  Loader2,
  User,
  Clock,
  CheckCircle2,
  XCircle,
  Search,
  Building2,
  MapPin,
  FileText,
  LogIn,
  LogOut,
  Users,
  CreditCard,
  Phone,
  X,
  ChevronDown,
} from 'lucide-react';
import { calculateAge } from '../utils/cpf';
import { classifyAuditEvent } from '../utils/labels';
import { cleanAuditNote, organizeStays } from '../utils/history';
import { normalizeText } from '../utils/search';
import { StatusBadge } from '../components/StatusBadge';

function getEventStyle(entry: AuditEntry) {
  const ev = classifyAuditEvent(entry);
  if (ev.kind === 'edit') {
    return {
      icon: <FileText className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />,
      badgeBg: 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/60',
      tag: 'Atualização Cadastral',
    };
  }
  if (ev.kind === 'referral') {
    return {
      icon: <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />,
      badgeBg: 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/60',
      tag: 'Encaminhamento / Aguardando',
    };
  }
  if (ev.kind === 'checkin') {
    return {
      icon: <LogIn className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />,
      badgeBg: 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60',
      tag: 'Entrada na Casa',
    };
  }
  if (ev.kind === 'checkout' || ev.kind === 'noshow') {
    return {
      icon: <LogOut className="h-4 w-4 text-amber-600 dark:text-amber-400" />,
      badgeBg: 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/60',
      tag: ev.kind === 'noshow' ? 'Não veio / Saída' : 'Saída',
    };
  }
  return {
    icon: <History className="h-4 w-4 text-slate-500 dark:text-slate-400" />,
    badgeBg: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700',
    tag: ev.label,
  };
}

export default function GuestHistoryPage() {
  const { id } = useParams();
  const [guest, setGuest] = useState<Guest | undefined>();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'todas' | 'presente' | 'agendado' | 'finalizada'>('todas');
  const [searchTerm, setSearchTerm] = useState('');
  const [openStays, setOpenStays] = useState<Record<string, boolean>>({});

  const toggleStay = (stayId: string, currentlyOpen: boolean) => {
    setOpenStays(prev => ({
      ...prev,
      [stayId]: !currentlyOpen,
    }));
  };

  const loadData = useCallback(async (isInitial = false) => {
    if (!id) return;
    if (isInitial) setLoading(true);
    try {
      const g = await getGuest(id);
      const logs = await listAudit(id);
      setGuest(g);
      setEntries(logs);
    } finally {
      if (isInitial) setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadData(true);

    const unsubscribe = subscribeToDataChanges(() => {
      loadData(false);
    });

    const handleFocus = () => {
      if (document.visibilityState === 'visible') {
        loadData(false);
      }
    };
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);

    return () => {
      unsubscribe();
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
    };
  }, [loadData]);

  const allStays = useMemo(() => organizeStays(guest, entries), [guest, entries]);

  const filteredStays = useMemo(() => {
    const q = normalizeText(searchTerm);
    return allStays.filter(stay => {
      if (activeTab === 'presente' && stay.status !== 'em_andamento') return false;
      if (activeTab === 'agendado' && stay.status !== 'agendada') return false;
      if (activeTab === 'finalizada' && stay.status !== 'finalizada') return false;

      if (!q) return true;
      const haystack = normalizeText(
        [
          stay.hospital,
          stay.procedure,
          stay.appointmentText,
          formatCompanionsList(stay.companions),
          ...stay.events.flatMap(e => [e.note, e.byUser, classifyAuditEvent(e).label]),
        ]
          .filter(Boolean)
          .join(' ')
      );
      return haystack.includes(q);
    });
  }, [allStays, activeTab, searchTerm]);

  return (
    <div className="container-page py-6 space-y-5">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 sm:min-h-[44px]">
        <div className="flex items-center gap-2.5">
          <Link
            to={guest ? `/hospedes/${guest.id}` : "/hospedes"}
            className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-200/60 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800 transition-colors"
            title="Voltar à Ficha do Hóspede"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white">
              Histórico de {guest?.name || 'Hóspede'}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Linha do tempo completa com todas as estadias, procedimentos e alterações
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {guest && (
            <Link
              to={`/hospedes/${guest.id}`}
              className="btn-primary"
            >
              <User className="h-3.5 w-3.5" />
              <span>Ver Ficha Cadastral</span>
            </Link>
          )}
        </div>
      </div>

      {/* Guest Summary Card */}
      {guest && (
        <div className="card p-5">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white">
                  {guest.name}
                </h2>
                <StatusBadge status={guest.status} />
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                <span>
                  <strong className="text-slate-700 dark:text-slate-300 font-medium">CPF:</strong> {guest.cpf || '-'}
                </span>
                {guest.susCard && (
                  <>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <CreditCard className="h-3.5 w-3.5 text-slate-400" />
                      <strong className="text-slate-700 dark:text-slate-300 font-medium">CNS/SUS:</strong> {guest.susCard}
                    </span>
                  </>
                )}
                {guest.phone && (
                  <>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Phone className="h-3.5 w-3.5 text-slate-400" />
                      <strong className="text-slate-700 dark:text-slate-300 font-medium">Contato:</strong> {guest.phone}
                    </span>
                  </>
                )}
                {guest.addressCity && (
                  <>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5 text-slate-400" />
                      {guest.addressCity} - {guest.addressState || 'GO'}
                    </span>
                  </>
                )}
                <span>•</span>
                <span>
                  <strong className="text-slate-700 dark:text-slate-300 font-medium">Idade:</strong>{' '}
                  {guest.dateOfBirth ? `${calculateAge(guest.dateOfBirth)} anos` : '-'}
                </span>
              </div>
            </div>

            {/* Quick Metrics */}
            <div className="flex items-center gap-2.5 shrink-0 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-100 dark:border-slate-800">
              <div className="px-3.5 py-2 rounded-md bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/60 text-center min-w-[90px]">
                <span className="block text-[10px] font-medium text-slate-500 uppercase tracking-wider">Estadias</span>
                <span className="text-base font-semibold text-slate-900 dark:text-white tabular-nums">{allStays.length}</span>
              </div>
              <div className="px-3.5 py-2 rounded-md bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/60 text-center min-w-[90px]">
                <span className="block text-[10px] font-medium text-slate-500 uppercase tracking-wider">Registros</span>
                <span className="text-base font-semibold text-slate-900 dark:text-white tabular-nums">{entries.length}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="card p-3.5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Tabs */}
          <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700/60 rounded-md">
            <button
              type="button"
              onClick={() => setActiveTab('todas')}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
                activeTab === 'todas'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Todas ({allStays.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('presente')}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
                activeTab === 'presente'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Em Andamento ({allStays.filter(s => s.status === 'em_andamento').length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('agendado')}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
                activeTab === 'agendado'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Aguardando ({allStays.filter(s => s.status === 'agendada').length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('finalizada')}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
                activeTab === 'finalizada'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Finalizadas ({allStays.filter(s => s.status === 'finalizada').length})
            </button>
          </div>

          {/* Search */}
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            <input
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Buscar hospital, motivo ou operador..."
              className="input !pl-9 !pr-9"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                title="Limpar busca"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="py-16 flex flex-col items-center justify-center gap-2 text-slate-500">
          <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
          <p className="text-xs font-medium">Carregando histórico do hóspede...</p>
        </div>
      ) : filteredStays.length === 0 ? (
        <div className="card p-10 text-center text-slate-500 space-y-2">
          <Calendar className="h-8 w-8 text-slate-300 dark:text-slate-600 mx-auto" />
          <h3 className="text-sm font-medium text-slate-800 dark:text-slate-200">
            Nenhuma estadia encontrada
          </h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            {searchTerm
              ? 'Nenhum resultado corresponde à sua pesquisa. Tente buscar por outros termos.'
              : 'Não há registros para os filtros selecionados.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3.5">
          {filteredStays.map((stay, idx) => {
            const stayNumber = allStays.length - idx;
            const isOngoing = stay.status === 'em_andamento';
            const isScheduled = stay.status === 'agendada';
            const isOpen = openStays[stay.id] ?? idx === 0;

            return (
              <div
                key={stay.id}
                className="card overflow-hidden"
              >
                {/* Stay Header Bar (Clickable) */}
                <div
                  onClick={() => toggleStay(stay.id, isOpen)}
                  className={`px-5 py-3.5 bg-slate-50/70 dark:bg-slate-900 flex items-center justify-between gap-4 cursor-pointer select-none transition-colors hover:bg-slate-100/70 dark:hover:bg-slate-800/50 ${
                    isOpen ? 'border-b border-slate-200/80 dark:border-slate-800' : ''
                  }`}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      toggleStay(stay.id, isOpen);
                    }
                  }}
                  aria-expanded={isOpen}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`h-8 w-8 rounded-md flex items-center justify-center font-semibold text-xs shrink-0 tabular-nums ${
                        isOngoing
                          ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60'
                          : isScheduled
                            ? 'bg-blue-50 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60'
                            : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      #{stayNumber}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-slate-900 dark:text-white">
                          Estadia #{stayNumber}
                        </span>
                        {isOngoing ? (
                          <span className="badge-green">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400" />
                            Em Andamento
                          </span>
                        ) : isScheduled ? (
                          <span className="badge-blue">
                            <Clock className="h-3 w-3" />
                            Aguardando Chegada
                          </span>
                        ) : stay.noShow ? (
                          <span className="badge-red">
                            <XCircle className="h-3 w-3" />
                            Não veio
                          </span>
                        ) : (
                          <span className="badge-gray">
                            <CheckCircle2 className="h-3 w-3 text-slate-400" />
                            Concluída
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 text-xs text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                        {stay.appointmentText && stay.appointmentText !== '-' && (
                          <>
                            <span className="flex items-center gap-1 font-medium text-slate-700 dark:text-slate-300">
                              <Calendar className="h-3.5 w-3.5 text-slate-400" />
                              Consulta: {stay.appointmentText}
                            </span>
                            <span>•</span>
                          </>
                        )}
                        <span className="flex items-center gap-1">
                          <LogIn className="h-3.5 w-3.5 text-slate-400" />
                          Entrada:{' '}
                          {stay.start
                            ? new Date(stay.start).toLocaleString('pt-BR', {
                                dateStyle: 'short',
                                timeStyle: 'short',
                              })
                            : stay.noShow
                              ? 'Não compareceu'
                              : isScheduled
                                ? 'Aguardando'
                                : 'Não registrada'}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <LogOut className="h-3.5 w-3.5 text-slate-400" />
                          Saída:{' '}
                          {stay.end
                            ? new Date(stay.end).toLocaleString('pt-BR', {
                                dateStyle: 'short',
                                timeStyle: 'short',
                              })
                            : 'Em aberto'}
                        </span>
                        {stay.durationText && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-1 font-medium text-slate-700 dark:text-slate-300">
                              <Clock className="h-3.5 w-3.5 text-slate-400" />
                              {stay.durationText}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <div className="p-1.5 rounded-md text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700">
                      <ChevronDown
                        className={`h-4 w-4 transition-transform duration-150 ${
                          isOpen ? 'rotate-180 text-slate-700 dark:text-slate-200' : ''
                        }`}
                      />
                    </div>
                  </div>
                </div>

                {/* Collapsible Content */}
                {isOpen && (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {/* Stay Context Details (Consulta / Hospital / Motivo / Acompanhantes) */}
                    <div className="px-5 py-3.5 bg-slate-50/40 dark:bg-slate-900/40 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                      <div>
                        <span className="block font-medium text-slate-500 mb-0.5 flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5 text-slate-400" />
                          Dia e Hora da Consulta
                        </span>
                        <p className="text-xs font-medium text-slate-900 dark:text-slate-100 tabular-nums">
                          {stay.appointmentText && stay.appointmentText !== '-'
                            ? stay.appointmentText
                            : 'Não informado'}
                        </p>
                      </div>
                      <div>
                        <span className="block font-medium text-slate-500 mb-0.5 flex items-center gap-1">
                          <Stethoscope className="h-3.5 w-3.5 text-slate-400" />
                          Procedimento / Motivo
                        </span>
                        <p className="text-xs font-medium text-slate-900 dark:text-slate-100">
                          {stay.procedure || 'Não informado'}
                        </p>
                      </div>
                      <div>
                        <span className="block font-medium text-slate-500 mb-0.5 flex items-center gap-1">
                          <Building2 className="h-3.5 w-3.5 text-slate-400" />
                          Hospital / Local de Atendimento
                        </span>
                        <p className="text-xs font-medium text-slate-900 dark:text-slate-100">
                          {stay.hospital || 'Não informado'}
                        </p>
                      </div>
                      <div>
                        <span className="block font-medium text-slate-500 mb-0.5 flex items-center gap-1">
                          <Users className="h-3.5 w-3.5 text-slate-400" />
                          Acompanhante(s)
                        </span>
                        <p className="text-xs font-medium text-slate-900 dark:text-slate-100">
                          {formatCompanionsList(stay.companions) || 'Nenhum'}
                        </p>
                      </div>
                    </div>

                    {/* Event Audit Log for this Stay */}
                    <div className="p-5">
                      <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-1.5">
                        <History className="h-3.5 w-3.5 text-slate-400" />
                        Eventos e Ações Registradas ({stay.events.length})
                      </h4>

                      <div className="relative pl-5 space-y-3 before:absolute before:left-1.5 before:top-2 before:bottom-2 before:w-px before:bg-slate-200 dark:before:bg-slate-800">
                        {stay.events.map(event => {
                          const style = getEventStyle(event);

                          return (
                            <div key={event.id} className="relative group">
                              {/* Timeline dot */}
                              <div className="absolute -left-5 top-1.5 h-3.5 w-3.5 rounded-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 flex items-center justify-center">
                                <span className="h-1.5 w-1.5 rounded-full bg-slate-500 dark:bg-slate-400" />
                              </div>

                              <div className="p-3 rounded-md bg-white dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <span
                                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border ${style.badgeBg}`}
                                    >
                                      {style.icon}
                                      {style.tag}
                                    </span>
                                    <span className="text-xs text-slate-400">
                                      por <strong className="font-medium text-slate-600 dark:text-slate-300">{event.byUser || 'Sistema'}</strong>
                                    </span>
                                  </div>
                                  <p className="text-xs font-medium text-slate-800 dark:text-slate-200">
                                    {cleanAuditNote(event.note) ||
                                      (event.fromStatus
                                        ? `Situação atualizada: ${event.fromStatus === 'presente' ? 'Na casa' : event.fromStatus === 'agendado' ? 'Aguardando' : 'Finalizado'} → ${event.toStatus === 'presente' ? 'Na casa' : event.toStatus === 'agendado' ? 'Aguardando' : 'Finalizado'}`
                                        : `Situação: ${event.toStatus === 'presente' ? 'Na casa' : event.toStatus === 'agendado' ? 'Aguardando' : 'Finalizado'}`)}
                                  </p>
                                </div>

                                <span className="text-xs text-slate-500 dark:text-slate-400 shrink-0 tabular-nums">
                                  {new Date(event.at).toLocaleString('pt-BR', {
                                    dateStyle: 'short',
                                    timeStyle: 'short',
                                  })}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}