import { useState, useRef, useEffect, type KeyboardEvent } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export interface AutocompleteOption {
  label: string;
  badge?: string;
  category?: string;
}

interface SmartAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  options: (string | AutocompleteOption)[];
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  icon?: React.ReactNode;
  emptyText?: string;
}

function normalize(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export default function SmartAutocomplete({
  value,
  onChange,
  onBlur,
  options,
  placeholder = '',
  className = '',
  inputClassName = '',
  icon,
  emptyText = 'Nenhuma opção encontrada. Pressione Enter para usar o texto digitado.',
}: SmartAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const formattedOptions: AutocompleteOption[] = options.map(opt =>
    typeof opt === 'string' ? { label: opt } : opt
  );

  const queryNorm = normalize(value.trim());

  const filtered = formattedOptions.filter(opt => {
    if (!queryNorm) return true;
    const labelNorm = normalize(opt.label);
    const catNorm = opt.category ? normalize(opt.category) : '';
    const badgeNorm = opt.badge ? normalize(opt.badge) : '';
    return (
      labelNorm.includes(queryNorm) ||
      catNorm.includes(queryNorm) ||
      badgeNorm.includes(queryNorm)
    );
  });

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        if (open) {
          setOpen(false);
          onBlur?.();
        }
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open, onBlur]);

  useEffect(() => {
    setHighlightedIndex(-1);
  }, [value]);

  function handleSelect(opt: AutocompleteOption) {
    onChange(opt.label);
    setOpen(false);
    onBlur?.();
    inputRef.current?.blur();
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setOpen(true);
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev < filtered.length - 1 ? prev + 1 : 0));
      scrollToHighlighted(highlightedIndex + 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev > 0 ? prev - 1 : filtered.length - 1));
      scrollToHighlighted(highlightedIndex - 1);
    } else if (e.key === 'Enter') {
      if (open && highlightedIndex >= 0 && highlightedIndex < filtered.length) {
        e.preventDefault();
        handleSelect(filtered[highlightedIndex]);
      } else {
        setOpen(false);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  function scrollToHighlighted(index: number) {
    if (listRef.current && index >= 0) {
      const items = listRef.current.querySelectorAll('li');
      if (items[index]) {
        items[index].scrollIntoView({ block: 'nearest' });
      }
    }
  }

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <div className="relative">
        {icon && (
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            {icon}
          </div>
        )}

        <input
          ref={inputRef}
          className={`input ${icon ? '!pl-10' : ''} !pr-9 ${inputClassName}`}
          placeholder={placeholder}
          value={value}
          onChange={e => {
            onChange(e.target.value);
            if (!open) setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
        />

        <button
          type="button"
          tabIndex={-1}
          onClick={() => {
            setOpen(!open);
            inputRef.current?.focus();
          }}
          className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
        >
          <ChevronDown
            className={`h-4 w-4 transition-transform duration-200 ${
              open ? 'rotate-180 text-brand-600' : ''
            }`}
          />
        </button>
      </div>

      {open && (
        <div className="absolute z-50 mt-1.5 w-full rounded-2xl border border-slate-200/90 dark:border-slate-800/90 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
          {filtered.length === 0 ? (
            <div className="p-4 text-xs text-slate-500 text-center">
              {emptyText}
            </div>
          ) : (
            <ul
              ref={listRef}
              className="max-h-64 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/50 p-1"
            >
              {filtered.map((opt, idx) => {
                const isSelected = value.trim().toLowerCase() === opt.label.trim().toLowerCase();
                const isHighlighted = highlightedIndex === idx;

                return (
                  <li
                    key={idx}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    onClick={() => handleSelect(opt)}
                    className={`px-3.5 py-2.5 rounded-xl text-xs cursor-pointer flex items-center justify-between gap-3 transition-colors ${
                      isHighlighted || isSelected
                        ? 'bg-brand-50/90 dark:bg-brand-950/50 text-brand-900 dark:text-brand-100'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                    }`}
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                        {opt.label}
                        {isSelected && <Check className="h-3.5 w-3.5 text-brand-600 shrink-0" />}
                      </span>
                      {opt.category && (
                        <span className="text-[11px] text-slate-400">
                          {opt.category}
                        </span>
                      )}
                    </div>

                    {opt.badge && (
                      <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/50">
                        {opt.badge}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
