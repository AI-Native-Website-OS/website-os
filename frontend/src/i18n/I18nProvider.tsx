'use client';

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { zh, en } from './messages';

export type Locale = 'zh' | 'en';

const STORAGE_KEY = 'site_locale';
const DICTS: Record<Locale, any> = { zh, en };

interface I18nContextValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextValue>({
  locale: 'zh',
  setLocale: () => {},
  t: (k: string) => k,
});

function getInitialLocale(): Locale {
  if (typeof window === 'undefined') return 'zh';
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'en' || saved === 'zh') return saved;
  } catch {}
  return 'zh';
}

function resolvePath(dict: any, path: string): string | undefined {
  const parts = path.split('.');
  let cur = dict;
  for (const p of parts) {
    if (cur && typeof cur === 'object' && p in cur) cur = cur[p];
    else return undefined;
  }
  return typeof cur === 'string' ? cur : undefined;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(getInitialLocale);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, locale);
    } catch {}
    document.documentElement.lang = locale === 'en' ? 'en' : 'zh-CN';
  }, [locale]);

  const t = useCallback(
    (key: string): string => {
      const dict = DICTS[locale];
      const v = resolvePath(dict, key);
      if (v !== undefined) return v;
      const fallback = resolvePath(zh, key);
      return fallback !== undefined ? fallback : key;
    },
    [locale]
  );

  const setLocale = useCallback((l: Locale) => setLocaleState(l), []);

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>{children}</I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}