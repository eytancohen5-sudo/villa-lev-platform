/**
 * Single source of truth for the bank presentation PDF.
 * Update PRESENTATION_PDF_URL when a new PDF is deployed to public/.
 * Version, date, and optional time are derived automatically from the filename.
 *
 * Naming convention:
 *   VillaLevGroup_Presentation_v{N}_{DD}{Mon}{YYYY}.pdf          → "v23 · 26 May 2026"
 *   VillaLevGroup_Presentation_v{N}_{DD}{Mon}{YYYY}_{HHMM}.pdf   → "v23 · 26 May 2026 · 14:23"
 *
 * Use the time suffix whenever more than one version is produced on the same day.
 *
 * To add a locale-specific v23 PDF: drop it in public/ and update
 * PRESENTATION_PDF_BY_LOCALE below. PRESENTATION_VERSION_BY_LOCALE controls
 * whether the stale-version banner appears for that locale.
 */
import type { Locale } from "@/lib/i18n/types";

export const PRESENTATION_PDF_URL =
  "/VillaLevGroup_Presentation_v25_27May2026.pdf";

const _m = PRESENTATION_PDF_URL.match(
  /_v(\d+)_(\d{2})([A-Za-z]+)(\d{4})(?:_(\d{2})(\d{2}))?/
);
export const PRESENTATION_VERSION = _m ? `v${_m[1]}` : "v?";
export const PRESENTATION_DATE    = _m ? `${_m[2]} ${_m[3]} ${_m[4]}` : "";
const _time = _m?.[5] && _m?.[6] ? `${_m[5]}:${_m[6]}` : null;
export const PRESENTATION_LABEL   = _m
  ? [PRESENTATION_VERSION, PRESENTATION_DATE, _time].filter(Boolean).join(" · ")
  : PRESENTATION_VERSION;

// Locale-specific PDF map. EN is always the canonical version.
// EL/HE point to the latest translated versions available in public/.
// When a locale-specific PDF is deployed, update its entry here and
// set its PRESENTATION_VERSION_BY_LOCALE entry to PRESENTATION_VERSION.
// EL/HE temporarily serve the EN PDF (full 49-page deck).
// Replace with locale-specific PDFs once full translations are available.
export const PRESENTATION_PDF_BY_LOCALE: Partial<Record<Locale, string>> = {
  en: PRESENTATION_PDF_URL,
  el: PRESENTATION_PDF_URL,
  he: PRESENTATION_PDF_URL,
};

export const PRESENTATION_VERSION_BY_LOCALE: Partial<Record<Locale, string>> = {
  en: PRESENTATION_VERSION,
  el: PRESENTATION_VERSION,
  he: PRESENTATION_VERSION,
};

export function getPresentationUrl(locale: Locale): string {
  return PRESENTATION_PDF_BY_LOCALE[locale] ?? PRESENTATION_PDF_URL;
}

export function isPresentationStale(locale: Locale): boolean {
  return (PRESENTATION_VERSION_BY_LOCALE[locale] ?? PRESENTATION_VERSION) !== PRESENTATION_VERSION;
}
