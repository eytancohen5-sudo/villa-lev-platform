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

// Ensure a template has a roomAreas object (migration for pre-roomAreas saves)
function ensureRoomAreas(tpl: PropertyTemplate): PropertyTemplate {
  if (tpl.roomAreas) return tpl;
  const builtIn = BUILT_IN_TEMPLATES.find((bt) => bt.id === tpl.id);
  const roomAreas: RoomAreaBreakdown = builtIn
    ? { ...builtIn.roomAreas }
    : { ...DEFAULT_ROOM_AREAS };
  return { ...tpl, roomAreas };
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

// ── Storage ──

const STORAGE_KEY = 'villa-lev-saved-configs';
const TEMPLATES_STORAGE_KEY = 'villa-lev-templates';
const HISTORY_STORAGE_KEY = 'villa-lev-history';
const USER_STORAGE_KEY = 'villa-lev-current-user';
const HISTORY_MAX = 200;

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

interface ModelStore {
  assumptions: ModelAssumptions;
  model: ModelOutput | null;
  loading: boolean;
  computeTimeMs: number;
  activeScenario: ScenarioName;

  // Templates & Projects
  templates: PropertyTemplate[];
  projects: ProjectAllocation[];

  // Saved configs
  savedConfigs: SavedConfiguration[];
  activeConfigId: string | null;
  activeConfigName: string | null;

  // Change history + user attribution
  history: ChangeEntry[];
  currentUser: string;
  setCurrentUser: (name: string) => void;
  revertChange: (id: string) => void;
  clearHistory: () => void;

  // Core actions
  setAssumption: (path: string, value: unknown, label?: string) => void;
  setFinancingPath: (path: FinancingPath) => void;
  setActiveScenario: (scenario: ScenarioName) => void;
  toggleGrant: (enabled: boolean) => void;
  toggleRRF: (enabled: boolean) => void;
  resetToDefaults: () => void;
  recompute: () => void;
  init: () => void;

  // Template management
  addTemplate: (type: 'villa' | 'suite' | 'mixed') => void;
  updateTemplate: (id: string, path: string, value: unknown, label?: string) => void;
  renameTemplate: (id: string, newName: string) => void;
  duplicateTemplate: (id: string) => void;
  deleteTemplate: (id: string) => void;

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
  loadConfig: (id: string) => void;
  deleteConfig: (id: string) => void;
  renameConfig: (id: string, newName: string) => void;
}

// ── Store ──

export const useModelStore = create<ModelStore>((set, get) => ({
  assumptions: { ...BASE_CASE, portfolio: BASE_CASE.portfolio.map((p) => ({ ...p, opex: { ...p.opex } })) },
  model: null,
  loading: false,
  computeTimeMs: 0,
  activeScenario: 'realistic' as ScenarioName,
  templates: [...BUILT_IN_TEMPLATES],
  projects: DEFAULT_PROJECTS.map((p) => ({ ...p })),
  savedConfigs: [],
  activeConfigId: null,
  activeConfigName: null,
  history: [],
  currentUser: 'You',

  setCurrentUser: (name: string) => {
    const trimmed = name.trim() || 'You';
    set({ currentUser: trimmed });
    saveUserToStorage(trimmed);
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
    } else if (entry.scope === 'portfolio' && entry.path === 'financingPath') {
      set((s) => ({ assumptions: { ...s.assumptions, financingPath: entry.before as FinancingPath } }));
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
    pushHistory(get, set, {
      scope: 'assumption',
      path,
      label: label ?? path,
      before,
      after: value,
    });
    get().recompute();
  },

  setActiveScenario: (scenario: ScenarioName) => {
    set({ activeScenario: scenario });
  },

  setFinancingPath: (path: FinancingPath) => {
    // Not recorded in history: financing path is trivially toggleable via the top bar.
    set((state) => ({
      assumptions: { ...state.assumptions, financingPath: path },
      activeConfigId: null,
    }));
    get().recompute();
  },

  toggleGrant: (enabled: boolean) => {
    set((state) => ({
      assumptions: {
        ...state.assumptions,
        financingPath: enabled ? 'grant' : 'commercial',
        grant: { ...state.assumptions.grant, enabled },
      },
      activeConfigId: null,
    }));
    get().recompute();
  },

  toggleRRF: (enabled: boolean) => {
    set((state) => ({
      assumptions: {
        ...state.assumptions,
        financingPath: enabled ? 'rrf' : 'commercial',
        rrf: { ...state.assumptions.rrf, enabled },
      },
      activeConfigId: null,
    }));
    get().recompute();
  },

  resetToDefaults: () => {
    set({
      assumptions: {
        ...BASE_CASE,
        portfolio: BASE_CASE.portfolio.map((p) => ({ ...p, opex: { ...p.opex } })),
      },
      templates: [...BUILT_IN_TEMPLATES],
      projects: DEFAULT_PROJECTS.map((p) => ({ ...p })),
      activeConfigId: null,
      activeConfigName: null,
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
    const model = computeModel(assumptions);
    set({ assumptions, model, loading: false, computeTimeMs: model.computeTimeMs });
  },

  init: () => {
    const configs = loadFromStorage();
    const savedTemplates = loadTemplatesFromStorage();
    const history = loadHistoryFromStorage();
    const currentUser = loadUserFromStorage();
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
    set({ savedConfigs: configs, templates: allTemplates, history, currentUser });
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
    get().recompute();
  },

  removeProject: (id: string) => {
    const projects = get().projects;
    if (projects.length <= 1) return;
    set({ projects: projects.filter((p) => p.id !== id), activeConfigId: null });
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
    pushHistory(get, set, {
      scope: 'project',
      scopeId: id,
      scopeLabel: prev?.name,
      path: 'count',
      label: 'Project unit count',
      before,
      after: count,
    });
    get().recompute();
  },

  changeProjectTemplate: (id: string, templateId: string) => {
    const tpl = get().templates.find((t) => t.id === templateId);
    if (!tpl) return;
    const projects = get().projects.map((p) =>
      p.id === id ? { ...p, templateId, name: tpl.name } : p
    );
    set({ projects, activeConfigId: null });
    get().recompute();
  },

  renameProject: (id: string, newName: string) => {
    const projects = get().projects.map((p) =>
      p.id === id ? { ...p, name: newName } : p
    );
    set({ projects, activeConfigId: null });
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
    set({ savedConfigs: configs, activeConfigId: id, activeConfigName: name });
    saveToStorage(configs);
  },

  loadConfig: (id: string) => {
    const config = get().savedConfigs.find((c) => c.id === id);
    if (!config) return;

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
        templates: allTemplates,
        projects: config.projects,
        activeConfigId: id,
        activeConfigName: config.name,
      });
      saveTemplatesToStorage(allTemplates);
    } else {
      // Legacy config: migrate portfolio to projects
      const migrated = migrateToPortfolio(config.assumptions);
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
      });
    }
    get().recompute();
  },

  deleteConfig: (id: string) => {
    const configs = get().savedConfigs.filter((c) => c.id !== id);
    set({
      savedConfigs: configs,
      activeConfigId: get().activeConfigId === id ? null : get().activeConfigId,
      activeConfigName: get().activeConfigId === id ? null : get().activeConfigName,
    });
    saveToStorage(configs);
  },

  renameConfig: (id: string, newName: string) => {
    const configs = get().savedConfigs.map((c) =>
      c.id === id ? { ...c, name: newName } : c
    );
    set({
      savedConfigs: configs,
      activeConfigName: get().activeConfigId === id ? newName : get().activeConfigName,
    });
    saveToStorage(configs);
  },
}));
