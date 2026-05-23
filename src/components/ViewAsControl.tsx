// View-As dropdown — admin-only UI to preview the platform from another
// role's perspective without signing out. Hidden when canImpersonate is
// false, hidden during auth loading (no flicker per task constraint).
//
// Lives in the admin layout alongside other chrome controls; matches the
// existing Tailwind 4 styling (same look as the sign-out button on
// /admin/assumptions).

"use client";

import { useEffect, useRef, useState } from "react";
import {
  useEffectiveAuth,
  type ImpersonationTarget,
} from "@/lib/data/useEffectiveAuth";

const OPTIONS: { value: ImpersonationTarget | null; label: string }[] = [
  { value: null, label: "View as Admin" },
  { value: "banker", label: "View as Banker" },
];

function currentLabel(
  target: ImpersonationTarget | null | undefined,
): string {
  const match = OPTIONS.find((o) => o.value === (target ?? null));
  return match ? match.label : "View as…";
}

export function ViewAsControl() {
  const {
    loading,
    canImpersonate,
    isImpersonating,
    effectiveRole,
    setImpersonation,
  } = useEffectiveAuth();

  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Click-outside to close.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  // Anti-flicker: while auth is loading, render an empty placeholder of
  // the same height so the chrome doesn't jump when the widget appears.
  if (loading) {
    return <div className="h-7" aria-hidden="true" />;
  }
  if (!canImpersonate) return null;

  // Map effectiveRole back to the dropdown target for highlighting.
  const activeTarget: ImpersonationTarget | null = isImpersonating
    ? effectiveRole === "banker"
      ? "banker"
      : effectiveRole === "editor"
        ? "editor"
        : effectiveRole === "viewer"
          ? "viewer"
          : null
    : null;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        title={currentLabel(activeTarget)}
        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-colors border ${
          isImpersonating
            ? "bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100"
            : open
              ? "bg-brand-50 text-brand-700 border-brand-200"
              : "bg-surface-secondary text-text-secondary border-surface-tertiary hover:bg-surface-tertiary"
        }`}
      >
        <span>{currentLabel(activeTarget)}</span>
        <svg className="w-3 h-3 opacity-50 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute bottom-full mb-1 left-0 right-0 z-30 bg-white border border-surface-tertiary rounded-xl shadow-lg py-1">
          {OPTIONS.map((opt) => {
            const isActive = opt.value === activeTarget;
            return (
              <button
                key={opt.value ?? "default"}
                type="button"
                onClick={() => {
                  setImpersonation(opt.value);
                  setOpen(false);
                }}
                className={`block w-full text-left px-3 py-1.5 text-xs transition-colors ${
                  isActive
                    ? "bg-brand-50 text-brand-700 font-medium"
                    : "text-text-secondary hover:bg-surface-secondary"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
