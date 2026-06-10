import { create } from 'zustand';
import {
  ModelAssumptions,
  ModelOutput,
  CapexBreakdown,
  FinancingPath,
  PropertyTemplate,
  ProjectAllocation,
  PropertyConfig,
  PropertyOpex,
  RoomAreaBreakdown,
  StaffRole,
  SharedServiceLine,
  PortfolioOpex,
} from '../engine/types';
import {
  BASE_CASE,
  BUILT_IN_TEMPLATES,
  DEFAULT_PROJECTS,
  DEFAULT_ROOM_AREAS,
  DEFAULT_VILLA,
  DEFAULT_SUITE,
  resolvePortfolio,
  DEFAULT_PORTFOLIO_OPEX,
  ensurePortfolioOpex,
} from '../engine/defaults';
import { computeModel, computeCapex } from '../engine/model';
import { applyCapexUplift } from '../engine/capexUplift';
import { applyCapexAbsorption, isAbsorptionActive, type CapexAbsorptionConfig } from '../engine/capexAbsorption';
import {
  CapTableStakeholder,
  WaterfallParams,
  DEFAULT_CAP_TABLE,
  DEFAULT_WATERFALL,
} from '../engine/capTable';

// Backfill fields added after a template was saved, so older saved scenarios
// load without crashing the UI: roomAreas, and unit counts (villaUnits,
// standardSuites, doubleSuites). For built-in IDs we copy the canonical values;
// otherwise we fall back to zeros / DEFAULT_ROOM_AREAS.
function ensureRoomAreas(tpl: PropertyTemplate): PropertyTemplate {
  const builtIn = BUILT_IN_TEMPLATES.find((bt) => bt.id === tpl.id);
  const baseRooms: RoomAreaBreakdown = tpl.roomAreas
    ? tpl.roomAreas
    : builtIn
      ? { ...builtIn.roomAreas }
      : { ...DEFAULT_ROOM_AREAS };
  // Older saves don't have villaRooms — synthesize a single bulk entry from
  // villaUnitArea so users see something editable instead of a hidden field.
  const villaUnitsCount = tpl.villaUnits ?? builtIn?.villaUnits ?? 0;
  const roomAreas: RoomAreaBreakdown =
    villaUnitsCount > 0 && (!baseRooms.villaRooms || baseRooms.villaRooms.length === 0)
      ? {
          ...baseRooms,
          villaRooms: [
            {
              id: 'vr-legacy-' + tpl.id,
              name: 'Villa interior',
              count: 1,
              area: baseRooms.villaUnitArea || 0,
            },
          ],
        }
      : baseRooms;
  const bedroomsPerStandard = tpl.bedroomsPerStandard ?? builtIn?.bedroomsPerStandard ?? 1;
  const bedroomsPerDouble   = tpl.bedroomsPerDouble   ?? builtIn?.bedroomsPerDouble   ?? 2;
  const bedroomsInMain      = tpl.bedroomsInMain      ?? builtIn?.bedroomsInMain      ?? 4;
  const lockableSubUnits    = tpl.lockableSubUnits    ?? builtIn?.lockableSubUnits    ?? 3;
  const bedroomsPerSubUnit  = tpl.bedroomsPerSubUnit  ?? builtIn?.bedroomsPerSubUnit  ?? 1;
  return {
    ...tpl,
    roomAreas,
    villaUnits: villaUnitsCount,
    standardSuites: tpl.standardSuites ?? builtIn?.standardSuites ?? 0,
    doubleSuites: tpl.doubleSuites ?? builtIn?.doubleSuites ?? 0,
    bedroomsPerStandard,
    bedroomsPerDouble,
    bedroomsInMain,
    lockableSubUnits,
    bedroomsPerSubUnit,
    // Backfill ffeReserveFloor added 2026-05 — built-in templates use the
    // canonical value; custom templates default to 0.
    opex: {
      ...tpl.opex,
      ffeReserveFloor: tpl.opex.ffeReserveFloor ?? builtIn?.opex.ffeReserveFloor ?? 0,
    },
    landscapingCost: tpl.landscapingCost ?? builtIn?.landscapingCost,
    licensesPermitsCost: tpl.licensesPermitsCost ?? builtIn?.licensesPermitsCost,
    constructionDirectorCost: tpl.constructionDirectorCost || builtIn?.constructionDirectorCost,
    // Treat empty poolSlots array same as undefined — old snapshots may have
    // been saved with [] before the pool-slots feature existed.
    poolSlots: (tpl.poolSlots && tpl.poolSlots.length > 0)
      ? tpl.poolSlots
      : builtIn?.poolSlots?.map(s => ({ ...s })),
    wellnessFlatCost: tpl.wellnessFlatCost ?? builtIn?.wellnessFlatCost,
    // 7.34% is the standard Greek acquisition legal rate; use as fallback for
    // custom templates that pre-date this field.
    acquisitionLegalRate: tpl.acquisitionLegalRate ?? builtIn?.acquisitionLegalRate ?? 0.0734,
    interiorDesignerCost: tpl.interiorDesignerCost ?? builtIn?.interiorDesignerCost,
  };
}

// ── Helpers ──

function deepMerge<T extends Record<string, unknown>>(target: T, source: Partial<T>): T {
  const result = { ...target };
  for (const key in source) {
    if (
      source[key] &&
      typeof source[key] === 'object' &&
      !Array.isArray(source[key]) &&
      target[key] &&
      typeof target[key] === 'object'
    ) {
      (result as Record<string, unknown>)[key] = deepMerge(
        target[key] as Record<string, unknown>,
        source[key] as Record<string, unknown>
      );
    } else if (source[key] !== undefined) {
      (result as Record<string, unknown>)[key] = source[key];
    }
  }
  return result;
}

function setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): Record<string, unknown> {
  const keys = path.split('.');
  const result = { ...obj };
  let current: Record<string, unknown> = result;
  for (let i = 0; i < keys.length - 1; i++) {
    current[keys[i]] = { ...(current[keys[i]] as Record<string, unknown>) };
    current = current[keys[i]] as Record<string, unknown>;
  }
  current[keys[keys.length - 1]] = value;
  return result;
}

function readNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const keys = path.split('.');
  let current: unknown = obj;
  for (const key of keys) {
    if (current === null || current === undefined) return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

// pushHistory records a single change, marks earlier same-(scope,scopeId,path) entries superseded,
// and persists the trimmed history to localStorage.
function pushHistory(
  getState: () => { history: ChangeEntry[]; currentUser: string },
  setState: (partial: { history: ChangeEntry[] }) => void,
  entry: { scope: ChangeScope; scopeId?: string; scopeLabel?: string; path: string; label: string; before: unknown; after: unknown }
) {
  // Skip no-op changes
  if (JSON.stringify(entry.before) === JSON.stringify(entry.after)) return;

  const state = getState();
  const newEntry: ChangeEntry = {
    id: generateId('chg'),
    timestamp: Date.now(),
    user: state.currentUser,
    scope: entry.scope,
    scopeId: entry.scopeId,
    scopeLabel: entry.scopeLabel,
    path: entry.path,
    label: entry.label,
    before: entry.before,
    after: entry.after,
  };

  // Mark previous non-superseded entries for same (scope, scopeId, path) as superseded
  const updatedHistory = state.history.map((h) =>
    !h.superseded &&
    h.scope === entry.scope &&
    h.scopeId === entry.scopeId &&
    h.path === entry.path
      ? { ...h, superseded: true }
      : h
  );

  const next = [...updatedHistory, newEntry].slice(-HISTORY_MAX);
  setState({ history: next });
  saveHistoryToStorage(next);
}

let idCounter = 0;
function generateId(prefix: string): string {
  idCounter++;
  return `${prefix}-${Date.now()}-${idCounter}`;
}

// Threshold for when to suggest saving — keeps the prompt from firing on every keystroke.
const SAVE_PROMPT_THRESHOLD = 3;

// Called from every assumption/template/project mutator after the change lands.
// Fires the name modal on the very first edit (when user is still the default
// "You"), and the save modal once a small batch of edits has accumulated.
function bumpEditCounter(
  getState: () => {
    currentUser: string;
    userHasSetName: boolean;
    savePromptDismissed: boolean;
    savePromptDisabled: boolean;
    nameModalOpen: boolean;
    saveModalOpen: boolean;
    editsSinceLastSave: number;
  },
  setState: (partial: { editsSinceLastSave?: number; nameModalOpen?: boolean; saveModalOpen?: boolean }) => void
) {
  const s = getState();
  const nextCount = s.editsSinceLastSave + 1;
  setState({ editsSinceLastSave: nextCount });

  if (s.currentUser === 'You' && !s.userHasSetName && !s.nameModalOpen) {
    setState({ nameModalOpen: true });
    return; // Don't stack the save modal on top — show it after name confirm.
  }
  if (
    !s.saveModalOpen &&
    !s.savePromptDismissed &&
    !s.savePromptDisabled &&
    nextCount >= SAVE_PROMPT_THRESHOLD
  ) {
    setState({ saveModalOpen: true });
  }
}

// ── Storage ──

const STORAGE_KEY = 'villa-lev-saved-configs';
const TEMPLATES_STORAGE_KEY = 'villa-lev-templates';
const HISTORY_STORAGE_KEY = 'villa-lev-history';
const USER_STORAGE_KEY = 'villa-lev-current-user';
const ASSUMPTIONS_STORAGE_KEY = 'villa-lev-assumptions';
const PROJECTS_STORAGE_KEY = 'villa-lev-projects';
const SCENARIO_STORAGE_KEY = 'villa-lev-active-scenario';
const SAVE_PROMPT_DISABLED_KEY = 'villa-lev-save-prompt-disabled';
const LAST_SAVED_CONFIG_KEY = 'villa-lev-last-saved-config';
const CAP_TABLE_STORAGE_KEY = 'villa-lev-cap-table';
const WATERFALL_STORAGE_KEY = 'villa-lev-waterfall';
const CAPEX_UPLIFT_STORAGE_KEY = 'villa-lev-capex-uplift';
const CAPEX_ABSORPTION_STORAGE_KEY = 'villa-lev-capex-absorption';
const HISTORY_MAX = 200;

// ── Server-side scenario sync (Firestore) ──
// Saved scenarios live in Firestore so every browser opening the deployed app
// sees the same list. localStorage is kept as a write-through cache for
// instant first paint and offline tolerance. No auth — anyone reaching the
// app can read/write; tighten firestore.rules if scope changes.

import { getDb, SCENARIOS_COLLECTION } from '@/lib/firebase';
import {
  collection,
  getDocs,
  doc,
  setDoc,
  deleteDoc,
  writeBatch,
  query,
  where,
} from 'firebase/firestore';

// Fetch every scenario this caller is permitted to read. The rules layer
// allows: (a) any `published == true` doc to any reader (including the
// banker / unauthenticated view) and (b) any doc whose `userId == auth.uid`
// to its owner. We split the read into two indexed queries so each one is
// permitted by a single rules predicate — a single `getDocs(collection)`
// would fail closed under rules since some docs in the collection aren't
// readable by every caller.
async function fetchServerConfigs(
  uid: string | null,
): Promise<SavedConfiguration[] | null> {
  const db = getDb();
  if (!db) return null;
  try {
    const col = collection(db, SCENARIOS_COLLECTION);
    const publishedQ = query(col, where('published', '==', true));
    const ownQ = uid ? query(col, where('userId', '==', uid)) : null;
    const [publishedSnap, ownSnap] = await Promise.all([
      getDocs(publishedQ),
      ownQ ? getDocs(ownQ) : Promise.resolve(null),
    ]);
    const byId = new Map<string, SavedConfiguration>();
    publishedSnap.forEach((d) => byId.set(d.id, d.data() as SavedConfiguration));
    ownSnap?.forEach((d) => byId.set(d.id, d.data() as SavedConfiguration));
    return Array.from(byId.values());
  } catch (err) {
    console.warn('[scenarios] fetch failed; using local cache', err);
    return null;
  }
}

// Throws on Firestore error so callers (saveConfig / updateConfig /
// loadConfig copy-on-load / deleteConfig / renameConfig) can wrap in
// try/catch and surface the failure via the existing requestAlert flow
// — mirrors referenceScenario.ts:111-136. The previous swallow-and-log
// behaviour made permission-denied silent, which under the sharing model
// is exactly what we need to surface.
async function pushServerConfig(config: SavedConfiguration): Promise<void> {
  const db = getDb();
  if (!db) {
    throw new Error(
      'Firestore is not available. The scenario was not saved to the shared list.',
    );
  }
  try {
    await setDoc(doc(db, SCENARIOS_COLLECTION, config.id), config);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Unknown Firestore error.';
    throw new Error(
      `Failed to save scenario "${config.name}": ${message}. ` +
        `Check that you are signed in.`,
    );
  }
}

async function deleteServerConfig(id: string): Promise<void> {
  const db = getDb();
  if (!db) {
    throw new Error(
      'Firestore is not available. The scenario was not removed from the shared list.',
    );
  }
  try {
    await deleteDoc(doc(db, SCENARIOS_COLLECTION, id));
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Unknown Firestore error.';
    throw new Error(
      `Failed to delete scenario: ${message}. ` +
        `You can only delete scenarios you saved yourself.`,
    );
  }
}

async function bulkServerConfigs(configs: SavedConfiguration[]): Promise<SavedConfiguration[] | null> {
  const db = getDb();
  if (!db) return null;
  try {
    // Firestore batch caps at 500 ops; chunk to be safe.
    const CHUNK = 400;
    for (let i = 0; i < configs.length; i += CHUNK) {
      const batch = writeBatch(db);
      for (const cfg of configs.slice(i, i + CHUNK)) {
        if (!cfg?.id) continue;
        batch.set(doc(db, SCENARIOS_COLLECTION, cfg.id), cfg);
      }
      await batch.commit();
    }
    return configs;
  } catch (err) {
    console.warn('[scenarios] bulk push failed', err);
    return null;
  }
}

function loadSavePromptDisabled(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(SAVE_PROMPT_DISABLED_KEY) === '1';
}
function saveSavePromptDisabled(disabled: boolean) {
  if (typeof window === 'undefined') return;
  if (disabled) localStorage.setItem(SAVE_PROMPT_DISABLED_KEY, '1');
  else localStorage.removeItem(SAVE_PROMPT_DISABLED_KEY);
}

function loadLastSavedConfig(): { id: string; name: string } | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(LAST_SAVED_CONFIG_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function saveLastSavedConfig(value: { id: string; name: string } | null) {
  if (typeof window === 'undefined') return;
  if (value) localStorage.setItem(LAST_SAVED_CONFIG_KEY, JSON.stringify(value));
  else localStorage.removeItem(LAST_SAVED_CONFIG_KEY);
}

function loadFromStorage(): SavedConfiguration[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveToStorage(configs: SavedConfiguration[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(configs));
  } catch { /* storage full */ }
}

function loadTemplatesFromStorage(): PropertyTemplate[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(TEMPLATES_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveTemplatesToStorage(templates: PropertyTemplate[]) {
  if (typeof window === 'undefined') return;
  try {
    // Save custom templates + any modified built-in templates
    const custom = templates.filter((t) => !t.builtIn);
    const modifiedBuiltIns = templates.filter((t) => {
      if (!t.builtIn) return false;
      const original = BUILT_IN_TEMPLATES.find((bt) => bt.id === t.id);
      if (!original) return false;
      return JSON.stringify(t) !== JSON.stringify(original);
    });
    localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify([...custom, ...modifiedBuiltIns]));
  } catch { /* storage full */ }
}

function loadHistoryFromStorage(): ChangeEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveHistoryToStorage(history: ChangeEntry[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history.slice(-HISTORY_MAX)));
  } catch { /* storage full */ }
}

function loadUserFromStorage(): string {
  if (typeof window === 'undefined') return 'You';
  try {
    return localStorage.getItem(USER_STORAGE_KEY) || 'You';
  } catch {
    return 'You';
  }
}

function saveUserToStorage(user: string) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(USER_STORAGE_KEY, user);
  } catch { /* storage full */ }
}

