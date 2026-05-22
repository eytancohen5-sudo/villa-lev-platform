"use client";

// ConservatismTriangle — the "BP vs 2025 Greek-market average" hero strip
// that replaces the static Market Position KPI grid on the /admin/dashboard,
// /investor, and /pitch pages.
//
// Each tier row (Standard suite, Premium suite) renders two horizontal bars
// anchored to the same x-axis:
//   - BP            — the floor (green-tone)
//   - 2025 market   — Greek market average for the tier-matched comparable (slate)
//
// Below the bars: one delta chip, "X% vs 2025 market".
//
// Below the strip: defence copy explaining why per-suite-night is the right
// unit to compare, plus a "See the N comparables" link that opens the
// MarketComparablesDrawer.
//
// Villa Lev's own whole-villa actuals are NOT shown here — they describe a
// different unit (one buyer rents the entire property) and are presented
// separately in the LiveTrackRecord card above this component.

import { useState } from "react";
import { useTranslation } from "@/lib/i18n/I18nProvider";
import { formatCurrency } from "@/lib/hooks/useModel";
import { MARKET_2025_BACKSTOP, distinctHotelCount } from "@/lib/data/marketBenchmarks";
import { MarketComparablesDrawer } from "@/components/MarketComparablesDrawer";

// 50/50 HIGH/MED blend, matching how MARKET_2025_BACKSTOP feeds the headline.
function blend(tier: "basicRoom" | "premiumSuite"): number {
  const b = MARKET_2025_BACKSTOP[tier];
  return (b.high + b.med) / 2;
}

type BarColor = "bp" | "market";

function deltaPct(bp: number, ref: number): number {
  if (ref === 0) return 0;
  return (bp - ref) / ref;
}

// One tier row: label + 2 bars + 1 delta chip. Keeps text outside the bars
// (i18n-safe — RTL languages would otherwise reverse the visual order against
// the numeric x-axis).
function TierRow({
  label,
  bp,
  market,
  marketLabel,
  bpLabel,
  deltaVsMarketTmpl,
  locale,
}: {
  label: string;
  bp: number;
  market: number;
  marketLabel: string;
  bpLabel: string;
  deltaVsMarketTmpl: string;
  locale: Parameters<typeof formatCurrency>[2];
}) {
  // Scale bars to the max across the two so a banker can read relative
  // heights at a glance.
  const values: Array<{ key: BarColor; value: number; tone: string; label: string }> = [
    { key: "bp", value: bp, tone: "bg-positive", label: bpLabel },
    { key: "market", value: market, tone: "bg-text-tertiary/60", label: marketLabel },
  ];
  const max = Math.max(bp, market) || 1;

  const dMarket = deltaPct(bp, market);

  const chipClass = (pct: number) => {
    // Negative pct = BP below comparable = conservative = positive tone.
    if (Math.abs(pct) < 0.005) return "bg-surface-secondary text-text-tertiary";
    return pct < 0 ? "bg-positive/15 text-positive" : "bg-warning/15 text-warning";
  };
  const fmtPct = (pct: number) => {
    const rounded = Math.round(pct * 1000) / 10;
    const sign = rounded > 0 ? "+" : rounded < 0 ? "−" : "";
    return `${sign}${Math.abs(rounded).toFixed(1)}%`;
  };

  return (
    <div className="bg-white rounded-xl border border-surface-tertiary p-4 md:p-5">
      <div className="flex items-baseline justify-between gap-2 mb-3">
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-tertiary">
          {label}
        </div>
        <div className="text-[10px] text-text-tertiary">
          BP {formatCurrency(bp, false, locale)}
        </div>
      </div>
      <div className="space-y-2">
        {values.map((v) => (
          <div key={v.key} className="flex items-center gap-2.5">
            <span className="shrink-0 inline-block text-[10px] font-medium uppercase tracking-wider text-text-tertiary w-24 truncate">
              {v.label}
            </span>
            <div className="flex-1 h-3 rounded-full bg-surface-secondary/60 overflow-hidden">
              <div
                className={`h-full ${v.tone} transition-[width] duration-300`}
                style={{ width: `${Math.max(0, (v.value / max) * 100)}%` }}
                aria-hidden="true"
              />
            </div>
            <span className="shrink-0 font-mono text-[12px] tabular-nums text-text-secondary w-20 text-end">
              {v.value > 0 ? formatCurrency(v.value, false, locale) : "—"}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-1.5 pt-2 border-t border-surface-tertiary">
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold tabular-nums ${chipClass(dMarket)}`}
        >
          {deltaVsMarketTmpl.replace("{pct}", fmtPct(dMarket))}
        </span>
      </div>
    </div>
  );
}

export function ConservatismTriangle({
  bpStandardADR,
  bpPremiumADR,
  id,
}: {
  bpStandardADR: number;
  bpPremiumADR: number;
  /** Optional scroll anchor id (used by the dashboard page-tour). */
  id?: string;
}) {
  const { t, locale } = useTranslation();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const marketStandard = blend("basicRoom"); // 846
  const marketPremium = blend("premiumSuite"); // 1261.5

  // Distinct hotel count, not raw tier-row count. The drawer table is one
  // row per (hotel, tier), but bankers read "41 comparables" as 41 hotels.
  const totalComparables = distinctHotelCount();

  return (
    <section id={id} className="scroll-mt-24 mb-6">
      <div className="flex items-baseline justify-between mb-3 mt-8 first:mt-0 px-1">
        <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-text-secondary">
          {t("triangle.stripTitle")}
        </h2>
        <span className="text-[11px] text-text-tertiary">{t("triangle.stripSub")}</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <TierRow
          label={t("triangle.tierStandard")}
          bp={bpStandardADR}
          market={marketStandard}
          bpLabel={t("triangle.barBP")}
          marketLabel={t("triangle.barMarket")}
          deltaVsMarketTmpl={t("triangle.deltaVsMarket")}
          locale={locale}
        />
        <TierRow
          label={t("triangle.tierPremium")}
          bp={bpPremiumADR}
          market={marketPremium}
          bpLabel={t("triangle.barBP")}
          marketLabel={t("triangle.barMarket")}
          deltaVsMarketTmpl={t("triangle.deltaVsMarket")}
          locale={locale}
        />
      </div>

      <p className="text-[11px] text-text-tertiary/90 mt-3 px-1 leading-relaxed max-w-3xl">
        {t("triangle.defenceCopy")}
      </p>

      <div className="mt-2 px-1">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="text-[12px] font-medium text-brand-700 hover:text-brand-900 underline underline-offset-4 decoration-brand-400/60 hover:decoration-brand-700 transition-colors"
        >
          {t("triangle.seeComparables").replace("{n}", String(totalComparables))}
        </button>
      </div>

      <MarketComparablesDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </section>
  );
}
