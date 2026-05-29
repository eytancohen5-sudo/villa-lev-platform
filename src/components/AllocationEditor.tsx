"use client";

import { PropertyConfig } from "@/lib/engine/types";
import { useTranslation } from "@/lib/i18n/I18nProvider";

interface AllocationEditorProps {
  lineAllocations: Record<string, number>;   // fractions 0–1
  projects: PropertyConfig[];
  onChange: (updated: Record<string, number>) => void;
}

export function AllocationEditor({
  lineAllocations,
  projects,
  onChange,
}: AllocationEditorProps) {
  const { t } = useTranslation();

  if (projects.length === 0) {
    return (
      <p className="text-xs text-text-tertiary">{t('as.portfolioOpex.allocateNoProjects')}</p>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-[10px] text-text-tertiary">{t('as.portfolioOpex.allocateHint')}</p>
      <div className="flex flex-wrap gap-3">
        {projects.map((p) => {
          const currentPct = Math.round((lineAllocations[p.id] ?? 0) * 100);
          const hasAllocation = (lineAllocations[p.id] ?? 0) > 0;
          return (
            <div key={p.id} className="flex items-center gap-1">
              <span
                className={`text-xs font-medium ${hasAllocation ? "text-blue-700" : "text-text-secondary"} flex items-center gap-1`}
              >
                {hasAllocation && (
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500" aria-hidden="true" />
                )}
                {p.name || p.id}
              </span>
              <input
                type="number"
                min={0}
                max={100}
                step={1}
                value={currentPct}
                aria-label={`${p.name || p.id} allocation %`}
                className="w-16 text-right text-sm font-mono border rounded px-1 py-0.5 border-surface-tertiary focus:border-blue-300 focus:outline-none"
                onChange={(e) => {
                  const raw = parseFloat(e.target.value);
                  const clamped = Math.max(0, Math.min(100, isNaN(raw) ? 0 : raw));
                  onChange({ ...lineAllocations, [p.id]: clamped / 100 });
                }}
              />
              <span className="text-xs text-text-tertiary">%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
