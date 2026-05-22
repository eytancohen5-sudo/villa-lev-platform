// Unit tests for the scenario-sharing extension on modelStore.
//
// What this covers (planner Step 13, 8 cases):
//   1. saveConfig stamps userId + ownerDisplayName + published=false by default.
//   2. saveConfig with { published: true } stamps published=true.
//   3. loadConfig on a FOREIGN scenario forks a copy with copiedFrom provenance
//      and a fresh id, leaving the source untouched.
//   4. loadConfig double-click race (Revision 3): second load finds the
//      existing copy instead of creating a duplicate.
//   5. updateConfig refuses to write to someone else's scenario (alerts).
//   6. deleteConfig refuses to delete someone else's scenario (alerts).
//   7. Email-local-part fallback when displayName is null at save time.
//   8. importConfigs (Revision 4) preserves `published` on own-backup imports
//      and resets it on foreign imports.
//
// Mocking strategy: we mock `firebase/firestore` to an in-memory store
// (no emulator dependency, matching the pattern in userProfile.test.ts).
// Firebase auth and getDb() are stubbed via `@/lib/firebase`.

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── Mock firebase BEFORE importing the store ──────────────────────────
// The store imports getDb / SCENARIOS_COLLECTION from '@/lib/firebase'
// at module top-level; we replace those with controllable fakes.

vi.mock('@/lib/firebase', () => ({
  getDb: () => ({ __fakeDb: true }),
  SCENARIOS_COLLECTION: 'scenarios',
  USERS_COLLECTION: 'users',
  INVITES_COLLECTION: 'invites',
}));

type FakeDoc = { id: string; data: Record<string, unknown> };
type FakeStore = {
  docs: Map<string, FakeDoc>;
  setCalls: Array<{ id: string; data: Record<string, unknown> }>;
  deleteCalls: string[];
  failNextWrite: boolean;
};

const fakeState: { store: FakeStore } = {
  store: {
    docs: new Map(),
    setCalls: [],
    deleteCalls: [],
    failNextWrite: false,
  },
};

function resetFakeStore() {
  fakeState.store = {
    docs: new Map(),
    setCalls: [],
    deleteCalls: [],
    failNextWrite: false,
  };
}

vi.mock('firebase/firestore', () => {
  return {
    collection: (_db: unknown, name: string) => ({ __collection: name }),
    doc: (_db: unknown, collectionName: string, id: string) => ({
      __doc: true,
      path: `${collectionName}/${id}`,
      id,
    }),
    getDocs: async (q: { __collection?: string; __query?: { field: string; value: unknown } }) => {
      // q can be either a raw collection ref OR a query() result. We only
      // ever read `scenarios`, so any match-all + where-predicate over
      // that collection is fine.
      const docs = Array.from(fakeState.store.docs.values());
      let filtered = docs;
      if (q && '__query' in q && q.__query) {
        const { field, value } = q.__query;
        filtered = docs.filter((d) => d.data[field] === value);
      }
      return {
        forEach: (fn: (snap: { id: string; data: () => Record<string, unknown> }) => void) => {
          filtered.forEach((d) => fn({ id: d.id, data: () => d.data }));
        },
      };
    },
    setDoc: async (ref: { id: string }, data: Record<string, unknown>) => {
      if (fakeState.store.failNextWrite) {
        fakeState.store.failNextWrite = false;
        throw new Error('permission-denied');
      }
      fakeState.store.setCalls.push({ id: ref.id, data });
      fakeState.store.docs.set(ref.id, { id: ref.id, data });
    },
    deleteDoc: async (ref: { id: string }) => {
      if (fakeState.store.failNextWrite) {
        fakeState.store.failNextWrite = false;
        throw new Error('permission-denied');
      }
      fakeState.store.deleteCalls.push(ref.id);
      fakeState.store.docs.delete(ref.id);
    },
    writeBatch: () => {
      const ops: Array<() => void> = [];
      return {
        set: (ref: { id: string }, data: Record<string, unknown>) => {
          ops.push(() => {
            fakeState.store.setCalls.push({ id: ref.id, data });
            fakeState.store.docs.set(ref.id, { id: ref.id, data });
          });
        },
        delete: (ref: { id: string }) => {
          ops.push(() => {
            fakeState.store.deleteCalls.push(ref.id);
            fakeState.store.docs.delete(ref.id);
          });
        },
        commit: async () => {
          ops.forEach((op) => op());
        },
      };
    },
    query: (col: { __collection: string }, ...constraints: Array<{ __where: { field: string; value: unknown } }>) => ({
      __collection: col.__collection,
      __query: constraints[0]?.__where,
    }),
    where: (field: string, _op: string, value: unknown) => ({
      __where: { field, value },
    }),
  };
});

