// Shared formatters for docx export modules.

import type { ModelAssumptions } from '@/lib/engine/types';

export const eur = (n: number): string => {
  if (!Number.isFinite(n) || n === 0) return '€0';
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${sign}€${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}€${Math.round(abs / 1_000)}K`;
  return `${sign}€${Math.round(abs)}`;
};

export const pct = (n: number): string => `${(n * 100).toFixed(1)}%`;

export const mul = (n: number): string => `${n.toFixed(2)}×`;

export function financingPathLabel(path: ModelAssumptions['financingPath']): string {
  switch (path) {
    case 'commercial':  return 'Commercial Bank Loan';
    case 'grant':       return 'ESPA Development Grant';
    case 'rrf':         return 'Recovery & Resilience Facility';
    case 'tepix-loan':  return 'TEPIX III Entrepreneurship Fund';
    case 'optima':      return 'Optima Bank';
  }
}
