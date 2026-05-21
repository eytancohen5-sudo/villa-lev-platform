// Unit tests for userProfile helpers + claimInvite.
//
// claimInvite is exercised with a thin in-memory Firestore mock — enough to
// verify the three-state result (created / existing / not-invited) and the
// batched create+delete behaviour. Full integration coverage lives in the
// rules-text test (rbac-rules.test.ts) which asserts the rules file contains
// the BLOCKER guards from plan-challenger.
//
// Why no @firebase/rules-unit-testing here: that lib spins up the Firestore
// emulator which requires Java (JRE not available on this build host). The
// rules-text test plus this mock-Firestore coverage is the pragmatic
// substitute for tonight's ship; full emulator coverage is a follow-up.

import { describe, it, expect, vi } from "vitest";
import {
  normalizeEmail,
  isRole,
  roleAtLeast,
  claimInvite,
  type Role,
} from "@/lib/data/userProfile";

describe("normalizeEmail", () => {
  it("lower-cases mixed case", () => {
    expect(normalizeEmail("Foo@Bar.COM")).toBe("foo@bar.com");
  });
  it("trims whitespace", () => {
    expect(normalizeEmail("  hi@example.com  ")).toBe("hi@example.com");
  });
  it("returns empty string for null / undefined", () => {
    expect(normalizeEmail(null)).toBe("");
    expect(normalizeEmail(undefined)).toBe("");
    expect(normalizeEmail("")).toBe("");
  });
});

describe("isRole", () => {
  it("accepts valid roles", () => {
    expect(isRole("admin")).toBe(true);
    expect(isRole("editor")).toBe(true);
    expect(isRole("viewer")).toBe(true);
  });
  it("rejects typos / capitalisations / other values", () => {
    expect(isRole("Admin")).toBe(false);
    expect(isRole("Editor")).toBe(false);
    expect(isRole("owner")).toBe(false);
    expect(isRole("")).toBe(false);
    expect(isRole(null)).toBe(false);
    expect(isRole(undefined)).toBe(false);
    expect(isRole(42)).toBe(false);
  });
});

describe("roleAtLeast", () => {
  it("admin satisfies every minimum", () => {
    expect(roleAtLeast("admin", "viewer")).toBe(true);
    expect(roleAtLeast("admin", "editor")).toBe(true);
    expect(roleAtLeast("admin", "admin")).toBe(true);
  });
  it("editor satisfies editor + viewer but not admin", () => {
    expect(roleAtLeast("editor", "viewer")).toBe(true);
    expect(roleAtLeast("editor", "editor")).toBe(true);
    expect(roleAtLeast("editor", "admin")).toBe(false);
  });
  it("viewer satisfies only viewer", () => {
    expect(roleAtLeast("viewer", "viewer")).toBe(true);
    expect(roleAtLeast("viewer", "editor")).toBe(false);
    expect(roleAtLeast("viewer", "admin")).toBe(false);
  });
  it("null / undefined never satisfies any minimum", () => {
    expect(roleAtLeast(null, "viewer")).toBe(false);
    expect(roleAtLeast(undefined, "viewer")).toBe(false);
  });
});

// ── claimInvite mock-Firestore harness ────────────────────────────────────
//
// We don't import the real `doc`, `getDoc`, `writeBatch` — vi.mock swaps the
// firestore module for an in-memory store. This lets us drive claimInvite
// through its three branches without spinning up the emulator.

type StoredDoc = { path: string; data: Record<string, unknown> };

interface FakeStore {
  docs: Map<string, StoredDoc["data"]>;
  batchCommits: number;
  deletes: string[];
  sets: Array<{ path: string; data: Record<string, unknown> }>;
}

function makeFakeStore(): FakeStore {
  return { docs: new Map(), batchCommits: 0, deletes: [], sets: [] };
}

vi.mock("firebase/firestore", () => {
  // The store is module-level so each test resets it via the helper below.
  const state: { store: FakeStore } = { store: makeFakeStore() };

  return {
    __setStore(s: FakeStore) {
      state.store = s;
    },
    __getStore() {
      return state.store;
    },
    doc: (_db: unknown, ...parts: string[]) => {
      return { _path: parts.join("/") };
    },
    getDoc: async (ref: { _path: string }) => {
      const data = state.store.docs.get(ref._path);
      return {
        exists: () => data !== undefined,
        data: () => data,
      };
    },
    writeBatch: () => {
      const ops: Array<() => void> = [];
      return {
        set: (ref: { _path: string }, data: Record<string, unknown>) => {
          ops.push(() => {
            state.store.sets.push({ path: ref._path, data });
            state.store.docs.set(ref._path, data);
          });
        },
        delete: (ref: { _path: string }) => {
          ops.push(() => {
            state.store.deletes.push(ref._path);
            state.store.docs.delete(ref._path);
          });
        },
        commit: async () => {
          ops.forEach((op) => op());
          state.store.batchCommits += 1;
        },
      };
    },
    serverTimestamp: () => ({ __server: true }),
  };
});