// Mock crypto.randomUUID for deterministic ids in the foreign-load test.
let uuidCounter = 0;
beforeEach(() => {
  uuidCounter = 0;
  const g = globalThis as unknown as { crypto: { randomUUID: () => string } };
  if (!g.crypto) {
    g.crypto = { randomUUID: () => `test-uuid-${++uuidCounter}` };
  } else {
    g.crypto.randomUUID = () => `test-uuid-${++uuidCounter}`;
  }
  resetFakeStore();
  // Stub localStorage for the Node env (vitest 'node' env has no DOM).
  // The store reads `typeof window !== 'undefined'` to decide whether to
  // touch localStorage, AND uses bare `localStorage.setItem(...)` (not
  // `window.localStorage`), so we expose it on globalThis too.
  const memStore = new Map<string, string>();
  const fakeLocalStorage = {
    getItem: (k: string) => (memStore.has(k) ? memStore.get(k)! : null),
    setItem: (k: string, v: string) => { memStore.set(k, v); },
    removeItem: (k: string) => { memStore.delete(k); },
    clear: () => { memStore.clear(); },
    key: () => null,
    length: 0,
  } as Storage;
  // Casting through `unknown` because Node + Vitest 'node' env doesn't
  // declare these globals. Assignments are intentional test polyfills.
  const gg = globalThis as unknown as {
    window: { localStorage: Storage };
    localStorage: Storage;
  };
  gg.window = gg.window ?? ({ localStorage: fakeLocalStorage } as { localStorage: Storage });
  gg.window.localStorage = fakeLocalStorage;
  gg.localStorage = fakeLocalStorage;
});

// Import the store AFTER mocks are set up so vi.mock takes effect.
import { useModelStore, type SavedConfiguration } from '@/lib/store/modelStore';

// Force-reset the store between tests so leakage from one case doesn't
// pollute another. The store is a module-level singleton.
function resetStore() {
  useModelStore.setState({
    savedConfigs: [],
    activeConfigId: null,
    activeConfigName: null,
    lastSavedConfigId: null,
    lastSavedConfigName: null,
    currentUserUid: null,
    currentUserDisplayName: null,
    currentUserEmail: null,
    hydrationToken: 0,
    hydratingFor: null,
    uiPrompt: null,
  });
}

// Drain any pending requestAlert so the next test starts clean.
function consumeAlert() {
  const p = useModelStore.getState().uiPrompt;
  useModelStore.setState({ uiPrompt: null });
  return p;
}

describe('saveConfig — ownership stamping', () => {
  beforeEach(resetStore);

  it('1. stamps userId + ownerDisplayName + published=false by default', async () => {
    useModelStore.getState().setCurrentAuthIdentity({
      uid: 'uid-alice',
      displayName: 'Alice',
      email: 'alice@example.com',
    });
    await useModelStore.getState().saveConfig('My scenario');
    const configs = useModelStore.getState().savedConfigs;
    expect(configs).toHaveLength(1);
    const saved = configs[0];
    expect(saved.userId).toBe('uid-alice');
    expect(saved.ownerDisplayName).toBe('Alice');
    expect(saved.published).toBe(false);
    expect(saved.copiedFrom).toBeNull();
    // Server got a copy too.
    expect(fakeState.store.setCalls).toHaveLength(1);
    expect(fakeState.store.setCalls[0].data.userId).toBe('uid-alice');
    expect(fakeState.store.setCalls[0].data.published).toBe(false);
  });

  it('2. stamps published=true when opts.published is set', async () => {
    useModelStore.getState().setCurrentAuthIdentity({
      uid: 'uid-alice',
      displayName: 'Alice',
      email: 'alice@example.com',
    });
    await useModelStore.getState().saveConfig('Shared scenario', { published: true });
    const saved = useModelStore.getState().savedConfigs[0];
    expect(saved.published).toBe(true);
  });

  it('7. falls back to email-local-part when displayName is null', async () => {
    useModelStore.getState().setCurrentAuthIdentity({
      uid: 'uid-bob',
      displayName: null,
      email: 'bob.smith@foo.com',
    });
    await useModelStore.getState().saveConfig('No display name');
    const saved = useModelStore.getState().savedConfigs[0];
    expect(saved.ownerDisplayName).toBe('bob.smith');
  });

  it('refuses to save without auth, alerts the user', async () => {
    // No identity bridge call → uid is null.
    await useModelStore.getState().saveConfig('Anonymous attempt');
    expect(useModelStore.getState().savedConfigs).toHaveLength(0);
    const alert = consumeAlert();
    expect(alert?.kind).toBe('alert');
    if (alert?.kind === 'alert') {
      expect(alert.tone).toBe('warning');
      expect(alert.title).toMatch(/sign.?in/i);
    }
  });
});

