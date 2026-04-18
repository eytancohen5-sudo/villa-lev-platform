"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { useModelStore } from "@/lib/store/modelStore";
import { useTranslation } from "@/lib/i18n/I18nProvider";
import { LanguageToggle } from "@/components/LanguageToggle";

export default function InvestorLayout({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const { init } = useModelStore();

  const initialized = useRef(false);
  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      init();
    }
  }, [init]);

  return (
    <div className="min-h-screen bg-surface-primary">
      <header className="border-b border-surface-tertiary bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="font-display text-lg text-text-primary">
              {t('app.title')}
            </Link>
            <span className="text-text-tertiary text-sm">&middot;</span>
            <span className="text-text-tertiary text-sm">{t('app.platform')}</span>
          </div>
          <div className="flex items-center gap-4">
            <LanguageToggle />
            <Link
              href="/admin/dashboard"
              className="text-xs text-text-tertiary hover:text-brand-500 transition-colors"
            >
              {t('nav.switchAdmin')}
            </Link>
          </div>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
