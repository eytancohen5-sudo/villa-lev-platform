// Lightweight loading skeletons. Used in place of `return null` while the
// engine is computing the model — keeps the layout from flashing in/out.

import { useTranslation } from "@/lib/i18n/I18nProvider";

interface PageSkeletonProps {
  // Whether to mimic a wide table layout (P&L, CAPEX) or a tile grid (Dashboard,
  // Scenarios). Defaults to grid which is the more common case.
  variant?: 'table' | 'grid';
  // Optional hint shown under the skeleton — falls back to t('common.loading').
  hint?: string;
}

export function PageSkeleton({ variant = 'grid', hint }: PageSkeletonProps) {
  const { t } = useTranslation();
  const label = hint ?? t('common.loading');
  return (
    <div className="animate-pulse">
      {/* Header */}
      <div className="flex items-baseline justify-between mb-6 gap-4">
        <div className="space-y-2">
          <div className="h-7 w-48 rounded bg-surface-tertiary/60" />
          <div className="h-3 w-64 rounded bg-surface-tertiary/40" />
        </div>
        <div className="h-9 w-32 rounded-lg bg-surface-tertiary/40" />
      </div>

      {variant === 'table' ? (
        <div className="bg-white rounded-2xl border border-surface-tertiary p-5">
          <div className="grid grid-cols-12 gap-2 mb-4">
            <div className="col-span-3 h-4 rounded bg-surface-tertiary/40" />
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="h-4 rounded bg-surface-tertiary/30" />
            ))}
          </div>
          {Array.from({ length: 12 }).map((_, r) => (
            <div key={r} className="grid grid-cols-12 gap-2 py-2 border-t border-surface-secondary/40">
              <div className="col-span-3 h-3.5 rounded bg-surface-tertiary/30" />
              {Array.from({ length: 9 }).map((_, c) => (
                <div key={c} className="h-3.5 rounded bg-surface-tertiary/20" />
              ))}
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-surface-tertiary bg-white p-5 space-y-3">
                <div className="h-3 w-24 rounded bg-surface-tertiary/40" />
                <div className="h-8 w-32 rounded bg-surface-tertiary/40" />
                <div className="h-3 w-20 rounded bg-surface-tertiary/30" />
              </div>
            ))}
          </div>
          <div className="rounded-2xl border border-surface-tertiary bg-white p-5 h-64" />
        </>
      )}

      <div className="text-center text-xs text-text-tertiary mt-6">{label}</div>
    </div>
  );
}
