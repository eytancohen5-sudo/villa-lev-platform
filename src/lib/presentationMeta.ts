/**
 * Single source of truth for the bank presentation PDF.
 * Update PRESENTATION_PDF_URL when a new PDF is deployed to public/.
 * Version and date are derived automatically from the filename.
 */
export const PRESENTATION_PDF_URL =
  "/VillaLevGroup_Presentation_v23_26May2026.pdf";

const _m = PRESENTATION_PDF_URL.match(/_v(\d+)_(\d{2})([A-Za-z]+)(\d{4})/);
export const PRESENTATION_VERSION = _m ? `v${_m[1]}` : "v?";
export const PRESENTATION_DATE    = _m ? `${_m[2]} ${_m[3]} ${_m[4]}` : "";
export const PRESENTATION_LABEL   = _m
  ? `${PRESENTATION_VERSION} · ${PRESENTATION_DATE}`
  : PRESENTATION_VERSION;
