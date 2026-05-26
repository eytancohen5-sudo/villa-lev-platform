// Regression tests for the referenceAutoLoadAttempted guard.
//
// Bug: when a user dismissed the save modal, `dismissSaveModal` zeroed
// `editsSinceLastSave`. The `useReferenceScenarioAutoLoad` hook's `tryLoad`
// used `editsSinceLastSave > 0` as a guard against overwriting user edits.
// Because the counter was cleared, `tryLoad` would call `loadConfig` and
// overwrite user edits with the reference scenario.
//
// Fix: every store action that zeros `editsSinceLastSave` also sets
// `referenceAutoLoadAttempted: true`, which is the primary guard in `tryLoad`.
//
// Cases covered:
//   1. dismissSaveModal() — sets flag + resets counter
//   2. dismissSaveModal(true) — permanent-disable path also sets flag
//   3. revertChange — sets flag (seeded history entry required)
//   4. acceptSaveSuggestion — sets flag (Firebase mocked)
//   5. acceptUpdateExisting — sets flag (Firebase mocked, lastSavedConfigId seeded)
//   6. Fresh store — flag starts false (auto-load baseline still works)

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── Mock firebase BEFORE importing the store ──────────────────────────
vi.mock('@/lib/firebase', () => ({
  getDb: () => ({ __fakeDb: true }),
  SCENARIOS_COLLECTION: 'scenarios',
  USERS_COLLECTION: 'users',
  INVITES_COLLECTION: 'invites',
}));

// Minimal in-memory Firestore fake — only the operations exercised here.
const fakeFirestore = {
  setCalls: [] as Array<{ id: string; data: Record<string, unknown> }>,
};

function resetFakeFirestore() {
  fakeFirestore.setCalls = [];
}

vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, name: string) => ({ __collection: name }),
  doc: (_db: unknown, collectionName: string, id: string) => ({
    __doc: true,
    path: `${collectionName}/${id}`,
    id,
  }),
  getDocs: async () => ({
    forEach: () => {},
  }),
  setDoc: async (ref: { id: string }, data: Record<string, unknown>) => {
    fakeFirestore.setCalls.push({ id: ref.id, data });
  },
  deleteDoc: async () => {},
  writeBatch: () => {
    const ops: Array<() => void> = [];
    return {
      set: (ref: { id: string }, data: Record<string, unknown>) => {
        ops.push(() => { fakeFirestore.setCalls.push({ id: ref.id, data }); });
      },
      delete: () => {},
      commit: async () => { ops.forEach((op) => op()); },
    };
  },
  query: (col: { __collection: string }) => ({ __collection: col.__collection }),
  where: (field: string, _op: string, value: unknown) => ({ __where: { field, value } }),
}));

// Deterministic UUIDs so IDs in saved configs are predictable.
let uuidCounter = 0;
beforeEach(() => {
  uuidCounter = 0;
  const g = globalThis as unknown as { crypto: { randomUUID: () => string } };
  if (!g.crypto) {
    g.crypto = { randomUUID: () => `test-uuid-${++uuidCounter}` };
  } else {
    g.crypto.randomUUID = () => `test-uuid-${++uuidCounter}`;
  }

  resetFakeFirestore();

  // Polyfill localStorage for the Node/Vitest environment.
  const memStore = new Map<string, string>();
  const fakeLocalStorage: Storage = {
    getItem: (k) => (memStore.has(k) ? memStore.get(k)! : null),
    setItem: (k, v) => { memStore.set(k, v); },
    removeItem: (k) => { memStore.delete(k); },
    clear: () => { memStore.clear(); },
    key: () => null,
    length: 0,
  };
  const gg = globalThis as unknown as {
    window: { localStorage: Storage };
    localStorage: Storage;
  };
  gg.window = gg.window ?? ({ localStorage: fakeLocalStorage } as { localStorage: Storage });
  gg.window.localStorage = fakeLocalStorage;
  gg.localStorage = fakeLocalStorage;
});

// Import the store AFTER mocks are wired.
import { useModelStore, type SavedConfiguration, type ChangeEntry } from '@/lib/store/modelStore';

// ── Helpers ────────────────────────────────────────────────────────────

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
    editsSinceLastSave: 0,
    referenceAutoLoadAttempted: false,
    saveModalOpen: false,
    savePromptDismissed: false,
    savePromptDisabled: false,
    history: [],
  });
}

/** Build a minimal valid ChangeEntry that revertChange can act on. */
function makeHistoryEntry(overrides: Partial<ChangeEntry> = {}): ChangeEntry {
  return {
    id: 'chg-seed-1',
    timestamp: 1_000_000,
    user: 'You',
    scope: 'assumption',
    path: 'commercialLoan.interestRate',
    label: 'Interest rate',
    before: 0.05,
    after: 0.07,
    superseded: false,
    reverted: false,
    ...overrides,
  };
}

// ── Test suites ────────────────────────────────────────────────────────

