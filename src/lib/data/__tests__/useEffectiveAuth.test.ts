// Unit tests for the pure override helper inside useEffectiveAuth.
//
// Vitest is configured environment: 'node' in this app — no jsdom / no
// React renderer. So we don't test the React hook itself here; we test
// the pure `impersonationOverrides` helper, which is the load-bearing
// piece of the impersonation logic. The hook wiring (event listeners,
// localStorage hydration, canImpersonate gating) is verified manually
// per the task plan's smoke checklist.

import { describe, it, expect } from "vitest";
import { impersonationOverrides } from "@/lib/data/useEffectiveAuth";

describe("impersonationOverrides", () => {
  it("banker = unauthenticated public viewer", () => {
    expect(impersonationOverrides("banker")).toEqual({
      role: null,
      isAdmin: false,
      canEdit: false,
      canView: false,
    });
  });

  it("viewer = read-only signed-in user", () => {
    expect(impersonationOverrides("viewer")).toEqual({
      role: "viewer",
      isAdmin: false,
      canEdit: false,
      canView: true,
    });
  });

  it("editor = can edit, not admin", () => {
    expect(impersonationOverrides("editor")).toEqual({
      role: "editor",
      isAdmin: false,
      canEdit: true,
      canView: true,
    });
  });

  it("no target ever maps to isAdmin=true", () => {
    // Defensive: View-As should never escalate. Admin = default (no
    // impersonation), so no `impersonationOverrides('admin')` branch
    // should exist.
    const targets = ["banker", "viewer", "editor"] as const;
    for (const t of targets) {
      expect(impersonationOverrides(t).isAdmin).toBe(false);
    }
  });
});
