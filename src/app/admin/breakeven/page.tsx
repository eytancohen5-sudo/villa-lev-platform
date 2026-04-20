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
} from "recharts";

export default function BreakEvenPage() {
  const { t, locale } = useTranslation();
  const { assumptions, model } = useModelStore();

  const analysis = useMemo(() => {
    if (!model) return null;

    // Compute total unit counts from portfolio (unit mix)
    const nVilla = assumptions.portfolio.reduce((s, p) => s + p.villaUnits * p.count, 0);
    const nStdSuite = assumptions.portfolio.reduce((s, p) => s + p.standardSuites * p.count, 0);
    const nDblSuite = assumptions.portfolio.reduce((s, p) => s + p.doubleSuites * p.count, 0);

    const annualDS = model.keyMetrics.annualDS;
    const totalOpex = model.scenarios.realistic.stabilisedYear?.totalOpex ?? 263500;
    const breakEvenRevenue = annualDS + totalOpex;

    const a = assumptions.revenueRealistic;
    const revenuePerVillaNight = a.villaADR * nVilla;
    const revenuePerSuiteNight = a.suiteStandardADR * nStdSuite + a.suiteDoubleADR * nDblSuite;
    const fixedRevenue =
      a.eventsPerYear * a.netProfitPerEvent +
      a.ancillaryBaseProfit * Math.pow(1 + a.ancillaryGrowthRate, 3);

    const revenuePerNight = revenuePerVillaNight + revenuePerSuiteNight;
    const breakEvenNights = Math.ceil(
      (breakEvenRevenue - fixedRevenue) / revenuePerNight
    );

    // Nights sweep
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
      });
    }

    // Break-even ADR
    const baseNights = a.villaBaseNights + 3;
    const baseSuiteNights = a.suiteBaseNights + 3;
    const suiteRevAtBase =
      (a.suiteStandardADR * nStdSuite + a.suiteDoubleADR * nDblSuite) * baseSuiteNights;
    const breakEvenADR = Math.ceil(
      (breakEvenRevenue - suiteRevAtBase - fixedRevenue) /
        (nVilla * baseNights)
    );

    // ADR sweep
    const adrSweep = [];
    for (let adr = 1500; adr <= 5000; adr += 250) {
      const rev =
        nVilla * baseNights * adr + suiteRevAtBase + fixedRevenue;
      const ncf = rev - totalOpex - annualDS;
      const dscr = (rev - totalOpex) / annualDS;
      adrSweep.push({
        adr,
        revenue: Math.round(rev),
        ncf: Math.round(ncf),
        dscr: Number(dscr.toFixed(2)),
      });
    }

    // Heatmap
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
          nVilla * n * adr +
          (a.suiteStandardADR * nStdSuite + a.suiteDoubleADR * nDblSuite) * n +
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

    // Break-even across financing paths
    const paths = (["commercial", "rrf", "grant", "tepix-loan"] as const).map((path) => {
      const m = computeModel({ ...assumptions, financingPath: path });
      const ds = m.keyMetrics.annualDS;
      const beRev = ds + totalOpex;
      const beNights = Math.ceil(
        (beRev - fixedRevenue) / revenuePerNight
      );
      const beADR = nVilla > 0 ? Math.ceil(
        (beRev - suiteRevAtBase - fixedRevenue) / (nVilla * baseNights)
      ) : 0;
      return {
        path: path === "commercial"
          ? t('path.commercialShort')
          : path === "rrf"
            ? t('path.rrfShort')
            : path === "grant"
              ? t('path.grantShort')
              : t('path.tepixLoanShort'),
        annualDS: ds,
        breakEvenRevenue: beRev,
        breakEvenNights: beNights,
        breakEvenADR: beADR,
        currentNights: baseNights,
        currentADR: a.villaADR,
        bufferNights: baseNights - beNights,
        bufferADR: a.villaADR - beADR,
        bufferNightsPct: ((baseNights - beNights) / baseNights) * 100,
        bufferADRPct: beADR > 0 ? ((a.villaADR - beADR) / a.villaADR) * 100 : 0,
        color: path === "commercial" ? "#8B6914"
          : path === "rrf" ? "#4A6A8B"
          : path === "grant" ? "#4A7C3F"
          : "#7B5EA7",
      };
    });

    // Financial Break-Even Scenario
    const villaRevCurrent = nVilla * baseNights * a.villaADR;
    const suiteRevCurrent = suiteRevAtBase;
    const currentRev = villaRevCurrent + suiteRevCurrent + fixedRevenue;
    const currentEBITDA = currentRev - totalOpex;
    const occLinkedRevCurrent = villaRevCurrent + suiteRevCurrent;

    const nightsFactor = occLinkedRevCurrent > 0 ? (annualDS + totalOpex - fixedRevenue) / occLinkedRevCurrent : 1;
    const beNightsOnlyNights = Math.ceil(baseNights * nightsFactor);
    const beNightsOnlyVillaRev = nVilla * beNightsOnlyNights * a.villaADR;
    const beNightsOnlySuiteRev = (a.suiteStandardADR * nStdSuite + a.suiteDoubleADR * nDblSuite) * beNightsOnlyNights;
    const beNightsOnlyRev = beNightsOnlyVillaRev + beNightsOnlySuiteRev + fixedRevenue;

    const adrFactor = occLinkedRevCurrent > 0 ? (annualDS + totalOpex - fixedRevenue) / occLinkedRevCurrent : 1;
    const beADROnlyVillaADR = Math.ceil(a.villaADR * adrFactor);
    const beADROnlyStdADR = Math.round(a.suiteStandardADR * adrFactor);
    const beADROnlyDblADR = Math.round(a.suiteDoubleADR * adrFactor);
    const beADROnlyVillaRev = nVilla * baseNights * beADROnlyVillaADR;
    const beADROnlySuiteRev = (beADROnlyStdADR * nStdSuite + beADROnlyDblADR * nDblSuite) * baseNights;
    const beADROnlyRev = beADROnlyVillaRev + beADROnlySuiteRev + fixedRevenue;

    const combinedFactor = occLinkedRevCurrent > 0 ? Math.sqrt((annualDS + totalOpex - fixedRevenue) / occLinkedRevCurrent) : 1;
    const beComboNights = Math.ceil(baseNights * combinedFactor);
    const beComboVillaADR = Math.ceil(a.villaADR * combinedFactor);
    const beComboStdADR = Math.round(a.suiteStandardADR * combinedFactor);
    const beComboVillaRev = nVilla * beComboNights * beComboVillaADR;
    const beComboDblADR = Math.round(a.suiteDoubleADR * combinedFactor);
    const beComboSuiteRev = (beComboStdADR * nStdSuite + beComboDblADR * nDblSuite) * beComboNights;
    const beComboRev = beComboVillaRev + beComboSuiteRev + fixedRevenue;

    const breakEvenScenario = {
      nightsOnly: {
        nights: beNightsOnlyNights, villaADR: a.villaADR,
        stdADR: a.suiteStandardADR, dblADR: a.suiteDoubleADR,
        villaRev: beNightsOnlyVillaRev, suiteRev: beNightsOnlySuiteRev,
        fixedRev: fixedRevenue, revenue: beNightsOnlyRev,
        ebitda: beNightsOnlyRev - totalOpex, dropPct: (1 - nightsFactor) * 100,
      },
      adrOnly: {
        nights: baseNights, villaADR: beADROnlyVillaADR,
        stdADR: beADROnlyStdADR, dblADR: beADROnlyDblADR,
        villaRev: beADROnlyVillaRev, suiteRev: beADROnlySuiteRev,
        fixedRev: fixedRevenue, revenue: beADROnlyRev,
        ebitda: beADROnlyRev - totalOpex, dropPct: (1 - adrFactor) * 100,
      },
      proportional: {
        nights: beComboNights, villaADR: beComboVillaADR,
        stdADR: beComboStdADR, dblADR: beComboDblADR,
        villaRev: beComboVillaRev, suiteRev: beComboSuiteRev,
        fixedRev: fixedRevenue, revenue: beComboRev,
        ebitda: beComboRev - totalOpex, dropPct: (1 - combinedFactor) * 100,
      },
      current: {
        nights: baseNights, villaADR: a.villaADR,
        stdADR: a.suiteStandardADR, dblADR: a.suiteDoubleADR,
        villaRev: villaRevCurrent, suiteRev: suiteRevCurrent,
        fixedRev: fixedRevenue, revenue: currentRev,
        ebitda: currentEBITDA, ds: annualDS,
        ncf: currentEBITDA - annualDS, dscr: annualDS > 0 ? currentEBITDA / annualDS : 0,
      },
    };

    return {
      annualDS, totalOpex, breakEvenRevenue, breakEvenNights, breakEvenADR,
      nightsSweep, adrSweep, heatmapData, paths,
      currentNights: baseNights, currentADR: a.villaADR,
      nightsRange, adrRange, breakEvenScenario,
      nVilla, nStdSuite, nDblSuite,
    };
  }, [assumptions, model, t]);

  if (!model || !analysis) return null;

  const activePath = analysis.paths.find(
    (p) =>
      p.path.toLowerCase().includes(
        assumptions.financingPath === "grant" ? "grant"
        : assumptions.financingPath === "rrf" ? "rrf"
        : assumptions.financingPath === "tepix-loan" ? "tepix"
        : "commercial"
      )
  ) ?? analysis.paths[0];

  return (
    <div>
      <h1 className="font-display text-2xl text-text-primary mb-1">{t('be.title')}</h1>
      <p className="text-sm text-text-secondary mb-6">{t('be.subtitle')}</p>

      {/* Hero KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-2xl border border-surface-tertiary shadow-sm p-5">
          <div className="text-xs font-medium uppercase tracking-wider text-text-tertiary mb-2">{t('be.nights')}</div>
          <div className="kpi-value text-text-primary">{activePath.breakEvenNights}</div>
          <div className="text-xs text-text-tertiary mt-1">{t('be.nightsSub')}</div>
        </div>
        <div className="bg-white rounded-2xl border border-surface-tertiary shadow-sm p-5">
          <div className="text-xs font-medium uppercase tracking-wider text-text-tertiary mb-2">{t('be.buffer')}</div>
          <div className="kpi-value text-positive">+{activePath.bufferNights} nights</div>
          <div className="text-xs text-text-tertiary mt-1">{activePath.bufferNightsPct.toFixed(0)}% {t('be.bufferSub')}</div>
        </div>
        <div className="bg-white rounded-2xl border border-surface-tertiary shadow-sm p-5">
          <div className="text-xs font-medium uppercase tracking-wider text-text-tertiary mb-2">{t('be.adr')}</div>
          <div className="kpi-value text-text-primary">{formatCurrency(activePath.breakEvenADR, false, locale)}</div>
          <div className="text-xs text-text-tertiary mt-1">{t('be.adrSub')}</div>
        </div>
        <div className="bg-white rounded-2xl border border-surface-tertiary shadow-sm p-5">
          <div className="text-xs font-medium uppercase tracking-wider text-text-tertiary mb-2">{t('be.adrBuffer')}</div>
          <div className="kpi-value text-positive">+{formatCurrency(activePath.bufferADR, false, locale)}</div>
          <div className="text-xs text-text-tertiary mt-1">{activePath.bufferADRPct.toFixed(0)}% {t('be.adrBufferSub')}</div>
        </div>
      </div>

      {/* Financial Break-Even Scenario */}
      {(() => {
        const be = analysis.breakEvenScenario;
        const cols = [
          { key: "current" as const, label: t('be.current'), color: "text-brand-600" },
          { key: "nightsOnly" as const, label: t('be.nightsDrop'), color: "text-earth-terracotta" },
          { key: "adrOnly" as const, label: t('be.adrDrop'), color: "text-info" },
          { key: "proportional" as const, label: t('be.bothDrop'), color: "text-negative" },
        ];

        type ColKey = typeof cols[number]["key"];
        const get = (key: ColKey) => be[key];

        return (
          <div className="bg-white rounded-2xl border-2 border-brand-200 shadow-sm p-6 mb-8">
            <h3 className="font-display text-lg text-text-primary mb-1">{t('be.scenarioTitle')}</h3>
            <p className="text-sm text-text-secondary mb-5">{t('be.scenarioSubtitle')}</p>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-tertiary">
                    <th className="text-left py-2 pr-4 text-xs uppercase tracking-wider text-text-tertiary font-medium min-w-[200px]">{t('be.metric')}</th>
                    {cols.map((c) => (
                      <th key={c.key} className={`text-right py-2 px-4 text-xs uppercase tracking-wider font-medium ${c.color}`}>{c.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-surface-secondary/50">
                    <td className="py-2.5 pr-4 text-text-secondary">{t('be.nightsPerYear')}</td>
                    {cols.map((c) => {
                      const d = get(c.key);
                      const changed = d.nights !== be.current.nights;
                      return (
                        <td key={c.key} className={`text-right py-2.5 px-4 data-cell font-mono ${changed ? c.color + " font-medium" : ""}`}>
                          {d.nights}
                          {changed && <span className="text-xs ml-1">(-{((1 - d.nights / be.current.nights) * 100).toFixed(0)}%)</span>}
                        </td>
                      );
                    })}
                  </tr>
                  <tr className="border-b border-surface-secondary/50">
                    <td className="py-2.5 pr-4 text-text-secondary">{t('be.villaADR')}</td>
                    {cols.map((c) => {
                      const d = get(c.key);
                      const changed = d.villaADR !== be.current.villaADR;
                      return (
                        <td key={c.key} className={`text-right py-2.5 px-4 data-cell font-mono ${changed ? c.color + " font-medium" : ""}`}>
                          {formatCurrency(d.villaADR, false, locale)}
                          {changed && <span className="text-xs ml-1">(-{((1 - d.villaADR / be.current.villaADR) * 100).toFixed(0)}%)</span>}
                        </td>
                      );
                    })}
                  </tr>
                  <tr className="border-b border-surface-secondary/50">
                    <td className="py-2.5 pr-4 text-text-secondary">{t('be.stdSuiteADR')}</td>
                    {cols.map((c) => (
                      <td key={c.key} className="text-right py-2.5 px-4 data-cell font-mono">{formatCurrency(get(c.key).stdADR, false, locale)}</td>
                    ))}
                  </tr>
                  <tr className="border-b border-surface-secondary/50">
                    <td className="py-2.5 pr-4 text-text-secondary">{t('be.dblSuiteADR')}</td>
                    {cols.map((c) => (
                      <td key={c.key} className="text-right py-2.5 px-4 data-cell font-mono">{formatCurrency(get(c.key).dblADR, false, locale)}</td>
                    ))}
                  </tr>
                  <tr className="border-b border-surface-secondary/50 bg-surface-secondary/20">
                    <td className="py-2.5 pr-4 text-text-tertiary text-xs pl-2">Villa revenue ({analysis.nVilla} unit{analysis.nVilla !== 1 ? 's' : ''})</td>
                    {cols.map((c) => (
                      <td key={c.key} className="text-right py-2.5 px-4 data-cell text-text-tertiary font-mono">{formatCurrency(get(c.key).villaRev, true, locale)}</td>
                    ))}
                  </tr>
                  <tr className="border-b border-surface-secondary/50 bg-surface-secondary/20">
                    <td className="py-2.5 pr-4 text-text-tertiary text-xs pl-2">Suite revenue ({analysis.nStdSuite + analysis.nDblSuite} rooms)</td>
                    {cols.map((c) => (
                      <td key={c.key} className="text-right py-2.5 px-4 data-cell text-text-tertiary font-mono">{formatCurrency(get(c.key).suiteRev, true, locale)}</td>
                    ))}
                  </tr>
                  <tr className="border-b border-surface-secondary/50 bg-surface-secondary/20">
                    <td className="py-2.5 pr-4 text-text-tertiary text-xs pl-2">{t('be.eventsAncillary')}</td>
                    {cols.map((c) => (
                      <td key={c.key} className="text-right py-2.5 px-4 data-cell text-text-tertiary font-mono">{formatCurrency(get(c.key).fixedRev, true, locale)}</td>
                    ))}
                  </tr>
                  <tr className="border-b border-surface-secondary/50 font-medium">
                    <td className="py-2.5 pr-4">{t('pnl.totalRevenue')}</td>
                    {cols.map((c) => (
                      <td key={c.key} className="text-right py-2.5 px-4 data-cell font-mono">{formatCurrency(get(c.key).revenue, true, locale)}</td>
                    ))}
                  </tr>
                  <tr className="border-b border-surface-secondary/50">
                    <td className="py-2.5 pr-4 text-text-secondary">{t('pnl.totalOpex')}</td>
                    {cols.map((c) => (
                      <td key={c.key} className="text-right py-2.5 px-4 data-cell font-mono">{formatCurrency(analysis.totalOpex, true, locale)}</td>
                    ))}
                  </tr>
                  <tr className="border-b border-surface-secondary/50 bg-surface-secondary/30 font-medium">
                    <td className="py-2.5 pr-4">{t('term.ebitda')}</td>
                    {cols.map((c) => (
                      <td key={c.key} className="text-right py-2.5 px-4 data-cell font-mono">{formatCurrency(get(c.key).ebitda, true, locale)}</td>
                    ))}
                  </tr>
                  <tr className="border-b border-surface-secondary/50">
                    <td className="py-2.5 pr-4 text-text-secondary">{t('pnl.debtService')}</td>
                    {cols.map((c) => (
                      <td key={c.key} className="text-right py-2.5 px-4 data-cell text-negative font-mono">{formatCurrency(analysis.annualDS, true, locale)}</td>
                    ))}
                  </tr>
                  <tr className="border-b border-surface-secondary/50 font-medium">
                    <td className="py-2.5 pr-4">{t('kpi.netCashFlow')}</td>
                    <td className="text-right py-2.5 px-4 data-cell text-positive font-mono">{formatCurrency(be.current.ncf, true, locale)}</td>
                    <td className="text-right py-2.5 px-4 data-cell text-warning font-mono">~{formatCurrency(0, false, locale)}</td>
                    <td className="text-right py-2.5 px-4 data-cell text-warning font-mono">~{formatCurrency(0, false, locale)}</td>
                    <td className="text-right py-2.5 px-4 data-cell text-warning font-mono">~{formatCurrency(0, false, locale)}</td>
                  </tr>
                  <tr className="bg-surface-secondary/30 font-medium">
                    <td className="py-2.5 pr-4">{t('term.dscr')}</td>
                    <td className="text-right py-2.5 px-4 data-cell text-positive font-mono">{formatMultiple(be.current.dscr)}</td>
                    <td className="text-right py-2.5 px-4 data-cell text-warning font-mono">1.00&times;</td>
                    <td className="text-right py-2.5 px-4 data-cell text-warning font-mono">1.00&times;</td>
                    <td className="text-right py-2.5 px-4 data-cell text-warning font-mono">1.00&times;</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="mt-4 bg-surface-secondary rounded-xl p-4 text-xs text-text-secondary space-y-1">
              <p><strong>Nights Drop:</strong> Occupancy drops to {be.nightsOnly.nights} nights (-{be.nightsOnly.dropPct.toFixed(0)}%). ADRs unchanged.</p>
              <p><strong>ADR Drop:</strong> All ADRs drop by {be.adrOnly.dropPct.toFixed(0)}%. Nights unchanged at {be.current.nights}.</p>
              <p><strong>Both Drop:</strong> Nights and ADRs each fall ~{be.proportional.dropPct.toFixed(0)}%.</p>
            </div>
          </div>
        );
      })()}

      {/* Break-even across financing paths */}
      <div className="bg-white rounded-2xl border border-surface-tertiary shadow-sm p-5 mb-8">
        <h3 className="text-sm font-medium uppercase tracking-wider text-text-tertiary mb-4">{t('be.byFinancingPath')}</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-tertiary">
                <th className="text-left py-2 pr-4 text-xs uppercase tracking-wider text-text-tertiary font-medium">{t('common.path')}</th>
                <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-text-tertiary font-medium">{t('be.annualDS')}</th>
                <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-text-tertiary font-medium">{t('be.beNights')}</th>
                <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-text-tertiary font-medium">{t('be.nightsBuffer')}</th>
                <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-text-tertiary font-medium">{t('be.beADR')}</th>
                <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-text-tertiary font-medium">{t('be.adrBuffer')}</th>
              </tr>
            </thead>
            <tbody>
              {analysis.paths.map((p) => (
                <tr key={p.path} className="border-b border-surface-secondary/50">
                  <td className="py-2.5 pr-4">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                      {p.path}
                    </div>
                  </td>
                  <td className="text-right py-2.5 px-3 data-cell font-mono">{formatCurrency(p.annualDS, true, locale)}</td>
                  <td className="text-right py-2.5 px-3 data-cell font-mono font-medium">{p.breakEvenNights}</td>
                  <td className="text-right py-2.5 px-3 data-cell text-positive font-mono">+{p.bufferNights} ({p.bufferNightsPct.toFixed(0)}%)</td>
                  <td className="text-right py-2.5 px-3 data-cell font-mono font-medium">{formatCurrency(p.breakEvenADR, false, locale)}</td>
                  <td className="text-right py-2.5 px-3 data-cell text-positive font-mono">+{formatCurrency(p.bufferADR, false, locale)} ({p.bufferADRPct.toFixed(0)}%)</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-2xl border border-surface-tertiary shadow-sm p-5">
          <h3 className="text-sm font-medium uppercase tracking-wider text-text-tertiary mb-4">{t('be.dscrByOccupancy')}</h3>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={analysis.nightsSweep}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EDE6D5" />
              <XAxis dataKey="nights" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `${v.toFixed(1)}x`} domain={[0, "auto"]} />
              <Tooltip formatter={(value) => `${Number(value).toFixed(2)}x`} contentStyle={{ borderRadius: 12, border: "1px solid #EDE6D5", fontSize: 12 }} />
              <ReferenceLine y={1.0} stroke="#9E3B3B" strokeDasharray="5 5" />
              <ReferenceLine y={1.25} stroke="#B8863A" strokeDasharray="3 3" />
              <ReferenceLine x={analysis.currentNights} stroke="#6B7A3D" strokeDasharray="3 3" />
              <Line type="monotone" dataKey="dscr" stroke="#8B6914" strokeWidth={2.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white rounded-2xl border border-surface-tertiary shadow-sm p-5">
          <h3 className="text-sm font-medium uppercase tracking-wider text-text-tertiary mb-4">{t('be.dscrByADR')}</h3>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={analysis.adrSweep}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EDE6D5" />
              <XAxis dataKey="adr" tick={{ fontSize: 11 }} tickFormatter={(v: number) => `${formatCurrency(v, false, locale)}`} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `${v.toFixed(1)}x`} domain={[0, "auto"]} />
              <Tooltip formatter={(value) => `${Number(value).toFixed(2)}x`} contentStyle={{ borderRadius: 12, border: "1px solid #EDE6D5", fontSize: 12 }} />
              <ReferenceLine y={1.0} stroke="#9E3B3B" strokeDasharray="5 5" />
              <ReferenceLine y={1.25} stroke="#B8863A" strokeDasharray="3 3" />
              <ReferenceLine x={analysis.currentADR} stroke="#6B7A3D" strokeDasharray="3 3" />
              <Line type="monotone" dataKey="dscr" stroke="#4A6A8B" strokeWidth={2.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Heatmap */}
      <div className="bg-white rounded-2xl border border-surface-tertiary shadow-sm p-5 mb-8">
        <h3 className="text-sm font-medium uppercase tracking-wider text-text-tertiary mb-4">{t('be.dscrMatrix')}</h3>
        <p className="text-xs text-text-secondary mb-4">{t('be.dscrMatrixDesc')}</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-tertiary">
                <th className="text-left py-2 pr-2 text-xs uppercase tracking-wider text-text-tertiary font-medium">Nights / ADR</th>
                {analysis.adrRange.map((adr) => (
                  <th key={adr} className={`text-center py-2 px-2 text-xs uppercase tracking-wider font-medium ${adr === analysis.currentADR ? "text-brand-600" : "text-text-tertiary"}`}>
                    {formatCurrency(adr, false, locale)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {analysis.nightsRange.map((n) => (
                <tr key={n} className="border-b border-surface-secondary/50">
                  <td className={`py-2 pr-2 text-sm font-medium ${Math.abs(n - analysis.currentNights) <= 3 ? "text-brand-600" : "text-text-secondary"}`}>{n}</td>
                  {analysis.adrRange.map((adr) => {
                    const cell = analysis.heatmapData.find((d) => d.nights === n && d.adr === adr);
                    const dscr = cell?.dscr ?? 0;
                    const bg = dscr >= 1.25 ? "bg-green-50 text-positive" : dscr >= 1.0 ? "bg-amber-50 text-warning" : "bg-red-50 text-negative";
                    const isCurrent = Math.abs(n - analysis.currentNights) <= 3 && adr === analysis.currentADR;
                    return (
                      <td key={`${n}-${adr}`} className={`text-center py-2 px-2 data-cell font-mono ${bg} ${isCurrent ? "ring-2 ring-brand-500 ring-inset font-bold" : ""}`}>
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
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-50 border border-green-200" /> DSCR &ge; 1.25&times;</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-50 border border-amber-200" /> 1.0&times; &ndash; 1.25&times;</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-50 border border-red-200" /> Below 1.0&times;</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded ring-2 ring-brand-500" /> Current</span>
        </div>
      </div>
    </div>
  );
}
