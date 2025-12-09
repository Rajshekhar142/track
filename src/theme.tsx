import { useState, useEffect } from "react";
export function useTheme() {
  const [theme, setTheme] = useState<'light'|'dark'>(() => {
    // Try localStorage, then prefer-color-scheme
    try {
      const saved = localStorage.getItem('theme');
      if (saved === 'dark' || saved === 'light') return saved;
    } catch {}
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme === 'dark' ? 'dark' : 'light');
    try { localStorage.setItem('theme', theme); } catch {}
  }, [theme]);

  return { theme, setTheme };
}