// Persist current assumption edits (rate, loan coverage, financing path, ramp,
// revenue, tax, etc.) — everything except `portfolio`, which is rebuilt from
// templates + projects on every recompute().
function loadAssumptionsFromStorage(): Partial<ModelAssumptions> | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(ASSUMPTIONS_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveAssumptionsToStorage(assumptions: ModelAssumptions) {
  if (typeof window === 'undefined') return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { portfolio: _portfolio, ...persistable } = assumptions;
    // portfolioOpex is retained in persistable — it is user-edited state, not a derived field.
    localStorage.setItem(ASSUMPTIONS_STORAGE_KEY, JSON.stringify(persistable));
  } catch { /* storage full */ }
}

function loadProjectsFromStorage(): ProjectAllocation[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(PROJECTS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : null;
  } catch {
    return null;
  }
}

function saveProjectsToStorage(projects: ProjectAllocation[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(projects));
  } catch { /* storage full */ }
}

function loadScenarioFromStorage(): ScenarioName | null {
  if (typeof window === 'undefined') return null;
  try {
    const saved = localStorage.getItem(SCENARIO_STORAGE_KEY);
    if (saved === 'realistic' || saved === 'upside' || saved === 'downside' || saved === 'breakeven') return saved;
    return null;
  } catch {
    return null;
  }
}

function saveScenarioToStorage(scenario: ScenarioName) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SCENARIO_STORAGE_KEY, scenario);
  } catch { /* storage full */ }
}

function loadCapTableFromStorage(): CapTableStakeholder[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CAP_TABLE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : null;
  } catch {
    return null;
  }
}
function saveCapTableToStorage(stakeholders: CapTableStakeholder[]) {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(CAP_TABLE_STORAGE_KEY, JSON.stringify(stakeholders)); } catch { /* full */ }
}
function loadWaterfallFromStorage(): WaterfallParams | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(WATERFALL_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
function saveWaterfallToStorage(w: WaterfallParams) {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(WATERFALL_STORAGE_KEY, JSON.stringify(w)); } catch { /* full */ }
}
type PerPathLoans = { commercial: number; rrf: number; grant: number; tepixLoan: number; optima: number };

function loadCapexUpliftFromStorage(): { eur: number | null; base: number | null; mode: 'abs' | 'pct'; baselineLoans: PerPathLoans | null } | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CAPEX_UPLIFT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Discard only truly old pre-fix saves where the 'baselineLoans' key is
    // entirely absent. null is acceptable — extraLoan display shows €0 which is
    // fine, and the uplift itself still applies correctly to portfolioTotal.
    if (parsed.eur && parsed.eur > 0 && !('baselineLoans' in parsed)) {
      try { localStorage.removeItem(CAPEX_UPLIFT_STORAGE_KEY); } catch { /* ok */ }
      return null;
    }
    return { eur: parsed.eur ?? null, base: parsed.base ?? null, mode: parsed.mode ?? 'pct', baselineLoans: parsed.baselineLoans ?? null };
  } catch { return null; }
}
function saveCapexUpliftToStorage(eur: number | null, base: number | null, mode: 'abs' | 'pct', baselineLoans?: PerPathLoans | null) {
  if (typeof window === 'undefined') return;
  if (eur === null || eur <= 0) {
    try { localStorage.removeItem(CAPEX_UPLIFT_STORAGE_KEY); } catch { /* ok */ }
  } else {
    try { localStorage.setItem(CAPEX_UPLIFT_STORAGE_KEY, JSON.stringify({ eur, base, mode, baselineLoans: baselineLoans ?? null })); } catch { /* full */ }
  }
}

function loadCapexAbsorptionFromStorage(): { serviceProviders: boolean; contingency: boolean } {
  if (typeof window === 'undefined') return { serviceProviders: false, contingency: false };
  try {
    const raw = localStorage.getItem(CAPEX_ABSORPTION_STORAGE_KEY);
    if (!raw) return { serviceProviders: false, contingency: false };
    const parsed = JSON.parse(raw);
    return {
      serviceProviders: parsed.serviceProviders === true,
      contingency: parsed.contingency === true,
    };
  } catch { return { serviceProviders: false, contingency: false }; }
}
function saveCapexAbsorptionToStorage(config: { serviceProviders: boolean; contingency: boolean }) {
  if (typeof window === 'undefined') return;
  if (!config.serviceProviders && !config.contingency) {
    try { localStorage.removeItem(CAPEX_ABSORPTION_STORAGE_KEY); } catch { /* ok */ }
  } else {
    try { localStorage.setItem(CAPEX_ABSORPTION_STORAGE_KEY, JSON.stringify(config)); } catch { /* full */ }
  }
}

function clearPersistedState() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(ASSUMPTIONS_STORAGE_KEY);
    localStorage.removeItem(PROJECTS_STORAGE_KEY);
    localStorage.removeItem(TEMPLATES_STORAGE_KEY);
    localStorage.removeItem(SCENARIO_STORAGE_KEY);
  } catch { /* ignore */ }
}

// ── Migration ──

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function migrateToPortfolio(raw: any): ModelAssumptions {
  if (raw.portfolio && Array.isArray(raw.portfolio)) {
    let merged = deepMerge(
      BASE_CASE as unknown as Record<string, unknown>,
      raw as Record<string, unknown>
    ) as unknown as ModelAssumptions;
    // v1→v2 migration: if portfolioOpex is missing, housekeeping costs were
    // tracked per-template. Zero them out and seed portfolioOpex from defaults.
    if (!raw.portfolioOpex) {
      merged = {
        ...merged,
        portfolio: (merged.portfolio ?? []).map((prop: PropertyConfig) => ({
          ...prop,
          opex: { ...prop.opex, housekeeping: 0 },
        })),
      };
      // Trigger one-time migration banner
      if (typeof window !== 'undefined') {
        localStorage.setItem('vlg_portfolio_opex_migrated_v2', '1');
      }
      merged = ensurePortfolioOpex(merged);
    }
    return merged;
  }

  const portfolio: PropertyConfig[] = [];

  if (raw.properties?.propertyA) {
    const oldA = raw.properties.propertyA;
    const oldOpexA = raw.opex?.propertyA ?? DEFAULT_VILLA.opex;
    portfolio.push({
      id: 'prop-a',
      name: oldA.name || 'Twin Villas',
      villaUnits: 1,
      standardSuites: 0,
      doubleSuites: 0,
      count: raw.numberOfPropertyA ?? 2,
      roomAreas: { ...DEFAULT_VILLA.roomAreas },
      landCost: oldA.landCost ?? DEFAULT_VILLA.landCost,
      constructionArea: oldA.constructionArea ?? DEFAULT_VILLA.constructionArea,
      constructionCostPerM2: oldA.constructionCostPerM2 ?? DEFAULT_VILLA.constructionCostPerM2,
      ffeCost: oldA.ffeCost ?? DEFAULT_VILLA.ffeCost,
      legalFees: oldA.legalFees ?? DEFAULT_VILLA.legalFees,
      architectFees: oldA.architectFees ?? DEFAULT_VILLA.architectFees,
      civilEngineerFees: oldA.civilEngineerFees ?? DEFAULT_VILLA.civilEngineerFees,
      contingencyRate: oldA.contingencyRate ?? DEFAULT_VILLA.contingencyRate,
      opexContingencyRate: oldA.opexContingencyRate ?? 0,
      opex: {
        housekeeping: oldOpexA.housekeeping ?? DEFAULT_VILLA.opex.housekeeping,
        maintenance: oldOpexA.maintenance ?? DEFAULT_VILLA.opex.maintenance,
        utilities: oldOpexA.utilities ?? DEFAULT_VILLA.opex.utilities,
        insurance: oldOpexA.insurance ?? DEFAULT_VILLA.opex.insurance,
        propertyTax: oldOpexA.propertyTax ?? DEFAULT_VILLA.opex.propertyTax,
        marketing: oldOpexA.marketing ?? DEFAULT_VILLA.opex.marketing,
        // @deprecated — field retained for Firestore backward-compat; engine ignores this field
        managementFee: 0,
        consumables: oldOpexA.consumables ?? DEFAULT_VILLA.opex.consumables,
        accounting: oldOpexA.accounting ?? DEFAULT_VILLA.opex.accounting,
        ffeReserveFloor: oldOpexA.ffeReserveFloor ?? DEFAULT_VILLA.opex.ffeReserveFloor,
      },
      bedroomsPerStandard: 1,
      bedroomsPerDouble:   2,
      bedroomsInMain:      4,
      lockableSubUnits:    3,
      bedroomsPerSubUnit:  1,
    });
  }

  if (raw.properties?.propertyB) {
    const oldB = raw.properties.propertyB;
    const oldOpexB = raw.opex?.propertyB ?? DEFAULT_SUITE.opex;
    portfolio.push({
      id: 'prop-b',
      name: oldB.name || 'Boutique Suites',
      villaUnits: 0,
      standardSuites: 2,
      doubleSuites: 2,
      count: raw.numberOfPropertyB ?? 1,
      roomAreas: { ...DEFAULT_SUITE.roomAreas },
      landCost: oldB.landCost ?? DEFAULT_SUITE.landCost,
      constructionArea: oldB.constructionArea ?? DEFAULT_SUITE.constructionArea,
      constructionCostPerM2: oldB.constructionCostPerM2 ?? DEFAULT_SUITE.constructionCostPerM2,
      ffeCost: oldB.ffeCost ?? DEFAULT_SUITE.ffeCost,
      legalFees: oldB.legalFees ?? DEFAULT_SUITE.legalFees,
      architectFees: oldB.architectFees ?? DEFAULT_SUITE.architectFees,
      civilEngineerFees: oldB.civilEngineerFees ?? DEFAULT_SUITE.civilEngineerFees,
      contingencyRate: oldB.contingencyRate ?? DEFAULT_SUITE.contingencyRate,
      opexContingencyRate: oldB.opexContingencyRate ?? 0,
      opex: {
        housekeeping: oldOpexB.housekeeping ?? DEFAULT_SUITE.opex.housekeeping,
        maintenance: oldOpexB.maintenance ?? DEFAULT_SUITE.opex.maintenance,
        utilities: oldOpexB.utilities ?? DEFAULT_SUITE.opex.utilities,
        insurance: oldOpexB.insurance ?? DEFAULT_SUITE.opex.insurance,
        propertyTax: oldOpexB.propertyTax ?? DEFAULT_SUITE.opex.propertyTax,
        marketing: oldOpexB.marketing ?? DEFAULT_SUITE.opex.marketing,
        // @deprecated — field retained for Firestore backward-compat; engine ignores this field
        managementFee: 0,
        consumables: oldOpexB.consumables ?? DEFAULT_SUITE.opex.consumables,
        accounting: oldOpexB.accounting ?? DEFAULT_SUITE.opex.accounting,
        ffeReserveFloor: oldOpexB.ffeReserveFloor ?? DEFAULT_SUITE.opex.ffeReserveFloor,
      },
      bedroomsPerStandard: 1,
      bedroomsPerDouble:   2,
      bedroomsInMain:      4,
      lockableSubUnits:    3,
      bedroomsPerSubUnit:  1,
    });
  }

  if (portfolio.length === 0) {
    portfolio.push({ ...DEFAULT_VILLA }, { ...DEFAULT_SUITE });
  }

  const migrated: ModelAssumptions = {
    ...BASE_CASE,
    general: raw.general ? deepMerge(BASE_CASE.general as unknown as Record<string, unknown>, raw.general) as unknown as typeof BASE_CASE.general : BASE_CASE.general,
    revenueRealistic: raw.revenueRealistic ? deepMerge(BASE_CASE.revenueRealistic as unknown as Record<string, unknown>, raw.revenueRealistic) as unknown as typeof BASE_CASE.revenueRealistic : BASE_CASE.revenueRealistic,
    revenueUpside: raw.revenueUpside ? deepMerge(BASE_CASE.revenueUpside as unknown as Record<string, unknown>, raw.revenueUpside) as unknown as typeof BASE_CASE.revenueUpside : BASE_CASE.revenueUpside,
    portfolio,
    commercialLoan: raw.commercialLoan ? deepMerge(BASE_CASE.commercialLoan as unknown as Record<string, unknown>, raw.commercialLoan) as unknown as typeof BASE_CASE.commercialLoan : BASE_CASE.commercialLoan,
    grant: raw.grant ? deepMerge(BASE_CASE.grant as unknown as Record<string, unknown>, raw.grant) as unknown as typeof BASE_CASE.grant : BASE_CASE.grant,
    rrf: raw.rrf ? deepMerge(BASE_CASE.rrf as unknown as Record<string, unknown>, raw.rrf) as unknown as typeof BASE_CASE.rrf : BASE_CASE.rrf,
    tepixLoan: raw.tepixLoan ? deepMerge(BASE_CASE.tepixLoan as unknown as Record<string, unknown>, raw.tepixLoan) as unknown as typeof BASE_CASE.tepixLoan : BASE_CASE.tepixLoan,
    tax: raw.tax ? deepMerge(BASE_CASE.tax as unknown as Record<string, unknown>, raw.tax) as unknown as typeof BASE_CASE.tax : BASE_CASE.tax,
    acquisitionLegalPerPlot: raw.acquisitionLegalPerPlot ?? BASE_CASE.acquisitionLegalPerPlot,
    financingPath: raw.financingPath ?? BASE_CASE.financingPath,
  };

  return migrated;
}

