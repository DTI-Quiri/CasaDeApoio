import { useState, useRef, useEffect } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { formatDateBR, isoToBrDate, brDateToIso, isValidDateBR } from '../utils/cpf';

interface DateInputProps {
  value: string; // ISO format: YYYY-MM-DD
  onChange: (isoValue: string) => void;
  className?: string;
  wrapperClassName?: string;
  disabled?: boolean;
  required?: boolean;
  id?: string;
  ariaLabel?: string;
  hasError?: boolean;
  placeholder?: string;
  maxDate?: string; // ISO format
  minDate?: string; // ISO format
  defaultToToday?: boolean;
}

const MONTH_NAMES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

const WEEKDAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

export default function DateInput({
  value,
  onChange,
  className = '',
  wrapperClassName = 'w-full',
  disabled = false,
  required = false,
  id,
  ariaLabel,
  hasError = false,
  placeholder = '',
  maxDate,
  defaultToToday = false,
}: DateInputProps) {
  const [displayValue, setDisplayValue] = useState(() => isoToBrDate(value));
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync display value when value prop changes externally
  useEffect(() => {
    setDisplayValue(isoToBrDate(value));
  }, [value]);

  // Determine current view year & month for calendar
  const now = new Date();
  const currentYear = now.getFullYear();
  const fallbackYear = defaultToToday ? currentYear : 1990;
  const fallbackMonth = defaultToToday ? now.getMonth() : 0;
  const initialYear = value ? parseInt(value.split('-')[0], 10) || fallbackYear : fallbackYear;
  const initialMonth = value ? (parseInt(value.split('-')[1], 10) || 1) - 1 : fallbackMonth;

  const [viewYear, setViewYear] = useState(initialYear);
  const [viewMonth, setViewMonth] = useState(initialMonth);

  useEffect(() => {
    if (value) {
      const parts = value.split('-');
      if (parts.length === 3) {
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        if (!isNaN(y)) setViewYear(y);
        if (!isNaN(m)) setViewMonth(m);
      }
    }
  }, [value]);

  // Close calendar on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const formatted = formatDateBR(raw);
    setDisplayValue(formatted);

    const digitsOnly = formatted.replace(/\D/g, '');
    if (digitsOnly.length === 8) {
      if (isValidDateBR(formatted)) {
        const iso = brDateToIso(formatted);
        onChange(iso);
      } else {
        onChange('');
      }
    } else if (digitsOnly.length === 0) {
      onChange('');
    } else if (value) {
      onChange('');
    }
  };

  const handleBlur = () => {
    const digitsOnly = displayValue.replace(/\D/g, '');
    if (digitsOnly.length === 8 && isValidDateBR(displayValue)) {
      const iso = brDateToIso(displayValue);
      onChange(iso);
    } else if (digitsOnly.length > 0) {
      onChange('');
    }
  };

  const handleSelectDay = (day: number) => {
    const yStr = String(viewYear).padStart(4, '0');
    const mStr = String(viewMonth + 1).padStart(2, '0');
    const dStr = String(day).padStart(2, '0');
    const iso = `${yStr}-${mStr}-${dStr}`;

    setDisplayValue(`${dStr}/${mStr}/${yStr}`);
    onChange(iso);
    setIsOpen(false);
  };

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(prev => prev - 1);
    } else {
      setViewMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(prev => prev + 1);
    } else {
      setViewMonth(prev => prev + 1);
    }
  };

  // Generate calendar grid
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();

  // Selected date comparison
  const selectedDateParts = value ? value.split('-').map(Number) : null;
  const isSelectedDay = (day: number) => {
    if (!selectedDateParts) return false;
    return (
      selectedDateParts[0] === viewYear &&
      selectedDateParts[1] === viewMonth + 1 &&
      selectedDateParts[2] === day
    );
  };

  // Generate list of years from maxAllowedYear down to 1910
  const yearOptions: number[] = [];
  const maxAllowedYear = maxDate
    ? parseInt(maxDate.split('-')[0], 10)
    : defaultToToday
      ? currentYear + 2
      : currentYear;
  for (let y = maxAllowedYear; y >= 1910; y--) {
    yearOptions.push(y);
  }

  const hasClearButton = Boolean(displayValue && !disabled);

  return (
    <div ref={containerRef} className={`relative ${wrapperClassName}`}>
      <div className="relative flex items-center">
        <input
          id={id}
          aria-label={ariaLabel}
          required={required}
          type="text"
          inputMode="numeric"
          className={`input ${hasClearButton ? 'pr-14' : 'pr-9'} ${className} ${
            hasError ? 'border-rose-400 dark:border-rose-500 ring-4 ring-rose-500/10' : ''
          }`}
          placeholder={placeholder}
          value={displayValue}
          onChange={handleInputChange}
          onBlur={handleBlur}
          disabled={disabled}
          maxLength={10}
          autoComplete="off"
        />

        <div className="absolute right-2 flex items-center gap-0.5">
          {hasClearButton && (
            <button
              type="button"
              onClick={() => {
                setDisplayValue('');
                onChange('');
              }}
              className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
              title="Limpar data"
              aria-label="Limpar data"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}

          <button
            type="button"
            onClick={() => !disabled && setIsOpen(prev => !prev)}
            disabled={disabled}
            className="p-1 rounded-md text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="Abrir calendário"
            aria-label="Abrir calendário"
          >
            <CalendarIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="absolute left-0 z-50 mt-1 w-68 max-w-[calc(100vw-2rem)] rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-lg p-3.5">
          {/* Header with Month and Year selects */}
          <div className="flex items-center justify-between gap-1 mb-2.5">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
              title="Mês anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-1.5">
              <select
                value={viewMonth}
                onChange={e => setViewMonth(parseInt(e.target.value, 10))}
                className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md px-2 py-1 text-xs font-semibold text-slate-800 dark:text-slate-200 cursor-pointer outline-none"
              >
                {MONTH_NAMES.map((name, idx) => (
                  <option key={idx} value={idx}>
                    {name}
                  </option>
                ))}
              </select>

              <select
                value={viewYear}
                onChange={e => setViewYear(parseInt(e.target.value, 10))}
                className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md px-2 py-1 text-xs font-semibold text-slate-800 dark:text-slate-200 cursor-pointer outline-none tabular-nums"
              >
                {yearOptions.map(y => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
              title="Próximo mês"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-1 text-center mb-1">
            {WEEKDAYS.map((w, idx) => (
              <span
                key={idx}
                className="text-[11px] font-medium text-slate-400 dark:text-slate-500 py-0.5"
              >
                {w}
              </span>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <div key={`empty-${i}`} className="h-7 w-7" />
            ))}

            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const selected = isSelectedDay(day);

              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => handleSelectDay(day)}
                  className={`h-7 w-7 rounded-md text-xs font-medium flex items-center justify-center transition-colors cursor-pointer tabular-nums ${
                    selected
                      ? 'bg-brand-700 text-white font-semibold'
                      : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
