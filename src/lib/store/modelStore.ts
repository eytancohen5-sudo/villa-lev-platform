import { create } from 'zustand';
import {
  ModelAssumptions,
  ModelOutput,
  FinancingPath,
  PropertyTemplate,
  ProjectAllocation,
  PropertyConfig,
  PropertyOpex,
  RoomAreaBreakdown,
} from '../engine/types';
import {
  BASE_CASE,
  BUILT_IN_TEMPLATES,
  DEFAULT_PROJECTS,
  DEFAULT_ROOM_AREAS,
  DEFAULT_VILLA,
  DEFAULT_SUITE,
  resolvePortfolio,
} from '../engine/defaults';
import { computeModel } from '../engine/model';
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
  return {
    ...tpl,
    roomAreas,
    villaUnits: villaUnitsCount,
    standardSuites: tpl.standardSuites ?? builtIn?.standardSuites ?? 0,
    doubleSuites: tpl.doubleSuites ?? builtIn?.doubleSuites ?? 0,
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
} from 'firebase/firestore';

async function fetchServerConfigs(): Promise<SavedConfiguration[] | null> {
  const db = getDb();
  if (!db) return null;
  try {
    const snap = await getDocs(collection(db, SCENARIOS_COLLECTION));
    const out: SavedConfiguration[] = [];
    snap.forEach((d) => out.push(d.data() as SavedConfiguration));
    return out;
  } catch (err) {
    console.warn('[scenarios] fetch failed; using local cache', err);
    return null;
  }
}

async function pushServerConfig(config: SavedConfiguration): Promise<void> {
  const db = getDb();
  if (!db) return;
  try {
    await setDoc(doc(db, SCENARIOS_COLLECTION, config.id), config);
  } catch (err) {
    console.warn('[scenarios] push failed; will rely on local cache', err);
  }
}

