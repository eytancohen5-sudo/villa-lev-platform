import type { Locale } from "@/lib/i18n/types";

export type LocalizedString = Record<Locale, string>;

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
