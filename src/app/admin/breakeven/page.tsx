"use client";

import { useModelStore } from "@/lib/store/modelStore";
import { formatCurrency, formatMultiple } from "@/lib/hooks/useModel";
import { useTranslation } from "@/lib/i18n/I18nProvider";
import { computeModel } from "@/lib/engine/model";
import { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ScatterChart,
  Scatter,
  ZAxis,
  Cell,
} from "recharts";

export default function BreakEvenPage() {
  const { t, locale } = useTranslation();
  const { assumptions, model } = useModelStore();

  const analysis = useMemo(() => {
    if (!model) return null;

    const annualDS = model.keyMetrics.annualDS;
    const totalOpex = 263500; // Stabilised OPEX
    const breakEvenRevenue = annualDS + totalOpex;

    // ── 1. Break-even by nights (holding ADR constant) ──
    // Total revenue = 2 × (nights × villaADR) + (2×nights×stdADR + 2×nights×dblADR) + events + ancillary
    // At break-even: revenue = DS + OPEX
    // Simplify: revenue per villa night across portfolio
    const a = assumptions.revenueRealistic;
    const revenuePerVillaNight = a.villaADR * 2; // 2 villa projects
    const revenuePerSuiteNight = 2 * a.suiteStandardADR + 2 * a.suiteDoubleADR; // 4 suites
    const fixedRevenue =
      a.eventsPerYear * a.netProfitPerEvent +
      a.ancillaryBaseProfit * Math.pow(1 + a.ancillaryGrowthRate, 3); // ~2031 ancillary

    // Break-even nights (assuming villa and suite nights are equal)
    const revenuePerNight = revenuePerVillaNight + revenuePerSuiteNight;
    const breakEvenNights = Math.ceil(
      (breakEvenRevenue - fixedRevenue) / revenuePerNight
    );

    // Nights sweep for chart
    const nightsSweep = [];
    for (let n = 30; n <= 120; n += 5) {
      const rev = n * revenuePerNight + fixedRevenue;
      const ncf = rev - totalOpex - annualDS;
      const dscr = (rev - totalOpex) / annualDS;
      nightsSweep.push({
        nights: n,
        revenue: Math.round(rev),
        ncf: Math.round(ncf),
        dscr: Number(dscr.toFixed(2)),
        isBreakEven: Math.abs(n - breakEvenNights) <= 2,
      });
    }

    // ── 2. Break-even by ADR (holding nights constant at base) ──
    const baseNights = a.villaBaseNights + 3; // ~2031 stabilised with growth
    const baseSuiteNights = a.suiteBaseNights + 3;
    // Revenue = 2×(nights×ADR) + suite revenue + fixed
    // At break-even: 2×baseNights×ADR + suiteRev + fixed = DS + OPEX
    const suiteRevAtBase =
      (2 * a.suiteStandardADR + 2 * a.suiteDoubleADR) * baseSuiteNights;
    const breakEvenADR = Math.ceil(
      (breakEvenRevenue - suiteRevAtBase - fixedRevenue) /
        (2 * baseNights)
    );

    // ADR sweep
    const adrSweep = [];
    for (let adr = 1500; adr <= 5000; adr += 250) {
      const rev =
        2 * baseNights * adr + suiteRevAtBase + fixedRevenue;
      const ncf = rev - totalOpex - annualDS;
      const dscr = (rev - totalOpex) / annualDS;
      adrSweep.push({
        adr,
        revenue: Math.round(rev),
        ncf: Math.round(ncf),
        dscr: Number(dscr.toFixed(2)),
        isBreakEven: Math.abs(adr - breakEvenADR) <= 125,
      });
    }

    // ── 3. Combined heatmap: nights × ADR → DSCR ──
    const heatmapData: {
      nights: number;
      adr: number;
      dscr: number;
      ncf: number;
    }[] = [];
    const nightsRange = [50, 60, 70, 80, 85, 90, 95, 100, 105, 110];
    const adrRange = [2000, 2500, 3000, 3250, 3500, 3750, 4000, 4500];

    for (const n of nightsRange) {
      for (const adr of adrRange) {
        const rev =
          2 * n * adr +
          (2 * a.suiteStandardADR + 2 * a.suiteDoubleADR) * n +
          fixedRevenue;
        const ebitda = rev - totalOpex;
        const dscr = ebitda / annualDS;
        const ncf = ebitda - annualDS;
        heatmapData.push({
          nights: n,
          adr,
          dscr: Number(dscr.toFixed(2)),
          ncf: Math.round(ncf),
        });
      }
    }

    // ── 4. Break-even across financing paths ──
    const paths = (["commercial", "rrf", "grant"] as const).map((path) => {
      const m = computeModel({ ...assumptions, financingPath: path });
      const ds = m.keyMetrics.annualDS;
      const beRev = ds + totalOpex;
      const beNights = Math.ceil(
        (beRev - fixedRevenue) / revenuePerNight
      );
      const beADR = Math.ceil(
        (beRev - suiteRevAtBase - fixedRevenue) / (2 * baseNights)
      );
      return {
        path:
          path === "commercial"
            ? t('path.commercialShort')
            : path === "rrf"
              ? t('path.rrfShort')
              : t('path.grantShort'),
        annualDS: ds,
        breakEvenRevenue: beRev,
        breakEvenNights: beNights,
        breakEvenADR: beADR,
        currentNights: baseNights,
        currentADR: a.villaADR,
        bufferNights: baseNights - beNights,
        bufferADR: a.villaADR - beADR,
        bufferNightsPct: ((baseNights - beNights) / baseNights) * 100,
        bufferADRPct: ((a.villaADR - beADR) / a.villaADR) * 100,
      };
    });

    // ── 5. Financial Break-Even Scenario (full P&L at break-even) ──
    // Current stabilised revenue breakdown
    const villaRevCurrent = 2 * baseNights * a.villaADR;
    const suiteRevCurrent = suiteRevAtBase;
    const currentRev = villaRevCurrent + suiteRevCurrent + fixedRevenue;
    const currentEBITDA = currentRev - totalOpex;

    // Occupancy-linked revenue = villa + suite (both scale with nights)
    // Fixed revenue = events + ancillary (don't change with nights/ADR)
    const occLinkedRevCurrent = villaRevCurrent + suiteRevCurrent;

    // ── Method A: Nights-only — all occupancy drops uniformly ──
    // Solve: nights_factor * occLinkedRevCurrent + fixedRevenue - totalOpex = annualDS
    // nights_factor = (annualDS + totalOpex - fixedRevenue) / occLinkedRevCurrent
    const nightsFactor = (annualDS + totalOpex - fixedRevenue) / occLinkedRevCurrent;
    const beNightsOnlyNights = Math.ceil(baseNights * nightsFactor);
    const beNightsOnlyVillaRev = 2 * beNightsOnlyNights * a.villaADR;
    const beNightsOnlySuiteRev = (2 * a.suiteStandardADR + 2 * a.suiteDoubleADR) * beNightsOnlyNights;
    const beNightsOnlyRev = beNightsOnlyVillaRev + beNightsOnlySuiteRev + fixedRevenue;

    // ── Method B: ADR-only — all ADRs drop uniformly, nights stay ──
    // Solve: adrFactor * occLinkedRevCurrent + fixedRevenue - totalOpex = annualDS
    const adrFactor = (annualDS + totalOpex - fixedRevenue) / occLinkedRevCurrent;
    const beADROnlyVillaADR = Math.ceil(a.villaADR * adrFactor);
    const beADROnlyStdADR = Math.round(a.suiteStandardADR * adrFactor);
    const beADROnlyDblADR = Math.round(a.suiteDoubleADR * adrFactor);
    const beADROnlyVillaRev = 2 * baseNights * beADROnlyVillaADR;
    const beADROnlySuiteRev = (2 * beADROnlyStdADR + 2 * beADROnlyDblADR) * baseNights;
    const beADROnlyRev = beADROnlyVillaRev + beADROnlySuiteRev + fixedRevenue;

    // ── Method C: Both drop — nights and ADRs each drop by sqrt(factor) ──
    const combinedFactor = Math.sqrt((annualDS + totalOpex - fixedRevenue) / occLinkedRevCurrent);
    const beComboNights = Math.ceil(baseNights * combinedFactor);
    const beComboVillaADR = Math.ceil(a.villaADR * combinedFactor);
    const beComboStdADR = Math.round(a.suiteStandardADR * combinedFactor);
    const beComboVillaRev = 2 * beComboNights * beComboVillaADR;
    const beComboDblADR = Math.round(a.suiteDoubleADR * combinedFactor);
    const beComboSuiteRev = (2 * beComboStdADR + 2 * beComboDblADR) * beComboNights;
    const beComboRev = beComboVillaRev + beComboSuiteRev + fixedRevenue;

    const breakEvenScenario = {
      nightsOnly: {
        nights: beNightsOnlyNights,
        villaADR: a.villaADR,
        stdADR: a.suiteStandardADR,
        dblADR: a.suiteDoubleADR,
        villaRev: beNightsOnlyVillaRev,
        suiteRev: beNightsOnlySuiteRev,
        fixedRev: fixedRevenue,
        revenue: beNightsOnlyRev,
        ebitda: beNightsOnlyRev - totalOpex,
        dropPct: (1 - nightsFactor) * 100,
      },
      adrOnly: {
        nights: baseNights,
        villaADR: beADROnlyVillaADR,
        stdADR: beADROnlyStdADR,
        dblADR: beADROnlyDblADR,
        villaRev: beADROnlyVillaRev,
        suiteRev: beADROnlySuiteRev,
        fixedRev: fixedRevenue,
        revenue: beADROnlyRev,
        ebitda: beADROnlyRev - totalOpex,
        dropPct: (1 - adrFactor) * 100,
      },
      proportional: {
        nights: beComboNights,
        villaADR: beComboVillaADR,
        stdADR: beComboStdADR,
        dblADR: beComboDblADR,
        villaRev: beComboVillaRev,
        suiteRev: beComboSuiteRev,
        fixedRev: fixedRevenue,
        revenue: beComboRev,
        ebitda: beComboRev - totalOpex,
        dropPct: (1 - combinedFactor) * 100,
      },
      current: {
        nights: baseNights,
        villaADR: a.villaADR,
        stdADR: a.suiteStandardADR,
        dblADR: a.suiteDoubleADR,
        villaRev: villaRevCurrent,
        suiteRev: suiteRevCurrent,
        fixedRev: fixedRevenue,
        revenue: currentRev,
        ebitda: currentEBITDA,
        ds: annualDS,
        ncf: currentEBITDA - annualDS,
        dscr: currentEBITDA / annualDS,
      },
    };

    return {
      annualDS,
      totalOpex,
      breakEvenRevenue,
      breakEvenNights,
      breakEvenADR,
      nightsSweep,
      adrSweep,
      heatmapData,
      paths,
      currentNights: baseNights,
      currentADR: a.villaADR,
      nightsRange,
      adrRange,
      breakEvenScenario,
    };
  }, [assumptions, model]);

  if (!model || !analysis) return null;

  const activePath = analysis.paths.find(
    (p) =>
      p.path.toLowerCase() ===
      (assumptions.financingPath === "grant"
        ? "grant"
        : assumptions.financingPath === "rrf"
          ? "rrf"
          : "commercial")
  )!;

  return (
    <div>
      <h1 className="font-display text-2xl text-text-primary mb-1">
        {t('be.title')}
      </h1>
      <p className="text-sm text-text-secondary mb-6">
        {t('be.subtitle')}
      </p>

      {/* Hero break-even KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-surface-tertiary p-5">
          <div className="text-xs font-medium uppercase tracking-wider text-text-tertiary mb-2">
            {t('be.nights')}
          </div>
          <div className="kpi-value text-text-primary">
            {activePath.breakEvenNights}
          </div>
          <div className="text-xs text-text-tertiary mt-1">
            {t('be.nightsSub')}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-surface-tertiary p-5">
          <div className="text-xs font-medium uppercase tracking-wider text-text-tertiary mb-2">
            {t('be.buffer')}
          </div>
          <div className="kpi-value text-positive">
            +{activePath.bufferNights} nights
          </div>
          <div className="text-xs text-text-tertiary mt-1">
            {activePath.bufferNightsPct.toFixed(0)}% {t('be.bufferSub')}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-surface-tertiary p-5">
          <div className="text-xs font-medium uppercase tracking-wider text-text-tertiary mb-2">
            {t('be.adr')}
          </div>
          <div className="kpi-value text-text-primary">
            €{activePath.breakEvenADR.toLocaleString()}
          </div>
          <div className="text-xs text-text-tertiary mt-1">
            {t('be.adrSub')}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-surface-tertiary p-5">
          <div className="text-xs font-medium uppercase tracking-wider text-text-tertiary mb-2">
            {t('be.adrBuffer')}
          </div>
          <div className="kpi-value text-positive">
            +€{activePath.bufferADR.toLocaleString()}
          </div>
          <div className="text-xs text-text-tertiary mt-1">
            {activePath.bufferADRPct.toFixed(0)}% {t('be.adrBufferSub')}
          </div>
        </div>
      </div>

      {/* ── Financial Break-Even Scenario ── */}
      {(() => {
        const be = analysis.breakEvenScenario;
        const cols = [
          { key: "current", label: t('be.current'), color: "text-brand-600" },
          { key: "nightsOnly", label: t('be.nightsDrop'), color: "text-earth-terracotta" },
          { key: "adrOnly", label: t('be.adrDrop'), color: "text-info" },
          { key: "proportional", label: t('be.bothDrop'), color: "text-negative" },
        ] as const;

        type ColKey = typeof cols[number]["key"];
        const get = (key: ColKey) => be[key];

        return (
          <div className="bg-white rounded-xl border-2 border-brand-200 p-6 mb-8">
            <h3 className="font-display text-lg text-text-primary mb-1">
              {t('be.scenarioTitle')}
            </h3>
            <p className="text-sm text-text-secondary mb-5">
              {t('be.scenarioSubtitle')}
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-tertiary">
                    <th className="text-left py-2 pr-4 text-xs uppercase tracking-wider text-text-tertiary font-medium min-w-[200px]">
                      {t('be.metric')}
                    </th>
                    {cols.map((c) => (
                      <th key={c.key} className={`text-right py-2 px-4 text-xs uppercase tracking-wider font-medium ${c.color}`}>
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* Nights */}
                  <tr className="border-b border-surface-secondary/50">
                    <td className="py-2.5 pr-4 text-text-secondary">{t('be.nightsPerYear')}</td>
                    {cols.map((c) => {
                      const d = get(c.key);
                      const changed = d.nights !== be.current.nights;
                      return (
                        <td key={c.key} className={`text-right py-2.5 px-4 data-cell ${changed ? c.color + " font-medium" : ""}`}>
                          {d.nights}
                          {changed && <span className="text-xs ml-1">(-{((1 - d.nights / be.current.nights) * 100).toFixed(0)}%)</span>}
                        </td>
                      );
                    })}
                  </tr>
                  {/* Villa ADR */}
                  <tr className="border-b border-surface-secondary/50">
                    <td className="py-2.5 pr-4 text-text-secondary">{t('be.villaADR')}</td>
                    {cols.map((c) => {
                      const d = get(c.key);
                      const changed = d.villaADR !== be.current.villaADR;
                      return (
                        <td key={c.key} className={`text-right py-2.5 px-4 data-cell ${changed ? c.color + " font-medium" : ""}`}>
                          €{d.villaADR.toLocaleString()}
                          {changed && <span className="text-xs ml-1">(-{((1 - d.villaADR / be.current.villaADR) * 100).toFixed(0)}%)</span>}
                        </td>
                      );
                    })}
                  </tr>
                  {/* Suite ADRs */}
                  <tr className="border-b border-surface-secondary/50">
                    <td className="py-2.5 pr-4 text-text-secondary">{t('be.stdSuiteADR')}</td>
                    {cols.map((c) => {
                      const d = get(c.key);
                      const changed = d.stdADR !== be.current.stdADR;
                      return (
                        <td key={c.key} className={`text-right py-2.5 px-4 data-cell ${changed ? "text-text-tertiary" : ""}`}>
                          €{d.stdADR.toLocaleString()}
                        </td>
                      );
                    })}
                  </tr>
                  <tr className="border-b border-surface-secondary/50">
                    <td className="py-2.5 pr-4 text-text-secondary">{t('be.dblSuiteADR')}</td>
                    {cols.map((c) => {
                      const d = get(c.key);
                      return (
                        <td key={c.key} className="text-right py-2.5 px-4 data-cell">
                          €{d.dblADR.toLocaleString()}
                        </td>
                      );
                    })}
                  </tr>
                  {/* Revenue breakdown */}
                  <tr className="border-b border-surface-secondary/50 bg-surface-secondary/20">
                    <td className="py-2.5 pr-4 text-text-tertiary text-xs pl-2">{t('be.villaRevenue')}</td>
                    {cols.map((c) => (
                      <td key={c.key} className="text-right py-2.5 px-4 data-cell text-text-tertiary">
                        {formatCurrency(get(c.key).villaRev, true, locale)}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b border-surface-secondary/50 bg-surface-secondary/20">
                    <td className="py-2.5 pr-4 text-text-tertiary text-xs pl-2">{t('be.suiteRevenue')}</td>
                    {cols.map((c) => (
                      <td key={c.key} className="text-right py-2.5 px-4 data-cell text-text-tertiary">
                        {formatCurrency(get(c.key).suiteRev, true, locale)}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b border-surface-secondary/50 bg-surface-secondary/20">
                    <td className="py-2.5 pr-4 text-text-tertiary text-xs pl-2">{t('be.eventsAncillary')}</td>
                    {cols.map((c) => (
                      <td key={c.key} className="text-right py-2.5 px-4 data-cell text-text-tertiary">
                        {formatCurrency(get(c.key).fixedRev, true, locale)}
                      </td>
                    ))}
                  </tr>
                  {/* Total Revenue */}
                  <tr className="border-b border-surface-secondary/50 font-medium">
                    <td className="py-2.5 pr-4">{t('pnl.totalRevenue')}</td>
                    {cols.map((c) => (
                      <td key={c.key} className="text-right py-2.5 px-4 data-cell">
                        {formatCurrency(get(c.key).revenue, true, locale)}
                      </td>
                    ))}
                  </tr>
                  {/* OPEX */}
                  <tr className="border-b border-surface-secondary/50">
                    <td className="py-2.5 pr-4 text-text-secondary">{t('pnl.totalOpex')}</td>
                    {cols.map((c) => (
                      <td key={c.key} className="text-right py-2.5 px-4 data-cell">
                        {formatCurrency(analysis.totalOpex, true, locale)}
                      </td>
                    ))}
                  </tr>
                  {/* EBITDA */}
                  <tr className="border-b border-surface-secondary/50 bg-surface-secondary/30 font-medium">
                    <td className="py-2.5 pr-4">{t('term.ebitda')}</td>
                    {cols.map((c) => (
                      <td key={c.key} className="text-right py-2.5 px-4 data-cell">
                        {formatCurrency(get(c.key).ebitda, true, locale)}
                      </td>
                    ))}
                  </tr>
                  {/* DS */}
                  <tr className="border-b border-surface-secondary/50">
                    <td className="py-2.5 pr-4 text-text-secondary">{t('pnl.debtService')}</td>
                    {cols.map((c) => (
                      <td key={c.key} className="text-right py-2.5 px-4 data-cell text-negative">
                        {formatCurrency(analysis.annualDS, true, locale)}
                      </td>
                    ))}
                  </tr>
                  {/* NCF */}
                  <tr className="border-b border-surface-secondary/50 font-medium">
                    <td className="py-2.5 pr-4">{t('kpi.netCashFlow')}</td>
                    <td className="text-right py-2.5 px-4 data-cell text-positive">{formatCurrency(be.current.ncf, true, locale)}</td>
                    <td className="text-right py-2.5 px-4 data-cell text-warning">~€0</td>
                    <td className="text-right py-2.5 px-4 data-cell text-warning">~€0</td>
                    <td className="text-right py-2.5 px-4 data-cell text-warning">~€0</td>
                  </tr>
                  {/* DSCR */}
                  <tr className="bg-surface-secondary/30 font-medium">
                    <td className="py-2.5 pr-4">{t('term.dscr')}</td>
                    <td className="text-right py-2.5 px-4 data-cell text-positive">{formatMultiple(be.current.dscr)}</td>
                    <td className="text-right py-2.5 px-4 data-cell text-warning">1.00×</td>
                    <td className="text-right py-2.5 px-4 data-cell text-warning">1.00×</td>
                    <td className="text-right py-2.5 px-4 data-cell text-warning">1.00×</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="mt-4 bg-surface-secondary rounded-lg p-4 text-xs text-text-secondary space-y-1">
              <p><strong>Nights Drop:</strong> All ADRs unchanged. Occupancy drops uniformly to {be.nightsOnly.nights} nights (-{be.nightsOnly.dropPct.toFixed(0)}%) across villas and suites.</p>
              <p><strong>ADR Drop:</strong> Occupancy unchanged at {be.current.nights} nights. All ADRs drop uniformly by {be.adrOnly.dropPct.toFixed(0)}% (villa to €{be.adrOnly.villaADR}, suites proportionally).</p>
              <p><strong>Both Drop:</strong> Nights and ADRs each fall by ~{be.proportional.dropPct.toFixed(0)}% — to {be.proportional.nights} nights at €{be.proportional.villaADR}/night villa ADR.</p>
              <p className="mt-2 text-text-tertiary">Events + ancillary revenue (€{formatCurrency(be.current.fixedRev, true, locale)}) held constant in all scenarios. Villa Lev first season: 53 nights at €2,200 ADR.</p>
            </div>
          </div>
        );
      })()}

      {/* Break-even across financing paths */}
      <div className="bg-white rounded-xl border border-surface-tertiary p-5 mb-8">
        <h3 className="text-sm font-medium uppercase tracking-wider text-text-tertiary mb-4">
          {t('be.byFinancingPath')}
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-tertiary">
                <th className="text-left py-2 pr-4 text-xs uppercase tracking-wider text-text-tertiary font-medium">
                  {t('common.path')}
                </th>
                <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-text-tertiary font-medium">
                  {t('be.annualDS')}
                </th>
                <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-text-tertiary font-medium">
                  {t('be.beRevenue')}
                </th>
                <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-text-tertiary font-medium">
                  {t('be.beNights')}
                </th>
                <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-text-tertiary font-medium">
                  {t('be.nightsBuffer')}
                </th>
                <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-text-tertiary font-medium">
                  {t('be.beADR')}
                </th>
                <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-text-tertiary font-medium">
                  {t('be.adrBuffer')}
                </th>
              </tr>
            </thead>
            <tbody>
              {analysis.paths.map((p) => {
                const isActive =
                  p.path.toLowerCase() ===
                  (assumptions.financingPath === "grant"
                    ? "grant"
                    : assumptions.financingPath === "rrf"
                      ? "rrf"
                      : "commercial");
                return (
                  <tr
                    key={p.path}
                    className={`border-b border-surface-secondary/50 ${isActive ? "bg-brand-50/50 font-medium" : ""}`}
                  >
                    <td className="py-2.5 pr-4">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2.5 h-2.5 rounded-full"
                          style={{
                            backgroundColor:
                              p.path === "Commercial"
                                ? "#8B6914"
                                : p.path === "RRF"
                                  ? "#4A6A8B"
                                  : "#4A7C3F",
                          }}
                        />
                        {p.path}
                      </div>
                    </td>
                    <td className="text-right py-2.5 px-3 data-cell">
                      {formatCurrency(p.annualDS, true, locale)}
                    </td>
                    <td className="text-right py-2.5 px-3 data-cell">
                      {formatCurrency(p.breakEvenRevenue, true, locale)}
                    </td>
                    <td className="text-right py-2.5 px-3 data-cell font-medium">
                      {p.breakEvenNights}
                    </td>
                    <td className="text-right py-2.5 px-3 data-cell text-positive">
                      +{p.bufferNights} ({p.bufferNightsPct.toFixed(0)}%)
                    </td>
                    <td className="text-right py-2.5 px-3 data-cell font-medium">
                      €{p.breakEvenADR.toLocaleString()}
                    </td>
                    <td className="text-right py-2.5 px-3 data-cell text-positive">
                      +€{p.bufferADR.toLocaleString()} (
                      {p.bufferADRPct.toFixed(0)}%)
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-text-tertiary mt-3">
          Current base: {analysis.currentNights} villa nights/yr at €
          {analysis.currentADR.toLocaleString()} ADR (stabilised 2031).
          Villa Lev first season (2022) achieved ~53 nights — all break-even
          levels are above this floor.
        </p>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Nights sweep chart */}
        <div className="bg-white rounded-xl border border-surface-tertiary p-5">
          <h3 className="text-sm font-medium uppercase tracking-wider text-text-tertiary mb-4">
            {t('be.dscrByOccupancy')}
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={analysis.nightsSweep}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EDE6D5" />
              <XAxis
                dataKey="nights"
                tick={{ fontSize: 11 }}
                label={{
                  value: t('be.nightsDown'),
                  position: "insideBottom",
                  offset: -5,
                  fontSize: 11,
                }}
              />
              <YAxis
                tick={{ fontSize: 11 }}
                tickFormatter={(v: number) => `${v.toFixed(1)}×`}
                domain={[0, "auto"]}
              />
              <Tooltip
                formatter={(value, name) =>
                  name === "dscr"
                    ? `${Number(value).toFixed(2)}×`
                    : formatCurrency(Number(value), false, locale)
                }
                contentStyle={{
                  borderRadius: 8,
                  border: "1px solid #EDE6D5",
                  fontSize: 12,
                }}
              />
              <ReferenceLine
                y={1.0}
                stroke="#9E3B3B"
                strokeDasharray="5 5"
                label={{ value: "1.0× DS", fontSize: 10, fill: "#9E3B3B" }}
              />
              <ReferenceLine
                y={1.25}
                stroke="#B8863A"
                strokeDasharray="3 3"
                label={{ value: "1.25× min", fontSize: 10, fill: "#B8863A" }}
              />
              <ReferenceLine
                x={analysis.currentNights}
                stroke="#6B7A3D"
                strokeDasharray="3 3"
                label={{
                  value: `Current: ${analysis.currentNights}`,
                  fontSize: 10,
                  fill: "#6B7A3D",
                }}
              />
              <Line
                type="monotone"
                dataKey="dscr"
                stroke="#8B6914"
                strokeWidth={2.5}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* ADR sweep chart */}
        <div className="bg-white rounded-xl border border-surface-tertiary p-5">
          <h3 className="text-sm font-medium uppercase tracking-wider text-text-tertiary mb-4">
            {t('be.dscrByADR')}
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={analysis.adrSweep}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EDE6D5" />
              <XAxis
                dataKey="adr"
                tick={{ fontSize: 11 }}
                tickFormatter={(v: number) => `€${v.toLocaleString()}`}
                label={{
                  value: t('be.adrDown'),
                  position: "insideBottom",
                  offset: -5,
                  fontSize: 11,
                }}
              />
              <YAxis
                tick={{ fontSize: 11 }}
                tickFormatter={(v: number) => `${v.toFixed(1)}×`}
                domain={[0, "auto"]}
              />
              <Tooltip
                formatter={(value, name) =>
                  name === "dscr"
                    ? `${Number(value).toFixed(2)}×`
                    : formatCurrency(Number(value), false, locale)
                }
                contentStyle={{
                  borderRadius: 8,
                  border: "1px solid #EDE6D5",
                  fontSize: 12,
                }}
              />
              <ReferenceLine
                y={1.0}
                stroke="#9E3B3B"
                strokeDasharray="5 5"
                label={{ value: "1.0× DS", fontSize: 10, fill: "#9E3B3B" }}
              />
              <ReferenceLine
                y={1.25}
                stroke="#B8863A"
                strokeDasharray="3 3"
                label={{ value: "1.25× min", fontSize: 10, fill: "#B8863A" }}
              />
              <ReferenceLine
                x={analysis.currentADR}
                stroke="#6B7A3D"
                strokeDasharray="3 3"
                label={{
                  value: `Current: €${analysis.currentADR}`,
                  fontSize: 10,
                  fill: "#6B7A3D",
                }}
              />
              <Line
                type="monotone"
                dataKey="dscr"
                stroke="#4A6A8B"
                strokeWidth={2.5}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Nights × ADR DSCR matrix */}
      <div className="bg-white rounded-xl border border-surface-tertiary p-5 mb-8">
        <h3 className="text-sm font-medium uppercase tracking-wider text-text-tertiary mb-4">
          {t('be.dscrMatrix')}
        </h3>
        <p className="text-xs text-text-secondary mb-4">
          {t('be.dscrMatrixDesc')}
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-tertiary">
                <th className="text-left py-2 pr-2 text-xs uppercase tracking-wider text-text-tertiary font-medium">
                  Nights ↓ / ADR →
                </th>
                {analysis.adrRange.map((adr) => (
                  <th
                    key={adr}
                    className={`text-center py-2 px-2 text-xs uppercase tracking-wider font-medium ${
                      adr === analysis.currentADR
                        ? "text-brand-600"
                        : "text-text-tertiary"
                    }`}
                  >
                    €{adr.toLocaleString()}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {analysis.nightsRange.map((n) => (
                <tr
                  key={n}
                  className="border-b border-surface-secondary/50"
                >
                  <td
                    className={`py-2 pr-2 text-sm font-medium ${
                      Math.abs(n - analysis.currentNights) <= 3
                        ? "text-brand-600"
                        : "text-text-secondary"
                    }`}
                  >
                    {n}
                  </td>
                  {analysis.adrRange.map((adr) => {
                    const cell = analysis.heatmapData.find(
                      (d) => d.nights === n && d.adr === adr
                    );
                    const dscr = cell?.dscr ?? 0;
                    const bg =
                      dscr >= 1.25
                        ? "bg-green-50 text-positive"
                        : dscr >= 1.0
                          ? "bg-amber-50 text-warning"
                          : "bg-red-50 text-negative";
                    const isCurrent =
                      Math.abs(n - analysis.currentNights) <= 3 &&
                      adr === analysis.currentADR;
                    return (
                      <td
                        key={`${n}-${adr}`}
                        className={`text-center py-2 px-2 data-cell ${bg} ${
                          isCurrent
                            ? "ring-2 ring-brand-500 ring-inset font-bold"
                            : ""
                        }`}
                      >
                        {formatMultiple(dscr)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex gap-4 mt-3 text-xs text-text-tertiary">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-green-50 border border-green-200" />
            DSCR ≥ 1.25×
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-amber-50 border border-amber-200" />
            1.0× – 1.25×
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-red-50 border border-red-200" />
            Below 1.0×
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded ring-2 ring-brand-500" />
            Current position
          </span>
        </div>
      </div>

      {/* Context */}
      <div className="bg-surface-secondary rounded-xl p-5 text-sm text-text-secondary">
        <h3 className="font-medium text-text-primary mb-2">{t('be.context')}</h3>
        <ul className="space-y-1 text-xs">
          <li>
            Villa Lev achieved ~53 nights in its very first season (2022) before
            any brand recognition.
          </li>
          <li>
            Current Villa Lev ADR is €4,000 (2026) — the model uses €3,500 as a
            conservative base.
          </li>
          <li>
            Break-even analysis assumes stabilised OPEX of{" "}
            {formatCurrency(analysis.totalOpex, false, locale)} and includes events + ancillary
            revenue at their stabilised level.
          </li>
          <li>
            Revenue must fall ~34% from the realistic base before debt service is
            affected under the commercial loan path.
          </li>
        </ul>
      </div>
    </div>
  );
}
