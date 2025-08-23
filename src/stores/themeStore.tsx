import React from 'react';
import { getConfig } from './configStore';

export type Theme = 'light' | 'dark' | 'system';

function applyTheme(theme: Theme) {
  const cfg = getConfig();
  const darkClass = cfg.theme.darkClass || 'dark';
  const root = document.documentElement;
  const prefersDark =
    window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const effectiveDark = theme === 'system' ? prefersDark : theme === 'dark';
  root.classList.toggle(darkClass, effectiveDark);
}

export const ThemeContext = React.createContext<{
  theme: Theme;
  setTheme: (t: Theme) => void;
} | null>(null);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const initial = (getConfig().theme.default ?? 'system') as Theme;
  const [theme, setTheme] = React.useState<Theme>(initial);

  React.useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
};

export function useTheme() {
  const ctx = React.useContext(ThemeContext);
  if (!ctx) throw new Error('ThemeProvider missing');
  return ctx;
}
