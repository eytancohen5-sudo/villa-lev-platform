import { Locale, TranslationDictionary } from './types';
import { en } from './en';
import { el } from './el';
import { he } from './he';

// fr is included for forward-compat (partial translation) but is not in the
// Locale type until fully translated. Cast through unknown to avoid strict
// object-literal excess-property check.
export const dictionaries = {
  en,
  el,
  he,
} as unknown as Record<Locale, TranslationDictionary>;

export { type Locale, type Direction, LOCALE_CONFIG } from './types';
export type { TranslationDictionary } from './types';
