import { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';

export default function ThemeToggle() {
  const [dark, setDark] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('casaapoio.theme');
      if (saved) return saved === 'dark';
      return false; // Inicia sempre no tema branco por padrão
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const onThemeChange = () => {
      const isDark = document.documentElement.classList.contains('dark');
      setDark(isDark);
    };

    window.addEventListener('theme-changed', onThemeChange);
    window.addEventListener('storage', onThemeChange);
    return () => {
      window.removeEventListener('theme-changed', onThemeChange);
      window.removeEventListener('storage', onThemeChange);
    };
  }, []);

  const toggleTheme = () => {
    const nextDark = !dark;
    setDark(nextDark);
    const root = document.documentElement;
    if (nextDark) {
      root.classList.add('dark');
      try {
        localStorage.setItem('casaapoio.theme', 'dark');
      } catch {}
    } else {
      root.classList.remove('dark');
      try {
        localStorage.setItem('casaapoio.theme', 'light');
      } catch {}
    }
    window.dispatchEvent(new Event('theme-changed'));
  };

  return (
    <button
      type="button"
      className="p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100/80 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800/80 transition-all active:scale-95"
      onClick={toggleTheme}
      aria-label="Alternar tema"
      title={dark ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
    >
      {dark ? (
        <Sun className="h-4 w-4 text-amber-400 transition-transform duration-200 hover:rotate-45" />
      ) : (
        <Moon className="h-4 w-4 text-slate-600 transition-transform duration-200 hover:-rotate-12" />
      )}
    </button>
  );
}