import React from 'react';
import en from '../locales/en.json';
import ru from '../locales/ru.json';
import { getConfig } from './configStore';

type Dict = Record<string, string>;
// Keep literal keys to enable precise Locale type
const DICTS = { en: en as Dict, ru: ru as Dict } as const;

export type Locale = keyof typeof DICTS;

export function resolveInitialLocale(): Locale {
  const cfg = getConfig();
  const d = cfg.i18n.defaultLocale as Locale;
  return (cfg.i18n.locales.includes(d) ? d : 'en') as Locale;
}

export function t(locale: Locale, key: string): string {
  const dict: Dict = DICTS[locale] ?? DICTS.en;
  return dict[key] ?? key;
}

export const I18nContext = React.createContext<{
  locale: Locale;
  setLocale: (l: Locale) => void;
} | null>(null);

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [locale, setLocale] = React.useState<Locale>(resolveInitialLocale());
  return <I18nContext.Provider value={{ locale, setLocale }}>{children}</I18nContext.Provider>;
};

export function useI18n() {
  const ctx = React.useContext(I18nContext);
  if (!ctx) throw new Error('I18nProvider missing');
  return {
    locale: ctx.locale,
    setLocale: ctx.setLocale,
    t: (key: string) => t(ctx.locale, key),
  };
}
