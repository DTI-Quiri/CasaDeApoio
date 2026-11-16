import { useEffect, useState } from 'react';
import { ALargeSmall } from 'lucide-react';

const STORAGE_KEY = 'casaapoio.fontSize';

export default function FontSizeToggle({ showLabel = false }: { showLabel?: boolean }) {
  const [large, setLarge] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'large';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const sync = () => setLarge(document.documentElement.classList.contains('text-lg-mode'));
    window.addEventListener('fontsize-changed', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('fontsize-changed', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  function toggle() {
    const next = !large;
    setLarge(next);
    document.documentElement.classList.toggle('text-lg-mode', next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? 'large' : 'normal');
    } catch {
      // ignore
    }
    window.dispatchEvent(new Event('fontsize-changed'));
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={large}
      title={large ? 'Voltar ao tamanho de letra padrão' : 'Aumentar tamanho da letra'}
      aria-label={large ? 'Voltar ao tamanho de letra padrão' : 'Aumentar tamanho da letra'}
      className={`inline-flex items-center gap-1.5 rounded-xl transition-colors cursor-pointer ${
        showLabel
          ? 'px-3 py-2 text-xs font-medium w-full justify-start'
          : 'p-2'
      } ${
        large
          ? 'bg-brand-50 text-brand-700 dark:bg-brand-950/60 dark:text-brand-300'
          : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100/80 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800/80'
      }`}
    >
      <ALargeSmall className="h-4 w-4 shrink-0" />
      {showLabel && <span>{large ? 'Letra maior: Ativada' : 'Letra maior'}</span>}
    </button>
  );
}