async function deleteServerConfig(id: string): Promise<void> {
  const db = getDb();
  if (!db) return;
  try {
    await deleteDoc(doc(db, SCENARIOS_COLLECTION, id));
  } catch (err) {
    console.warn('[scenarios] delete failed; will rely on local cache', err);
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
    const merged = deepMerge(
      BASE_CASE as unknown as Record<string, unknown>,
      raw as Record<string, unknown>
    ) as unknown as ModelAssumptions;
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
      opex: {
        housekeeping: oldOpexA.housekeeping ?? DEFAULT_VILLA.opex.housekeeping,
        maintenance: oldOpexA.maintenance ?? DEFAULT_VILLA.opex.maintenance,
        utilities: oldOpexA.utilities ?? DEFAULT_VILLA.opex.utilities,
        insurance: oldOpexA.insurance ?? DEFAULT_VILLA.opex.insurance,
        propertyTax: oldOpexA.propertyTax ?? DEFAULT_VILLA.opex.propertyTax,
        marketing: oldOpexA.marketing ?? DEFAULT_VILLA.opex.marketing,
        managementFee: oldOpexA.managementFee ?? DEFAULT_VILLA.opex.managementFee,
        consumables: oldOpexA.consumables ?? DEFAULT_VILLA.opex.consumables,
        accounting: oldOpexA.accounting ?? DEFAULT_VILLA.opex.accounting,
      },
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
      opex: {
        housekeeping: oldOpexB.housekeeping ?? DEFAULT_SUITE.opex.housekeeping,
        maintenance: oldOpexB.maintenance ?? DEFAULT_SUITE.opex.maintenance,
        utilities: oldOpexB.utilities ?? DEFAULT_SUITE.opex.utilities,
        insurance: oldOpexB.insurance ?? DEFAULT_SUITE.opex.insurance,
        propertyTax: oldOpexB.propertyTax ?? DEFAULT_SUITE.opex.propertyTax,
        marketing: oldOpexB.marketing ?? DEFAULT_SUITE.opex.marketing,
        managementFee: oldOpexB.managementFee ?? DEFAULT_SUITE.opex.managementFee,
        consumables: oldOpexB.consumables ?? DEFAULT_SUITE.opex.consumables,
        accounting: oldOpexB.accounting ?? DEFAULT_SUITE.opex.accounting,
      },
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
//   - /investor, /pitch route layouts (always 'bank')
//   - admin "Bank view" toggle (admin opts into 'bank' on /admin/*)
//   - useEffectiveAuth bridge for View-As-Banker impersonation
// `null` = honour assumptions.viewMode (which defaults to 'internal').
export type ViewModeOverride = 'internal' | 'bank' | null;

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
  acceptSaveSuggestion: (name: string) => void;
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
  // Per-villa interior rooms (bedrooms, bathrooms, etc. inside one villa)
  addVillaRoom: (tplId: string) => void;
  updateVillaRoom: (tplId: string, roomId: string, key: 'name' | 'count' | 'area', value: string | number) => void;
  removeVillaRoom: (tplId: string, roomId: string) => void;

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
  saveConfig: (name: string) => void;
  updateConfig: (id: string) => void;
  loadConfig: (id: string) => void;
  deleteConfig: (id: string) => void;
  renameConfig: (id: string, newName: string) => void;
  importConfigs: (incoming: SavedConfiguration[]) => { added: number; updated: number };
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

  acceptSaveSuggestion: (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    get().saveConfig(trimmed);
    set({ saveModalOpen: false, editsSinceLastSave: 0 });
  },

  acceptUpdateExisting: () => {
    const { lastSavedConfigId } = get();
    if (!lastSavedConfigId) return;
    get().updateConfig(lastSavedConfigId);
    set({ saveModalOpen: false, editsSinceLastSave: 0 });
  },

  dismissSaveModal: (disablePermanently?: boolean) => {
    if (disablePermanently) {
      saveSavePromptDisabled(true);
      set({ saveModalOpen: false, editsSinceLastSave: 0, savePromptDismissed: true, savePromptDisabled: true });
    } else {
      set({ saveModalOpen: false, editsSinceLastSave: 0, savePromptDismissed: true });
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
    set({ history: newHistory, activeConfigId: null });
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
    const assumptions = { ...state.assumptions, portfolio };
    // Apply viewMode override (banker routes, admin toggle, banker
    // impersonation). When null we fall through to assumptions.viewMode
    // (which defaults to 'internal' via BASE_CASE).
    const computed = state.viewModeOverride
      ? computeModel({ ...assumptions, viewMode: state.viewModeOverride })
      : computeModel(assumptions);
    set({ assumptions, model: computed, loading: false, computeTimeMs: computed.computeTimeMs });
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

    const projects = savedProjects ?? DEFAULT_PROJECTS.map((p) => ({ ...p }));

    const savePromptDisabled = loadSavePromptDisabled();
    const lastSaved = loadLastSavedConfig();
    // Don't restore lastSaved if that config no longer exists
    const stillExists = lastSaved && configs.some((c) => c.id === lastSaved.id);

    set({
      assumptions,
      savedConfigs: configs,
      templates: allTemplates,
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
    });
    get().recompute();

    // Background-fetch shared scenarios from the server and merge them in.
    // Server wins for matching ids when its savedAt is newer; otherwise local
    // entries are preserved. After merge we push the union back so the server
    // ends up holding any local-only entries the user had.
    fetchServerConfigs().then(async (serverConfigs) => {
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
      const merged = Array.from(byId.values());
      if (changed) {
        set({ savedConfigs: merged });
        saveToStorage(merged);
      }
      // Push any local-only entries up to the server so everyone connecting sees them.
      const serverIds = new Set(serverConfigs.map((c) => c.id));
      const localOnly = local.filter((c) => !serverIds.has(c.id));
      if (localOnly.length > 0) {
        await bulkServerConfigs(merged);
      }
    });
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

  saveConfig: (name: string) => {
    const id = crypto.randomUUID();
    const state = get();
    const config: SavedConfiguration = {
      id,
      name,
      assumptions: JSON.parse(JSON.stringify(state.assumptions)),
      templates: JSON.parse(JSON.stringify(state.templates)),
      projects: JSON.parse(JSON.stringify(state.projects)),
      savedAt: Date.now(),
    };
    const configs = [...state.savedConfigs, config];
    set({
      savedConfigs: configs,
      activeConfigId: id,
      activeConfigName: name,
      lastSavedConfigId: id,
      lastSavedConfigName: name,
      editsSinceLastSave: 0,
    });
    saveToStorage(configs);
    saveLastSavedConfig({ id, name });
    pushServerConfig(config);
  },

  updateConfig: (id: string) => {
    const state = get();
    const existing = state.savedConfigs.find((c) => c.id === id);
    if (!existing) return;
    const updated: SavedConfiguration = {
      ...existing,
      assumptions: JSON.parse(JSON.stringify(state.assumptions)),
      templates: JSON.parse(JSON.stringify(state.templates)),
      projects: JSON.parse(JSON.stringify(state.projects)),
      savedAt: Date.now(),
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
    pushServerConfig(updated);
  },

  loadConfig: (id: string) => {
    const config = get().savedConfigs.find((c) => c.id === id);
    if (!config) return;

    // Backfill schema fields added since the config was saved (e.g. exitEbitdaMultiple),
    // mirroring the init() merge so old scenarios don't render with undefined props.
    const mergedAssumptions = deepMerge(
      {
        ...BASE_CASE,
        portfolio: BASE_CASE.portfolio.map((p) => ({ ...p, opex: { ...p.opex } })),
      } as unknown as Record<string, unknown>,
      (config.assumptions ?? {}) as unknown as Record<string, unknown>,
    ) as unknown as ModelAssumptions;

    // If config has templates+projects, use them
    if (config.projects && config.projects.length > 0) {
      const savedTemplates = config.templates ?? [];
      const allTemplates = [
        ...BUILT_IN_TEMPLATES.map((bt) => {
          const saved = savedTemplates.find((st) => st.id === bt.id);
          return saved ? ensureRoomAreas({ ...saved, builtIn: true as const }) : bt;
        }),
        ...savedTemplates
          .filter((st) => !BUILT_IN_TEMPLATES.some((bt) => bt.id === st.id))
          .map(ensureRoomAreas),
      ];
      set({
        assumptions: mergedAssumptions,
        templates: allTemplates,
        projects: config.projects,
        activeConfigId: id,
        activeConfigName: config.name,
        lastSavedConfigId: id,
        lastSavedConfigName: config.name,
      });
      saveTemplatesToStorage(allTemplates);
      saveAssumptionsToStorage(mergedAssumptions);
      saveProjectsToStorage(config.projects);
      saveLastSavedConfig({ id, name: config.name });
    } else {
      // Legacy config: migrate portfolio to projects
      const migrated = migrateToPortfolio(mergedAssumptions);
      const projects: ProjectAllocation[] = migrated.portfolio.map((p) => ({
        id: p.id || generateId('proj'),
        templateId: p.villaUnits > 0 ? 'tpl-twin-villa' : 'tpl-boutique-suite',
        name: p.name,
        count: p.count,
      }));
      set({
        assumptions: migrated,
        projects,
        activeConfigId: id,
        activeConfigName: config.name,
        lastSavedConfigId: id,
        lastSavedConfigName: config.name,
      });
      saveAssumptionsToStorage(migrated);
      saveProjectsToStorage(projects);
      saveLastSavedConfig({ id, name: config.name });
    }
    get().recompute();
  },

  deleteConfig: (id: string) => {
    const state = get();
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
    deleteServerConfig(id);
  },

  renameConfig: (id: string, newName: string) => {
    const state = get();
    const configs = state.savedConfigs.map((c) =>
      c.id === id ? { ...c, name: newName } : c
    );
    const lastChanged = state.lastSavedConfigId === id;
    set({
      savedConfigs: configs,
      activeConfigName: state.activeConfigId === id ? newName : state.activeConfigName,
      lastSavedConfigName: lastChanged ? newName : state.lastSavedConfigName,
    });
    saveToStorage(configs);
    if (lastChanged) saveLastSavedConfig({ id, name: newName });
    const renamed = configs.find((c) => c.id === id);
    if (renamed) pushServerConfig(renamed);
  },

  // Merge incoming saved scenarios into the store. Same id ⇒ overwrite if the
  // incoming version is newer (by savedAt); different id ⇒ append. Returns
  // counts so the caller can show feedback.
  importConfigs: (incoming: SavedConfiguration[]) => {
    const state = get();
    const byId = new Map(state.savedConfigs.map((c) => [c.id, c]));
    let added = 0;
    let updated = 0;
    for (const inc of incoming) {
      if (!inc || typeof inc !== 'object' || !inc.id || !inc.name) continue;
      const existing = byId.get(inc.id);
      if (!existing) {
        byId.set(inc.id, inc);
        added++;
      } else if ((inc.savedAt ?? 0) > (existing.savedAt ?? 0)) {
        byId.set(inc.id, inc);
        updated++;
      }
    }
    const configs = Array.from(byId.values());
    set({ savedConfigs: configs });
    saveToStorage(configs);
    bulkServerConfigs(configs);
    return { added, updated };
  },
}));
