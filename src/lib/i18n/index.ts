import { Locale, TranslationDictionary } from './types';
import { en } from './en';
import { el } from './el';
import { he } from './he';

export const dictionaries: Record<Locale, TranslationDictionary> = {
  en,
  el,
  he,
};

export { type Locale, type Direction, LOCALE_CONFIG } from './types';
export type { TranslationDictionary } from './types';
