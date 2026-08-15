import { useCallback, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  root.classList.toggle('light', theme === 'light');
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() =>
    document.documentElement.classList.contains('dark') ? 'dark' : 'light',
  );

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const syncSystemTheme = (event: MediaQueryListEvent) => {
      if (localStorage.getItem('talentbridge-theme')) return;
      const next = event.matches ? 'dark' : 'light';
      setTheme(next);
      applyTheme(next);
    };
    media.addEventListener('change', syncSystemTheme);
    return () => media.removeEventListener('change', syncSystemTheme);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((current) => {
      const next = current === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      localStorage.setItem('talentbridge-theme', next);
      return next;
    });
  }, []);

  return { theme, toggleTheme };
}
