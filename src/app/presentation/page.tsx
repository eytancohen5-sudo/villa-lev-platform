"use client";

import { useTranslation } from "@/lib/i18n/I18nProvider";

/**
 * PDF URL keyed by locale.
 *
 * Placeholder copies are in place for el + he until the translated
 * versions are dropped into public/ and redeployed.
 */
const PDF_BY_LOCALE: Record<string, string> = {
  en: "/VillaLevGroup_Presentation_v23_26May2026.pdf",
  el: "/VillaLevGroup_Presentation_v23_26May2026.pdf",
  he: "/VillaLevGroup_Presentation_v23_26May2026.pdf",
};

export default function PresentationPage() {
  const { t, locale } = useTranslation();
  const pdfUrl = PDF_BY_LOCALE[locale] ?? PDF_BY_LOCALE.en;

  return (
    <>
      {/* Toolbar */}
      <div className="shrink-0 h-12 flex items-center justify-between px-5 bg-white border-b border-gray-200">
        <span className="text-sm font-semibold text-gray-800 tracking-tight">
          {t("presentation.viewer.title")}
        </span>
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
