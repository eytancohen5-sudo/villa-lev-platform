// Unit tests for the useConnectionsLog store's derive / grouping / staleness logic.
//
// Environment: node (vitest.config.ts — no jsdom, no React renderer).
//
// Strategy: we cannot call `renderHook` in node env. Instead:
//
//   - `@/lib/firebase`     → getDb returns a non-null sentinel so the
//                            `if (!db)` guard passes.
//   - `firebase/firestore` → collection() is a no-op; onSnapshot() captures
//                            the success callback so each test can fire it
//                            with controlled doc shapes.
//   - `react`              → useSyncExternalStore is stubbed to call
//                            subscribe(listener) ONCE, capture getSnapshot,
//                            and return the current snapshot. Subsequent
//                            calls in the same test reuse the captured
//                            getSnapshot to avoid double-subscribing.
//
// This drives the module-level store (rawDocs → deriveEntries → emit)
// without Firestore or the React reconciler.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { ConnectionsLogResult } from "@/lib/data/useConnectionsLog";

// ── Fake Firestore shapes ────────────────────────────────────────────────────

type DocData = Record<string, unknown>;

function makeDoc(id: string, data: DocData): { id: string; data: () => DocData } {
  return { id, data: () => data };
}

function makeSnap(docs: Array<{ id: string; data: () => DocData }>) {
  return {
    forEach: (cb: (doc: { id: string; data: () => DocData }) => void) => docs.forEach(cb),
  };
}

// ── Module-level mock state ──────────────────────────────────────────────────

// Holds the onSnapshot success callback captured during startFirestoreListener.
let capturedSuccessCb: ((snap: ReturnType<typeof makeSnap>) => void) | null = null;
// Holds the getSnapshot fn so we can read store state after firing a snapshot.
let capturedGetSnapshot: (() => ConnectionsLogResult) | null = null;
// Holds the unsubscribe returned to the module so the cleanup path works.
let capturedUnsub = vi.fn();
// Holds the cleanup fn returned by subscribe(), for afterEach teardown.
let capturedSubscribeCleanup: (() => void) | null = null;
// Flag: subscribe has been called at least once for this test.
let subscribed = false;

vi.mock("@/lib/firebase", () => ({
  getDb: () => ({}), // non-null sentinel — passes the `if (!db)` guard
}));

vi.mock("firebase/firestore", async (importOriginal) => {
  const actual = await importOriginal<typeof import("firebase/firestore")>();
  return {
    ...actual,
    collection: () => ({}),
    onSnapshot: (
      _ref: unknown,
      successCb: (snap: ReturnType<typeof makeSnap>) => void,
      _errorCb: unknown,
    ) => {
      capturedSuccessCb = successCb;
      return capturedUnsub;
    },
  };
});

// Stub useSyncExternalStore:
//   - First call per test: call subscribe(listener) once, capture cleanup
//     and getSnapshot, return current snapshot.
//   - Subsequent calls: just return getSnapshot() without re-subscribing
//     (avoids incrementing subscribeCount on every mountHook call).
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useSyncExternalStore: (
      subscribe: (listener: () => void) => () => void,
      getSnapshot: () => unknown,
      _getServerSnapshot: () => unknown,
    ) => {
      capturedGetSnapshot = getSnapshot as () => ConnectionsLogResult;
      if (!subscribed) {
        subscribed = true;
        capturedSubscribeCleanup = subscribe(() => {});
      }
      return getSnapshot();
    },
  };
});

// ── Helpers ──────────────────────────────────────────────────────────────────

async function getHook() {
  return import("@/lib/data/useConnectionsLog");
}

function readStore(): ConnectionsLogResult {
  if (!capturedGetSnapshot) throw new Error("hook not yet called");
  return capturedGetSnapshot();
}

function fireSnapshot(docs: Array<{ id: string; data: () => DocData }>) {
  if (!capturedSuccessCb) throw new Error("onSnapshot not yet registered — hook not mounted?");
  capturedSuccessCb(makeSnap(docs));
}

async function mountHook(): Promise<ConnectionsLogResult> {
  const { useConnectionsLog } = await getHook();
  return useConnectionsLog() as ConnectionsLogResult;
}

// ── Lifecycle ────────────────────────────────────────────────────────────────

beforeEach(() => {
  capturedSuccessCb = null;
  capturedGetSnapshot = null;
  capturedUnsub = vi.fn();
  subscribed = false;
  capturedSubscribeCleanup = null;
});

