import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { Companion } from '../types';
import { parseCompanions } from '../utils/companion';
import { formatPersonName } from '../utils/cpf';
import { Users } from 'lucide-react';

interface CompanionBadgeProps {
  hasCompanion?: boolean;
  companions?: (Companion | string)[];
  mode?: 'table' | 'card';
}

export default function CompanionBadge({
  hasCompanion,
  companions,
  mode = 'table',
}: CompanionBadgeProps) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; placement: 'top' | 'bottom' }>({
    top: 0,
    left: 0,
    placement: 'top',
  });
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const parsed = parseCompanions(companions, true);

  const updatePosition = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const showBelow = rect.top < 110;
    setCoords({
      top: showBelow ? rect.bottom + 8 : rect.top - 8,
      left: rect.left + rect.width / 2,
      placement: showBelow ? 'bottom' : 'top',
    });
  };

  const handleMouseEnter = () => {
    updatePosition();
    setOpen(true);
  };

  const handleMouseLeave = () => {
    setOpen(false);
  };

  useEffect(() => {
    if (!open) return;
    const handleScrollOrResize = () => setOpen(false);
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);
    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [open]);

  if (!hasCompanion) {
    return <span className="text-slate-400 dark:text-slate-500 text-xs">Não</span>;
  }

  const count = parsed.length > 0 ? parsed.length : 1;
  const label =
    mode === 'card'
      ? `+${count} acomp.`
      : `Sim${count > 1 ? ` (${count})` : ''}`;

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        aria-expanded={open}
        aria-label={`Ver detalhes de acompanhantes (${count})`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onFocus={handleMouseEnter}
        onBlur={handleMouseLeave}
        onKeyDown={e => {
          if (e.key === 'Escape') setOpen(false);
        }}
        onClick={() => {
          updatePosition();
          setOpen(prev => !prev);
        }}
        className="badge-yellow cursor-pointer select-none transition-colors hover:bg-amber-100 dark:hover:bg-amber-900/60 hover:border-amber-300 dark:hover:border-amber-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
      >
        <span>{label}</span>
      </button>

      {open &&
        createPortal(
          <div
            style={{
              position: 'fixed',
              top: coords.top,
              left: coords.left,
              transform:
                coords.placement === 'top'
                  ? 'translate(-50%, -100%)'
                  : 'translate(-50%, 0)',
            }}
            className="z-[9999] pointer-events-none min-w-[210px] max-w-[280px] rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 shadow-lg px-3 py-2.5 text-left"
          >
            <div className="flex items-center gap-1.5 pb-1.5 mb-1.5 border-b border-slate-100 dark:border-slate-800 text-[11px] font-semibold text-amber-700 dark:text-amber-400">
              <Users className="h-3 w-3 shrink-0" />
              <span>
                {parsed.length > 1
                  ? `Acompanhantes (${parsed.length})`
                  : 'Acompanhante'}
              </span>
            </div>

            {parsed.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-300">Nome não informado no cadastro</p>
            ) : (
              <div className="space-y-1.5">
                {parsed.map((c, i) => (
                  <div key={i} className="text-xs leading-snug">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="font-medium text-slate-900 dark:text-white">
                        {c.name ? formatPersonName(c.name) : 'Sem nome informado'}
                      </p>
                      {c.relationship && (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-50 dark:bg-slate-800 text-amber-800 dark:text-amber-300 border border-amber-200/80 dark:border-slate-700">
                          {c.relationship}
                        </span>
                      )}
                    </div>
                    {c.phone ? (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums mt-0.5">
                        Cel: {c.phone}
                      </p>
                    ) : c.cpf ? (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums mt-0.5">
                        CPF: {c.cpf}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>,
          document.body
        )}
    </>
  );
}

