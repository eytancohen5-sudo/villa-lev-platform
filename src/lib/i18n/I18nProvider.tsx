"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Locale, Direction, LOCALE_CONFIG, TranslationDictionary } from './types';
import { dictionaries } from './index';

interface I18nContextValue {
  locale: Locale;
  dir: Direction;
  setLocale: (locale: Locale) => void;
  t: (key: keyof TranslationDictionary) => string;
}

const I18nContext = createContext<I18nContextValue>({
  locale: 'en',
  dir: 'ltr',
  setLocale: () => {},
  t: (key) => key as string,
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en');

  useEffect(() => {
    const saved = localStorage.getItem('villa-lev-locale') as Locale | null;
    if (saved && dictionaries[saved]) {
      setLocaleState(saved);
      document.documentElement.lang = saved;
      document.documentElement.dir = LOCALE_CONFIG[saved].dir;
    }
  }, []);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem('villa-lev-locale', newLocale);
    document.documentElement.lang = newLocale;
    document.documentElement.dir = LOCALE_CONFIG[newLocale].dir;
  }, []);

  const t = useCallback(
    (key: keyof TranslationDictionary): string => {
      return dictionaries[locale][key] ?? dictionaries.en[key] ?? (key as string);
    },
    [locale]
  );

  const dir = LOCALE_CONFIG[locale].dir;

  return (
    <I18nContext.Provider value={{ locale, dir, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useTranslation() {
  return useContext(I18nContext);
}
