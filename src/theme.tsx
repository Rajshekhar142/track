// src/theme.tsx
import { useEffect, useState } from 'react';

type Theme = 'light' | 'dark';
const THEME_KEY = 'life-tracker-theme';

const LIGHT_VARS: Record<string, string> = {
  '--bg-page': '#f4fbff',
  '--bg-surface': '#ffffff',
  '--bg-muted': '#f7fbfd',
  '--text-primary': '#0f1724',
  '--text-secondary': '#475569',
  '--muted': '#94a3b8',
  '--color-primary': '#0ea5e9',
  '--color-primary-dark': '#0369a1'
};

const DARK_VARS: Record<string, string> = {
  '--bg-page': '#071429',
  '--bg-surface': '#071a2a',
  '--bg-muted': '#072433',
  '--text-primary': '#e6f2fb',
  '--text-secondary': '#c7dbe9',
  '--muted': '#7f9fb6',
  '--color-primary': '#0ea5e9',
  '--color-primary-dark': '#0ea5e9'
};

function applyCssVars(vars: Record<string, string>) {
  const root = document.documentElement;
  for (const k in vars) root.style.setProperty(k, vars[k]);
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      const saved = localStorage.getItem(THEME_KEY) as Theme | null;
      if (saved === 'light' || saved === 'dark') return saved;
    } catch {}
    // fallback to prefers-color-scheme
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    applyCssVars(theme === 'dark' ? DARK_VARS : LIGHT_VARS);

    // update meta theme-color for mobile chrome UI
    let meta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'theme-color';
      document.head.appendChild(meta);
    }
    meta.content = theme === 'dark' ? DARK_VARS['--bg-page'] : LIGHT_VARS['--bg-page'];

    try { localStorage.setItem(THEME_KEY, theme); } catch {}
  }, [theme]);

  return { theme, setTheme };
}
