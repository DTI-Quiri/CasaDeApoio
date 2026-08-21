import { useRef } from 'react';
import type { Status } from '../types';
import { Search, X } from 'lucide-react';

export interface FiltersValue {
  query: string;
  status: Status | 'todos';
}

export default function Filters({
  value,
  onChange,
}: {
  value: FiltersValue;
  onChange: (next: FiltersValue) => void;
}) {
  const prevStatusRef = useRef<FiltersValue['status']>(
    value.status !== 'todos' ? value.status : 'presente'
  );

  const handleQueryChange = (newQuery: string) => {
    const isNowSearching = newQuery.trim().length > 0;
    const wasSearching = value.query.trim().length > 0;

    let nextStatus = value.status;

    if (isNowSearching && !wasSearching) {
      if (value.status !== 'todos') {
        prevStatusRef.current = value.status;
      }
      nextStatus = 'todos';
    } else if (!isNowSearching && wasSearching) {
      nextStatus = prevStatusRef.current || 'presente';
    }

    onChange({ ...value, query: newQuery, status: nextStatus });
  };

  const handleClear = () => {
    const nextStatus = prevStatusRef.current || 'presente';
    onChange({ ...value, query: '', status: nextStatus });
  };

  const handleStatusChange = (newStatus: FiltersValue['status']) => {
    if (!value.query.trim()) {
      prevStatusRef.current = newStatus;
    }
    onChange({ ...value, status: newStatus });
  };

  return (
    <div className="card p-3 sm:p-4 shadow-sm">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500 pointer-events-none" />
          <input
            type="text"
            className="input !pl-10 !pr-10 py-2.5 w-full text-sm placeholder:text-slate-400 dark:placeholder:text-slate-500"
            placeholder="Buscar por nome, endereço, celular, CPF, SUS, hospital, acompanhante..."
            value={value.query}
            onChange={e => handleQueryChange(e.target.value)}
          />
          {value.query && (
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

        <div className="sm:w-56 shrink-0">
          <select
            className="input py-2.5 w-full text-sm font-medium cursor-pointer"
            value={value.status}
            onChange={e =>
              handleStatusChange(e.target.value as FiltersValue['status'])
            }
          >
            <option value="presente">Hóspedes Presentes</option>
            <option value="finalizado">Estadias Finalizadas</option>
            <option value="todos">Todos os status</option>
          </select>
        </div>
      </div>
    </div>
  );
}