// Admin-only toggle between the two engine view modes:
//   - "Internal view" (default, OpCo-senior)  → what Eytan sees as admin
//   - "Bank view"     (OpCo-subordinated)     → what bankers underwrite
//
// Toggling here flips `modelStore.viewModeOverride`, which propagates into
// `recompute()`. The choice is persisted to localStorage under
// `villa-lev-engineViewMode` so it survives reloads — but only for
// admins. Sign-out (user goes back to null) clears the persisted value.
//
// Hidden when the caller isn't an admin (`isAdmin` from useEffectiveAuth)
// AND not signed in. While auth is loading we render an invisible
// placeholder of matching height to avoid layout jump (same pattern as
// ViewAsControl).

"use client";

import { useEffect } from "react";
import { useModelStore } from "@/lib/store/modelStore";
import { useEffectiveAuth } from "@/lib/data/useEffectiveAuth";

const STORAGE_KEY = "villa-lev-engineViewMode";

function readStored(): "internal" | "bank" | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === "internal" || raw === "bank") return raw;
    return null;
  } catch {
    return null;
  }
}

function writeStored(value: "internal" | "bank" | null) {
  if (typeof window === "undefined") return;
  try {
    if (value === null) window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // private mode — ignore
  }
}

export function BankViewToggle() {
  const { loading, isAdmin, effectiveRole, isImpersonating, actualRole } =
    useEffectiveAuth();
  const viewModeOverride = useModelStore((s) => s.viewModeOverride);
  const setViewModeOverride = useModelStore((s) => s.setViewModeOverride);

  // Hydrate from localStorage on mount — admins only. If a previous
  // session had bank view active, restore it.
  useEffect(() => {
    if (loading) return;
    // Sign-out path: actualRole is null AND we're not impersonating.
    // Clear any persisted toggle so a fresh visitor doesn't inherit it.
    if (actualRole === null && !isImpersonating) {
      writeStored(null);
      return;
    }
    if (!isAdmin && !isImpersonating) return;
    // View-As-Banker impersonation: always force bank view (admin is
    // pretending to be a banker). Don't write to storage — this is a
    // transient impersonation override.
    if (isImpersonating && effectiveRole === "banker") {
      if (viewModeOverride !== "bank") setViewModeOverride("bank");
      return;
    }
    // Regular admin: honour the persisted toggle.
    const stored = readStored();
    if (stored === "bank" && viewModeOverride !== "bank") {
      setViewModeOverride("bank");
    } else if (stored !== "bank" && viewModeOverride === "bank") {
      // Persisted state says internal but the store is in bank — only
      // override if we hydrated cleanly (avoid clobbering route layouts).
      // For admin chrome this is safe because the admin layout owns this
      // hydration.
      setViewModeOverride(null);
    }
  }, [loading, isAdmin, isImpersonating, effectiveRole, actualRole, setViewModeOverride, viewModeOverride]);

  // Anti-flicker placeholder during auth loading.
  if (loading) return <div className="h-7" aria-hidden="true" />;
  // Only admins see / use this widget. Banker impersonation hides it because
  // the impersonation banner + auto-redirect to /investor already covers it.
  if (!isAdmin) return null;

  const isBank = viewModeOverride === "bank";

  const onToggle = () => {
    const next = isBank ? null : "bank";
    writeStored(next);
    setViewModeOverride(next);
  };

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={isBank}
      title={
        isBank
          ? "Bank view active — OpCo subordinated to debt service (what bankers underwrite). Click to switch back to internal view."
          : "Internal view active — OpCo paid in full (legacy). Click to preview the banker's underwriting waterfall."
      }
      className={`px-2.5 py-1 rounded-md text-[11px] font-medium uppercase tracking-wider transition-colors ${
        isBank
          ? "bg-blue-50 text-blue-800 border border-blue-300 hover:bg-blue-100"
          : "bg-surface-secondary text-text-secondary border border-surface-tertiary hover:bg-surface-tertiary"
      }`}
    >
      {isBank ? "Bank view" : "Internal view"}
    </button>
  );
}

// Inline indicator pill shown in the page chrome whenever bank view is
// active. Distinct color (blue) from the amber impersonation banner so
// the two states are visually unambiguous.
export function BankViewBadge() {
  const viewModeOverride = useModelStore((s) => s.viewModeOverride);
  const { isAdmin, loading } = useEffectiveAuth();
  if (loading) return null;
  // Only surface the badge to admins — bankers on /investor or /pitch
  // already know it's the bank view (it's the only view they see).
  if (!isAdmin) return null;
  if (viewModeOverride !== "bank") return null;
  return (
    <span
      role="status"
      aria-live="polite"
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider border border-blue-300 text-blue-800 bg-blue-50"
      title="OpCo subordinated to debt service — DSCR, NCF and CFADS reflect the banker's underwriting waterfall."
    >
      <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full bg-blue-500" />
      Bank view
    </span>
  );
}
