"use client";

import { useState, useRef, useEffect } from "react";
import { useTranslation } from "@/lib/i18n/I18nProvider";
import { Locale, LOCALE_CONFIG } from "@/lib/i18n/types";

const locales: Locale[] = ["en", "fr", "el", "he"];

export function LanguageToggle() {
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

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="px-2 py-1 rounded text-xs font-mono font-medium bg-surface-secondary text-text-secondary hover:bg-surface-tertiary transition-colors uppercase"
      >
        {locale}
      </button>
      {open && (
        <div className="absolute top-full mt-1 end-0 bg-white rounded-lg shadow-lg border border-surface-tertiary py-1 z-50 min-w-[140px]">
          {locales.map((l) => (
            <button
              key={l}
              onClick={() => {
                setLocale(l);
                setOpen(false);
              }}
              className={`w-full text-start px-3 py-2 text-sm transition-colors flex items-center justify-between ${
                l === locale
                  ? "bg-brand-50 text-brand-700 font-medium"
                  : "text-text-secondary hover:bg-surface-secondary"
              }`}
            >
              <span>{LOCALE_CONFIG[l].nativeName}</span>
              <span className="text-xs font-mono uppercase text-text-tertiary">
                {l}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
