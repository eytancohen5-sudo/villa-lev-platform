import { useModelStore } from '../store/modelStore';
import { Locale, LOCALE_CONFIG } from '../i18n/types';

export function useModel() {
  return useModelStore();
}

function intlLocale(locale: Locale = 'en'): string {
  return LOCALE_CONFIG[locale].intl;
}

export function formatCurrency(value: number, compact = false, locale: Locale = 'en'): string {
  const intl = intlLocale(locale);
  if (compact && Math.abs(value) >= 1_000_000) {
    return new Intl.NumberFormat(intl, {
      style: 'currency',
      currency: 'EUR',
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(value);
  }
  if (compact && Math.abs(value) >= 1_000) {
    return new Intl.NumberFormat(intl, {
      style: 'currency',
      currency: 'EUR',
      notation: 'compact',
      maximumFractionDigits: 0,
    }).format(value);
  }
  return new Intl.NumberFormat(intl, {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatPercent(value: number, decimals = 1): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

export function formatMultiple(value: number): string {
  return `${value.toFixed(2)}×`;
}

export function formatNumber(value: number, locale: Locale = 'en'): string {
  return new Intl.NumberFormat(intlLocale(locale)).format(Math.round(value));
}
