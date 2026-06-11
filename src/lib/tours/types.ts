// English is the only required locale (language policy 2026-06-11: EN-first,
// EL/HE frozen until re-translated in one pass). Additional locale keys are
// allowed so tour configs can carry translations without a type error;
// PageTour falls back to `en` when the active locale has no entry.
export type LocalizedString = { en: string } & Partial<Record<string, string>>;

export interface TourStep {
  // CSS selector. Omit on the welcome step (no spotlight, centered card).
  target?: string;
  title: LocalizedString;
  body: LocalizedString;
}

export interface TourConfig {
  // Unique localStorage flag for "tour seen" gating per page.
  storageKey: string;
  // Show 4-button language picker on the welcome step. Recommended only on the
  // first page (Dashboard) — once selected, the locale persists site-wide.
  showLanguagePicker?: boolean;
  steps: TourStep[];
}
