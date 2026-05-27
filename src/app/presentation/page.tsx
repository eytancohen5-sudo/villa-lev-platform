"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTranslation } from "@/lib/i18n/I18nProvider";
import { LanguageToggle } from "@/components/LanguageToggle";
import {
  PRESENTATION_LABEL,
  PRESENTATION_VERSION_BY_LOCALE,
  getPresentationUrl,
  isPresentationStale,
} from "@/lib/presentationMeta";

export default function PresentationPage() {
  const { t, locale } = useTranslation();
  const searchParams = useSearchParams();
  const backHref = searchParams.get("from") === "bank" ? "/bank" : "/admin/dashboard";
  const [staleDismissed, setStaleDismissed] = useState(false);

  const pdfUrl = getPresentationUrl(locale);
  const stale = isPresentationStale(locale);
  const localeVersion = PRESENTATION_VERSION_BY_LOCALE[locale] ?? PRESENTATION_LABEL;

  return (
    <>
      {/* Toolbar */}
      <div className="shrink-0 h-12 flex items-center justify-between px-5 bg-white border-b border-gray-200 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href={backHref}
            className="shrink-0 text-xs font-medium text-gray-500 hover:text-gray-800 transition-colors"
          >
            {t("presentation.viewer.back")}
          </Link>
          <span className="shrink-0 text-gray-300 select-none">|</span>
          <span className="text-sm font-semibold text-gray-800 tracking-tight truncate">
            {t("presentation.viewer.title")}
          </span>
          <span className="shrink-0 text-[11px] font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
            {stale ? localeVersion : PRESENTATION_LABEL}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-[120px]">
            <LanguageToggle placement="down" />
          </div>
          <a
            href={pdfUrl}
            download
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-brand-600 text-white hover:bg-brand-700 transition-colors"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M6 1v7M6 8l-2.5-2.5M6 8l2.5-2.5M1.5 10.5h9"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {t("presentation.viewer.download")}
          </a>
        </div>
      </div>

      {/* Stale-version banner — shown when the locale PDF is an older draft */}
      {stale && !staleDismissed && (
        <div
          role="alert"
          dir="auto"
          className="shrink-0 flex items-center justify-between gap-3 px-5 py-2 bg-amber-50 border-b border-amber-200 text-xs text-amber-800"
        >
          <span>{t("presentation.viewer.staleVersion")}</span>
          <button
            onClick={() => setStaleDismissed(true)}
            className="shrink-0 font-medium underline whitespace-nowrap"
          >
            {t("presentation.viewer.staleVersionDismiss")}
          </button>
        </div>
      )}

      {/* Inline PDF viewer — takes all remaining height */}
      <iframe
        src={pdfUrl}
        title={t("presentation.viewer.title")}
        className="flex-1 w-full border-0 bg-gray-100"
      >
        <p className="p-8 text-sm text-gray-500">
          {t("presentation.viewer.placeholder")}{" "}
          <a href={pdfUrl} download className="underline text-brand-600">
            {t("presentation.viewer.download")}
          </a>
        </p>
      </iframe>
    </>
  );
}
