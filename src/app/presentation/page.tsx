"use client";

import { useTranslation } from "@/lib/i18n/I18nProvider";
import {
  PRESENTATION_PDF_URL,
  PRESENTATION_LABEL,
} from "@/lib/presentationMeta";

export default function PresentationPage() {
  const { t } = useTranslation();
  const pdfUrl = PRESENTATION_PDF_URL;

  return (
    <>
      {/* Toolbar */}
      <div className="shrink-0 h-12 flex items-center justify-between px-5 bg-white border-b border-gray-200">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-gray-800 tracking-tight">
            {t("presentation.viewer.title")}
          </span>
          <span className="text-[11px] font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
            {PRESENTATION_LABEL}
          </span>
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