afterEach(() => {
  // Call the subscribe cleanup to return subscribeCount to 0, which causes
  // the module to clear rawDocs and reset current = INITIAL.
  if (capturedSubscribeCleanup) {
    capturedSubscribeCleanup();
    capturedSubscribeCleanup = null;
  }
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("useConnectionsLog — grouping by uid", () => {
  it("two docs with the same uid produce one entry with sessionCount: 2", async () => {
    await mountHook(); // subscribe + capture getSnapshot

    fireSnapshot([
      makeDoc("tab-A", {
        uid: "user-1",
        displayName: "Alice",
        isAnonymous: false,
        connectedAt: 1000,
        lastHeartbeat: 5000,
        currentPage: "/admin",
        tabId: "tab-A",
        schemaVersion: 1,
      }),
      makeDoc("tab-B", {
        uid: "user-1",
        displayName: "Alice",
        isAnonymous: false,
        connectedAt: 2000,
        lastHeartbeat: 6000,
        currentPage: "/admin",
        tabId: "tab-B",
        schemaVersion: 1,
      }),
    ]);

    const result = readStore();
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].uid).toBe("user-1");
    expect(result.entries[0].sessionCount).toBe(2);
  });
});

describe("useConnectionsLog — connectedSince is the earliest connectedAt", () => {
  it("picks the minimum connectedAt across tabs for the same uid", async () => {
    await mountHook();

    fireSnapshot([
      makeDoc("tab-A", {
        uid: "user-2",
        connectedAt: 1000,
        lastHeartbeat: 5000,
        schemaVersion: 1,
      }),
      makeDoc("tab-B", {
        uid: "user-2",
        connectedAt: 2000,
        lastHeartbeat: 6000,
        schemaVersion: 1,
      }),
    ]);

    const result = readStore();
    expect(result.entries[0].connectedSince).toBe(1000);
  });
});

describe("useConnectionsLog — lastSeen is the latest lastHeartbeat", () => {
  it("picks the maximum lastHeartbeat across tabs for the same uid", async () => {
    await mountHook();

    fireSnapshot([
      makeDoc("tab-A", {
        uid: "user-3",
        connectedAt: 1000,
        lastHeartbeat: 5000,
        schemaVersion: 1,
      }),
      makeDoc("tab-B", {
        uid: "user-3",
        connectedAt: 2000,
        lastHeartbeat: 8000,
        schemaVersion: 1,
      }),
    ]);

    const result = readStore();
    expect(result.entries[0].lastSeen).toBe(8000);
  });
});

describe("useConnectionsLog — isStale flag", () => {
  it("isStale true when lastHeartbeat is 120 s ago (STALE_THRESHOLD_MS is 90 s)", async () => {
    await mountHook();

    const staleHeartbeat = Date.now() - 120_000;

    fireSnapshot([
      makeDoc("tab-stale", {
        uid: "user-stale",
        connectedAt: staleHeartbeat - 10_000,
        lastHeartbeat: staleHeartbeat,
        schemaVersion: 1,
      }),
    ]);

    const result = readStore();
    expect(result.entries[0].isStale).toBe(true);
  });

  it("isStale false when lastHeartbeat is 30 s ago (below 90 s threshold)", async () => {
    await mountHook();

    const freshHeartbeat = Date.now() - 30_000;

    fireSnapshot([
      makeDoc("tab-fresh", {
        uid: "user-fresh",
        connectedAt: freshHeartbeat - 5_000,
        lastHeartbeat: freshHeartbeat,
        schemaVersion: 1,
      }),
    ]);

    const result = readStore();
    expect(result.entries[0].isStale).toBe(false);
  });
});

describe("useConnectionsLog — sort order", () => {
  it("entries are sorted ascending by connectedSince (earliest first)", async () => {
    await mountHook();

    const now = Date.now();
    fireSnapshot([
      makeDoc("tab-C", {
        uid: "user-C",
        connectedAt: 3000,
        lastHeartbeat: now - 10_000,
        schemaVersion: 1,
      }),
      makeDoc("tab-A", {
        uid: "user-A",
        connectedAt: 1000,
        lastHeartbeat: now - 10_000,
        schemaVersion: 1,
      }),
      makeDoc("tab-B", {
        uid: "user-B",
        connectedAt: 2000,
        lastHeartbeat: now - 10_000,
        schemaVersion: 1,
      }),
    ]);

    const result = readStore();
    expect(result.entries).toHaveLength(3);
    expect(result.entries[0].uid).toBe("user-A");
    expect(result.entries[1].uid).toBe("user-B");
    expect(result.entries[2].uid).toBe("user-C");
  });
});

describe("useConnectionsLog — invalid docs filtered", () => {
  it("doc missing uid field is dropped; valid doc passes through", async () => {
    await mountHook();

    const now = Date.now();
    fireSnapshot([
      // Valid doc — all required fields present.
      makeDoc("tab-valid", {
        uid: "user-valid",
        connectedAt: 1000,
        lastHeartbeat: now - 10_000,
        schemaVersion: 1,
      }),
      // Invalid doc — uid intentionally omitted so typeof uid !== 'string'.
      makeDoc("tab-invalid", {
        connectedAt: 2000,
        lastHeartbeat: now - 5_000,
        schemaVersion: 1,
      }),
    ]);

    const result = readStore();
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].uid).toBe("user-valid");
  });
});