describe('referenceAutoLoadAttempted guard — regression for save-modal race', () => {
  beforeEach(resetStore);

  // ------------------------------------------------------------------ 6
  it('6. fresh store: referenceAutoLoadAttempted starts false (auto-load baseline)', () => {
    // No interaction at all — the hook must be free to run on a clean visit.
    expect(useModelStore.getState().referenceAutoLoadAttempted).toBe(false);
  });

  // ------------------------------------------------------------------ 1
  it('1. dismissSaveModal() sets referenceAutoLoadAttempted and zeros editsSinceLastSave', () => {
    // Simulate the user having made edits before dismissing.
    useModelStore.setState({ editsSinceLastSave: 3, saveModalOpen: true });

    useModelStore.getState().dismissSaveModal();

    const state = useModelStore.getState();
    expect(state.referenceAutoLoadAttempted).toBe(true);
    expect(state.editsSinceLastSave).toBe(0);
    expect(state.saveModalOpen).toBe(false);
    expect(state.savePromptDismissed).toBe(true);
  });

  // ------------------------------------------------------------------ 2
  it('2. dismissSaveModal(true) permanent-disable also sets referenceAutoLoadAttempted', () => {
    useModelStore.setState({ editsSinceLastSave: 5, saveModalOpen: true });

    useModelStore.getState().dismissSaveModal(true);

    const state = useModelStore.getState();
    expect(state.referenceAutoLoadAttempted).toBe(true);
    expect(state.editsSinceLastSave).toBe(0);
    expect(state.savePromptDisabled).toBe(true);
    expect(state.savePromptDismissed).toBe(true);
    expect(state.saveModalOpen).toBe(false);
  });

  // ------------------------------------------------------------------ 3
  it('3. revertChange sets referenceAutoLoadAttempted', () => {
    // Seed assumptions so the revert has something to write back.
    const entry = makeHistoryEntry();
    // Put the "after" value into assumptions so the store holds it and
    // revertChange can write `entry.before` back.
    useModelStore.setState({
      history: [entry],
      referenceAutoLoadAttempted: false,
    });
    // The assumption path is 'commercialLoan.interestRate'. Set it to `after`
    // so reverting to `before` is a meaningful write.
    useModelStore.getState().setAssumption(
      'commercialLoan.interestRate',
      0.07,
      'Interest rate'
    );
    // Reset the flag that setAssumption doesn't touch but history got extended;
    // re-plant our seed entry so we have a known ID to revert.
    useModelStore.setState({
      history: [entry],
      referenceAutoLoadAttempted: false,
    });

    useModelStore.getState().revertChange('chg-seed-1');

    expect(useModelStore.getState().referenceAutoLoadAttempted).toBe(true);
  });

  // ------------------------------------------------------------------ 4
  it('4. acceptSaveSuggestion sets referenceAutoLoadAttempted', async () => {
    // Auth identity required so saveConfig doesn't bail early.
    useModelStore.getState().setCurrentAuthIdentity({
      uid: 'uid-test',
      displayName: 'Tester',
      email: 'test@example.com',
    });
    useModelStore.setState({ editsSinceLastSave: 2, saveModalOpen: true });

    // acceptSaveSuggestion calls saveConfig (fire-and-forget), then sets state
    // synchronously. We await a microtask tick so the promise chain settles.
    useModelStore.getState().acceptSaveSuggestion('My new scenario');
    // The synchronous set happens immediately; no need to await the internal
    // saveConfig promise for the flag assertion.
    await Promise.resolve();

    const state = useModelStore.getState();
    expect(state.referenceAutoLoadAttempted).toBe(true);
    expect(state.editsSinceLastSave).toBe(0);
    expect(state.saveModalOpen).toBe(false);
  });

  // ------------------------------------------------------------------ 5
  it('5. acceptUpdateExisting sets referenceAutoLoadAttempted', async () => {
    useModelStore.getState().setCurrentAuthIdentity({
      uid: 'uid-test',
      displayName: 'Tester',
      email: 'test@example.com',
    });

    // Seed an existing own scenario so updateConfig can find it.
    const existing: SavedConfiguration = {
      id: 'saved-id-1',
      name: 'Existing scenario',
      assumptions: useModelStore.getState().assumptions,
      templates: useModelStore.getState().templates,
      projects: useModelStore.getState().projects,
      savedAt: 900_000,
      userId: 'uid-test',
      ownerDisplayName: 'Tester',
      published: false,
      copiedFrom: null,
    };
    useModelStore.setState({
      savedConfigs: [existing],
      lastSavedConfigId: 'saved-id-1',
      lastSavedConfigName: 'Existing scenario',
      editsSinceLastSave: 4,
      saveModalOpen: true,
    });

    useModelStore.getState().acceptUpdateExisting();
    await Promise.resolve();

    const state = useModelStore.getState();
    expect(state.referenceAutoLoadAttempted).toBe(true);
    expect(state.editsSinceLastSave).toBe(0);
    expect(state.saveModalOpen).toBe(false);
  });
});
