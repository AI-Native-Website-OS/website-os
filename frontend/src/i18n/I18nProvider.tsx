'use client';

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { zh, en } from './messages';
import { setLocale as setStoreLocale } from '@/lib/localeStore';

export type Locale = 'zh' | 'en';

const STORAGE_KEY = 'site_locale';
const DICTS: Record<Locale, any> = { zh, en };

interface I18nContextValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
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
    setStoreLocale(locale);
  }, [locale]);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      const dict = DICTS[locale];
      const v = resolvePath(dict, key);
      const raw = v !== undefined ? v : (resolvePath(zh, key) ?? key);
      if (!params) return raw;
      return raw.replace(/\{(\w+)\}/g, (m, k) => (k in params ? String(params[k]) : m));
    },
    [locale]
  );

  const setLocale = useCallback(
    (l: Locale) => {
      if (l === locale) return;
      setLocaleState(l);
      setStoreLocale(l);
      try {
        localStorage.setItem(STORAGE_KEY, l);
      } catch {}
      // 切换语言后整页刷新，重新按新语言拉取内容译文
      if (typeof window !== 'undefined') {
        window.location.reload();
      }
    },
    [locale]
  );

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>{children}</I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}