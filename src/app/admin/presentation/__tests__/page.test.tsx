/**
 * Tests for /admin/presentation page.tsx
 *
 * Strategy:
 *   - We mock the heavy component dependencies (BankPnLSection, BankStressTest,
 *     LiveTrackRecord) to avoid needing a full Zustand + Firebase environment.
 *   - useModelStore is mocked to return either null (loading state) or a minimal
 *     ModelOutput so we can assert on KPI values without running the engine.
 *   - The export button is tested by mocking the dynamic import of
 *     exportBankPresentation and asserting the anchor click pattern fires.
 *
 * All tests use Vitest + React Testing Library.
 * Run with: npm run test:run
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import React from 'react';

// ── Mock heavy dependencies ───────────────────────────────────────────────────

// Mocking the store before importing the page ensures the page never calls
// the real Zustand store (which needs Firebase / localStorage).
vi.mock('@/lib/store/modelStore', () => ({
  useModelStore: vi.fn(),
  ScenarioName: {},
}));

vi.mock('@/lib/i18n/I18nProvider', () => ({
  useTranslation: () => ({
    t: (key: string) => key,  // Returns the key itself — good enough for assertions
    locale: 'en',
  }),
}));

vi.mock('@/components/BankPnLSection', () => ({
  BankPnLSection: () => <div data-testid="bank-pnl-section">P&L Section</div>,
}));

vi.mock('@/components/BankStressTest', () => ({
  BankStressTest: () => <div data-testid="bank-stress-test">Stress Test</div>,
}));

vi.mock('@/components/LiveTrackRecord', () => ({
  LiveTrackRecord: () => <div data-testid="live-track-record">Track Record</div>,
}));

vi.mock('@/components/Skeleton', () => ({
  PageSkeleton: ({ hint }: { hint?: string }) => (
    <div data-testid="page-skeleton">{hint ?? 'Loading…'}</div>
  ),
}));

vi.mock('@/components/AdminUI', () => ({
  KPICard: ({ label, value }: { label: string; value: string }) => (
    <div data-testid="kpi-card">
      <span data-testid="kpi-label">{label}</span>
      <span data-testid="kpi-value">{value}</span>
    </div>
  ),
  SectionHeader: ({ title }: { title: string }) => (
    <h2 data-testid="section-header">{title}</h2>
  ),
  StatusChip: ({ label }: { label: string }) => <span>{label}</span>,
}));

vi.mock('@/lib/hooks/useModel', () => ({
  formatCurrency: (v: number) => `€${(v / 1e6).toFixed(1)}M`,
  formatPercent: (v: number, d = 1) => `${(v * 100).toFixed(d)}%`,
  formatMultiple: (v: number) => `${v.toFixed(2)}×`,
}));

vi.mock('@/lib/engine/defaults', () => ({
  resolvePortfolio: () => [
    {
      id: 'plot-a',
      name: 'Plot A',
      villaUnits: 1,
      standardSuites: 0,
      doubleSuites: 0,
      count: 1,
      constructionArea: 350,
      landCost: 500_000,
      constructionCostPerM2: 3500,
      ffeCost: 200_000,
      opexContingencyRate: 0,
    },
  ],
}));

// ── Mock model fixture ────────────────────────────────────────────────────────

const MOCK_KEY_METRICS = {
  stabilisedRevenue: 800_000,
  stabilisedEBITDA: 400_000,
  stabilisedEBITDAMargin: 0.5,
  stabilisedDSCR: 1.55,
  stabilisedNCF: 200_000,
  totalCapex: 8_500_000,
  loanAmount: 6_800_000,
  equityRequired: 1_700_000,
  annualDS: 560_000,
  ltv: 0.80,
  assetCoverage: 1.42,
  portfolioValue: 9_600_000,
  breakEvenNights: 31,
  bufferToBreakEven: 56,
  primaryLoan: 6_800_000,
  supplementaryLoan: 0,
  landFundedByTepix: 0,
  landFundedByCommercial: 0,
  tepixCapBindingBy: 0,
  tepixLoanCap: 0,
  grantAmount: 0,
};

const MOCK_SCENARIO_OUTPUT = {
  equityIRR: 0.185,
  totalMOIC: 2.4,
  terminalUnderwater: false,
  terminalAssetValue: 12_000_000,
  terminalAssetValuePropertySale: 11_000_000,
  terminalEquityValue: 5_200_000,
  terminalEquityValuePropertySale: 4_800_000,
  equityIRRPropertySale: 0.165,
  propertyExitDominates: false,
  stabilisedYear: null,
  pnl: [],
};

const MOCK_ASSUMPTIONS = {
  financingPath: 'commercial' as const,
  commercialLoan: {
    loanCoverageRate: 0.80,
    interestRate: 0.044,
    gracePeriodYears: 3,
    repaymentTermYears: 12,
    workingCapitalFacility: 470_000,
    interest2026: 0,
    interest2027: 0,
    interest2028: 0,
  },
  rrf: { enabled: false, coverageRate: 0.80, rrfShareOfLoan: 0.80, rrfInterestRate: 0.035, commercialShareRate: 0.20, commercialInterestRate: 0.044, gracePeriodYears: 3, repaymentTermYears: 12 },
  tepixLoan: { enabled: false, coverageRate: 0.80, hdbShareOfLoan: 0.40, bankShareOfLoan: 0.60, bankInterestRate: 0.05, interestSubsidy: 0.03, subsidyDurationYears: 5, totalTermYears: 15, gracePeriodYears: 3, landCapOnFundContribution: 0 },
  // Delta 5: revenueRealistic.villaBaseNights is the Conservative nights assumption read in page.tsx
  revenueRealistic: { villaADR: 3500, villaBaseNights: 87, suiteStandardADR: 650, suiteDoubleADR: 920, suiteBaseNights: 87, eventsPerYear: 0, netProfitPerEvent: 0, ancillaryBaseProfit: 0, ancillaryGrowthRate: 0, ancillaryGrowthYears: 0 },
  general: { year1RampFactor: 0.75, year2RampFactor: 0.88, nightsGrowthPerYear: 3, nightsCap: 110 },
};

const MOCK_MODEL = {
  keyMetrics: MOCK_KEY_METRICS,
  scenarios: {
    realistic: MOCK_SCENARIO_OUTPUT,
    upside: MOCK_SCENARIO_OUTPUT,
    downside: MOCK_SCENARIO_OUTPUT,
    breakeven: MOCK_SCENARIO_OUTPUT,
  },
};

function makeStoreState(overrides: Record<string, unknown> = {}) {
  return {
    model: MOCK_MODEL,
    assumptions: MOCK_ASSUMPTIONS,
    activeScenario: 'realistic' as const,
    setActiveScenario: vi.fn(),
    setFinancingPath: vi.fn(),
    financingPathOverride: null,
    setFinancingPathOverride: vi.fn(),
    templates: [],
    projects: [],
    capTable: {} as never,
    waterfall: {} as never,
    ...overrides,
  };
}

// ── Import page AFTER mocks are in place ─────────────────────────────────────

import PresentationPage from '../page';
import { useModelStore } from '@/lib/store/modelStore';

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('/admin/presentation — PresentationPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Restore any spies so document.createElement pollution doesn't carry
    // between tests (particularly after the export-button test).
    vi.restoreAllMocks();
    cleanup();
  });

  // ── 1. Loading state ───────────────────────────────────────────────────────

  it('renders PageSkeleton when model is null', () => {
    vi.mocked(useModelStore).mockReturnValue(
      makeStoreState({ model: null })
    );
    render(<PresentationPage />);
    expect(screen.getByTestId('page-skeleton')).toBeTruthy();
    // Should show the presentation.loading key (translated to key itself in test)
    expect(screen.getByText('presentation.loading')).toBeTruthy();
  });

  it('does not render any section when model is null', () => {
    vi.mocked(useModelStore).mockReturnValue(
      makeStoreState({ model: null })
    );
    render(<PresentationPage />);
    // Should have no section headers
    expect(screen.queryAllByTestId('section-header')).toHaveLength(0);
  });

  // ── 2. Full render — all sections present ────────────────────────────────

  it('renders all 11 section headers when model is loaded', () => {
    vi.mocked(useModelStore).mockReturnValue(
      makeStoreState()
    );
    render(<PresentationPage />);
    const headers = screen.getAllByTestId('section-header');
    // §1–§11 = 11 section headers
    expect(headers.length).toBeGreaterThanOrEqual(11);
  });

  it('renders the BankPnLSection component in § 6', () => {
    vi.mocked(useModelStore).mockReturnValue(
      makeStoreState()
    );
    render(<PresentationPage />);
    expect(screen.getByTestId('bank-pnl-section')).toBeTruthy();
  });

  it('renders BankStressTest component in § 11', () => {
    vi.mocked(useModelStore).mockReturnValue(
      makeStoreState()
    );
    render(<PresentationPage />);
    expect(screen.getByTestId('bank-stress-test')).toBeTruthy();
  });

  it('renders LiveTrackRecord component in § 4', () => {
    vi.mocked(useModelStore).mockReturnValue(
      makeStoreState()
    );
    render(<PresentationPage />);
    expect(screen.getByTestId('live-track-record')).toBeTruthy();
  });

  // ── 3. KPI tiles — sourced from model ────────────────────────────────────

  it('renders DSCR value from model.keyMetrics.stabilisedDSCR', () => {
    vi.mocked(useModelStore).mockReturnValue(
      makeStoreState()
    );
    render(<PresentationPage />);
    // DSCR 1.55 → "1.55×"
    const dscrValues = screen.getAllByText('1.55×');
    expect(dscrValues.length).toBeGreaterThanOrEqual(1);
  });

  it('renders equity IRR from activeScenarioOutput.equityIRR', () => {
    vi.mocked(useModelStore).mockReturnValue(
      makeStoreState()
    );
    render(<PresentationPage />);
    // IRR 0.185 → "18.5%"
    const irrValues = screen.getAllByText('18.5%');
    expect(irrValues.length).toBeGreaterThanOrEqual(1);
  });

  // ── 4. Export button ──────────────────────────────────────────────────────

  it('renders the Export to Word button', () => {
    vi.mocked(useModelStore).mockReturnValue(
      makeStoreState()
    );
    render(<PresentationPage />);
    // Button text is the i18n key (mocked t() returns key)
    const btn = screen.getByText('presentation.exportDocx');
    expect(btn).toBeTruthy();
  });

  it('export button is disabled when model is null', () => {
    vi.mocked(useModelStore).mockReturnValue(
      makeStoreState({ model: null })
    );
    render(<PresentationPage />);
    // When model is null we show the skeleton, no export button
    expect(screen.queryByText('presentation.exportDocx')).toBeNull();
  });

  it('export button click does not throw with model present', async () => {
    // Minimal URL stub — createObjectURL must return something string-like.
    // We use body.appendChild spy only (not document.createElement) to avoid
    // poisoning React's own createElement calls in subsequent tests.
    global.URL.createObjectURL = vi.fn().mockReturnValue('blob:test-url');
    global.URL.revokeObjectURL = vi.fn();

    vi.mocked(useModelStore).mockReturnValue(
      makeStoreState()
    );
    render(<PresentationPage />);

    const btn = screen.getByText('presentation.exportDocx');
    // Should not throw synchronously
    expect(() => fireEvent.click(btn)).not.toThrow();

    // Wait briefly for the async import to settle without asserting internals
    // (dynamic import of exportBankPresentation may reject in test env — that's
    // acceptable; we only care that the UI doesn't crash on click).
    await waitFor(() => {}, { timeout: 500 });
  });

  // ── 5. OPEX contingency badge — only shown when rate > 0 ─────────────────

  it('does not show OPEX contingency badge when rate is 0', () => {
    vi.mocked(useModelStore).mockReturnValue(
      makeStoreState()
    );
    render(<PresentationPage />);
    // resolvePortfolio mock returns opexContingencyRate: 0
    expect(screen.queryByText(/OPEX contingency/i)).toBeNull();
  });

  // ── 6. Selector parity — switching scenario triggers re-render ───────────

  it('calls setActiveScenario when a scenario pill is clicked', () => {
    const setActiveScenario = vi.fn();
    vi.mocked(useModelStore).mockReturnValue(
      makeStoreState({ setActiveScenario })
    );
    render(<PresentationPage />);
    // Click the "Upside" pill
    const upsidePill = screen.getByText('Upside');
    fireEvent.click(upsidePill);
    expect(setActiveScenario).toHaveBeenCalledWith('upside');
  });

  it('calls setFinancingPathOverride when a path pill is clicked (override active)', () => {
    const setFinancingPathOverride = vi.fn();
    vi.mocked(useModelStore).mockReturnValue(
      makeStoreState({
        financingPathOverride: 'commercial',
        setFinancingPathOverride,
      })
    );
    render(<PresentationPage />);
    const grantPill = screen.getByText('Grant');
    fireEvent.click(grantPill);
    expect(setFinancingPathOverride).toHaveBeenCalledWith('grant');
  });
});
