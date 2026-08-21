import { useEffect, useMemo, useState, useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getGuest, listAudit } from '../services/guests';
import type { AuditEntry, Guest, Companion } from '../types';
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
import { StatusBadge } from '../components/StatusBadge';

type StayGroup = {
  id: string;
  status: 'em_andamento' | 'finalizada' | 'avulso';
  start?: string;
  end?: string;
  durationText?: string;
  procedure?: string;
  hospital?: string;
  medicalStatus?: string;
  companions?: Companion[];
  events: AuditEntry[];
};

function cleanAuditNote(note?: string): string {
  if (!note) return '';
  return note
    .replace(/"true"/gi, '"Sim"')
    .replace(/"false"/gi, '"Não"');
}

function formatDuration(startDate?: string, endDate?: string): string {
  if (!startDate) return '';
  const start = new Date(startDate).getTime();
  const end = endDate ? new Date(endDate).getTime() : Date.now();
  const diffMs = Math.max(0, end - start);
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays === 0) {
    if (diffHours === 0) return 'Menos de 1 hora';
    return `${diffHours} hora${diffHours > 1 ? 's' : ''}`;
  }
  const remainingHours = diffHours % 24;
  if (remainingHours === 0) {
    return `${diffDays} dia${diffDays > 1 ? 's' : ''}`;
  }
  return `${diffDays} dia${diffDays > 1 ? 's' : ''} e ${remainingHours}h`;
}

