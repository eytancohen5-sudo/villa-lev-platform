import { create } from 'zustand';
import { ModelAssumptions, ModelOutput, FinancingPath, PropertyConfig, PropertyOpex } from '../engine/types';
import { BASE_CASE, DEFAULT_VILLA, DEFAULT_SUITE } from '../engine/defaults';
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

// Migrate old saved configs (fixed propertyA/B format) to new portfolio format
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function migrateToPortfolio(raw: any): ModelAssumptions {
  // If it already has a portfolio array, merge with BASE_CASE and return
  if (raw.portfolio && Array.isArray(raw.portfolio)) {
    const merged = deepMerge(
      BASE_CASE as unknown as Record<string, unknown>,
      raw as Record<string, unknown>
    ) as unknown as ModelAssumptions;
    return merged;
  }

  // Old format: convert properties + opex + numberOfPropertyA/B → portfolio[]
  const portfolio: PropertyConfig[] = [];

  if (raw.properties?.propertyA) {
    const oldA = raw.properties.propertyA;
    const oldOpexA = raw.opex?.propertyA ?? DEFAULT_VILLA.opex;
    portfolio.push({
      id: 'prop-a',
      name: oldA.name || 'Twin Villas',
      type: 'villa' as const,
      count: raw.numberOfPropertyA ?? 2,
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
      type: 'suite' as const,
      count: raw.numberOfPropertyB ?? 1,
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

  // If neither A nor B found, use defaults
  if (portfolio.length === 0) {
    portfolio.push({ ...DEFAULT_VILLA }, { ...DEFAULT_SUITE });
  }

  // Build migrated assumptions (strip old fields)
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
    tepixGuarantee: raw.tepixGuarantee ? deepMerge(BASE_CASE.tepixGuarantee as unknown as Record<string, unknown>, raw.tepixGuarantee) as unknown as typeof BASE_CASE.tepixGuarantee : BASE_CASE.tepixGuarantee,
    tax: raw.tax ? deepMerge(BASE_CASE.tax as unknown as Record<string, unknown>, raw.tax) as unknown as typeof BASE_CASE.tax : BASE_CASE.tax,
    acquisitionLegalPerPlot: raw.acquisitionLegalPerPlot ?? BASE_CASE.acquisitionLegalPerPlot,
    financingPath: raw.financingPath ?? BASE_CASE.financingPath,
  };

  return migrated;
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

  // Portfolio management
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

let idCounter = 0;
function generateId(): string {
  idCounter++;
  return `prop-${Date.now()}-${idCounter}`;
}

export const useModelStore = create<ModelStore>((set, get) => ({
  assumptions: { ...BASE_CASE, portfolio: BASE_CASE.portfolio.map((p) => ({ ...p, opex: { ...p.opex } })) },
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
    set({ assumptions: updated, activeConfigId: null });
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
    set({
      assumptions: {
        ...BASE_CASE,
        portfolio: BASE_CASE.portfolio.map((p) => ({ ...p, opex: { ...p.opex } })),
      },
      activeConfigId: null,
      activeConfigName: null,
    });
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

  // ── Portfolio Management ──

  addProperty: (type: 'villa' | 'suite') => {
    const template = type === 'villa' ? DEFAULT_VILLA : DEFAULT_SUITE;
    const current = get().assumptions;
    const existingCount = current.portfolio.filter((p) => p.type === type).length;
    const newProp: PropertyConfig = {
      ...template,
      opex: { ...template.opex },
      id: generateId(),
      name: `${type === 'villa' ? 'Villa' : 'Suite'} Property ${existingCount + 1}`,
      count: 1,
    };
    set({
      assumptions: {
        ...current,
        portfolio: [...current.portfolio, newProp],
      },
      activeConfigId: null,
    });
    get().recompute();
  },

  removeProperty: (id: string) => {
    const current = get().assumptions;
    if (current.portfolio.length <= 1) return; // Must keep at least one property
    set({
      assumptions: {
        ...current,
        portfolio: current.portfolio.filter((p) => p.id !== id),
      },
      activeConfigId: null,
    });
    get().recompute();
  },

  updateProperty: (id: string, path: string, value: unknown) => {
    const current = get().assumptions;
    const portfolio = current.portfolio.map((prop) => {
      if (prop.id !== id) return prop;
      // Handle nested paths like 'opex.housekeeping'
      if (path.includes('.')) {
        const keys = path.split('.');
        const updated = { ...prop };
        if (keys[0] === 'opex') {
          updated.opex = { ...updated.opex, [keys[1]]: value } as PropertyOpex;
        }
        return updated;
      }
      return { ...prop, [path]: value };
    });
    set({
      assumptions: { ...current, portfolio },
      activeConfigId: null,
    });
    get().recompute();
  },

  renameProperty: (id: string, newName: string) => {
    const current = get().assumptions;
    const portfolio = current.portfolio.map((prop) =>
      prop.id === id ? { ...prop, name: newName } : prop
    );
    set({
      assumptions: { ...current, portfolio },
      activeConfigId: null,
    });
  },

  // ── Config Management ──

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
    // Migrate old format if needed, then merge with defaults
    const migrated = migrateToPortfolio(config.assumptions);
    set({
      assumptions: migrated,
      activeConfigId: id,
      activeConfigName: config.name,
    });
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
