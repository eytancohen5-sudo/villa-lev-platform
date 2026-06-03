"use client";

import React from "react";

// NOTE: relies on .kpi-value and .kpi-value-compact CSS classes defined in globals.css

export function SectionHeader({
  title,
  sub,
  rightSlot,
}: {
  title: string;
  sub?: string;
  rightSlot?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between mb-4 mt-10 first:mt-0 pb-2 border-b border-surface-tertiary">
      <h2 className="text-[11px] font-bold uppercase tracking-[0.16em] text-text-primary">
        {title}
      </h2>
      <div className="flex items-center gap-3">
        {sub && <span className="text-[11px] text-text-tertiary">{sub}</span>}
        {rightSlot && <div>{rightSlot}</div>}
      </div>
    </div>
  );
}

export function StatusChip({
  label,
  ok,
}: {
  label: string;
  ok: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider ${
        ok
          ? "bg-positive/15 text-positive"
          : "bg-warning/15 text-warning"
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${ok ? "bg-positive" : "bg-warning"}`} />
      {label}
    </span>
  );
}

export function KPICard({
  label,
  value,
  sublabel,
  threshold,
  chip,
  accent = false,
  tone,
  valueSize = "default",
  footer,
}: {
  label: string;
  value: string;
  sublabel?: string;
  threshold?: string;
  chip?: { label: string; ok: boolean };
  accent?: boolean;
  tone?: "positive" | "warning" | "neutral";
  valueSize?: "default" | "compact";
  footer?: React.ReactNode;
}) {
  const bgClass = accent
    ? "bg-brand-50 border-brand-200"
    : tone === "positive"
    ? "bg-green-50 border-green-200"
    : tone === "warning"
    ? "bg-amber-50 border-amber-200"
    : "bg-white border-surface-tertiary";
  const valueColor =
    tone === "positive" ? "text-positive" : tone === "warning" ? "text-warning" : "text-text-primary";
  const valueClass = valueSize === "compact" ? "kpi-value-compact" : "kpi-value";
  return (
    <div className={`relative rounded-xl border p-5 shadow-sm ${bgClass}`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-text-tertiary">
          {label}
        </div>
        {chip && <StatusChip label={chip.label} ok={chip.ok} />}
      </div>
      <div className={`${valueClass} ${valueColor}`}>{value}</div>
      {sublabel && <div className="text-xs text-text-secondary mt-1">{sublabel}</div>}
      {threshold && (
        <div className="text-[11px] text-text-tertiary/80 mt-1.5 pt-1.5 border-t border-surface-tertiary/50">
          {threshold}
        </div>
      )}
      {footer && <div className="mt-3">{footer}</div>}
    </div>
  );
}
