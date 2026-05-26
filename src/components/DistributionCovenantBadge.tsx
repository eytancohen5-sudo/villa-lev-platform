'use client';
import { useTranslation } from '@/lib/i18n/I18nProvider';

interface Props { gated: boolean; }

export function DistributionCovenantBadge({ gated }: Props) {
  const { t } = useTranslation();
  if (gated) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning">
        <svg width="12" height="14" viewBox="0 0 12 14" fill="none" aria-hidden="true" className="shrink-0">
          <rect x="1.5" y="6" width="9" height="7.5" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
          <path d="M3.5 6V4a2.5 2.5 0 015 0v2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
        </svg>
        <span>{t('covenant.distributionGated')}</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 rounded-lg border border-positive/30 bg-positive/10 px-3 py-2 text-sm text-positive">
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true" className="shrink-0">
        <path d="M2 6.5l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      <span>{t('covenant.distributionUnlocked')}</span>
    </div>
  );
}
