import { useEffect, useMemo, useState, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { listGuests } from '../services/guests';
import type { Guest } from '../types';
import { StatusBadge } from '../components/StatusBadge';
import ExportButtons from '../components/ExportButtons';
import { Search, History, ArrowRight, Loader2, Users, X } from 'lucide-react';
import { calculateAge } from '../utils/cpf';
import { matchGuest } from '../utils/search';

export default function GuestHistoryListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [q, setQ] = useState(searchParams.get('q') || '');
  const [status, setStatus] = useState(searchParams.get('status') || '');

  const prevStatusRef = useRef<string>(status || 'presente');

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const data = await listGuests();
        setGuests(data);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    const next = new URLSearchParams();
    if (q) next.set('q', q);
    if (status) next.set('status', status);
    setSearchParams(next);
  }, [q, status, setSearchParams]);

  const handleQueryChange = (newQ: string) => {
    const isNowSearching = newQ.trim().length > 0;
    const wasSearching = q.trim().length > 0;
    let nextStatus = status;

    if (isNowSearching && !wasSearching) {
      if (status) {
        prevStatusRef.current = status;
      }
      nextStatus = '';
    } else if (!isNowSearching && wasSearching) {
      nextStatus = prevStatusRef.current || '';
    }

    setQ(newQ);
    setStatus(nextStatus);
  };

  const handleClear = () => {
    setQ('');
    setStatus(prevStatusRef.current || '');
  };

  const handleStatusChange = (newStatus: string) => {
    if (!q.trim()) {
      prevStatusRef.current = newStatus;
    }
    setStatus(newStatus);
  };

  const filtered = useMemo(() => {
    return guests.filter(g => {
      const matchSearch = matchGuest(g, q);
      const matchStatus = !status || g.status === status;
      return matchSearch && matchStatus;
    });
  }, [guests, q, status]);

  return (
    <div className="container-page py-8 space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
            <History className="h-6 w-6 text-brand-600 dark:text-brand-400" />
            Histórico Geral de Hóspedes
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Consulte o histórico de visitas, estadias passadas e atendimentos por hóspede
          </p>
        </div>

        <ExportButtons guests={filtered} />
      </div>

      {/* Filter card */}
      <div className="card p-4 sm:p-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-2 relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500 pointer-events-none" />
            <input
              value={q}
              onChange={e => handleQueryChange(e.target.value)}
              placeholder="Buscar por nome, endereço, celular, CPF, SUS, hospital, acompanhante..."
              className="input !pl-10 !pr-10"
            />
            {q && (
              <button
                type="button"
                onClick={handleClear}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                title="Limpar busca"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <select
            value={status}
            onChange={e => handleStatusChange(e.target.value)}
            className="input cursor-pointer"
          >
            <option value="">Todos os status</option>
            <option value="presente">Presente</option>
            <option value="finalizado">Finalizado</option>
          </select>
        </div>
      </div>

      {/* Guest History Table */}
      <div className="card overflow-hidden shadow-card">
        {loading ? (
          <div className="py-16 flex flex-col items-center justify-center gap-3 text-slate-500">
            <Loader2 className="h-7 w-7 animate-spin text-brand-600" />
            <p className="text-sm font-medium">Carregando histórico...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-slate-500">
            <Users className="h-10 w-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              Nenhum hóspede encontrado
            </p>
            <p className="text-xs text-slate-400">Tente ajustar o termo de pesquisa</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm text-left">
              <thead className="bg-slate-50/90 dark:bg-slate-900/90 border-b border-slate-200/80 dark:border-slate-800/80 text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold">
                <tr>
                  <th className="py-3.5 px-5">Nome do Hóspede</th>
                  <th className="py-3.5 px-4">CPF</th>
                  <th className="py-3.5 px-4">Celular</th>
                  <th className="py-3.5 px-4">Idade</th>
                  <th className="py-3.5 px-4">Status Atual</th>
                  <th className="py-3.5 px-5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 bg-white/40 dark:bg-slate-900/40">
                {filtered.map(g => (
                  <tr
                    key={g.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors group"
                  >
                    <td className="py-3.5 px-5 font-bold text-slate-900 dark:text-white">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center font-bold text-xs shrink-0 group-hover:bg-brand-50 group-hover:text-brand-600 transition-colors">
                          {g.name.charAt(0).toUpperCase()}
                        </div>
                        <span>{g.name}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-xs font-medium text-slate-500">
                      {g.cpf || '-'}
                    </td>
                    <td className="py-3.5 px-4 text-xs font-medium text-slate-500">
                      {g.phone || '-'}
                    </td>
                    <td className="py-3.5 px-4 text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {g.dateOfBirth ? `${calculateAge(g.dateOfBirth)} anos` : '-'}
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={g.status} />
                    </td>
                    <td className="py-3.5 px-5 text-right">
                      <Link
                        className="btn-secondary py-1 px-3 text-xs font-semibold rounded-lg inline-flex items-center gap-1.5"
                        to={`/hospedes/${g.id}/historico`}
                      >
                        <span>Ver Histórico</span>
                        <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}