// ── Types ──

export type ScenarioName = 'realistic' | 'upside' | 'downside' | 'breakeven';

export type ChangeScope = 'assumption' | 'template' | 'project' | 'portfolio';

export interface ChangeEntry {
  id: string;
  timestamp: number;
  user: string;
  scope: ChangeScope;
  scopeId?: string;   // templateId or projectId when relevant
  scopeLabel?: string; // e.g. "Twin Villas" — the template/project name
  path: string;        // e.g. "commercialLoan.interestRate" or "roomAreas.kitchen"
  label: string;       // human-readable field label
  before: unknown;
  after: unknown;
  superseded?: boolean;
  reverted?: boolean;
  isRevert?: boolean;  // true if this entry was created by a revert action (not revertable)
}

export interface SavedConfiguration {
  id: string;
  name: string;
  assumptions: ModelAssumptions;
  templates?: PropertyTemplate[];
  projects?: ProjectAllocation[];
  savedAt: number;
  // Sharing extension (revisions 1–5):
  //   - All fields optional on the TYPE so legacy localStorage docs (no
  //     ownership stamp) keep hydrating without runtime crashes.
  //   - SERVER-write paths must populate them — saveConfig / updateConfig /
  //     loadConfig (copy-on-load) / importConfigs all stamp userId and
  //     ownerDisplayName when the caller is authenticated. The denormalized
  //     ownerDisplayName side-steps `users/{uid}` being admin-only-readable
  //     (villa-lev-admin/firestore.rules:172) — readers fan out to that doc
  //     instead of a forbidden cross-user lookup.
  userId?: string;
  ownerDisplayName?: string;
  published?: boolean;
  copiedFrom?: {
    userId: string;
    displayName: string;
    scenarioId: string;
    copiedAt: number;
  } | null;
  capexUpliftEur?: number | null;
  capexUpliftBase?: number | null;
  capexUpliftMode?: 'abs' | 'pct';
  capexUpliftBaselineLoans?: PerPathLoans | null;
  capexAbsorptionServiceProviders?: boolean;
  capexAbsorptionContingency?: boolean;
  activeScenario?: ScenarioName;
}

export interface ConfirmOpts {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;       // styles the confirm button red for destructive actions
  onConfirm: () => void;
  onCancel?: () => void;
}

export interface AlertOpts {
  title: string;
  message: string;
  okLabel?: string;
  tone?: 'success' | 'warning' | 'error' | 'neutral';
  onClose?: () => void;
}

export type UiPrompt =
  | ({ kind: 'confirm' } & ConfirmOpts)
  | ({ kind: 'alert' } & AlertOpts);

// Engine view-mode override. When set, recompute() forces the engine into
// that viewMode regardless of the persisted assumption value. Used by:
//   - /pitch route layouts (always 'bank')
//   - admin "Bank view" toggle (admin opts into 'bank' on /admin/*)
//   - useEffectiveAuth bridge for View-As-Banker impersonation
// `null` = honour assumptions.viewMode (which defaults to 'internal').
export type ViewModeOverride = 'internal' | 'bank' | null;

// Ephemeral financing-path override for the /bank view. When set, recompute()
// uses this path instead of assumptions.financingPath. Never persisted to
// localStorage — lives only in the in-memory store and is set/cleared by
// BankControlBar + bank/layout.tsx cleanup. This keeps the banker's path
// selection from corrupting Eytan's admin session.
// `null` = honour assumptions.financingPath.
export type FinancingPathOverride = string | null;

interface ModelStore {
  assumptions: ModelAssumptions;
  model: ModelOutput | null;
  loading: boolean;
  computeTimeMs: number;
  activeScenario: ScenarioName;
  // See ViewModeOverride above. Not persisted to assumptions storage —
  // lives only in the in-memory store and is set/cleared by layouts +
  // the admin toggle. Default null.
  viewModeOverride: ViewModeOverride;
  setViewModeOverride: (mode: ViewModeOverride) => void;

  // See FinancingPathOverride above. Not persisted to assumptions storage —
  // set/cleared by BankControlBar and cleared on bank/layout.tsx unmount.
  // Default null.
  financingPathOverride: FinancingPathOverride;
  setFinancingPathOverride: (path: FinancingPathOverride) => void;

  // Ephemeral stress-test overrides for the /bank view. Applied on top of
  // assumptions inside recompute() but never written to localStorage or the
  // assumptions slice. null = inactive (admin view); {} = active but unedited;
  // { path: value } = banker has tweaked that field. Cleared on layout unmount
  // so navigating back to /admin always shows the clean model.
  stressTestOverrides: Record<string, number> | null;
  initStressTestOverrides: () => void;
  setStressTestOverride: (path: string, value: number) => void;
  clearAllStressTestOverrides: () => void;
  deactivateStressTest: () => void;

  // Ephemeral CAPEX uplift sensitivity for /bank/optima only.
  // null = inactive; positive number = EUR uplift applied to construction cost.
  // Never persisted to disk. Survives client-side navigation (Zustand singleton).
  capexUpliftEur: number | null;
  // Base (pre-uplift) CAPEX total in EUR — stored so % back-calculation survives page remount.
  capexUpliftBase: number | null;
  // Per-path baseline loans captured before any uplift is applied — survives remount via localStorage.
  capexUpliftBaselineLoans: { commercial: number; rrf: number; grant: number; tepixLoan: number; optima: number } | null;
  // Default changed to 'pct' per Eytan 2026-05-29; ADR-0024 originally defaulted to 'abs'.
  capexUpliftMode: 'abs' | 'pct';
  setCapexUplift: (upliftEur: number, baseEur?: number) => void;
  setCapexUpliftMode: (mode: 'abs' | 'pct') => void;
  clearCapexUplift: () => void;
  /** Capture per-path baseline loans. Only stores when no uplift is active — safe to call in useEffect on every model recompute. */
  captureCapexBaselines: (loans: { commercial: number; rrf: number; grant: number; tepixLoan: number; optima: number }) => void;

  // ── CapEx Absorption (Financing Paths page) ──────────────────────
  // Toggles that absorb specific CapEx categories into the construction
  // line for bank-facing output. Persisted to localStorage.
  capexAbsorptionServiceProviders: boolean;
  capexAbsorptionContingency: boolean;
  setCapexAbsorptionServiceProviders: (value: boolean) => void;
  setCapexAbsorptionContingency: (value: boolean) => void;

  // Templates & Projects
  templates: PropertyTemplate[];
  projects: ProjectAllocation[];

  // Saved configs
  savedConfigs: SavedConfiguration[];
  activeConfigId: string | null;
  activeConfigName: string | null;
  // Last saved/loaded config — survives edits, used to offer "Update existing"
  // in the save modal. Cleared only via deleteConfig of that same id.
  lastSavedConfigId: string | null;
  lastSavedConfigName: string | null;

  // Change history + user attribution
  history: ChangeEntry[];
  currentUser: string;
  setCurrentUser: (name: string) => void;
  revertChange: (id: string) => void;
  clearHistory: () => void;

  // Prompt state — drives the "enter your name" and "save scenario?" modals
  nameModalOpen: boolean;
  saveModalOpen: boolean;
  editsSinceLastSave: number;
  userHasSetName: boolean;       // true when user confirmed a name this session
  savePromptDismissed: boolean;  // session flag — don't re-nag after explicit dismiss
  savePromptDisabled: boolean;   // persistent — user opted out across sessions
  confirmUserName: (name: string) => void;
  dismissNameModal: () => void;
  acceptSaveSuggestion: (name: string, opts?: { published?: boolean }) => void;
  acceptUpdateExisting: () => void;
  dismissSaveModal: (disablePermanently?: boolean) => void;
  setSavePromptDisabled: (disabled: boolean) => void;

  // Generic confirmation / message modal — replaces native alert()/confirm()
  // for in-app prompts. `kind: 'confirm'` shows two buttons; `kind: 'alert'`
  // shows one. Use via `requestConfirm({ ... })` / `requestAlert({ ... })`.
  uiPrompt: UiPrompt | null;
  requestConfirm: (opts: ConfirmOpts) => void;
  requestAlert: (opts: AlertOpts) => void;
  resolveUiPrompt: (confirmed: boolean) => void;

  // Core actions
  setAssumption: (path: string, value: unknown, label?: string) => void;
  setFinancingPath: (path: FinancingPath) => void;
  setGraceMode: (mode: import('../engine/types').GraceMode) => void;
  setActiveScenario: (scenario: ScenarioName) => void;
  toggleGrant: (enabled: boolean) => void;
  toggleRRF: (enabled: boolean) => void;
  resetToDefaults: () => void;
  recompute: () => void;
  init: () => void;

  // Cap table & waterfall state (Feature 3). Computed on demand by the page.
  capTable: CapTableStakeholder[];
  waterfall: WaterfallParams;
  updateStakeholder: (id: string, patch: Partial<CapTableStakeholder>) => void;
  addStakeholder: (sh: CapTableStakeholder) => void;
  removeStakeholder: (id: string) => void;
  setWaterfallParam: <K extends keyof WaterfallParams>(key: K, value: WaterfallParams[K]) => void;
  resetCapTable: () => void;

  // Template management
  addTemplate: (type: 'villa' | 'suite' | 'mixed') => void;
  updateTemplate: (id: string, path: string, value: unknown, label?: string) => void;
  renameTemplate: (id: string, newName: string) => void;
  duplicateTemplate: (id: string) => void;
  deleteTemplate: (id: string) => void;
  // Custom-named common spaces on a template's roomAreas
  addCustomSpace: (tplId: string) => void;
  updateCustomSpace: (tplId: string, csId: string, key: 'name' | 'area', value: string | number) => void;
  removeCustomSpace: (tplId: string, csId: string) => void;
  // Extra annual OPEX lines (fold into P&L opex)
  addOpexLine: () => void;
  removeOpexLine: (tplId: string, lineId: string) => void;
  updateOpexLine: (tplId: string, lineId: string, key: 'name' | 'value', value: string | number) => void;
  // Portfolio OPEX — shared staff roles
  addPortfolioStaffRole: (role: StaffRole) => void;
  updatePortfolioStaffRole: (index: number, role: StaffRole) => void;
  removePortfolioStaffRole: (index: number) => void;
  // Portfolio OPEX — shared services
  addPortfolioService: (line: SharedServiceLine) => void;
  updatePortfolioService: (index: number, line: SharedServiceLine) => void;
  removePortfolioService: (index: number) => void;
  // Portfolio OPEX — shared overhead
  addPortfolioOverhead: (line: SharedServiceLine) => void;
  updatePortfolioOverhead: (index: number, line: SharedServiceLine) => void;
  removePortfolioOverhead: (index: number) => void;
  // Portfolio OPEX — scalar fields
  updatePortfolioOpexScalar: (
    key: keyof Omit<PortfolioOpex, 'staffRoles' | 'sharedServices' | 'sharedOverhead'>,
    value: number | boolean
  ) => void;
  // Extra one-off CAPEX lines (fold into capex totals and export)
  addCapexLine: (tplId: string) => void;
  removeCapexLine: (tplId: string, lineId: string) => void;
  updateCapexLine: (tplId: string, lineId: string, key: 'name' | 'cost', value: string | number) => void;
  // Per-villa interior rooms (bedrooms, bathrooms, etc. inside one villa)
  addVillaRoom: (tplId: string) => void;
  updateVillaRoom: (tplId: string, roomId: string, key: 'name' | 'count' | 'area', value: string | number) => void;
  removeVillaRoom: (tplId: string, roomId: string) => void;
  // Pool slots (civil-engineer restructure 2026-05)
  addPoolSlot: (tplId: string) => void;
  updatePoolSlot: (tplId: string, slotId: string, key: 'qty' | 'widthM' | 'lengthM', value: number) => void;
  removePoolSlot: (tplId: string, slotId: string) => void;
  setWellnessFlatCost: (tplId: string, value: number | undefined) => void;

  // Project management
  addProject: (templateId: string) => void;
  removeProject: (id: string) => void;
  updateProjectCount: (id: string, count: number) => void;
  changeProjectTemplate: (id: string, templateId: string) => void;
  renameProject: (id: string, newName: string) => void;

  // Legacy portfolio (for backward compatibility with other pages)
  addProperty: (type: 'villa' | 'suite') => void;
  removeProperty: (id: string) => void;
  updateProperty: (id: string, path: string, value: unknown) => void;
  renameProperty: (id: string, newName: string) => void;

  // Config management
  saveConfig: (name: string, opts?: { published?: boolean }) => Promise<void>;
  updateConfig: (id: string) => Promise<void>;
  loadConfig: (id: string) => Promise<void>;
  deleteConfig: (id: string) => Promise<void>;
  renameConfig: (id: string, newName: string) => Promise<void>;
  importConfigs: (incoming: SavedConfiguration[]) => { added: number; updated: number };

  // Reference-scenario auto-load flag. Set to true once the shared hook has
  // attempted an auto-load (successful or not). Survives client-side route
  // changes within the session. NOT reset by resetToDefaults — after a reset
  // the user wants BASE_CASE, not an auto-reload of the reference scenario.
  referenceAutoLoadAttempted: boolean;

  // ── Auth identity bridge (sharing extension) ──
  // useAuth/useEffectiveAuth lives in React-land; the store is plain TS.
  // ConfigPanel mounts an effect that pushes the current uid/displayName
  // /email into the store on mount and on uid/displayName/email change so
  // saveConfig & friends can stamp ownership without a hook.
  currentUserUid: string | null;
  currentUserDisplayName: string | null;
  currentUserEmail: string | null;
  // Revision 1 — race guard for hydrateForUser. The counter is bumped at
  // the start of each call and re-checked after the async fetch resolves;
  // a stale snapshot is dropped. hydratingFor dedupes parallel calls for
  // the same uid (a re-render in the bridge effect could otherwise fire
  // overlapping fetches).
  hydrationToken: number;
  hydratingFor: string | null;
  setCurrentAuthIdentity: (identity: {
    uid: string | null;
    displayName: string | null;
    email: string | null;
  }) => void;
  hydrateForUser: (uid: string | null) => Promise<void>;