// Helper to grab the mock control surface after vi.mock has wired it.
async function getMockControl() {
  const mod = (await import("firebase/firestore")) as unknown as {
    __setStore: (s: FakeStore) => void;
    __getStore: () => FakeStore;
  };
  return mod;
}

function mkAuthUser(uid: string, email: string | null): {
  uid: string;
  email: string | null;
  displayName: string | null;
} {
  return { uid, email, displayName: null };
}

describe("claimInvite", () => {
  it("returns 'created' and atomically writes user + deletes invite", async () => {
    const ctrl = await getMockControl();
    const store = makeFakeStore();
    store.docs.set("invites/new@example.com", {
      email: "new@example.com",
      role: "editor" as Role,
      invitedBy: "admin-uid",
      invitedAt: 1000,
      note: null,
    });
    ctrl.__setStore(store);

    const fakeDb = {} as unknown as Parameters<typeof claimInvite>[1];
    const result = await claimInvite(
      mkAuthUser("uid-1", "new@example.com") as unknown as Parameters<typeof claimInvite>[0],
      fakeDb,
    );
    expect(result.kind).toBe("created");
    if (result.kind === "created") {
      expect(result.profile.role).toBe("editor");
      expect(result.profile.email).toBe("new@example.com");
    }
    expect(store.batchCommits).toBe(1);
    expect(store.sets.length).toBe(1);
    expect(store.sets[0].path).toBe("users/uid-1");
    expect(store.deletes).toContain("invites/new@example.com");
  });

  it("returns 'existing' when users/{uid} already exists (idempotent)", async () => {
    const ctrl = await getMockControl();
    const store = makeFakeStore();
    store.docs.set("users/uid-2", {
      uid: "uid-2",
      email: "existing@example.com",
      displayName: "Existing",
      role: "viewer" as Role,
      createdAt: 500,
      invitedBy: null,
      lastSignInAt: 500,
    });
    ctrl.__setStore(store);

    const fakeDb = {} as unknown as Parameters<typeof claimInvite>[1];
    const result = await claimInvite(
      mkAuthUser("uid-2", "existing@example.com") as unknown as Parameters<typeof claimInvite>[0],
      fakeDb,
    );
    expect(result.kind).toBe("existing");
    expect(store.batchCommits).toBe(0); // idempotent: no write
  });

  it("returns 'not-invited' when neither user doc nor invite exists", async () => {
    const ctrl = await getMockControl();
    ctrl.__setStore(makeFakeStore());

    const fakeDb = {} as unknown as Parameters<typeof claimInvite>[1];
    const result = await claimInvite(
      mkAuthUser("uid-3", "stranger@example.com") as unknown as Parameters<typeof claimInvite>[0],
      fakeDb,
    );
    expect(result.kind).toBe("not-invited");
  });

  it("case-mismatched email still claims (Foo@Bar.com claims invite for foo@bar.com)", async () => {
    const ctrl = await getMockControl();
    const store = makeFakeStore();
    store.docs.set("invites/foo@bar.com", {
      email: "foo@bar.com",
      role: "admin" as Role,
      invitedBy: "admin-uid",
      invitedAt: 1000,
      note: null,
    });
    ctrl.__setStore(store);

    const fakeDb = {} as unknown as Parameters<typeof claimInvite>[1];
    const result = await claimInvite(
      mkAuthUser("uid-mixed", "Foo@Bar.com") as unknown as Parameters<typeof claimInvite>[0],
      fakeDb,
    );
    expect(result.kind).toBe("created");
    if (result.kind === "created") {
      expect(result.profile.email).toBe("foo@bar.com");
      expect(result.profile.role).toBe("admin");
    }
    // Verify the doc written to users/{uid} also has the lower-cased email.
    expect(store.sets[0].data.email).toBe("foo@bar.com");
    expect(store.deletes).toContain("invites/foo@bar.com");
  });

  it("rejects an invite with an out-of-enum role (defensive against corrupt data)", async () => {
    const ctrl = await getMockControl();
    const store = makeFakeStore();
    store.docs.set("invites/bad@example.com", {
      email: "bad@example.com",
      role: "owner", // not a valid Role
      invitedBy: "admin-uid",
      invitedAt: 1000,
      note: null,
    });
    ctrl.__setStore(store);

    const fakeDb = {} as unknown as Parameters<typeof claimInvite>[1];
    const result = await claimInvite(
      mkAuthUser("uid-bad", "bad@example.com") as unknown as Parameters<typeof claimInvite>[0],
      fakeDb,
    );
    expect(result.kind).toBe("not-invited");
    expect(store.batchCommits).toBe(0);
  });

  it("returns 'not-invited' when authUser has no email", async () => {
    const ctrl = await getMockControl();
    ctrl.__setStore(makeFakeStore());

    const fakeDb = {} as unknown as Parameters<typeof claimInvite>[1];
    const result = await claimInvite(
      mkAuthUser("uid-noemail", null) as unknown as Parameters<typeof claimInvite>[0],
      fakeDb,
    );
    expect(result.kind).toBe("not-invited");
  });
});