function organizeStays(guest: Guest | undefined, entries: AuditEntry[]): StayGroup[] {
  if (!guest) return [];

  // Sort entries chronologically ascending
  const sorted = [...entries].sort(
    (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime()
  );

  const stays: StayGroup[] = [];
  let currentStay: StayGroup | null = null;
  let stayIndex = 1;

  for (const entry of sorted) {
    const note = (entry.note || '').toLowerCase();

    // Explicit Check-in:
    // 1. Has note indicating check-in / new stay / initial registration
    // 2. OR status transitioned from non-presente to presente (fromStatus exists and !== 'presente')
    const isExplicitCheckIn =
      note.includes('nova estadia') ||
      note.includes('1ª estadia') ||
      note.includes('cadastro realizado') ||
      note.includes('check-in') ||
      (entry.fromStatus && entry.fromStatus !== 'presente' && entry.toStatus === 'presente');

    // Explicit Check-out:
    // Status transitioned to finalizado without being a simple field edit
    const isExplicitCheckOut =
      note.includes('check-out') ||
      note.includes('estadia finalizada') ||
      (entry.toStatus === 'finalizado' && !note.startsWith('alterou'));

    if (isExplicitCheckIn) {
      if (currentStay && !currentStay.end) {
        // If there was an open stay, finalize it before starting the next
        currentStay.end = entry.at;
        currentStay.status = 'finalizada';
        currentStay.durationText = formatDuration(currentStay.start, currentStay.end);
        stays.push(currentStay);
      }
      currentStay = {
        id: `stay-${stayIndex++}`,
        status: 'em_andamento',
        start: entry.at,
        end: undefined,
        procedure: guest.reason,
        hospital: guest.medicalNotes,
        medicalStatus: guest.medicalStatus,
        companions: guest.companions,
        events: [entry],
      };
      continue;
    }

    if (isExplicitCheckOut) {
      if (!currentStay) {
        currentStay = {
          id: `stay-${stayIndex++}`,
          status: 'finalizada',
          start: guest.checkInAt || entry.at,
          end: entry.at,
          procedure: guest.reason,
          hospital: guest.medicalNotes,
          medicalStatus: guest.medicalStatus,
          companions: guest.companions,
          events: [entry],
        };
        currentStay.durationText = formatDuration(currentStay.start, currentStay.end);
        stays.push(currentStay);
        currentStay = null;
      } else {
        currentStay.end = entry.at;
        currentStay.status = 'finalizada';
        currentStay.durationText = formatDuration(currentStay.start, currentStay.end);
        currentStay.events.push(entry);
        stays.push(currentStay);
        currentStay = null;
      }
      continue;
    }

    // It's a field edit, note, or update during the stay!
    if (currentStay) {
      currentStay.events.push(entry);
    } else {
      // If we don't have an open stay yet, create the stay for this guest
      currentStay = {
        id: `stay-${stayIndex++}`,
        status: guest.status === 'presente' ? 'em_andamento' : 'finalizada',
        start: guest.checkInAt || entry.at,
        end: guest.checkOutAt,
        procedure: guest.reason,
        hospital: guest.medicalNotes,
        medicalStatus: guest.medicalStatus,
        companions: guest.companions,
        events: [entry],
      };
    }
  }

  if (currentStay) {
    if (guest.status === 'finalizado' && !currentStay.end && guest.checkOutAt) {
      currentStay.end = guest.checkOutAt;
      currentStay.status = 'finalizada';
    }
    currentStay.durationText = formatDuration(currentStay.start, currentStay.end);
    stays.push(currentStay);
  }

  // Fallback: If no audit entries exist but guest has checkInAt recorded
  if (stays.length === 0 && guest.checkInAt) {
    stays.push({
      id: 'stay-current',
      status: guest.status === 'presente' ? 'em_andamento' : 'finalizada',
      start: guest.checkInAt,
      end: guest.checkOutAt,
      durationText: formatDuration(guest.checkInAt, guest.checkOutAt),
      procedure: guest.reason,
      hospital: guest.medicalNotes,
      medicalStatus: guest.medicalStatus,
      companions: guest.companions,
      events: [
        {
          id: 'initial-checkin',
          guestId: guest.id,
          toStatus: guest.status,
          at: guest.checkInAt,
          byUser: 'Sistema',
          note: guest.status === 'presente' ? 'Estadia ativa na Casa de Apoio' : 'Estadia finalizada',
        },
      ],
    });
  }

  // Return sorted descending (most recent first)
  return stays.reverse();
}

function getEventStyle(entry: AuditEntry) {
  const note = (entry.note || '').toLowerCase();
  if (entry.toStatus === 'presente' || note.includes('iniciada') || note.includes('check-in')) {
    return {
      icon: <LogIn className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />,
      badgeBg: 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60',
      tag: 'Check-in / Entrada',
    };
  }
  if (entry.toStatus === 'finalizado' || note.includes('finalizada') || note.includes('check-out')) {
    return {
      icon: <LogOut className="h-4 w-4 text-amber-600 dark:text-amber-400" />,
      badgeBg: 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/60',
      tag: 'Check-out / Saída',
    };
  }
  if (note.includes('alterou')) {
    return {
      icon: <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400" />,
      badgeBg: 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/60',
      tag: 'Atualização Cadastral',
    };
  }
  return {
    icon: <History className="h-4 w-4 text-slate-500 dark:text-slate-400" />,
    badgeBg: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700',
    tag: 'Registro de Atividade',
  };
}

export default function GuestHistoryPage() {
  const { id } = useParams();
  const [guest, setGuest] = useState<Guest | undefined>();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'todas' | 'presente' | 'finalizada'>('todas');
  const [searchTerm, setSearchTerm] = useState('');
  const [openStays, setOpenStays] = useState<Record<string, boolean>>({});

  const toggleStay = (stayId: string) => {
    setOpenStays(prev => ({
      ...prev,
      [stayId]: !prev[stayId],
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
    return allStays.filter(stay => {
      // Tab filter
      if (activeTab === 'presente' && stay.status !== 'em_andamento') return false;
      if (activeTab === 'finalizada' && stay.status !== 'finalizada') return false;

      // Text search filter
      if (!searchTerm.trim()) return true;
      const q = searchTerm.toLowerCase();
      const matchHospital = (stay.hospital || '').toLowerCase().includes(q);
      const matchProcedure = (stay.procedure || '').toLowerCase().includes(q);
      const matchEvents = stay.events.some(
        e =>
          (e.note || '').toLowerCase().includes(q) ||
          (e.byUser || '').toLowerCase().includes(q)
      );
      return matchHospital || matchProcedure || matchEvents;
    });
  }, [allStays, activeTab, searchTerm]);

  return (
    <div className="container-page py-8 space-y-6 animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            to="/historico"
            className="p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800 transition-colors"
            title="Voltar à Lista de Histórico"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              <History className="h-6 w-6 text-brand-600 dark:text-brand-400" />
              Histórico de {guest?.name || 'Hóspede'}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Linha do tempo completa com todas as estadias, procedimentos e alterações
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {guest && (
            <Link
              to={`/hospedes/${guest.id}`}
              className="btn-primary text-xs sm:text-sm font-semibold shadow-sm flex items-center gap-2"
            >
              <User className="h-4 w-4" />
              <span>Ver Ficha Cadastral</span>
            </Link>
          )}
        </div>
      </div>

      {/* Guest Summary Card */}
      {guest && (
        <div className="card p-6 shadow-sm border border-slate-200/80 dark:border-slate-800/80">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="flex items-start sm:items-center gap-4">
              <div className="h-16 w-16 rounded-2xl bg-gradient-to-tr from-brand-600 to-brand-400 text-white flex items-center justify-center text-2xl font-extrabold shadow-md shrink-0">
                {guest.name.charAt(0).toUpperCase()}
              </div>
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                    {guest.name}
                  </h2>
                  <StatusBadge status={guest.status} />
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-500 dark:text-slate-400">
                  <span className="flex items-center gap-1">
                    <strong>CPF:</strong> {guest.cpf || '-'}
                  </span>
                  {guest.susCard && (
                    <>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <CreditCard className="h-3.5 w-3.5 text-blue-500" />
                        <strong>CNS/SUS:</strong> {guest.susCard}
                      </span>
                    </>
                  )}
                  {guest.phone && (
                    <>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Phone className="h-3.5 w-3.5 text-emerald-500" />
                        <strong>Contato:</strong> {guest.phone}
                      </span>
                    </>
                  )}
                  {guest.addressCity && (
                    <>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5 text-rose-500" />
                        {guest.addressCity} - {guest.addressState || 'GO'}
                      </span>
                    </>
                  )}
                  <span>•</span>
                  <span>
                    <strong>Idade:</strong> {guest.dateOfBirth ? `${calculateAge(guest.dateOfBirth)} anos` : '-'}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Metrics */}
            <div className="flex items-center gap-3 shrink-0 pt-4 lg:pt-0 border-t lg:border-t-0 border-slate-100 dark:border-slate-800">
              <div className="px-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/50 text-center min-w-[100px]">
                <span className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Estadias</span>
                <span className="text-lg font-bold text-brand-600 dark:text-brand-400">{allStays.length}</span>
              </div>
              <div className="px-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/50 text-center min-w-[100px]">
                <span className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Registros</span>
                <span className="text-lg font-bold text-slate-800 dark:text-slate-200">{entries.length}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="card p-4 sm:p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl">
            <button
              type="button"
              onClick={() => setActiveTab('todas')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'todas'
                  ? 'bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Todas as Estadias ({allStays.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('presente')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'presente'
                  ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Em Andamento ({allStays.filter(s => s.status === 'em_andamento').length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('finalizada')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'finalizada'
                  ? 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Finalizadas ({allStays.filter(s => s.status === 'finalizada').length})
            </button>
          </div>

          {/* Search */}
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            <input
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Buscar hospital, motivo ou operador..."
              className="input !pl-10 !pr-9 text-xs py-2"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
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
        <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-500">
          <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
          <p className="text-sm font-medium">Carregando histórico do hóspede...</p>
        </div>
      ) : filteredStays.length === 0 ? (
        <div className="card p-12 text-center text-slate-500 space-y-3">
          <Calendar className="h-12 w-12 text-slate-300 dark:text-slate-600 mx-auto" />
          <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200">
            Nenhuma estadia encontrada
          </h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            {searchTerm
              ? 'Nenhum resultado corresponde à sua pesquisa. Tente buscar por outros termos.'
              : 'Não há registros para os filtros selecionados.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredStays.map((stay, idx) => {
            const stayNumber = allStays.length - idx;
            const isOngoing = stay.status === 'em_andamento';
            const isOpen = !!openStays[stay.id];

            return (
              <div
                key={stay.id}
                className="card overflow-hidden shadow-card border border-slate-200/80 dark:border-slate-800/80 transition-all hover:shadow-md"
              >
                {/* Stay Header Bar (Clickable) */}
                <div
                  onClick={() => toggleStay(stay.id)}
                  className={`px-6 py-4 bg-slate-50/90 dark:bg-slate-900/90 flex items-center justify-between gap-4 cursor-pointer select-none transition-colors hover:bg-slate-100/80 dark:hover:bg-slate-800/60 ${
                    isOpen ? 'border-b border-slate-200/80 dark:border-slate-800/80' : ''
                  }`}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      toggleStay(stay.id);
                    }
                  }}
                  aria-expanded={isOpen}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`h-9 w-9 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${
                        isOngoing
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 ring-2 ring-emerald-500/20'
                          : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                      }`}
                    >
                      #{stayNumber}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-base text-slate-900 dark:text-white">
                          Estadia #{stayNumber}
                        </span>
                        {isOngoing ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/50">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Em Andamento
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/50">
                            <CheckCircle2 className="h-3 w-3 text-slate-400" />
                            Concluída
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        <span className="flex items-center gap-1">
                          <LogIn className="h-3.5 w-3.5 text-emerald-600" />
                          <strong>Entrada:</strong>{' '}
                          {stay.start
                            ? new Date(stay.start).toLocaleString('pt-BR', {
                                dateStyle: 'short',
                                timeStyle: 'short',
                              })
                            : 'Sem data'}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <LogOut className="h-3.5 w-3.5 text-amber-600" />
                          <strong>Saída:</strong>{' '}
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
                              <Clock className="h-3.5 w-3.5 text-blue-500" />
                              {stay.durationText}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <div className="p-2 rounded-xl text-slate-400 dark:text-slate-500 bg-white/80 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 shadow-2xs">
                      <ChevronDown
                        className={`h-4 w-4 transition-transform duration-200 ${
                          isOpen ? 'rotate-180 text-brand-600 dark:text-brand-400' : ''
                        }`}
                      />
                    </div>
                  </div>
                </div>

                {/* Collapsible Content */}
                {isOpen && (
                  <div className="animate-in fade-in duration-200 divide-y divide-slate-100 dark:divide-slate-800/80">
                    {/* Stay Context Details (Hospital / Motivo / Acompanhantes) */}
                    <div className="px-6 py-4 bg-slate-50/40 dark:bg-slate-900/40 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                      <div>
                        <span className="block font-semibold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                          <Stethoscope className="h-3.5 w-3.5 text-indigo-500" />
                          Procedimento / Motivo
                        </span>
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                          {stay.procedure || 'Não informado'}
                        </p>
                      </div>
                      <div>
                        <span className="block font-semibold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                          <Building2 className="h-3.5 w-3.5 text-blue-500" />
                          Hospital / Local de Atendimento
                        </span>
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                          {stay.hospital || 'Não informado'}
                        </p>
                      </div>
                      <div>
                        <span className="block font-semibold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                          <Users className="h-3.5 w-3.5 text-amber-500" />
                          Acompanhante(s)
                        </span>
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                          {formatCompanionsList(stay.companions) || 'Nenhum'}
                        </p>
                      </div>
                    </div>

                    {/* Event Audit Log for this Stay */}
                    <div className="p-6">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-1.5">
                        <History className="h-3.5 w-3.5 text-slate-500" />
                        Eventos e Ações Registradas ({stay.events.length})
                      </h4>

                      <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
                        {stay.events.map(event => {
                          const style = getEventStyle(event);

                          return (
                            <div key={event.id} className="relative group">
                              {/* Timeline dot */}
                              <div className="absolute -left-6 top-1.5 h-4 w-4 rounded-full bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-600 flex items-center justify-center shadow-sm group-hover:border-brand-500 transition-colors">
                                <span className="h-1.5 w-1.5 rounded-full bg-brand-600 dark:bg-brand-400" />
                              </div>

                              <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <span
                                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${style.badgeBg}`}
                                    >
                                      {style.icon}
                                      {style.tag}
                                    </span>
                                    <span className="text-xs text-slate-400 font-medium">
                                      por <strong>{event.byUser || 'Sistema'}</strong>
                                    </span>
                                  </div>
                                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                                    {cleanAuditNote(event.note) ||
                                      (event.fromStatus
                                        ? `Status atualizado: ${event.fromStatus === 'presente' ? 'Presente' : 'Finalizado'} → ${event.toStatus === 'presente' ? 'Presente' : 'Finalizado'}`
                                        : `Status: ${event.toStatus === 'presente' ? 'Presente' : 'Finalizado'}`)}
                                  </p>
                                </div>

                                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 shrink-0 bg-slate-50 dark:bg-slate-900/60 px-2.5 py-1 rounded-lg border border-slate-200/60 dark:border-slate-800">
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