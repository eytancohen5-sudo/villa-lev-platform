"use client";

import { useState, useRef, useEffect } from "react";
import { useTranslation } from "@/lib/i18n/I18nProvider";
import { Locale, LOCALE_CONFIG } from "@/lib/i18n/types";

const locales: Locale[] = ["en", "el", "he"];

export function LanguageToggle({ placement = 'up', variant = 'light' }: { placement?: 'up' | 'down'; variant?: 'light' | 'dark' }) {
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
  const isDark = variant === 'dark';

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label={`Language: ${currentConfig.nativeName}`}
        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-colors border ${
          isDark
            ? open
              ? "bg-white/10 text-[#F0EAD8] border-[#4A4840]"
              : "bg-white/5 text-[#9A9080] border-[#2D2B24] hover:bg-white/10 hover:text-[#F0EAD8]"
            : open
            ? "bg-brand-50 text-brand-700 border-brand-200"
            : "bg-surface-secondary text-text-secondary border-surface-tertiary hover:bg-surface-tertiary"
        }`}
      >
        <span>{currentConfig.nativeName}</span>
        <span className={`font-mono uppercase ${isDark ? "text-[#5A5448]" : "text-text-tertiary"}`}>{locale}</span>
      </button>
      {open && (
        <div className={`absolute ${placement === 'down' ? 'top-full mt-1' : 'bottom-full mb-1'} start-0 end-0 rounded-lg shadow-lg border py-1 z-50 ${isDark ? 'bg-[#2D2B24] border-[#4A4840]' : 'bg-white border-surface-tertiary'}`}>
          {locales.map((l) => (
            <button
              key={l}
              onClick={() => {
                setLocale(l);
                setOpen(false);
              }}
              className={`w-full text-start px-3 py-2 text-xs transition-colors flex items-center justify-between ${
                isDark
                  ? l === locale
                    ? "bg-white/10 text-[#F0EAD8] font-medium"
                    : "text-[#9A9080] hover:bg-white/8 hover:text-[#F0EAD8]"
                  : l === locale
                  ? "bg-brand-50 text-brand-700 font-medium"
                  : "text-text-secondary hover:bg-surface-secondary"
              }`}
            >
              <span>{LOCALE_CONFIG[l].nativeName}</span>
              <span className={`font-mono uppercase ${isDark ? "text-[#5A5448]" : "text-text-tertiary"}`}>{l}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
