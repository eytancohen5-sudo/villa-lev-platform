"use client";

import { useState, useRef, useEffect } from "react";
import { useTranslation } from "@/lib/i18n/I18nProvider";
import { Locale, LOCALE_CONFIG } from "@/lib/i18n/types";

// fr is not yet fully translated — excluded from the picker until complete.
const locales: Locale[] = ["en", "el", "he"];

export function LanguageToggle({ placement = 'up' }: { placement?: 'up' | 'down' }) {
  const { locale, setLocale } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const currentConfig = LOCALE_CONFIG[locale];

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label={`Language: ${currentConfig.nativeName}`}
        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-colors border ${
          open
            ? "bg-brand-50 text-brand-700 border-brand-200"
            : "bg-surface-secondary text-text-secondary border-surface-tertiary hover:bg-surface-tertiary"
        }`}
      >
        <span>{currentConfig.nativeName}</span>
        <span className="font-mono uppercase text-text-tertiary">{locale}</span>
      </button>
      {open && (
        <div className={`absolute ${placement === 'down' ? 'top-full mt-1' : 'bottom-full mb-1'} start-0 end-0 bg-white rounded-lg shadow-lg border border-surface-tertiary py-1 z-50`}>
          {locales.map((l) => (
            <button
              key={l}
              onClick={() => {
                setLocale(l);
                setOpen(false);
              }}
              className={`w-full text-start px-3 py-2 text-xs transition-colors flex items-center justify-between ${
                l === locale
                  ? "bg-brand-50 text-brand-700 font-medium"
                  : "text-text-secondary hover:bg-surface-secondary"
              }`}
            >
              <span>{LOCALE_CONFIG[l].nativeName}</span>
              <span className="font-mono uppercase text-text-tertiary">{l}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
