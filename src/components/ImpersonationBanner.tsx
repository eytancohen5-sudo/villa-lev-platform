// Sticky top-of-page banner that shows whenever the admin is impersonating
// another role. Lives in the ROOT layout so it appears on every page —
// admin chrome, public investor pages, pitch, and the home page. Gated on
// `useEffectiveAuth().isImpersonating`, which is false for actual
// unauthenticated visitors, so bankers viewing a real share-link never
// see this.
//
// Color: amber/orange — warning, not critical. Consistent with the
// existing stale-snapshot banner in admin/layout.tsx.

"use client";

import { useEffectiveAuth } from "@/lib/data/useEffectiveAuth";

function labelFor(role: string | null | undefined): string {
  if (role === "banker") return "Banker (public)";
  if (role === "viewer") return "Viewer";
  if (role === "editor") return "Editor";
  if (role === "admin") return "Admin";
  return "—";
}

export function ImpersonationBanner() {
  const { isImpersonating, effectiveRole, setImpersonation, loading } =
    useEffectiveAuth();

  // No flash: while loading, render nothing. An actual unauthenticated
  // visitor never satisfies isImpersonating, so they never see this.
  if (loading) return null;
  if (!isImpersonating) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="sticky top-0 z-50 bg-amber-100 border-b border-amber-300 text-amber-900 text-xs px-6 py-2 flex items-center justify-between gap-3 print:hidden"
    >
      <span className="flex items-center gap-2">
        <span aria-hidden="true">▲</span>
        <span>
          IMPERSONATING: <strong>{labelFor(effectiveRole)}</strong>. UI is
          rendered as if you were this role; your Firestore permissions are
          unchanged.
        </span>
      </span>
      <button
        type="button"
        onClick={() => setImpersonation(null)}
        className="px-2.5 py-1 rounded-md bg-amber-200 hover:bg-amber-300 text-amber-900 font-medium uppercase tracking-wider text-[10px] transition-colors"
      >
        Exit →
      </button>
    </div>
  );
}
