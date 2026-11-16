import { useRef } from 'react';
import type { Status } from '../types';
import { Search, X } from 'lucide-react';

export interface FiltersValue {
  query: string;
  status: Status | 'ativos' | 'todos';
}

export default function Filters({
  value,
  onChange,
}: {
  value: FiltersValue;
  onChange: (next: FiltersValue) => void;
}) {
  const prevStatusRef = useRef<FiltersValue['status']>(value.status);

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
      nextStatus = prevStatusRef.current || 'todos';
    }

    onChange({ ...value, query: newQuery, status: nextStatus });
  };

  const handleClear = () => {
    const nextStatus = prevStatusRef.current || 'todos';
    onChange({ ...value, query: '', status: nextStatus });
  };

  const handleStatusChange = (newStatus: FiltersValue['status']) => {
    if (!value.query.trim()) {
      prevStatusRef.current = newStatus;
    }
    onChange({ ...value, status: newStatus });
  };

  const statusOptions: { value: FiltersValue['status']; label: string }[] = [
    { value: 'ativos', label: 'Ativos' },
    { value: 'agendado', label: 'Aguardando' },
    { value: 'presente', label: 'Na casa' },
    { value: 'finalizado', label: 'Finalizados' },
    { value: 'todos', label: 'Todos' },
  ];

  return (
    <div className="card p-3">
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        <div
          role="group"
          aria-label="Filtrar hóspedes por situação"
          className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-md"
        >
          {statusOptions.map(opt => {
            const active = value.status === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                aria-pressed={active}
                onClick={() => handleStatusChange(opt.value)}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
                  active
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        <div className="relative flex-1 lg:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 dark:text-slate-500 pointer-events-none" />
          <input
            type="text"
            aria-label="Buscar por nome, CPF, SUS, telefone, hospital ou cidade"
            className="input !pl-9 !pr-8 w-full text-xs"
            placeholder="Buscar por nome, CPF, SUS, telefone, hospital, cidade..."
            value={value.query}
            onChange={e => handleQueryChange(e.target.value)}
          />
          {value.query && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Limpar busca"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}