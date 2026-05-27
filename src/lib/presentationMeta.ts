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
  "/VillaLevGroup_Presentation_v23_26May2026.pdf";

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
// NOTE: EL/HE are v24 (partial translation: structure translated, body prose English).
// EN stays on v23 until a v24 EN PDF is exported and placed in public/.
export const PRESENTATION_PDF_BY_LOCALE: Partial<Record<Locale, string>> = {
  en: PRESENTATION_PDF_URL,
  el: "/VillaLevGroup_Presentation_v24_27May2026.el.pdf",
  he: "/VillaLevGroup_Presentation_v24_27May2026.he.pdf",
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