describe('loadConfig — copy-on-load semantics', () => {
  beforeEach(resetStore);

  // Helper: seed the store with a foreign scenario (someone else's, published).
  function seedForeign(): SavedConfiguration {
    const foreign: SavedConfiguration = {
      id: 'foreign-source-id',
      name: 'Alice scenario',
      assumptions: useModelStore.getState().assumptions,
      savedAt: 1_000_000,
      userId: 'uid-alice',
      ownerDisplayName: 'Alice',
      published: true,
      copiedFrom: null,
      // No projects → triggers legacy-migration branch; but we also want
      // the new-schema branch to be reached, so we set an empty projects
      // array via the store. The store falls into legacy when projects
      // is empty; that's fine — the test still asserts the copy lands.
      templates: useModelStore.getState().templates,
      projects: useModelStore.getState().projects,
    };
    useModelStore.setState({ savedConfigs: [foreign] });
    return foreign;
  }

  it('3. loading a foreign scenario forks a copy with copiedFrom provenance', async () => {
    useModelStore.getState().setCurrentAuthIdentity({
      uid: 'uid-bob',
      displayName: 'Bob',
      email: 'bob@example.com',
    });
    const foreign = seedForeign();
    await useModelStore.getState().loadConfig(foreign.id);
    const configs = useModelStore.getState().savedConfigs;
    // Original untouched, copy appended.
    expect(configs).toHaveLength(2);
    const copy = configs.find((c) => c.id !== foreign.id)!;
    expect(copy.userId).toBe('uid-bob');
    expect(copy.ownerDisplayName).toBe('Bob');
    expect(copy.published).toBe(false);
    expect(copy.copiedFrom).toEqual({
      userId: 'uid-alice',
      displayName: 'Alice',
      scenarioId: foreign.id,
      copiedAt: expect.any(Number),
    });
    // Active pointer points at the COPY, not the source.
    expect(useModelStore.getState().activeConfigId).toBe(copy.id);
    expect(useModelStore.getState().activeConfigId).not.toBe(foreign.id);
    // Server received the copy.
    const serverCopy = fakeState.store.setCalls.find((c) => c.id === copy.id);
    expect(serverCopy).toBeDefined();
  });

  it('4. double-click race: second load focuses existing copy instead of duplicating', async () => {
    useModelStore.getState().setCurrentAuthIdentity({
      uid: 'uid-bob',
      displayName: 'Bob',
      email: 'bob@example.com',
    });
    const foreign = seedForeign();
    await useModelStore.getState().loadConfig(foreign.id);
    const afterFirst = useModelStore.getState().savedConfigs.length;
    // Second load should NOT add a third entry.
    await useModelStore.getState().loadConfig(foreign.id);
    const afterSecond = useModelStore.getState().savedConfigs.length;
    expect(afterSecond).toBe(afterFirst);
    // Active pointer still at the existing copy (not the source).
    expect(useModelStore.getState().activeConfigId).not.toBe(foreign.id);
  });

  it('loading own scenario does NOT fork a copy', async () => {
    useModelStore.getState().setCurrentAuthIdentity({
      uid: 'uid-alice',
      displayName: 'Alice',
      email: 'alice@example.com',
    });
    const ownDoc: SavedConfiguration = {
      id: 'own-id',
      name: 'My own',
      assumptions: useModelStore.getState().assumptions,
      templates: useModelStore.getState().templates,
      projects: useModelStore.getState().projects,
      savedAt: 1_000_000,
      userId: 'uid-alice',
      ownerDisplayName: 'Alice',
      published: false,
      copiedFrom: null,
    };
    useModelStore.setState({ savedConfigs: [ownDoc] });
    await useModelStore.getState().loadConfig(ownDoc.id);
    expect(useModelStore.getState().savedConfigs).toHaveLength(1);
    expect(useModelStore.getState().activeConfigId).toBe(ownDoc.id);
  });
});

