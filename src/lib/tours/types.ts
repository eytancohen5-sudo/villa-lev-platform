import type { Locale } from "@/lib/i18n/types";

// Required for the three shipped locales; additional locale keys (e.g. 'fr')
// are allowed so tour configs can be prepared for future locales without
// triggering a type error.
export type LocalizedString = Record<Locale, string> & Partial<Record<string, string>>;

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
