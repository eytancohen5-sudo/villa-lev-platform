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

interface ModelStore {
  assumptions: ModelAssumptions;
  model: ModelOutput | null;
  loading: boolean;
  computeTimeMs: number;
  activeScenario: ScenarioName;

  setAssumption: (path: string, value: unknown) => void;
  setFinancingPath: (path: FinancingPath) => void;
  setActiveScenario: (scenario: ScenarioName) => void;
  toggleGrant: (enabled: boolean) => void;
  toggleRRF: (enabled: boolean) => void;
  resetToDefaults: () => void;
  recompute: () => void;
  init: () => void;
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

export const useModelStore = create<ModelStore>((set, get) => ({
  assumptions: { ...BASE_CASE },
  model: null,
  loading: false,
  computeTimeMs: 0,
  activeScenario: 'realistic' as ScenarioName,

  setAssumption: (path: string, value: unknown) => {
    const current = get().assumptions;
    const updated = setNestedValue(
      current as unknown as Record<string, unknown>,
      path,
      value
    ) as unknown as ModelAssumptions;
    set({ assumptions: updated });
    get().recompute();
  },

  setActiveScenario: (scenario: ScenarioName) => {
    set({ activeScenario: scenario });
  },

  setFinancingPath: (path: FinancingPath) => {
    set((state) => ({
      assumptions: { ...state.assumptions, financingPath: path },
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
    }));
    get().recompute();
  },

  resetToDefaults: () => {
    set({ assumptions: { ...BASE_CASE } });
    get().recompute();
  },

  recompute: () => {
    set({ loading: true });
    const a = get().assumptions;
    const model = computeModel(a);
    set({ model, loading: false, computeTimeMs: model.computeTimeMs });
  },

  init: () => {
    get().recompute();
  },
}));