describe('updateConfig / deleteConfig — owner-only guards', () => {
  beforeEach(resetStore);

  function seedForeign(): SavedConfiguration {
    const foreign: SavedConfiguration = {
      id: 'foreign-id',
      name: 'Alice scenario',
      assumptions: useModelStore.getState().assumptions,
      templates: useModelStore.getState().templates,
      projects: useModelStore.getState().projects,
      savedAt: 1_000_000,
      userId: 'uid-alice',
      ownerDisplayName: 'Alice',
      published: true,
      copiedFrom: null,
    };
    useModelStore.setState({ savedConfigs: [foreign] });
    return foreign;
  }

  it('5. updateConfig refuses to overwrite someone else\'s scenario', async () => {
    useModelStore.getState().setCurrentAuthIdentity({
      uid: 'uid-bob',
      displayName: 'Bob',
      email: 'bob@example.com',
    });
    const foreign = seedForeign();
    await useModelStore.getState().updateConfig(foreign.id);
    // Server was NOT called.
    expect(fakeState.store.setCalls).toHaveLength(0);
    // Alert was raised.
    const alert = consumeAlert();
    expect(alert?.kind).toBe('alert');
    if (alert?.kind === 'alert') {
      expect(alert.tone).toBe('warning');
    }
  });

  it('6. deleteConfig refuses to delete someone else\'s scenario', async () => {
    useModelStore.getState().setCurrentAuthIdentity({
      uid: 'uid-bob',
      displayName: 'Bob',
      email: 'bob@example.com',
    });
    const foreign = seedForeign();
    await useModelStore.getState().deleteConfig(foreign.id);
    expect(fakeState.store.deleteCalls).toHaveLength(0);
    expect(useModelStore.getState().savedConfigs).toHaveLength(1);
    const alert = consumeAlert();
    expect(alert?.kind).toBe('alert');
  });
});

describe('importConfigs — ownership re-stamping', () => {
  beforeEach(resetStore);

  it('8a. preserves published on own-backup imports', () => {
    useModelStore.getState().setCurrentAuthIdentity({
      uid: 'uid-alice',
      displayName: 'Alice',
      email: 'alice@example.com',
    });
    // Restoring Alice's OWN previously-shared backup. published was true,
    // it should stay true after import.
    const incoming: SavedConfiguration = {
      id: 'backup-1',
      name: 'Alice backup',
      assumptions: useModelStore.getState().assumptions,
      templates: useModelStore.getState().templates,
      projects: useModelStore.getState().projects,
      savedAt: 2_000_000,
      userId: 'uid-alice',
      ownerDisplayName: 'Alice',
      published: true,
      copiedFrom: null,
    };
    const { added } = useModelStore.getState().importConfigs([incoming]);
    expect(added).toBe(1);
    const stored = useModelStore.getState().savedConfigs.find((c) => c.id === 'backup-1');
    expect(stored?.published).toBe(true);
    expect(stored?.userId).toBe('uid-alice');
  });

  it('8b. resets published + re-stamps userId on foreign imports', () => {
    useModelStore.getState().setCurrentAuthIdentity({
      uid: 'uid-bob',
      displayName: 'Bob',
      email: 'bob@example.com',
    });
    // Bob imports a JSON exported by Alice. It MUST be re-stamped to Bob,
    // and published reset to false.
    const incoming: SavedConfiguration = {
      id: 'alice-export-1',
      name: 'Alice export',
      assumptions: useModelStore.getState().assumptions,
      templates: useModelStore.getState().templates,
      projects: useModelStore.getState().projects,
      savedAt: 2_000_000,
      userId: 'uid-alice',
      ownerDisplayName: 'Alice',
      published: true,
      copiedFrom: null,
    };
    useModelStore.getState().importConfigs([incoming]);
    const stored = useModelStore.getState().savedConfigs.find((c) => c.id === 'alice-export-1');
    expect(stored?.userId).toBe('uid-bob');
    expect(stored?.ownerDisplayName).toBe('Bob');
    expect(stored?.published).toBe(false);
    expect(stored?.copiedFrom).toBeNull();
  });
});
