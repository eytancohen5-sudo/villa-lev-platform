"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslation } from "@/lib/i18n/I18nProvider";

export function AssumptionsMemoButton() {
  const pathname = usePathname();
  const { t } = useTranslation();

  if (pathname?.startsWith("/assumptions-memo")) {
    return null;
  }

  return (
    <div className="print:hidden">
      <Link
        href="/assumptions-memo"
        aria-label="View conservative assumptions memo"
        className="fixed top-[15vh] right-6 z-50 rounded-full inline-flex items-center gap-2.5 px-5 py-3 bg-brand-700 text-white hover:bg-brand-800 active:scale-95 transition-all shadow-2xl ring-2 ring-white/20 text-sm font-semibold"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-4 h-4 shrink-0"
          aria-hidden="true"
        >
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
        {t('memo.buttonLabel')}
      </Link>
    </div>
  );
}