  // Optima Bank sub-project allocation
  setOptimaSubProjectSide: (propertyId: string, side: 'A' | 'B') => void;
  setOptimaEuriborRate: (rate: number) => void;
  setOptimaSpreadBps: (bps: number) => void;
  setCapexLineAbsorption: (categoryName: string, included: boolean) => void;
}

// Revision 2 — resolve the displayName to stamp on a SavedConfiguration.
// users/{uid} is admin-only-readable in villa-lev-admin/firestore.rules, so
// we cannot lazily look up another user's name. Instead, we denormalize:
// stamp `ownerDisplayName` at write time and have readers consume it
// directly. Fallback chain: displayName → email-local-part → gate name → 'Unknown'.
function resolveOwnerDisplayName(state: {
  currentUserDisplayName: string | null;
  currentUserEmail: string | null;
}): string {
  if (state.currentUserDisplayName && state.currentUserDisplayName.trim()) {
    return state.currentUserDisplayName.trim();
  }
  if (state.currentUserEmail) {
    const localPart = state.currentUserEmail.split('@')[0];
    if (localPart) return localPart;
  }
  // Gate name: set by AuthGate when user enters their name on login.
  // Covers anonymous Firebase Auth users before updateProfile resolves.
  if (typeof window !== 'undefined') {
    try {
      const gateName = localStorage.getItem('vl-admin-name');
      if (gateName) return gateName;
    } catch { /* private mode */ }
  }
  return 'Unknown';
}

// ── Store ──

