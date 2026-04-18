import { create } from 'zustand';
import { ModelAssumptions, ModelOutput, FinancingPath } from '../engine/types';
import { BASE_CASE } from '../engine/defaults';
import { computeModel } from '../engine/model';

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

export type ScenarioName = 'realistic' | 'upside' | 'downside' | 'breakeven';

export interface SavedConfiguration {
  id: string;
  name: string;
  assumptions: ModelAssumptions;
  savedAt: number;
}

const STORAGE_KEY = 'villa-lev-saved-configs';

interface ModelStore {
  assumptions: ModelAssumptions;
  model: ModelOutput | null;
  loading: boolean;
  computeTimeMs: number;
  activeScenario: ScenarioName;

  // Saved configurations
  savedConfigs: SavedConfiguration[];
  activeConfigId: string | null;
  activeConfigName: string | null;

  setAssumption: (path: string, value: unknown) => void;
  setFinancingPath: (path: FinancingPath) => void;
  setActiveScenario: (scenario: ScenarioName) => void;
  toggleGrant: (enabled: boolean) => void;
  toggleRRF: (enabled: boolean) => void;
  resetToDefaults: () => void;
  recompute: () => void;
  init: () => void;

  // Config management
  saveConfig: (name: string) => void;
  loadConfig: (id: string) => void;
  deleteConfig: (id: string) => void;
  renameConfig: (id: string, newName: string) => void;
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
  } catch {
    // storage full or unavailable
  }
}

export const useModelStore = create<ModelStore>((set, get) => ({
  assumptions: { ...BASE_CASE },
  model: null,
  loading: false,
  computeTimeMs: 0,
  activeScenario: 'realistic' as ScenarioName,
  savedConfigs: [],
  activeConfigId: null,
  activeConfigName: null,

  setAssumption: (path: string, value: unknown) => {
    const current = get().assumptions;
    const updated = setNestedValue(
      current as unknown as Record<string, unknown>,
      path,
      value
    ) as unknown as ModelAssumptions;
    set({ assumptions: updated, activeConfigId: null }); // Mark as modified
    get().recompute();
  },

  setActiveScenario: (scenario: ScenarioName) => {
    set({ activeScenario: scenario });
  },

  setFinancingPath: (path: FinancingPath) => {
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
    set({ assumptions: { ...BASE_CASE }, activeConfigId: null, activeConfigName: null });
    get().recompute();
  },

  recompute: () => {
    set({ loading: true });
    const a = get().assumptions;
    const model = computeModel(a);
    set({ model, loading: false, computeTimeMs: model.computeTimeMs });
  },

  init: () => {
    const configs = loadFromStorage();
    set({ savedConfigs: configs });
    get().recompute();
  },

  saveConfig: (name: string) => {
    const id = crypto.randomUUID();
    const config: SavedConfiguration = {
      id,
      name,
      assumptions: JSON.parse(JSON.stringify(get().assumptions)),
      savedAt: Date.now(),
    };
    const configs = [...get().savedConfigs, config];
    set({ savedConfigs: configs, activeConfigId: id, activeConfigName: name });
    saveToStorage(configs);
  },

  loadConfig: (id: string) => {
    const config = get().savedConfigs.find((c) => c.id === id);
    if (!config) return;
    // Deep merge with BASE_CASE for backward compat (new fields get defaults)
    const merged = deepMerge(
      BASE_CASE as unknown as Record<string, unknown>,
      config.assumptions as unknown as Record<string, unknown>
    ) as unknown as ModelAssumptions;
    set({ assumptions: merged, activeConfigId: id, activeConfigName: config.name });
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