export const useModelStore = create<ModelStore>((set, get) => ({
  assumptions: { ...BASE_CASE, portfolio: BASE_CASE.portfolio.map((p) => ({ ...p, opex: { ...p.opex } })) },
  model: null,
  loading: false,
  computeTimeMs: 0,
  activeScenario: 'realistic' as ScenarioName,
  viewModeOverride: null as ViewModeOverride,
  setViewModeOverride: (mode: ViewModeOverride) => {
    const current = get().viewModeOverride;
    if (current === mode) return;
    set({ viewModeOverride: mode });
    get().recompute();
  },

  financingPathOverride: null as FinancingPathOverride,
  setFinancingPathOverride: (path: FinancingPathOverride) => {
    const current = get().financingPathOverride;
    if (current === path) return;
    set({ financingPathOverride: path });
    get().recompute();
  },

  stressTestOverrides: null,
  initStressTestOverrides: () => {
    set({ stressTestOverrides: {} });
    // No recompute: empty overrides have no effect on the model.
  },
  setStressTestOverride: (path: string, value: number) => {
    const current = get().stressTestOverrides ?? {};
    set({ stressTestOverrides: { ...current, [path]: value } });
    get().recompute();
  },
  clearAllStressTestOverrides: () => {
    set({ stressTestOverrides: {} });
    get().recompute();
  },
  deactivateStressTest: () => {
    set({ stressTestOverrides: null });
    get().recompute();
  },

  capexUpliftEur: null,
  capexUpliftBase: null,
  capexUpliftBaselineLoans: null,
  capexUpliftMode: 'pct',
  setCapexUplift: (upliftEur: number, baseEur?: number) => {
    set({
      capexUpliftEur: upliftEur,
      ...(baseEur !== undefined && { capexUpliftBase: baseEur }),
    });
    const s = get();
    // Baselines are captured by recompute() when no override is active. But if
    // the app started with an uplift already loaded (Firestore scenario), recompute
    // skips capture (noOverrideActive=false). Fall back to computing from the
    // current model so the save always carries valid baseline data.
    let baselineLoans = s.capexUpliftBaselineLoans;
    if (!baselineLoans && s.model) {
      const loanRow = s.model.financingComparison.find(
        (r: { key: string }) => r.key === 'totalLoanDrawn'
      ) as Record<string, unknown> | undefined;
      if (loanRow) {
        baselineLoans = {
          commercial: typeof loanRow.commercial === 'number' ? loanRow.commercial : 0,
          rrf:        typeof loanRow.rrf        === 'number' ? loanRow.rrf        : 0,
          grant:      typeof loanRow.grant      === 'number' ? loanRow.grant      : 0,
          tepixLoan:  typeof loanRow.tepixLoan  === 'number' ? loanRow.tepixLoan  : 0,
          optima:     typeof loanRow.optima     === 'number' ? loanRow.optima     : 0,
        };
        set({ capexUpliftBaselineLoans: baselineLoans });
      }
    }
    saveCapexUpliftToStorage(upliftEur, baseEur ?? s.capexUpliftBase, s.capexUpliftMode, baselineLoans);
    get().recompute();
  },
  setCapexUpliftMode: (mode) => {
    set({ capexUpliftMode: mode });
    const s = get();
    saveCapexUpliftToStorage(s.capexUpliftEur, s.capexUpliftBase, mode, s.capexUpliftBaselineLoans);
    get().recompute();
  },
  clearCapexUplift: () => {
    set({ capexUpliftEur: null, capexUpliftBase: null, capexUpliftBaselineLoans: null });
    saveCapexUpliftToStorage(null, null, get().capexUpliftMode, null);
    get().recompute();
  },
  captureCapexBaselines: (loans) => {
    if (get().capexUpliftEur !== null) return; // only capture when no uplift active
    // In-memory only — persisted to localStorage by setCapexUplift when the uplift is later set,
    // since saveCapexUpliftToStorage removes the key when eur === null.
    set({ capexUpliftBaselineLoans: loans });
  },

  // ── CapEx Absorption ──────────────────────────────────────────
  capexAbsorptionServiceProviders: false,
  capexAbsorptionContingency: false,
  setCapexAbsorptionServiceProviders: (value) => {
    set({ capexAbsorptionServiceProviders: value });
    const s = get();
    saveCapexAbsorptionToStorage({ serviceProviders: value, contingency: s.capexAbsorptionContingency });
    get().recompute();
  },
  setCapexAbsorptionContingency: (value) => {
    set({ capexAbsorptionContingency: value });
    const s = get();
    saveCapexAbsorptionToStorage({ serviceProviders: s.capexAbsorptionServiceProviders, contingency: value });
    get().recompute();
  },

  templates: [...BUILT_IN_TEMPLATES],
  projects: DEFAULT_PROJECTS.map((p) => ({ ...p })),
  savedConfigs: [],
  uiPrompt: null,
  activeConfigId: null,
  activeConfigName: null,
  lastSavedConfigId: null,
  lastSavedConfigName: null,
  history: [],
  currentUser: 'You',
  nameModalOpen: false,
  saveModalOpen: false,
  editsSinceLastSave: 0,
  userHasSetName: false,
  savePromptDismissed: false,
  savePromptDisabled: false,

  capTable: DEFAULT_CAP_TABLE.map((sh) => ({ ...sh })),
  waterfall: { ...DEFAULT_WATERFALL },

  referenceAutoLoadAttempted: false,

  // Auth identity bridge — populated by an effect in ConfigPanel from
  // useEffectiveAuth. Default null on the server (SSR) and pre-mount.
  currentUserUid: null,
  currentUserDisplayName: null,
  currentUserEmail: null,
  hydrationToken: 0,
  hydratingFor: null,

  updateStakeholder: (id, patch) => {
    const next = get().capTable.map((sh) => (sh.id === id ? { ...sh, ...patch } : sh));
    set({ capTable: next });
    saveCapTableToStorage(next);
  },
  addStakeholder: (sh) => {
    const next = [...get().capTable, sh];
    set({ capTable: next });
    saveCapTableToStorage(next);
  },
  removeStakeholder: (id) => {
    const next = get().capTable.filter((sh) => sh.id !== id);
    set({ capTable: next });
    saveCapTableToStorage(next);
  },
  setWaterfallParam: (key, value) => {
    // Under the 3-layer founder waterfall there are no user-tunable params;
    // hook retained for forward-compat. No-op for unknown keys.
    const next = { ...get().waterfall, [key]: value };
    set({ waterfall: next });
    saveWaterfallToStorage(next);
  },
  resetCapTable: () => {
    const t = DEFAULT_CAP_TABLE.map((sh) => ({ ...sh }));
    const w = { ...DEFAULT_WATERFALL };
    set({ capTable: t, waterfall: w });
    saveCapTableToStorage(t);
    saveWaterfallToStorage(w);
  },

  setCurrentUser: (name: string) => {
    const trimmed = name.trim() || 'You';
    set({ currentUser: trimmed });
    saveUserToStorage(trimmed);
  },

  // Called from the name modal once the user submits their name.
  // Also retroactively re-attributes any "You" entries from this edit burst.
  confirmUserName: (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const state = get();
    set({ currentUser: trimmed, userHasSetName: true, nameModalOpen: false });
    saveUserToStorage(trimmed);
    // Re-attribute the latest contiguous batch of "You" entries to the new name
    // so audit history reflects who actually made these edits.
    const updated = [...state.history];
    for (let i = updated.length - 1; i >= 0; i--) {
      if (updated[i].user === 'You') updated[i] = { ...updated[i], user: trimmed };
      else break;
    }
    set({ history: updated });
    saveHistoryToStorage(updated);
    // After the user identifies themselves, follow up with the save suggestion.
    if (!state.savePromptDismissed) {
      set({ saveModalOpen: true });
    }
  },

  dismissNameModal: () => {
    set({ nameModalOpen: false, userHasSetName: true });
  },

  acceptSaveSuggestion: (name: string, opts?: { published?: boolean }) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    // Fire-and-forget — saveConfig surfaces failures via requestAlert.
    void get().saveConfig(trimmed, opts);
    set({ saveModalOpen: false, editsSinceLastSave: 0, referenceAutoLoadAttempted: true });
  },

  acceptUpdateExisting: () => {
    const { lastSavedConfigId } = get();
    if (!lastSavedConfigId) return;
    void get().updateConfig(lastSavedConfigId);
    set({ saveModalOpen: false, editsSinceLastSave: 0, referenceAutoLoadAttempted: true });
  },

  dismissSaveModal: (disablePermanently?: boolean) => {
    if (disablePermanently) {
      saveSavePromptDisabled(true);
      set({ saveModalOpen: false, editsSinceLastSave: 0, savePromptDismissed: true, savePromptDisabled: true, referenceAutoLoadAttempted: true });
    } else {
      set({ saveModalOpen: false, editsSinceLastSave: 0, savePromptDismissed: true, referenceAutoLoadAttempted: true });
    }
  },

  setSavePromptDisabled: (disabled: boolean) => {
    saveSavePromptDisabled(disabled);
    set({ savePromptDisabled: disabled, ...(disabled ? { savePromptDismissed: true } : {}) });
  },

  // ── UI Prompts ────────────────────────────────────────────────────
  // Used to replace native confirm()/alert(). The render lives in
  // src/components/AssumptionPrompts.tsx.
  requestConfirm: (opts) => {
    set({ uiPrompt: { kind: 'confirm', ...opts } });
  },
  requestAlert: (opts) => {
    set({ uiPrompt: { kind: 'alert', ...opts } });
  },
  resolveUiPrompt: (confirmed: boolean) => {
    const p = get().uiPrompt;
    set({ uiPrompt: null });
    if (!p) return;
    if (p.kind === 'confirm') {
      if (confirmed) p.onConfirm();
      else p.onCancel?.();
    } else {
      p.onClose?.();
    }
  },

  revertChange: (id: string) => {
    const state = get();
    const entry = state.history.find((h) => h.id === id);
    if (!entry || entry.superseded || entry.reverted) return;

    if (entry.scope === 'assumption') {
      const updated = setNestedValue(
        state.assumptions as unknown as Record<string, unknown>,
        entry.path,
        entry.before
      ) as unknown as ModelAssumptions;
      set({ assumptions: updated });
      saveAssumptionsToStorage(updated);
    } else if (entry.scope === 'template' && entry.scopeId) {
      const templates = state.templates.map((tpl) => {
        if (tpl.id !== entry.scopeId) return tpl;
        if (entry.path.includes('.')) {
          const [root, key] = entry.path.split('.');
          if (root === 'opex') {
            return { ...tpl, opex: { ...tpl.opex, [key]: entry.before } as PropertyOpex };
          }
          if (root === 'roomAreas') {
            const rooms = tpl.roomAreas ?? { ...DEFAULT_ROOM_AREAS };
            return { ...tpl, roomAreas: { ...rooms, [key]: entry.before } as RoomAreaBreakdown };
          }
          return tpl;
        }
        return { ...tpl, [entry.path]: entry.before };
      });
      set({ templates });
      saveTemplatesToStorage(templates);
    } else if (entry.scope === 'project' && entry.scopeId) {
      const projects = state.projects.map((p) =>
        p.id === entry.scopeId ? { ...p, [entry.path]: entry.before } : p
      );
      set({ projects });
      saveProjectsToStorage(projects);
    } else if (entry.scope === 'portfolio' && entry.path === 'financingPath') {
      const updated: ModelAssumptions = { ...state.assumptions, financingPath: entry.before as FinancingPath };
      set({ assumptions: updated });
      saveAssumptionsToStorage(updated);
    }

    // Mark entry reverted; create a revert-note entry (not itself revertable)
    const revertEntry: ChangeEntry = {
      id: generateId('chg'),
      timestamp: Date.now(),
      user: state.currentUser,
      scope: entry.scope,
      scopeId: entry.scopeId,
      scopeLabel: entry.scopeLabel,
      path: entry.path,
      label: `Reverted: ${entry.label}`,
      before: entry.after,
      after: entry.before,
      isRevert: true,
    };
    const history = state.history.map((h) =>
      h.id === id ? { ...h, reverted: true, superseded: true } : h
    );
    // Also mark older entries for same (scope, scopeId, path) as superseded already — unchanged.
    // The new revertEntry becomes the latest non-superseded entry for this field.
    const newHistory = [...history, revertEntry].slice(-HISTORY_MAX);
    set({ history: newHistory, activeConfigId: null, referenceAutoLoadAttempted: true });
    saveHistoryToStorage(newHistory);
    get().recompute();
  },

  clearHistory: () => {
    set({ history: [] });
    saveHistoryToStorage([]);
  },

  setAssumption: (path: string, value: unknown, label?: string) => {
    const current = get().assumptions;
    const before = readNestedValue(current as unknown as Record<string, unknown>, path);
    const updated = setNestedValue(
      current as unknown as Record<string, unknown>,
      path,
      value
    ) as unknown as ModelAssumptions;
    set({ assumptions: updated, activeConfigId: null });
    saveAssumptionsToStorage(updated);
    pushHistory(get, set, {
      scope: 'assumption',
      path,
      label: label ?? path,
      before,
      after: value,
    });
    bumpEditCounter(get, set);
    get().recompute();
  },

  setActiveScenario: (scenario: ScenarioName) => {
    set({ activeScenario: scenario });
    saveScenarioToStorage(scenario);
  },

  setFinancingPath: (path: FinancingPath) => {
    // Not recorded in history: financing path is trivially toggleable via the top bar.
    const updated: ModelAssumptions = { ...get().assumptions, financingPath: path };
    set({ assumptions: updated, activeConfigId: null });
    saveAssumptionsToStorage(updated);
    get().recompute();
  },

  setGraceMode: (mode) => {
    get().setAssumption('commercialLoan.graceMode', mode, 'Grace structure');
  },

  toggleGrant: (enabled: boolean) => {
    const state = get();
    const updated: ModelAssumptions = {
      ...state.assumptions,
      financingPath: enabled ? 'grant' : 'commercial',
      grant: { ...state.assumptions.grant, enabled },
    };
    set({ assumptions: updated, activeConfigId: null });
    saveAssumptionsToStorage(updated);
    get().recompute();
  },

  toggleRRF: (enabled: boolean) => {
    const state = get();
    const updated: ModelAssumptions = {
      ...state.assumptions,
      financingPath: enabled ? 'rrf' : 'commercial',
      rrf: { ...state.assumptions.rrf, enabled },
    };
    set({ assumptions: updated, activeConfigId: null });
    saveAssumptionsToStorage(updated);
    get().recompute();
  },

  resetToDefaults: () => {
    clearPersistedState();
    set({
      assumptions: {
        ...BASE_CASE,
        portfolio: BASE_CASE.portfolio.map((p) => ({ ...p, opex: { ...p.opex } })),
      },
      templates: [...BUILT_IN_TEMPLATES],
      projects: DEFAULT_PROJECTS.map((p) => ({ ...p })),
      activeConfigId: null,
      activeConfigName: null,
      activeScenario: 'realistic',
    });
    get().recompute();
  },

  recompute: () => {
    set({ loading: true });
    const state = get();
    // Resolve templates + projects → portfolio
    const portfolio = resolvePortfolio(state.templates, state.projects);
    // Update assumptions with resolved portfolio
    let assumptions = { ...state.assumptions, portfolio };
    // Apply ephemeral financing-path override (banker view only). When non-null
    // it takes precedence over assumptions.financingPath without writing to
    // localStorage. Cleared on bank/layout.tsx unmount so the admin session
    // is never affected.
    if (state.financingPathOverride !== null) {
      assumptions = { ...assumptions, financingPath: state.financingPathOverride as FinancingPath };
    }
    // Apply ephemeral stress-test overrides (bank view only — never persisted).
    if (state.stressTestOverrides !== null) {
      for (const [path, value] of Object.entries(state.stressTestOverrides)) {
        assumptions = setNestedValue(
          assumptions as unknown as Record<string, unknown>,
          path,
          value
        ) as unknown as ModelAssumptions;
      }
    }
    // Apply ephemeral CAPEX overrides (absorption toggles + optional manual uplift).
    // Absorption: specific categories moved into the construction line for bank-facing output.
    // Uplift: blanket manual override still used by dashboard/assumptions controls.
    let capexOverride: CapexBreakdown | undefined;
    const activePath = (state.financingPathOverride ?? assumptions.financingPath) as FinancingPath;
    const absorptionConfig: CapexAbsorptionConfig = {
      serviceProviders: state.capexAbsorptionServiceProviders,
      contingency: state.capexAbsorptionContingency,
    };
    const hasAbsorption = isAbsorptionActive(absorptionConfig);
    const hasUplift = state.capexUpliftEur !== null && state.capexUpliftEur > 0;
    if (hasAbsorption || hasUplift) {
      const rawCapex = computeCapex(assumptions);
      let working = rawCapex;
      if (hasAbsorption) working = applyCapexAbsorption(working, absorptionConfig);
      if (hasUplift) working = applyCapexUplift(working, state.capexUpliftEur!);
      capexOverride = working;
    }

    // Apply viewMode override (banker routes, admin toggle, banker
    // impersonation). When null we fall through to assumptions.viewMode
    // (which defaults to 'internal' via BASE_CASE).
    const computed = state.viewModeOverride
      ? computeModel({ ...assumptions, viewMode: state.viewModeOverride }, capexOverride)
      : computeModel(assumptions, capexOverride);

    // Capture per-path baseline loans whenever no override (uplift or absorption) is active.
    // Done synchronously inside recompute so baselines are available regardless of which
    // page the user is on when they first activate the sensitivity.
    let baselineLoansUpdate: Partial<typeof state> = {};
    const noOverrideActive = (state.capexUpliftEur === null || state.capexUpliftEur <= 0)
      && !state.capexAbsorptionServiceProviders
      && !state.capexAbsorptionContingency;
    if (noOverrideActive) {
      const loanRow = computed.financingComparison.find(r => r.key === 'totalLoanDrawn');
      if (loanRow) {
        baselineLoansUpdate = {
          capexUpliftBaselineLoans: {
            commercial: typeof loanRow.commercial === 'number' ? loanRow.commercial : 0,
            rrf:        typeof loanRow.rrf        === 'number' ? loanRow.rrf        : 0,
            grant:      typeof loanRow.grant      === 'number' ? loanRow.grant      : 0,
            tepixLoan:  typeof loanRow.tepixLoan  === 'number' ? loanRow.tepixLoan  : 0,
            optima:     typeof loanRow.optima     === 'number' ? loanRow.optima     : 0,
          },
        };
      }
    }

    set({ assumptions: { ...state.assumptions, portfolio }, model: computed, loading: false, computeTimeMs: computed.computeTimeMs, ...baselineLoansUpdate });
  },

  init: () => {
    const configs = loadFromStorage();
    const savedTemplates = loadTemplatesFromStorage();
    const history = loadHistoryFromStorage();
    const currentUser = loadUserFromStorage();
    const savedAssumptions = loadAssumptionsFromStorage();
    const savedProjects = loadProjectsFromStorage();
    const savedScenario = loadScenarioFromStorage();
    const savedCapTable = loadCapTableFromStorage();
    const savedWaterfall = loadWaterfallFromStorage();
    const savedCapexUplift = loadCapexUpliftFromStorage();
    const savedCapexAbsorption = loadCapexAbsorptionFromStorage();

    // Merge: use saved version of built-in templates if modified, otherwise use default built-in
    const allTemplates = [
      ...BUILT_IN_TEMPLATES.map((bt) => {
        const saved = savedTemplates.find((st) => st.id === bt.id);
        return saved ? ensureRoomAreas({ ...saved, builtIn: true as const }) : bt;
      }),
      ...savedTemplates
        .filter((st) => !BUILT_IN_TEMPLATES.some((bt) => bt.id === st.id))
        .map(ensureRoomAreas),
    ];

    // Reconcile extraOpexLines: collect union of all line ids across templates,
    // then fill missing entries on templates that don't have them.
    const allLineIds = Array.from(
      new Set(allTemplates.flatMap((t) => (t.extraOpexLines ?? []).map((l) => l.id)))
    );
    const reconciled = allTemplates.map((tpl) => {
      const existing = tpl.extraOpexLines ?? [];
      const existingIds = new Set(existing.map((l) => l.id));
      const missing = allLineIds
        .filter((lid) => !existingIds.has(lid))
        .map((lid) => {
          // Find the name from whichever template has it, to avoid blank labels
          const donor = allTemplates.find((t) =>
            (t.extraOpexLines ?? []).some((l) => l.id === lid)
          );
          const donorLine = donor?.extraOpexLines?.find((l) => l.id === lid);
          return { id: lid, name: donorLine?.name ?? '', value: 0 };
        });
      return { ...tpl, extraOpexLines: [...existing, ...missing] };
    });

    // Rebuild assumptions from BASE_CASE + persisted edits. Deep-merge so
    // fields added to the schema after the user's last save get defaults.
    let assumptions: ModelAssumptions = {
      ...BASE_CASE,
      portfolio: BASE_CASE.portfolio.map((p) => ({ ...p, opex: { ...p.opex } })),
    };
    if (savedAssumptions) {
      assumptions = deepMerge(
        assumptions as unknown as Record<string, unknown>,
        savedAssumptions as Record<string, unknown>
      ) as unknown as ModelAssumptions;
    }
    assumptions = ensurePortfolioOpex(assumptions);
    // Backfill poolConstructionCostPerM2 added 2026-05 — default 1000 if absent
    if (assumptions.poolConstructionCostPerM2 == null) {
      assumptions = { ...assumptions, poolConstructionCostPerM2: 1_000 };
    }
    const projects = savedProjects ?? DEFAULT_PROJECTS.map((p) => ({ ...p }));

    const savePromptDisabled = loadSavePromptDisabled();
    const lastSaved = loadLastSavedConfig();
    // Don't restore lastSaved if that config no longer exists
    const stillExists = lastSaved && configs.some((c) => c.id === lastSaved.id);

    set({
      assumptions,
      savedConfigs: configs,
      templates: reconciled,
      projects,
      history,
      currentUser,
      userHasSetName: currentUser !== 'You',
      savePromptDisabled,
      lastSavedConfigId: stillExists ? lastSaved!.id : null,
      lastSavedConfigName: stillExists ? lastSaved!.name : null,
      ...(savedScenario ? { activeScenario: savedScenario } : {}),
      ...(savedCapTable ? { capTable: savedCapTable } : {}),
      ...(savedWaterfall ? { waterfall: { ...DEFAULT_WATERFALL, ...savedWaterfall } } : {}),
      ...(savedCapexUplift ? {
        capexUpliftEur: savedCapexUplift.eur,
        capexUpliftBase: savedCapexUplift.base,
        capexUpliftMode: savedCapexUplift.mode,
        capexUpliftBaselineLoans: savedCapexUplift.baselineLoans,
      } : {}),
      capexAbsorptionServiceProviders: savedCapexAbsorption.serviceProviders,
      capexAbsorptionContingency: savedCapexAbsorption.contingency,
    });
    get().recompute();
    // Persist backfilled templates (ensureRoomAreas may have added new fields
    // like landscapingCost / poolSlots that weren't in the saved version).
    saveTemplatesToStorage(get().templates);

    // Background-fetch shared scenarios from the server (banker view: uid
    // is null → published-only). When auth wires up, ConfigPanel bridges
    // currentUserUid into the store and calls hydrateForUser(uid) to
    // re-fetch with the own-scenarios query in addition. The merge logic
    // below stays identical (server wins on newer savedAt); we just no
    // longer auto-push local-only entries, because every persisted doc
    // now needs a userId and we don't have one at init time.
    fetchServerConfigs(get().currentUserUid).then((serverConfigs) => {
      if (!serverConfigs) return;
      const local = get().savedConfigs;
      const byId = new Map(local.map((c) => [c.id, c]));
      let changed = false;
      for (const sc of serverConfigs) {
        const cur = byId.get(sc.id);
        if (!cur) {
          byId.set(sc.id, sc);
          changed = true;
        } else if ((sc.savedAt ?? 0) > (cur.savedAt ?? 0)) {
          byId.set(sc.id, sc);
          changed = true;
        }
      }
      if (changed) {
        const merged = Array.from(byId.values());
        set({ savedConfigs: merged });
        saveToStorage(merged);
      }
    });
  },

  // ── Auth identity bridge ──────────────────────────────────────────
  // Called from ConfigPanel's bridge effect. We don't re-hydrate here —
  // hydrateForUser is called separately to keep the side effects
  // explicit at the call site (so React's strict-mode double-invoke
  // doesn't double-fetch).
  setCurrentAuthIdentity: ({ uid, displayName, email }) => {
    const cur = get();
    if (
      cur.currentUserUid === uid &&
      cur.currentUserDisplayName === displayName &&
      cur.currentUserEmail === email
    ) {
      return;
    }
    // ── Shared-machine hygiene (security-auditor m1, 2026-05-22) ──
    // When a previously-signed-in user is replaced by a DIFFERENT signed-in
    // user (uid → different uid), drop any localStorage-hydrated configs
    // that lack a `userId` field. Those are pre-migration legacy local
    // docs from the previous session and must not appear under the new
    // user's "Your scenarios". We DO NOT touch entries with a userId set —
    // those are either the new user's own docs (correctly stamped) or
    // foreign docs which the picker filter already handles.
    //
    // Intentionally does NOT fire on null → uid (first sign-in) or
    // uid → null (sign-out), only on uid → different uid (account switch).
    const prevUid = cur.currentUserUid;
    const isAccountSwitch =
      prevUid !== null && uid !== null && prevUid !== uid;

    // Auto-resolve currentUser / userHasSetName from Firebase identity so
    // bumpEditCounter never opens the name-attribution modal for a user whose
    // identity is already known (Google sign-in, email, or AuthGate name).
    const resolvedName = resolveOwnerDisplayName({ currentUserDisplayName: displayName, currentUserEmail: email });
    const identityExtra = resolvedName !== 'Unknown'
      ? { currentUser: resolvedName, userHasSetName: true, nameModalOpen: false }
      : {};
    if (resolvedName !== 'Unknown') saveUserToStorage(resolvedName);

    if (isAccountSwitch) {
      const filtered = cur.savedConfigs.filter((c) => !!c.userId);
      if (filtered.length !== cur.savedConfigs.length) {
        set({
          currentUserUid: uid,
          currentUserDisplayName: displayName,
          currentUserEmail: email,
          savedConfigs: filtered,
          ...identityExtra,
        });
        saveToStorage(filtered);
        return;
      }
    }
    set({
      currentUserUid: uid,
      currentUserDisplayName: displayName,
      currentUserEmail: email,
      ...identityExtra,
    });
  },

  // Re-fetch the scenario list for a freshly-known uid. Revision 1:
  //   1. Bump hydrationToken so stale fetches drop their results.
  //   2. Set hydratingFor=uid so a parallel call for the same uid
  //      short-circuits (React strict-mode double-invoke guard).
  //   3. After fetch resolves, re-check the token; bail on mismatch.
  hydrateForUser: async (uid) => {
    const state = get();
    // Dedupe: a hydration is already in flight for this exact uid.
    if (state.hydratingFor === uid) return;
    const token = state.hydrationToken + 1;
    set({ hydrationToken: token, hydratingFor: uid });
    let fetched: SavedConfiguration[] | null = null;
    try {
      fetched = await fetchServerConfigs(uid);
    } finally {
      // Always clear hydratingFor even on throw so a transient error
      // doesn't permanently block subsequent hydrations.
      if (get().hydratingFor === uid) {
        set({ hydratingFor: null });
      }
    }
    // Stale-token check: a newer hydrateForUser superseded us.
    if (get().hydrationToken !== token) return;
    if (!fetched) return;
    const local = get().savedConfigs;
    const byId = new Map(local.map((c) => [c.id, c]));
    let changed = false;
    for (const sc of fetched) {
      const cur = byId.get(sc.id);
      if (!cur) {
        byId.set(sc.id, sc);
        changed = true;
      } else if ((sc.savedAt ?? 0) > (cur.savedAt ?? 0)) {
        byId.set(sc.id, sc);
        changed = true;
      }
    }
    // Single shared-password team: keep ALL local configs regardless of userId.
    // Anonymous auth gives a new UID each session, so per-UID ownership
    // checks would silently drop configs saved in other sessions.
    if (changed) {
      const merged = Array.from(byId.values());
      set({ savedConfigs: merged });
      saveToStorage(merged);
    }
  },

  // ── Optima Bank sub-project allocation ──

  setOptimaSubProjectSide: (propertyId: string, side: 'A' | 'B') => {
    const { assumptions } = get();
    const loan = assumptions.optimaLoan;
    if (!loan) return;
    const updated: ModelAssumptions = {
      ...assumptions,
      optimaLoan: {
        ...loan,
        subProjectAllocation: { ...(loan.subProjectAllocation ?? {}), [propertyId]: side },
      },
    };
    set({ assumptions: updated, activeConfigId: null });
    saveAssumptionsToStorage(updated);
    // bumpEditCounter marks editsSinceLastSave > 0, preventing the reference-
    // scenario auto-load from overwriting this allocation after the Firestore
    // fetch completes (race condition on fresh page load).
    bumpEditCounter(get, set);
    get().recompute();
  },

  setOptimaEuriborRate: (rate: number) => {
    const { assumptions } = get();
    const loan = assumptions.optimaLoan;
    if (!loan) return;
    const updated: ModelAssumptions = {
      ...assumptions,
      optimaLoan: { ...loan, euriborRate: rate },
    };
    set({ assumptions: updated });
    // NOT calling saveAssumptionsToStorage — live rate is ephemeral
    get().recompute();
  },

  setOptimaSpreadBps: (bps: number) => {
    const { assumptions } = get();
    const loan = assumptions.optimaLoan;
    if (!loan) return;
    const updated: ModelAssumptions = {
      ...assumptions,
      optimaLoan: { ...loan, spreadBps: bps },
    };
    set({ assumptions: updated, activeConfigId: null });
    saveAssumptionsToStorage(updated);
    bumpEditCounter(get, set);
    get().recompute();
  },

  setCapexLineAbsorption: (categoryName: string, included: boolean) => {
    const { assumptions } = get();
    const loan = assumptions.optimaLoan;
    if (!loan) return;
    const updated: ModelAssumptions = {
      ...assumptions,
      optimaLoan: {
        ...loan,
        absorb: {
          ...loan.absorb,
          lineOverrides: { ...(loan.absorb.lineOverrides ?? {}), [categoryName]: included },
        },
      },
    };
    set({ assumptions: updated, activeConfigId: null });
    saveAssumptionsToStorage(updated);
    bumpEditCounter(get, set);
    get().recompute();
  },

  // ── Template Management ──

  addTemplate: (type: 'villa' | 'suite' | 'mixed') => {
    const templates = get().templates;
    const existingCount = templates.filter((t) => !t.builtIn).length;
    const base = type === 'mixed' ? BUILT_IN_TEMPLATES[4] : type === 'villa' ? BUILT_IN_TEMPLATES[0] : BUILT_IN_TEMPLATES[1];
    const label = type === 'mixed' ? 'Mixed' : type === 'villa' ? 'Villa' : 'Suite';
    const newTemplate: PropertyTemplate = {
      ...base,
      id: generateId('tpl'),
      name: `Custom ${label} ${existingCount + 1}`,
      builtIn: false,
      opex: { ...base.opex },
      roomAreas: { ...base.roomAreas },
    };
    const updated = [...templates, newTemplate];
    set({ templates: updated });
    saveTemplatesToStorage(updated);
  },

  updateTemplate: (id: string, path: string, value: unknown, label?: string) => {
    const state = get();
    const prevTpl = state.templates.find((t) => t.id === id);
    let before: unknown = undefined;
    if (prevTpl) {
      if (path.includes('.')) {
        const [root, key] = path.split('.');
        if (root === 'opex') before = prevTpl.opex[key as keyof PropertyOpex];
        else if (root === 'roomAreas') before = prevTpl.roomAreas?.[key as keyof RoomAreaBreakdown];
      } else {
        before = (prevTpl as unknown as Record<string, unknown>)[path];
      }
    }

    const templates = state.templates.map((tpl) => {
      if (tpl.id !== id) return tpl;
      if (path.includes('.')) {
        const keys = path.split('.');
        if (keys[0] === 'opex') {
          return { ...tpl, opex: { ...tpl.opex, [keys[1]]: value } as PropertyOpex };
        }
        if (keys[0] === 'roomAreas') {
          const rooms = tpl.roomAreas ?? { ...DEFAULT_ROOM_AREAS };
          return { ...tpl, roomAreas: { ...rooms, [keys[1]]: value } as RoomAreaBreakdown };
        }
        return tpl;
      }
      return { ...tpl, [path]: value };
    });
    set({ templates, activeConfigId: null });
    saveTemplatesToStorage(templates);
    pushHistory(get, set, {
      scope: 'template',
      scopeId: id,
      scopeLabel: prevTpl?.name,
      path,
      label: label ?? path,
      before,
      after: value,
    });
    bumpEditCounter(get, set);
    get().recompute();
  },

  renameTemplate: (id: string, newName: string) => {
    const templates = get().templates.map((tpl) =>
      tpl.id === id ? { ...tpl, name: newName } : tpl
    );
    set({ templates });
    saveTemplatesToStorage(templates);
  },

  duplicateTemplate: (id: string) => {
    const tpl = get().templates.find((t) => t.id === id);
    if (!tpl) return;
    const copy: PropertyTemplate = {
      ...tpl,
      id: generateId('tpl'),
      name: `${tpl.name} (copy)`,
      builtIn: false,
      opex: { ...tpl.opex },
      roomAreas: tpl.roomAreas ? { ...tpl.roomAreas } : { ...DEFAULT_ROOM_AREAS },
      extraOpexLines: (tpl.extraOpexLines ?? []).map((l) => ({
        ...l,
        id: generateId('opex-line'),
      })),
    };
    const templates = [...get().templates, copy];
    set({ templates });
    saveTemplatesToStorage(templates);
  },

  deleteTemplate: (id: string) => {
    const tpl = get().templates.find((t) => t.id === id);
    if (!tpl || tpl.builtIn) return; // Can't delete built-in
    // Remove any projects using this template
    const projects = get().projects.filter((p) => p.templateId !== id);
    // Ensure at least one project remains
    if (projects.length === 0) {
      projects.push({ id: generateId('proj'), templateId: 'tpl-twin-villa', name: 'Twin Villas', count: 1 });
    }
    const templates = get().templates.filter((t) => t.id !== id);
    set({ templates, projects, activeConfigId: null });
    saveTemplatesToStorage(templates);
    get().recompute();
  },

  // ── Custom Spaces ──

  addCustomSpace: (tplId: string) => {
    const templates = get().templates.map((tpl) => {
      if (tpl.id !== tplId) return tpl;
      const rooms = tpl.roomAreas ?? { ...DEFAULT_ROOM_AREAS };
      const customSpaces = [
        ...(rooms.customSpaces ?? []),
        { id: generateId('cs'), name: 'Custom space', area: 0 },
      ];
      return { ...tpl, roomAreas: { ...rooms, customSpaces } };
    });
    set({ templates, activeConfigId: null });
    saveTemplatesToStorage(templates);
    bumpEditCounter(get, set);
    get().recompute();
  },

  updateCustomSpace: (tplId: string, csId: string, key: 'name' | 'area', value: string | number) => {
    const templates = get().templates.map((tpl) => {
      if (tpl.id !== tplId) return tpl;
      const rooms = tpl.roomAreas ?? { ...DEFAULT_ROOM_AREAS };
      const customSpaces = (rooms.customSpaces ?? []).map((c) =>
        c.id === csId ? { ...c, [key]: value } : c
      );
      return { ...tpl, roomAreas: { ...rooms, customSpaces } };
    });
    set({ templates, activeConfigId: null });
    saveTemplatesToStorage(templates);
    bumpEditCounter(get, set);
    get().recompute();
  },

  removeCustomSpace: (tplId: string, csId: string) => {
    const templates = get().templates.map((tpl) => {
      if (tpl.id !== tplId) return tpl;
      const rooms = tpl.roomAreas ?? { ...DEFAULT_ROOM_AREAS };
      const customSpaces = (rooms.customSpaces ?? []).filter((c) => c.id !== csId);
      return { ...tpl, roomAreas: { ...rooms, customSpaces } };
    });
    set({ templates, activeConfigId: null });
    saveTemplatesToStorage(templates);
    bumpEditCounter(get, set);
    get().recompute();
  },

  // ── Extra OPEX Lines ──

  addOpexLine: () => {
    const lineId = generateId('opex-line');
    const templates = get().templates.map((tpl) => ({
      ...tpl,
      extraOpexLines: [...(tpl.extraOpexLines ?? []), { id: lineId, name: '', value: 0 }],
    }));
    set({ templates, activeConfigId: null });
    saveTemplatesToStorage(templates);
    bumpEditCounter(get, set);
    get().recompute();
  },

  removeOpexLine: (_tplId: string, lineId: string) => {
    const templates = get().templates.map((tpl) => ({
      ...tpl,
      extraOpexLines: (tpl.extraOpexLines ?? []).filter((l) => l.id !== lineId),
    }));
    set({ templates, activeConfigId: null });
    saveTemplatesToStorage(templates);
    bumpEditCounter(get, set);
    get().recompute();
  },

  updateOpexLine: (tplId: string, lineId: string, key: 'name' | 'value', value: string | number) => {
    const templates = get().templates.map((tpl) => {
      const extraOpexLines = (tpl.extraOpexLines ?? []).map((l) => {
        if (l.id !== lineId) return l;
        if (key === 'name') return { ...l, name: value as string };       // fan out: all templates
        if (tpl.id === tplId) return { ...l, value: value as number };    // per-template: only this one
        return l;
      });
      return { ...tpl, extraOpexLines };
    });
    set({ templates, activeConfigId: null });
    saveTemplatesToStorage(templates);
    bumpEditCounter(get, set);
    get().recompute();
  },

  // ── Extra CAPEX Lines ──

  addCapexLine: (tplId: string) => {
    const templates = get().templates.map((tpl) => {
      if (tpl.id !== tplId) return tpl;
      const extraCapexLines = [
        ...(tpl.extraCapexLines ?? []),
        { id: generateId('capex-line'), name: '', cost: 0 },
      ];
      return { ...tpl, extraCapexLines };
    });
    set({ templates, activeConfigId: null });
    saveTemplatesToStorage(templates);
    bumpEditCounter(get, set);
    get().recompute();
  },

  removeCapexLine: (tplId: string, lineId: string) => {
    const templates = get().templates.map((tpl) => {
      if (tpl.id !== tplId) return tpl;
      const extraCapexLines = (tpl.extraCapexLines ?? []).filter((l) => l.id !== lineId);
      return { ...tpl, extraCapexLines };
    });
    set({ templates, activeConfigId: null });
    saveTemplatesToStorage(templates);
    bumpEditCounter(get, set);
    get().recompute();
  },

  updateCapexLine: (tplId: string, lineId: string, key: 'name' | 'cost', value: string | number) => {
    const templates = get().templates.map((tpl) => {
      if (tpl.id !== tplId) return tpl;
      const extraCapexLines = (tpl.extraCapexLines ?? []).map((l) =>
        l.id === lineId ? { ...l, [key]: value } : l
      );
      return { ...tpl, extraCapexLines };
    });
    set({ templates, activeConfigId: null });
    saveTemplatesToStorage(templates);
    bumpEditCounter(get, set);
    get().recompute();
  },

  // ── Portfolio OPEX actions ──

  addPortfolioStaffRole: (role: StaffRole) => {
    const po = get().assumptions.portfolioOpex ?? DEFAULT_PORTFOLIO_OPEX;
    const updated = { ...get().assumptions, portfolioOpex: { ...po, staffRoles: [...po.staffRoles, role] } };
    set({ assumptions: updated, activeConfigId: null });
    saveAssumptionsToStorage(updated);
    bumpEditCounter(get, set);
    get().recompute();
  },

  updatePortfolioStaffRole: (index: number, role: StaffRole) => {
    const po = get().assumptions.portfolioOpex ?? DEFAULT_PORTFOLIO_OPEX;
    const staffRoles = po.staffRoles.map((r, i) => (i === index ? role : r));
    const updated = { ...get().assumptions, portfolioOpex: { ...po, staffRoles } };
    set({ assumptions: updated, activeConfigId: null });
    saveAssumptionsToStorage(updated);
    bumpEditCounter(get, set);
    get().recompute();
  },

  removePortfolioStaffRole: (index: number) => {
    const po = get().assumptions.portfolioOpex ?? DEFAULT_PORTFOLIO_OPEX;
    const staffRoles = po.staffRoles.filter((_, i) => i !== index);
    const updated = { ...get().assumptions, portfolioOpex: { ...po, staffRoles } };
    set({ assumptions: updated, activeConfigId: null });
    saveAssumptionsToStorage(updated);
    bumpEditCounter(get, set);
    get().recompute();
  },

  addPortfolioService: (line: SharedServiceLine) => {
    const po = get().assumptions.portfolioOpex ?? DEFAULT_PORTFOLIO_OPEX;
    const updated = { ...get().assumptions, portfolioOpex: { ...po, sharedServices: [...po.sharedServices, line] } };
    set({ assumptions: updated, activeConfigId: null });
    saveAssumptionsToStorage(updated);
    bumpEditCounter(get, set);
    get().recompute();
  },

  updatePortfolioService: (index: number, line: SharedServiceLine) => {
    const po = get().assumptions.portfolioOpex ?? DEFAULT_PORTFOLIO_OPEX;
    const sharedServices = po.sharedServices.map((s, i) => (i === index ? line : s));
    const updated = { ...get().assumptions, portfolioOpex: { ...po, sharedServices } };
    set({ assumptions: updated, activeConfigId: null });
    saveAssumptionsToStorage(updated);
    bumpEditCounter(get, set);
    get().recompute();
  },

  removePortfolioService: (index: number) => {
    const po = get().assumptions.portfolioOpex ?? DEFAULT_PORTFOLIO_OPEX;
    const sharedServices = po.sharedServices.filter((_, i) => i !== index);
    const updated = { ...get().assumptions, portfolioOpex: { ...po, sharedServices } };
    set({ assumptions: updated, activeConfigId: null });
    saveAssumptionsToStorage(updated);
    bumpEditCounter(get, set);
    get().recompute();
  },

  addPortfolioOverhead: (line: SharedServiceLine) => {
    const po = get().assumptions.portfolioOpex ?? DEFAULT_PORTFOLIO_OPEX;
    const updated = { ...get().assumptions, portfolioOpex: { ...po, sharedOverhead: [...po.sharedOverhead, line] } };
    set({ assumptions: updated, activeConfigId: null });
    saveAssumptionsToStorage(updated);
    bumpEditCounter(get, set);
    get().recompute();
  },

  updatePortfolioOverhead: (index: number, line: SharedServiceLine) => {
    const po = get().assumptions.portfolioOpex ?? DEFAULT_PORTFOLIO_OPEX;
    const sharedOverhead = po.sharedOverhead.map((s, i) => (i === index ? line : s));
    const updated = { ...get().assumptions, portfolioOpex: { ...po, sharedOverhead } };
    set({ assumptions: updated, activeConfigId: null });
    saveAssumptionsToStorage(updated);
    bumpEditCounter(get, set);
    get().recompute();
  },

  removePortfolioOverhead: (index: number) => {
    const po = get().assumptions.portfolioOpex ?? DEFAULT_PORTFOLIO_OPEX;
    const sharedOverhead = po.sharedOverhead.filter((_, i) => i !== index);
    const updated = { ...get().assumptions, portfolioOpex: { ...po, sharedOverhead } };
    set({ assumptions: updated, activeConfigId: null });
    saveAssumptionsToStorage(updated);
    bumpEditCounter(get, set);
    get().recompute();
  },

  updatePortfolioOpexScalar: (
    key: keyof Omit<PortfolioOpex, 'staffRoles' | 'sharedServices' | 'sharedOverhead'>,
    value: number | boolean
  ) => {
    const po = get().assumptions.portfolioOpex ?? DEFAULT_PORTFOLIO_OPEX;
    const updated = { ...get().assumptions, portfolioOpex: { ...po, [key]: value } };
    set({ assumptions: updated, activeConfigId: null });
    saveAssumptionsToStorage(updated);
    bumpEditCounter(get, set);
    get().recompute();
  },

  // ── Villa Rooms ──

  addVillaRoom: (tplId: string) => {
    const templates = get().templates.map((tpl) => {
      if (tpl.id !== tplId) return tpl;
      const rooms = tpl.roomAreas ?? { ...DEFAULT_ROOM_AREAS };
      const villaRooms = [
        ...(rooms.villaRooms ?? []),
        { id: generateId('vr'), name: 'Room', count: 1, area: 0 },
      ];
      return { ...tpl, roomAreas: { ...rooms, villaRooms } };
    });
    set({ templates, activeConfigId: null });
    saveTemplatesToStorage(templates);
    bumpEditCounter(get, set);
    get().recompute();
  },

  updateVillaRoom: (tplId: string, roomId: string, key: 'name' | 'count' | 'area', value: string | number) => {
    const templates = get().templates.map((tpl) => {
      if (tpl.id !== tplId) return tpl;
      const rooms = tpl.roomAreas ?? { ...DEFAULT_ROOM_AREAS };
      const villaRooms = (rooms.villaRooms ?? []).map((r) =>
        r.id === roomId ? { ...r, [key]: value } : r
      );
      return { ...tpl, roomAreas: { ...rooms, villaRooms } };
    });
    set({ templates, activeConfigId: null });
    saveTemplatesToStorage(templates);
    bumpEditCounter(get, set);
    get().recompute();
  },

  removeVillaRoom: (tplId: string, roomId: string) => {
    const templates = get().templates.map((tpl) => {
      if (tpl.id !== tplId) return tpl;
      const rooms = tpl.roomAreas ?? { ...DEFAULT_ROOM_AREAS };
      const villaRooms = (rooms.villaRooms ?? []).filter((r) => r.id !== roomId);
      return { ...tpl, roomAreas: { ...rooms, villaRooms } };
    });
    set({ templates, activeConfigId: null });
    saveTemplatesToStorage(templates);
    bumpEditCounter(get, set);
    get().recompute();
  },

  // ── Pool Slots ──

  addPoolSlot: (tplId: string) => {
    const templates = get().templates.map((tpl) => {
      if (tpl.id !== tplId) return tpl;
      const poolSlots = [
        ...(tpl.poolSlots ?? []),
        { id: generateId('ps'), qty: 1, widthM: 5, lengthM: 10 },
      ];
      return { ...tpl, poolSlots };
    });
    set({ templates, activeConfigId: null });
    saveTemplatesToStorage(templates);
    bumpEditCounter(get, set);
    get().recompute();
  },

  updatePoolSlot: (tplId: string, slotId: string, key: 'qty' | 'widthM' | 'lengthM', value: number) => {
    const templates = get().templates.map((tpl) => {
      if (tpl.id !== tplId) return tpl;
      const poolSlots = (tpl.poolSlots ?? []).map((s) =>
        s.id === slotId ? { ...s, [key]: value } : s
      );
      return { ...tpl, poolSlots };
    });
    set({ templates, activeConfigId: null });
    saveTemplatesToStorage(templates);
    bumpEditCounter(get, set);
    get().recompute();
  },

  removePoolSlot: (tplId: string, slotId: string) => {
    const templates = get().templates.map((tpl) => {
      if (tpl.id !== tplId) return tpl;
      const poolSlots = (tpl.poolSlots ?? []).filter((s) => s.id !== slotId);
      return { ...tpl, poolSlots };
    });
    set({ templates, activeConfigId: null });
    saveTemplatesToStorage(templates);
    bumpEditCounter(get, set);
    get().recompute();
  },

  setWellnessFlatCost: (tplId: string, value: number | undefined) => {
    const templates = get().templates.map((tpl) => {
      if (tpl.id !== tplId) return tpl;
      if (value === undefined) {
        // Switch to pool slots mode: clear wellnessFlatCost, add a default slot if none exist
        const poolSlots = tpl.poolSlots && tpl.poolSlots.length > 0
          ? tpl.poolSlots
          : [{ id: generateId('ps'), qty: 1, widthM: 5, lengthM: 10 }];
        return { ...tpl, wellnessFlatCost: undefined, poolSlots };
      }
      return { ...tpl, wellnessFlatCost: value };
    });
    set({ templates, activeConfigId: null });
    saveTemplatesToStorage(templates);
    bumpEditCounter(get, set);
    get().recompute();
  },

  // ── Project Management ──

  addProject: (templateId: string) => {
    const tpl = get().templates.find((t) => t.id === templateId);
    if (!tpl) return;
    const newProject: ProjectAllocation = {
      id: generateId('proj'),
      templateId,
      name: tpl.name,
      count: 1,
    };
    const projects = [...get().projects, newProject];
    set({ projects, activeConfigId: null });
    saveProjectsToStorage(projects);
    get().recompute();
  },

  removeProject: (id: string) => {
    const projects = get().projects;
    if (projects.length <= 1) return;
    const next = projects.filter((p) => p.id !== id);
    set({ projects: next, activeConfigId: null });
    saveProjectsToStorage(next);
    get().recompute();
  },

  updateProjectCount: (id: string, count: number) => {
    if (count < 0) return;
    const state = get();
    const prev = state.projects.find((p) => p.id === id);
    const before = prev?.count;
    const projects = state.projects.map((p) =>
      p.id === id ? { ...p, count } : p
    );
    set({ projects, activeConfigId: null });
    saveProjectsToStorage(projects);
    pushHistory(get, set, {
      scope: 'project',
      scopeId: id,
      scopeLabel: prev?.name,
      path: 'count',
      label: 'Project unit count',
      before,
      after: count,
    });
    bumpEditCounter(get, set);
    get().recompute();
  },

  changeProjectTemplate: (id: string, templateId: string) => {
    const tpl = get().templates.find((t) => t.id === templateId);
    if (!tpl) return;
    const projects = get().projects.map((p) =>
      p.id === id ? { ...p, templateId, name: tpl.name } : p
    );
    set({ projects, activeConfigId: null });
    saveProjectsToStorage(projects);
    get().recompute();
  },

  renameProject: (id: string, newName: string) => {
    const projects = get().projects.map((p) =>
      p.id === id ? { ...p, name: newName } : p
    );
    set({ projects, activeConfigId: null });
    saveProjectsToStorage(projects);
  },

  // ── Legacy Portfolio Methods (backward compat) ──

  addProperty: (type: 'villa' | 'suite') => {
    const templateId = type === 'villa' ? 'tpl-twin-villa' : 'tpl-boutique-suite';
    get().addProject(templateId);
  },

  removeProperty: (id: string) => {
    get().removeProject(id);
  },

  updateProperty: (id: string, path: string, value: unknown) => {
    // For legacy compatibility: update the template of this project
    const proj = get().projects.find((p) => p.id === id);
    if (!proj) return;
    get().updateTemplate(proj.templateId, path, value);
  },

  renameProperty: (id: string, newName: string) => {
    get().renameProject(id, newName);
  },

  // ── Config Management ──

  saveConfig: async (name: string, opts?: { published?: boolean }) => {
    const state = get();
    const uid = state.currentUserUid;
    const id = crypto.randomUUID();
    const ownerDisplayName = resolveOwnerDisplayName(state);
    // Default published:true — all team saves are visible to every
    // password-gate user without needing to tick "Share with team" each time.
    const config: SavedConfiguration = {
      id,
      name,
      assumptions: JSON.parse(JSON.stringify(state.assumptions)),
      templates: JSON.parse(JSON.stringify(state.templates)),
      projects: JSON.parse(JSON.stringify(state.projects)),
      savedAt: Date.now(),
      userId: uid ?? undefined,
      ownerDisplayName,
      published: opts?.published ?? true,
      copiedFrom: null,
      capexUpliftEur: state.capexUpliftEur,
      capexUpliftBase: state.capexUpliftBase,
      capexUpliftMode: state.capexUpliftMode,
      capexUpliftBaselineLoans: state.capexUpliftBaselineLoans,
      capexAbsorptionServiceProviders: state.capexAbsorptionServiceProviders,
      capexAbsorptionContingency: state.capexAbsorptionContingency,
      activeScenario: state.activeScenario,
    };
    const configs = [...state.savedConfigs, config];
    set({
      savedConfigs: configs,
      activeConfigId: id,
      activeConfigName: name,
      lastSavedConfigId: id,
      lastSavedConfigName: name,
      editsSinceLastSave: 0,
      referenceAutoLoadAttempted: true,
    });
    saveToStorage(configs);
    saveLastSavedConfig({ id, name });
    if (!uid) {
      // Anonymous auth resolves asynchronously after gate login. Save to
      // localStorage only for now; the scenario will be pushed to Firestore
      // once hydrateForUser runs after uid becomes available.
      return;
    }
    try {
      await pushServerConfig(config);
    } catch (err) {
      get().requestAlert({
        title: 'Could not save to the shared list',
        message: (err as Error).message,
        tone: 'error',
      });
    }
  },

  updateConfig: async (id: string) => {
    const state = get();
    const existing = state.savedConfigs.find((c) => c.id === id);
    if (!existing) return;
    // Revision 5 — owner-only edit. Construct from `existing`, never from
    // form state, so a malicious / accidental local mutation can't smuggle
    // a different userId past the rules layer.
    const uid = state.currentUserUid;
    if (existing.userId && uid && existing.userId !== uid) {
      state.requestAlert({
        title: 'Read-only scenario',
        message:
          'This scenario was saved by someone else. Load it instead to make a personal copy you can edit.',
        tone: 'warning',
      });
      return;
    }
    // Defensive guard — existing.userId can be undefined on legacy docs;
    // adopt the current uid in that case so we don't write a doc with no
    // owner field (the rules require one).
    const ownerUid = existing.userId ?? uid;
    if (!ownerUid) {
      state.requestAlert({
        title: 'Sign-in required',
        message: 'You need to be signed in to update a scenario.',
        tone: 'warning',
      });
      return;
    }
    const ownerDisplayName =
      existing.ownerDisplayName ?? resolveOwnerDisplayName(state);
    const updated: SavedConfiguration = {
      ...existing,
      assumptions: JSON.parse(JSON.stringify(state.assumptions)),
      templates: JSON.parse(JSON.stringify(state.templates)),
      projects: JSON.parse(JSON.stringify(state.projects)),
      savedAt: Date.now(),
      userId: ownerUid,
      ownerDisplayName,
      published: existing.published ?? false,
      copiedFrom: existing.copiedFrom ?? null,
      // Explicit re-snapshot — do not rely on ...existing spread (capex/scenario may have changed since load)
      capexUpliftEur: state.capexUpliftEur,
      capexUpliftBase: state.capexUpliftBase,
      capexUpliftMode: state.capexUpliftMode,
      capexUpliftBaselineLoans: state.capexUpliftBaselineLoans,
      capexAbsorptionServiceProviders: state.capexAbsorptionServiceProviders,
      capexAbsorptionContingency: state.capexAbsorptionContingency,
      activeScenario: state.activeScenario,
    };
    const configs = state.savedConfigs.map((c) => (c.id === id ? updated : c));
    set({
      savedConfigs: configs,
      activeConfigId: id,
      activeConfigName: existing.name,
      lastSavedConfigId: id,
      lastSavedConfigName: existing.name,
      editsSinceLastSave: 0,
    });
    saveToStorage(configs);
    saveLastSavedConfig({ id, name: existing.name });
    try {
      await pushServerConfig(updated);
    } catch (err) {
      get().requestAlert({
        title: 'Could not update the shared list',
        message: (err as Error).message,
        tone: 'error',
      });
    }
  },

  loadConfig: async (id: string) => {
    const state = get();
    const source = state.savedConfigs.find((c) => c.id === id);
    if (!source) return;

    // Backfill schema fields added since the config was saved (e.g. exitEbitdaMultiple),
    // mirroring the init() merge so old scenarios don't render with undefined props.
    const mergedAssumptions = deepMerge(
      {
        ...BASE_CASE,
        portfolio: BASE_CASE.portfolio.map((p) => ({ ...p, opex: { ...p.opex } })),
      } as unknown as Record<string, unknown>,
      (source.assumptions ?? {}) as unknown as Record<string, unknown>,
    ) as unknown as ModelAssumptions;

    // Single shared-password team — per-UID ownership is meaningless.
    // All authenticated users can edit any scenario. Never copy-on-load.
    const currentUid = state.currentUserUid;
    const isForeign = false; // ownership model removed: password gate is the access control

    // Branch 1: legacy config has no projects/templates yet — migrate from
    // raw portfolio. Independent of foreign/own; we still hydrate state.
    const hasNewSchema =
      Array.isArray(source.projects) && source.projects.length > 0;

    let targetTemplates: PropertyTemplate[];
    let targetProjects: ProjectAllocation[];
    let targetAssumptions: ModelAssumptions;
    if (hasNewSchema) {
      const savedTemplates = source.templates ?? [];
      const storeTemplates = get().templates;
      targetTemplates = [
        ...BUILT_IN_TEMPLATES.map((bt) => {
          const saved = savedTemplates.find((st) => st.id === bt.id);
          if (!saved) return bt;
          // Always pull constructionCostPerM2 from the current built-in — civil-
          // engineer inputs updated these in May 2026 (luxury 5K→3K, boutique
          // 4K→2.7K) and old Firestore snapshots still carry the wrong values.
          return ensureRoomAreas({
            ...saved,
            builtIn: true as const,
            constructionCostPerM2: bt.constructionCostPerM2,
            constructionDirectorCost: saved.constructionDirectorCost || bt.constructionDirectorCost,
            // Force built-in pool slots when saved snapshot has none — old
            // scenarios may carry [] before pool-slots was added to the schema.
            poolSlots: (saved.poolSlots && saved.poolSlots.length > 0)
              ? saved.poolSlots
              : bt.poolSlots?.map(s => ({ ...s })),
          });
        }),
        ...savedTemplates
          .filter((st) => !BUILT_IN_TEMPLATES.some((bt) => bt.id === st.id))
          .map((st) => {
            // For custom templates, the in-memory store may carry new capex
            // fields added after this scenario was saved. Backfill them so old
            // saved configs pick up the new structure without losing any edits.
            const cur = storeTemplates.find((t) => t.id === st.id);
            const merged: PropertyTemplate = cur ? {
              ...st,
              landscapingCost: st.landscapingCost ?? cur.landscapingCost,
              licensesPermitsCost: st.licensesPermitsCost ?? cur.licensesPermitsCost,
              constructionDirectorCost: st.constructionDirectorCost || cur.constructionDirectorCost,
              poolSlots: st.poolSlots ?? cur.poolSlots,
              wellnessFlatCost: st.wellnessFlatCost ?? cur.wellnessFlatCost,
              acquisitionLegalRate: st.acquisitionLegalRate ?? cur.acquisitionLegalRate,
              interiorDesignerCost: st.interiorDesignerCost ?? cur.interiorDesignerCost,
            } : st;
            return ensureRoomAreas(merged);
          }),
        // Preserve custom templates that exist locally but are not in the saved
        // scenario — e.g. templates created after the last Firestore save. Without
        // this, loading any prior scenario silently wipes locally-created templates.
        ...storeTemplates
          .filter((st) => !st.builtIn && !savedTemplates.some((t) => t.id === st.id))
          .map(ensureRoomAreas),
      ];
      targetProjects = source.projects!;
      targetAssumptions = ensurePortfolioOpex(mergedAssumptions);
    } else {
      const migrated = migrateToPortfolio(mergedAssumptions);
      targetTemplates = get().templates;
      targetProjects = migrated.portfolio.map((p) => ({
        id: p.id || generateId('proj'),
        templateId: p.villaUnits > 0 ? 'tpl-twin-villa' : 'tpl-boutique-suite',
        name: p.name,
        count: p.count,
      }));
      targetAssumptions = migrated;
    }

    if (!isForeign) {
      // Own scenario (or legacy / banker view): hydrate state and pin
      // the active pointer to the source id, as before.

      // Preserve subProjectAllocation — it's a UI routing preference (which
      // Optima sub-project each property belongs to), not a financial scenario
      // parameter. Scenarios saved before this field existed have no allocation,
      // so we keep whatever the user last set rather than silently resetting it.
      const loadedAllocation = targetAssumptions.optimaLoan?.subProjectAllocation;
      const currentAllocation = get().assumptions.optimaLoan?.subProjectAllocation;
      const hasLoadedAllocation =
        loadedAllocation && Object.keys(loadedAllocation).length > 0;
      const hasCurrentAllocation =
        currentAllocation && Object.keys(currentAllocation).length > 0;
      if (!hasLoadedAllocation && hasCurrentAllocation && targetAssumptions.optimaLoan) {
        targetAssumptions = {
          ...targetAssumptions,
          optimaLoan: { ...targetAssumptions.optimaLoan, subProjectAllocation: currentAllocation },
        };
      }

      set({
        assumptions: targetAssumptions,
        templates: targetTemplates,
        projects: targetProjects,
        activeConfigId: id,
        activeConfigName: source.name,
        lastSavedConfigId: id,
        lastSavedConfigName: source.name,
      });
      saveTemplatesToStorage(targetTemplates);
      saveAssumptionsToStorage(targetAssumptions);
      saveProjectsToStorage(targetProjects);
      saveLastSavedConfig({ id, name: source.name });
      // Hydrate capex sensitivity + active scenario from saved doc — safe fallbacks for legacy docs
      const loadedScenario = source.activeScenario ?? 'realistic';
      set({
        capexUpliftEur: source.capexUpliftEur ?? null,
        capexUpliftBase: source.capexUpliftBase ?? null,
        capexUpliftMode: source.capexUpliftMode ?? 'pct',
        capexUpliftBaselineLoans: source.capexUpliftBaselineLoans ?? null,
        capexAbsorptionServiceProviders: source.capexAbsorptionServiceProviders ?? false,
        capexAbsorptionContingency: source.capexAbsorptionContingency ?? false,
        activeScenario: loadedScenario,
      });
      saveScenarioToStorage(loadedScenario);
      // Only persist to localStorage when the loaded scenario has active sensitivity settings
      if (source.capexUpliftEur != null && source.capexUpliftEur > 0) {
        saveCapexUpliftToStorage(
          source.capexUpliftEur,
          source.capexUpliftBase ?? null,
          source.capexUpliftMode ?? 'pct',
          source.capexUpliftBaselineLoans ?? null,
        );
      }
      if (source.capexAbsorptionServiceProviders || source.capexAbsorptionContingency) {
        saveCapexAbsorptionToStorage({
          serviceProviders: source.capexAbsorptionServiceProviders ?? false,
          contingency: source.capexAbsorptionContingency ?? false,
        });
      }
      get().recompute();
      return;
    }

    // Foreign scenario + signed-in user → copy-on-load.
    // Revision 3 — guard against double-click race: if a copy of this
    // exact source already exists for the current user, focus it instead
    // of creating another.
    const existingCopy = state.savedConfigs.find(
      (c) => c.copiedFrom?.scenarioId === source.id && c.userId === currentUid,
    );
    if (existingCopy) {
      // Recursive call into our own non-foreign branch by simply loading
      // the existing copy by id. The recursion terminates because the
      // copy's userId equals currentUid → isForeign === false.
      await get().loadConfig(existingCopy.id);
      return;
    }

    const newId = (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : generateId('cfg');
    const ownerDisplayName = resolveOwnerDisplayName(state);
    const copy: SavedConfiguration = {
      id: newId,
      name: source.name,
      assumptions: JSON.parse(JSON.stringify(targetAssumptions)),
      templates: JSON.parse(JSON.stringify(targetTemplates)),
      projects: JSON.parse(JSON.stringify(targetProjects)),
      savedAt: Date.now(),
      userId: currentUid!,
      ownerDisplayName,
      published: false,
      copiedFrom: {
        userId: source.userId!,
        // Revision 2 — read ownerDisplayName directly off the source doc.
        displayName: source.ownerDisplayName ?? 'Unknown',
        scenarioId: source.id,
        copiedAt: Date.now(),
      },
      // TODO: extend copy-on-load branch with capex sensitivity fields once isForeign can be true (see capex save fix 2026-06)
    };
    const configs = [...state.savedConfigs, copy];
    set({
      savedConfigs: configs,
      assumptions: targetAssumptions,
      templates: targetTemplates,
      projects: targetProjects,
      activeConfigId: copy.id,
      activeConfigName: copy.name,
      lastSavedConfigId: copy.id,
      lastSavedConfigName: copy.name,
    });
    saveToStorage(configs);
    saveTemplatesToStorage(targetTemplates);
    saveAssumptionsToStorage(targetAssumptions);
    saveProjectsToStorage(targetProjects);
    saveLastSavedConfig({ id: copy.id, name: copy.name });
    get().recompute();
    try {
      await pushServerConfig(copy);
    } catch (err) {
      get().requestAlert({
        title: 'Could not save your copy to the shared list',
        message: (err as Error).message,
        tone: 'error',
      });
    }
  },

  deleteConfig: async (id: string) => {
    const state = get();
    const existing = state.savedConfigs.find((c) => c.id === id);
    if (!existing) return;
    // Owner-only delete. Legacy docs (no userId) are deletable by anyone
    // who can see them — they predate the sharing model and have no
    // recoverable owner. The rules layer also enforces this.
    const uid = state.currentUserUid;
    if (existing.userId && uid && existing.userId !== uid) {
      state.requestAlert({
        title: 'Read-only scenario',
        message:
          'This scenario was saved by someone else. You can load it (which makes a personal copy) but only its owner can delete it.',
        tone: 'warning',
      });
      return;
    }
    const configs = state.savedConfigs.filter((c) => c.id !== id);
    const lastCleared = state.lastSavedConfigId === id;
    set({
      savedConfigs: configs,
      activeConfigId: state.activeConfigId === id ? null : state.activeConfigId,
      activeConfigName: state.activeConfigId === id ? null : state.activeConfigName,
      lastSavedConfigId: lastCleared ? null : state.lastSavedConfigId,
      lastSavedConfigName: lastCleared ? null : state.lastSavedConfigName,
    });
    saveToStorage(configs);
    if (lastCleared) saveLastSavedConfig(null);
    try {
      await deleteServerConfig(id);
    } catch (err) {
      get().requestAlert({
        title: 'Could not delete from the shared list',
        message: (err as Error).message,
        tone: 'error',
      });
    }
  },

  renameConfig: async (id: string, newName: string) => {
    const state = get();
    const existing = state.savedConfigs.find((c) => c.id === id);
    if (!existing) return;
    // Owner-only rename — same predicate as updateConfig / deleteConfig.
    const uid = state.currentUserUid;
    if (existing.userId && uid && existing.userId !== uid) {
      state.requestAlert({
        title: 'Read-only scenario',
        message:
          'This scenario was saved by someone else. Only its owner can rename it.',
        tone: 'warning',
      });
      return;
    }
    // Revision 5 — construct the payload from `existing`, never from form
    // state. The new `name` is the only field that should change.
    const renamed: SavedConfiguration = { ...existing, name: newName };
    if (!renamed.userId && uid) renamed.userId = uid;
    if (!renamed.ownerDisplayName) {
      renamed.ownerDisplayName = resolveOwnerDisplayName(state);
    }
    const configs = state.savedConfigs.map((c) => (c.id === id ? renamed : c));
    const lastChanged = state.lastSavedConfigId === id;
    set({
      savedConfigs: configs,
      activeConfigName: state.activeConfigId === id ? newName : state.activeConfigName,
      lastSavedConfigName: lastChanged ? newName : state.lastSavedConfigName,
    });
    saveToStorage(configs);
    if (lastChanged) saveLastSavedConfig({ id, name: newName });
    try {
      await pushServerConfig(renamed);
    } catch (err) {
      get().requestAlert({
        title: 'Could not rename in the shared list',
        message: (err as Error).message,
        tone: 'error',
      });
    }
  },

  // Merge incoming saved scenarios into the store. Same id ⇒ overwrite if the
  // incoming version is newer (by savedAt); different id ⇒ append. Returns
  // counts so the caller can show feedback.
  //
  // Revision 4 — ownership semantics on import:
  //   - If the importer is the original owner of the incoming doc
  //     (incoming.userId === currentUid && !incoming.copiedFrom), preserve
  //     `published` (they're restoring their own backup; if it was shared
  //     before, keep it shared).
  //   - Otherwise re-stamp `userId` and `ownerDisplayName` from the current
  //     identity, reset `published: false`, and clear `copiedFrom` (an
  //     import from a backup is NOT a copy-on-load with provenance).
  //   - If the importer is signed out, drop docs that have a userId set —
  //     we cannot write them under the rules without ownership.
  importConfigs: (incoming: SavedConfiguration[]) => {
    const state = get();
    const uid = state.currentUserUid;
    const ownerDisplayName = uid ? resolveOwnerDisplayName(state) : null;
    const byId = new Map(state.savedConfigs.map((c) => [c.id, c]));
    let added = 0;
    let updated = 0;
    const toPush: SavedConfiguration[] = [];
    for (const inc of incoming) {
      if (!inc || typeof inc !== 'object' || !inc.id || !inc.name) continue;
      const isOwnBackup =
        !!uid && inc.userId === uid && !inc.copiedFrom;
      let normalised: SavedConfiguration;
      if (isOwnBackup) {
        normalised = {
          ...inc,
          userId: uid!,
          ownerDisplayName: inc.ownerDisplayName ?? ownerDisplayName ?? 'Unknown',
          published: inc.published ?? false,
          copiedFrom: inc.copiedFrom ?? null,
        };
      } else if (uid) {
        normalised = {
          ...inc,
          userId: uid,
          ownerDisplayName: ownerDisplayName ?? 'Unknown',
          published: false,
          copiedFrom: null,
        };
      } else {
        // Signed-out import: skip docs that originated from a foreign
        // owner (we can't re-stamp), but keep legacy local-only docs.
        if (inc.userId) continue;
        normalised = inc;
      }
      const existing = byId.get(inc.id);
      if (!existing) {
        byId.set(inc.id, normalised);
        added++;
        if (uid) toPush.push(normalised);
      } else if ((inc.savedAt ?? 0) > (existing.savedAt ?? 0)) {
        byId.set(inc.id, normalised);
        updated++;
        if (uid) toPush.push(normalised);
      }
    }
    const configs = Array.from(byId.values());
    set({ savedConfigs: configs });
    saveToStorage(configs);
    if (toPush.length > 0) bulkServerConfigs(toPush);
    return { added, updated };
  },
}));

// Dev-only: expose store on window so browser eval / DevTools can call
// updateTemplate, saveConfig, etc. for migration and debugging.
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as unknown as Record<string, unknown>).__modelStore = useModelStore;
}
