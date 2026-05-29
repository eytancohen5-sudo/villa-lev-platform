"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useModelStore, type ScenarioName } from "@/lib/store/modelStore";
import { useTranslation } from "@/lib/i18n/I18nProvider";
import { formatCurrency, formatPercent, formatMultiple } from "@/lib/hooks/useModel";
import { useSeasonSnapshot } from "@/lib/data/useSeasonSnapshot";
import { ConservatismTriangle } from "@/components/ConservatismTriangle";
import type { FinancingPath } from "@/lib/engine/types";
import type { Locale } from "@/lib/i18n/types";
import {
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ComposedChart,
  LineChart,
  ReferenceLine,
  ReferenceArea,
} from "recharts";

// ── Villa Lev operating history (from presentation v6, §2 Proven Track Record) ──
// Only endpoint years have full verified data. Intermediate revenue is verified;
// intermediate ADR/refused-bookings are not published, so we show only revenue bars
// with ADR labelled at the endpoints in the callout, not on the chart.
// 2022–2025 are settled years — fixed historicals. 2026 is live and flows from
// the same `useSeasonSnapshot()` source the admin dashboard's Conservatism Check
// reads, so the pitch chart and the dashboard never disagree.
const VILLA_LEV_HISTORY_SETTLED: { year: string; revenue: number; projected?: boolean }[] = [
  { year: "2022", revenue: 116 },
  { year: "2023", revenue: 165 },
  { year: "2024", revenue: 185 },
  { year: "2025", revenue: 298 },
];

// ── Slide shell ──
function Slide({
  children,
  className = "",
  id,
}: {
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section
      id={id}
      className={`snap-start min-h-screen w-full flex flex-col justify-center px-6 md:px-16 py-24 ${className}`}
    >
      <div className="max-w-6xl mx-auto w-full">{children}</div>
    </section>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-medium uppercase tracking-[0.2em] text-brand-500 mb-6">
      {children}
    </p>
  );
}

function Title({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-display text-4xl md:text-5xl leading-[1.1] text-text-primary mb-6 tracking-tight">
      {children}
    </h2>
  );
}

function Lede({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-lg md:text-xl leading-relaxed text-text-secondary max-w-2xl">
      {children}
    </p>
  );
}

// ── Sticky control bar ──
function ControlBar() {
  const { assumptions, setFinancingPath, activeScenario, setActiveScenario } = useModelStore();
  const { t } = useTranslation();

  const pathOptions: { key: FinancingPath; label: string }[] = [
    { key: "commercial", label: t("pitch.bar.commercial") },
    { key: "rrf", label: t("pitch.bar.rrf") },
    { key: "grant", label: t("pitch.bar.grant") },
    { key: "tepix-loan", label: t("pitch.bar.tepix") },
  ];
  const scenarioOptions: { key: ScenarioName; label: string }[] = [
    { key: "realistic", label: t("pitch.bar.realistic") },
    { key: "upside", label: t("pitch.bar.upside") },
    { key: "downside", label: t("pitch.bar.downside") },
  ];

  // Per audit 2026-05-21 fix #5: persistent badge so a banker can't accidentally
  // read Upside / Downside numbers as the base case. Default is Realistic in
  // the store (`modelStore.ts` line 748); we just surface it here unambiguously.
  const isRealisticBase = activeScenario === "realistic";
  const scenarioBadgeLabel = isRealisticBase
    ? t("pitch.bar.realistic")
    : activeScenario === "upside"
      ? t("pitch.bar.upside")
      : t("pitch.bar.downside");

  return (
    <div className="sticky top-0 z-50 bg-surface-primary/90 backdrop-blur-md border-b border-surface-tertiary">
      <div className="max-w-6xl mx-auto px-6 md:px-16 h-14 flex items-center justify-between gap-6">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/" className="font-display text-base text-text-primary truncate">
            Villa Lev Group
          </Link>
          <span
            className={`hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider border ${
              isRealisticBase
                ? "border-earth-olive/40 text-earth-olive bg-earth-olive/10"
                : "border-warning/50 text-warning bg-warning/10"
            }`}
            aria-label={`Active case: ${scenarioBadgeLabel}`}
            title={
              isRealisticBase
                ? "Base case — the figures across this deck reflect the Realistic scenario."
                : "Non-base case — figures across this deck reflect a non-Realistic scenario."
            }
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isRealisticBase ? "bg-earth-olive" : "bg-warning"
              }`}
            />
            {scenarioBadgeLabel}
          </span>
        </div>
        <div className="flex items-center gap-6 text-xs">
          <div className="hidden md:flex items-center gap-1">
            <span className="text-text-tertiary uppercase tracking-wider mr-2">{t("pitch.bar.path")}</span>
            {pathOptions.map((o) => (
              <button
                key={o.key}
                onClick={() => setFinancingPath(o.key)}
                className={`px-2.5 py-1 rounded transition-colors ${
                  assumptions.financingPath === o.key
                    ? "bg-brand-500 text-white"
                    : "text-text-secondary hover:bg-surface-secondary"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <span className="text-text-tertiary uppercase tracking-wider mr-2 hidden md:inline">
              {t("pitch.bar.case")}
            </span>
            {scenarioOptions.map((o) => (
              <button
                key={o.key}
                onClick={() => setActiveScenario(o.key)}
                className={`px-2.5 py-1 rounded transition-colors ${
                  activeScenario === o.key
                    ? "bg-earth-olive text-white"
                    : "text-text-secondary hover:bg-surface-secondary"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Break-even heatmap cell helper ──
function dscrColor(dscr: number): string {
  if (dscr >= 1.75) return "#6B7A3D";
  if (dscr >= 1.5) return "#8FA359";
  if (dscr >= 1.25) return "#C4A55E";
  if (dscr >= 1.1) return "#C4754B";
  return "#9E3B3B";
}

export default function PitchPage() {
  const { model, assumptions, activeScenario } = useModelStore();
  const { locale, t } = useTranslation();
  // Live 2026 revenue — same source the admin dashboard's Conservatism Check
  // reads (`useSeasonSnapshot` → `historicalYears`). While Firestore is still
  // doing its first read (`loading === true`), `historicalYears` already holds
  // the static fallback from `currentVillaActuals.ts`, but we deliberately hide
  // the 2026 bar to avoid showing a stale projection as a confirmed datapoint.
  const { historicalYears, loading: snapshotLoading } = useSeasonSnapshot();

  // BP per-villa assumptions in scope for the ConservatismTriangle on the
  // Market Tailwind slide. Render is gated on `model` being ready so this is
  // safe to read unconditionally here.
  const rev = assumptions.revenueRealistic;

  // Pre-compute derived data (all hooks must run before any early return)
  const km = model?.keyMetrics;
  const scenario = model?.scenarios[activeScenario] ?? model?.scenarios.realistic;
  const villaLevHistory = useMemo(() => {
    if (snapshotLoading) return VILLA_LEV_HISTORY_SETTLED;
    const y2026 = historicalYears.find((y) => y.year === 2026);
    if (!y2026 || !Number.isFinite(y2026.total) || y2026.total <= 0) {
      return VILLA_LEV_HISTORY_SETTLED;
    }
    return [
      ...VILLA_LEV_HISTORY_SETTLED,
      { year: "2026 YTD", revenue: Math.round(y2026.total / 1000), projected: true },
    ];
  }, [historicalYears, snapshotLoading]);
  const operatingPnl = useMemo(
    () => scenario?.pnl.filter((p) => p.year >= 2029) ?? [],
    [scenario]
  );

  const revenueChart = useMemo(
    () =>
      operatingPnl.map((p) => ({
        year: p.year,
        Revenue: Math.round(p.totalRevenue),
        EBITDA: Math.round(p.ebitda),
        "Net Cash Flow": Math.round(p.netCashFlow),
      })),
    [operatingPnl]
  );

  const dscrChart = useMemo(
    () =>
      (model?.dscrByYear ?? [])
        .filter((d) => d.year >= 2029)
        .map((d) => ({
          year: d.year,
          Realistic: Number(d.realistic.toFixed(2)),
          Upside: Number(d.upside.toFixed(2)),
          Downside: Number(d.downside.toFixed(2)),
        })),
    [model]
  );

  // Break-even heatmap grid from the realistic stabilised year
  const heatmap = useMemo(() => {
    if (!model || !km) return null;
    const stab = model.scenarios.realistic.stabilisedYear;
    if (!stab) return null;
    const baseRevenue = stab.totalRevenue;
    const baseEbitda = stab.ebitda;
    const baseNights = stab.villaNights + stab.suiteNights;
    const ds = km.annualDS;

    // Revenue scales ~linearly with both ADR and nights (OPEX is largely fixed here).
    // This is directional, not the full engine; for the live figure we still show km.stabilisedDSCR.
    const nightsRange = [50, 60, 70, 80, 90, 100, 110];
    const adrRange = [2000, 2500, 3000, 3500, 4000, 4500];
    const grid: { nights: number; adr: number; dscr: number }[] = [];
    for (const n of nightsRange) {
      for (const a of adrRange) {
        const scaledRevenue = baseRevenue * (n / baseNights) * (a / 3500); // 3500 ~= realistic blended ADR
        const fixedOpex = baseRevenue - baseEbitda; // approximate OPEX floor
        const scaledEbitda = scaledRevenue - fixedOpex;
        const dscr = ds > 0 ? scaledEbitda / ds : 0;
        grid.push({ nights: n, adr: a, dscr });
      }
    }
    return { nightsRange, adrRange, grid };
  }, [model, km]);

  if (!model || !km) {
    return (
      <>
        <ControlBar />
        <div className="flex items-center justify-center h-screen text-text-tertiary">
          {t("pitch.loading")}
        </div>
      </>
    );
  }

  // locale comes from useTranslation above — number formatting now follows the user's locale.

  // Capital structure (reacts to financing path)
  const grantAmount =
    assumptions.financingPath === "grant"
      ? Math.max(0, km.totalCapex - km.loanAmount - km.equityRequired)
      : 0;
  const capitalData = [
    { name: t("pitch.capital.bankLoan"), value: km.loanAmount, color: "#8B6914" },
    { name: t("pitch.capital.equity"), value: km.equityRequired, color: "#6B7A3D" },
    ...(grantAmount > 0
      ? [{ name: t("pitch.capital.grant"), value: grantAmount, color: "#4A7C3F" }]
      : []),
  ];

  const pathLabel =
    assumptions.financingPath === "commercial"
      ? t("pitch.pathLabel.commercial")
      : assumptions.financingPath === "rrf"
        ? t("pitch.pathLabel.rrf")
        : assumptions.financingPath === "grant"
          ? t("pitch.pathLabel.grant")
          : t("pitch.pathLabel.tepix");

  const scenarioLabel =
    activeScenario === "realistic"
      ? t("pitch.bar.realistic")
      : activeScenario === "upside"
        ? t("pitch.bar.upside")
        : t("pitch.bar.downside");

  return (
    <>
      <ControlBar />
      <div className="snap-y snap-mandatory h-[calc(100vh-3.5rem)] overflow-y-scroll scroll-smooth">
        {/* ────────────────────────────────── 1 · COVER ────────────────────────────────── */}
        <Slide id="cover" className="bg-surface-primary">
          <div className="text-center">
            <Eyebrow>{t("pitch.cover.eyebrow")}</Eyebrow>
            <h1 className="font-display text-5xl md:text-7xl leading-[1] text-text-primary mb-6 tracking-tight">
              {t("pitch.cover.titleLine1")}
              <br />
              <span className="text-brand-500">{t("pitch.cover.titleLine2")}</span>
            </h1>
            <p className="text-lg md:text-xl text-text-secondary max-w-2xl mx-auto mb-16">
              {t("pitch.cover.lede")}
            </p>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 py-10 border-y border-surface-tertiary max-w-4xl mx-auto">
              <HeroStat
                value={formatCurrency(km.totalCapex, true, locale)}
                label={t("pitch.cover.totalInvestment")}
              />
              <HeroStat
                value={formatCurrency(km.loanAmount, true, locale)}
                label={t("pitch.cover.loanRequested")}
                sub={`${formatPercent(km.loanAmount / km.totalCapex, 0)} ${t("pitch.cover.ofCapex")}`}
              />
              <HeroStat
                value={`~${formatPercent(km.ltv, 0)}`}
                label={t("pitch.cover.ltvAtCompletion")}
              />
              <HeroStat
                value={formatMultiple(km.assetCoverage)}
                label={t("pitch.cover.assetCoverage")}
                sub={formatCurrency(km.portfolioValue, true, locale)}
              />
            </div>

            <p className="mt-8 text-xs text-text-tertiary uppercase tracking-widest">
              {t("pitch.cover.liveModel")} · {t("pitch.cover.path")}: {pathLabel} · {t("pitch.cover.case")}: {scenarioLabel}
            </p>
          </div>
        </Slide>

        {/* ────────────────────────────── 2 · TRACK RECORD ────────────────────────────── */}
        <Slide id="track-record">
          <Eyebrow>{t("pitch.track.eyebrow")}</Eyebrow>
          <Title>
            {t("pitch.track.titleLine1")}
            <br />
            {t("pitch.track.titleLine2")}
          </Title>
          <Lede>
            {t("pitch.track.ledePart1")} <em className="not-italic text-text-primary font-medium">€298,000</em>{t("pitch.track.ledePart2")}{" "}
            <em className="not-italic text-text-primary font-medium">€300,000</em> {t("pitch.track.ledePart3")}
          </Lede>

          <div className="mt-12 bg-white rounded-xl border border-surface-tertiary p-8">
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={villaLevHistory}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EDE6D5" />
                <XAxis dataKey="year" tick={{ fontSize: 12 }} />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v: number) => `€${v}K`}
                />
                <Tooltip
                  formatter={(value) => `€${Number(value)}K`}
                  contentStyle={{
                    borderRadius: 8,
                    border: "1px solid #EDE6D5",
                    fontSize: 12,
                  }}
                />
                <Bar
                  dataKey="revenue"
                  name={t("pitch.track.revenueLegend")}
                  radius={[4, 4, 0, 0]}
                  fill="#C4A55E"
                />
              </ComposedChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-3 gap-6 mt-6 pt-6 border-t border-surface-tertiary text-center">
              <Stat value={t("pitch.track.stat1Value")} label={t("pitch.track.stat1Label")} />
              <Stat value={t("pitch.track.stat2Value")} label={t("pitch.track.stat2Label")} />
              <Stat value={t("pitch.track.stat3Value")} label={t("pitch.track.stat3Label")} />
            </div>
          </div>

          <p className="mt-8 text-sm italic text-text-tertiary max-w-2xl">
            {t("pitch.track.quote")}
          </p>
        </Slide>

        {/* ────────────────────────────── 3 · MARKET TAILWIND ────────────────────────────── */}
        <Slide id="market" className="bg-surface-secondary">
          <Eyebrow>{t("pitch.market.eyebrow")}</Eyebrow>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
            <div>
              <Title>{t("pitch.market.title")}</Title>
              <div className="mt-8 space-y-6 text-base text-text-secondary">
                <p>
                  {t("pitch.market.bodyPart1")}{" "}
                  <strong className="text-text-primary">37,000</strong> {t("pitch.market.bodyPart2")}{" "}
                  <strong className="text-text-primary">171,500</strong>{" "}
                  {t("pitch.market.bodyPart3")}{" "}
                  <strong className="text-text-primary">−2.7%</strong> {t("pitch.market.bodyPart4")}{" "}
                  <strong className="text-text-primary">+3.6%</strong>.
                </p>
                <p>{t("pitch.market.tailwindsIntro")}</p>
                <ul className="space-y-2 text-sm">
                  <li className="flex gap-3">
                    <span className="text-brand-500 mt-1">●</span>
                    <span>
                      <strong className="text-text-primary">{t("pitch.market.tailwind1Term")}</strong> {t("pitch.market.tailwind1Body")}
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <span className="text-brand-500 mt-1">●</span>
                    <span>
                      <strong className="text-text-primary">{t("pitch.market.tailwind2Term")}</strong> {t("pitch.market.tailwind2Body")}
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <span className="text-brand-500 mt-1">●</span>
                    <span>
                      <strong className="text-text-primary">{t("pitch.market.tailwind3Term")}</strong>{" "}
                      {t("pitch.market.tailwind3Body")}
                    </span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="text-center">
              <div className="font-display text-8xl md:text-9xl text-brand-500 leading-none tracking-tight">
                4.6×
              </div>
              <div className="mt-4 text-sm uppercase tracking-widest text-text-tertiary">
                {t("pitch.market.heroLabel")}
              </div>
              <div className="mt-8 pt-8 border-t border-surface-tertiary">
                <div className="font-display text-3xl text-text-primary">+12.5%</div>
                <div className="text-xs text-text-tertiary mt-1">{t("pitch.market.yoyLabel")}</div>
              </div>
            </div>
          </div>

          {/* BP-vs-market panel — Conservatism Triangle strip. Replaces the
              prior 3-tier card grid (ADR 0003, 2026-05-22): Greek-only
              headline, international comparables in the drawer drill-down,
              villa intentionally absent (Villa Lev actuals are the truer
              villa comparable). */}
          <div className="mt-12 pt-10 border-t border-surface-tertiary">
            <ConservatismTriangle
              bpStandardADR={rev.suiteStandardADR}
              bpPremiumADR={rev.suiteDoubleADR}
            />
          </div>
        </Slide>

        {/* ────────────────────────────── 4 · THE PROJECT ────────────────────────────── */}
        <Slide id="project">
          <Eyebrow>{t("pitch.project.eyebrow")}</Eyebrow>
          <Title>{t("pitch.project.title")}</Title>
          <Lede>{t("pitch.project.lede")}</Lede>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
            <PropertyCard
              name={t("pitch.project.twinIName")}
              type={t("pitch.project.twinType")}
              capex="€2.17M"
              detail={t("pitch.project.twinIDetail")}
            />
            <PropertyCard
              name={t("pitch.project.twinIIName")}
              type={t("pitch.project.twinType")}
              capex="€2.17M"
              detail={t("pitch.project.twinIIDetail")}
            />
            <PropertyCard
              name={t("pitch.project.suitesName")}
              type={t("pitch.project.suitesType")}
              capex="€1.68M"
              detail={t("pitch.project.suitesDetail")}
              accent
            />
          </div>

          <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-6">
            {model.capex.categories
              .filter((c) => c.name !== "Total" && c.grandTotal > 0)
              .slice(0, 4)
              .map((c) => (
                <div key={c.name} className="border-l-2 border-brand-400 pl-4">
                  <div className="data-cell text-text-primary">
                    {formatCurrency(c.grandTotal, true, locale)}
                  </div>
                  <div className="text-xs text-text-tertiary mt-1">{c.name}</div>
                </div>
              ))}
          </div>
        </Slide>

        {/* ────────────────────────────── 5 · CAPITAL STRUCTURE ────────────────────────────── */}
        <Slide id="capital" className="bg-surface-secondary">
          <Eyebrow>{t("pitch.capital.eyebrow")} · {pathLabel}</Eyebrow>
          <Title>{t("pitch.capital.title")}</Title>
          <Lede>{t("pitch.capital.lede")}</Lede>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mt-12 items-start">
            <div className="bg-white rounded-xl border border-surface-tertiary p-8">
              <div className="flex items-baseline justify-between mb-8">
                <div className="text-xs uppercase tracking-wider text-text-tertiary">
                  {t("pitch.capital.phasedDrawdown")}
                </div>
                <div className="text-[10px] uppercase tracking-widest text-earth-terracotta font-medium">
                  {t("pitch.capital.permitGated")}
                </div>
              </div>

              {/* Drawdown bar with permit gate */}
              <div className="mb-2 pt-6">
                <div className="flex items-stretch h-20 rounded-lg overflow-visible relative">
                  <div
                    className="bg-earth-olive text-white flex flex-col items-center justify-center rounded-l-lg"
                    style={{ width: "22%" }}
                  >
                    <div className="text-[10px] uppercase tracking-wider opacity-80">
                      {t("pitch.capital.phase1")}
                    </div>
                    <div className="font-display text-lg leading-tight">€1.35M</div>
                    <div className="text-[10px] opacity-80">22%</div>
                  </div>
                  <div className="relative flex-shrink-0 w-0 border-l-2 border-dashed border-earth-terracotta">
                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] uppercase tracking-widest text-earth-terracotta font-medium whitespace-nowrap">
                      {t("pitch.capital.permitGate")}
                    </div>
                  </div>
                  <div className="bg-brand-500 text-white flex flex-col items-center justify-center flex-1 rounded-r-lg">
                    <div className="text-[10px] uppercase tracking-wider opacity-80">
                      {t("pitch.capital.phase2")}
                    </div>
                    <div className="font-display text-lg leading-tight">€4.82M</div>
                    <div className="text-[10px] opacity-80">78%</div>
                  </div>
                </div>
                <div className="flex justify-between text-[10px] text-text-tertiary mt-2 uppercase tracking-wider">
                  <span>Q2 2026</span>
                  <span>Q4 2026 – Q1 2027</span>
                  <span>{t('pitch.timeline.opening')}</span>
                </div>
              </div>

              <div className="space-y-3 mt-8 text-sm">
                <div className="flex gap-3">
                  <div className="w-1 bg-earth-olive rounded flex-shrink-0 mt-1" />
                  <div>
                    <div className="text-text-primary font-medium">
                      {t("pitch.capital.phase1Title")}
                    </div>
                    <div className="text-text-secondary leading-relaxed">
                      {t("pitch.capital.phase1Body")}
                    </div>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="w-1 bg-brand-500 rounded flex-shrink-0 mt-1" />
                  <div>
                    <div className="text-text-primary font-medium">
                      {t("pitch.capital.phase2Title")}
                    </div>
                    <div className="text-text-secondary leading-relaxed">
                      {t("pitch.capital.phase2Body")}
                    </div>
                  </div>
                </div>
              </div>

              {/* Sources footer */}
              <div className="mt-6 pt-5 border-t border-surface-tertiary">
                <div className="text-[10px] uppercase tracking-widest text-text-tertiary mb-3">
                  {t("pitch.capital.fundedBy")}
                </div>
                <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs">
                  {capitalData.map((item) => (
                    <div key={item.name} className="flex items-center gap-2">
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-text-secondary">{item.name}</span>
                      <span className="data-cell text-text-primary">
                        {formatCurrency(item.value, true, locale)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <KV label={t("pitch.capital.kvStabilisedRevenue")} value={formatCurrency(km.stabilisedRevenue, true, locale)} />
              <KV label={t("pitch.capital.kvStabilisedEbitda")} value={formatCurrency(km.stabilisedEBITDA, true, locale)} />
              <KV label={t("pitch.capital.kvEbitdaMargin")} value={formatPercent(km.stabilisedEBITDAMargin)} />
              <KV label={t("pitch.capital.kvAnnualDS")} value={formatCurrency(km.annualDS, true, locale)} />
              <KV
                label={t("pitch.capital.kvStabilisedDscr")}
                value={formatMultiple(km.stabilisedDSCR)}
                highlight
              />
              <KV label={t("pitch.capital.kvNetCashFlow")} value={formatCurrency(km.stabilisedNCF, true, locale)} />
            </div>
          </div>
        </Slide>

        {/* ────────────────────────────── 6 · REVENUE RAMP ────────────────────────────── */}
        <Slide id="ramp">
          <Eyebrow>{t("pitch.ramp.eyebrowPrefix")} {scenarioLabel} {t("pitch.ramp.eyebrowSuffix")}</Eyebrow>
          <Title>{t("pitch.ramp.title")}</Title>
          <Lede>{t("pitch.ramp.lede")}</Lede>

          <div className="mt-10 bg-white rounded-xl border border-surface-tertiary p-8">
            <ResponsiveContainer width="100%" height={340}>
              <ComposedChart data={revenueChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EDE6D5" />
                <XAxis dataKey="year" tick={{ fontSize: 12 }} />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v: number) => `€${(v / 1000).toFixed(0)}K`}
                />
                <Tooltip
                  formatter={(value) => formatCurrency(Number(value), false, locale)}
                  contentStyle={{ borderRadius: 8, border: "1px solid #EDE6D5", fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Revenue" name={t("pitch.ramp.totalRevenue")} fill="#C4A55E" radius={[4, 4, 0, 0]} />
                <Bar dataKey="EBITDA" name={t("pitch.ramp.ebitda")} fill="#6B7A3D" radius={[4, 4, 0, 0]} />
                <Line
                  type="monotone"
                  dataKey="Net Cash Flow"
                  name={t("pitch.ramp.netCashFlow")}
                  stroke="#4A6A8B"
                  strokeWidth={2.5}
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Slide>

        {/* ────────────────────────────── 7 · DSCR ────────────────────────────── */}
        <Slide id="dscr" className="bg-surface-secondary">
          <Eyebrow>
            {t("pitch.dscr.eyebrowPrefix")} {scenarioLabel} {t("pitch.dscr.eyebrowSuffix")}
          </Eyebrow>
          <Title>
            {t("pitch.dscr.titleLine1")}
            <br />
            {t("pitch.dscr.titleLine2Prefix")}{" "}
            <span className="text-brand-500">
              {formatMultiple(scenario?.stabilisedYear?.dscr ?? km.stabilisedDSCR)}
            </span>
            .
          </Title>
          <Lede>{t("pitch.dscr.lede")}</Lede>

          <div className="mt-10 bg-white rounded-xl border border-surface-tertiary p-8">
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={dscrChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EDE6D5" />
                <XAxis dataKey="year" tick={{ fontSize: 12 }} />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v: number) => `${v.toFixed(1)}×`}
                  domain={[0, "auto"]}
                />
                <Tooltip
                  formatter={(value) => `${Number(value).toFixed(2)}×`}
                  contentStyle={{ borderRadius: 8, border: "1px solid #EDE6D5", fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {/* Safe zone (above the covenant) shaded pale green */}
                <ReferenceArea y1={1.25} y2={10} fill="#6B7A3D" fillOpacity={0.07} />
                <ReferenceLine
                  y={1.25}
                  stroke="#8C8477"
                  strokeDasharray="4 4"
                  label={{
                    value: t("pitch.dscr.covenantLabel"),
                    fontSize: 10,
                    fill: "#8C8477",
                    position: "insideTopRight",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="Realistic"
                  name={t("pitch.dscr.realisticLegend")}
                  stroke="#8B6914"
                  strokeWidth={activeScenario === "realistic" ? 3 : 1.25}
                  strokeOpacity={activeScenario === "realistic" ? 1 : 0.35}
                  dot={activeScenario === "realistic" ? { r: 3, fill: "#8B6914" } : false}
                />
                <Line
                  type="monotone"
                  dataKey="Upside"
                  name={t("pitch.dscr.upsideLegend")}
                  stroke="#6B7A3D"
                  strokeWidth={activeScenario === "upside" ? 3 : 1.25}
                  strokeOpacity={activeScenario === "upside" ? 1 : 0.35}
                  strokeDasharray={activeScenario === "upside" ? "0" : "4 2"}
                  dot={activeScenario === "upside" ? { r: 3, fill: "#6B7A3D" } : false}
                />
                <Line
                  type="monotone"
                  dataKey="Downside"
                  name={t("pitch.dscr.downsideLegend")}
                  stroke="#4A6A8B"
                  strokeWidth={activeScenario === "downside" ? 3 : 1.25}
                  strokeOpacity={activeScenario === "downside" ? 1 : 0.35}
                  strokeDasharray={activeScenario === "downside" ? "0" : "4 2"}
                  dot={activeScenario === "downside" ? { r: 3, fill: "#4A6A8B" } : false}
                />
              </LineChart>
            </ResponsiveContainer>
            <p className="text-[11px] text-text-tertiary mt-4 text-center">
              {t("pitch.dscr.footnote")}
            </p>
          </div>
        </Slide>

        {/* ────────────────────────────── 7.5 · EVENTS / WEDDINGS / RETREATS ────────────────────────────── */}
        <Slide id="events">
          <Eyebrow>{t("pitch.events.eyebrow")}</Eyebrow>
          <Title>
            {t("pitch.events.titleLine1")}
            <br />
            <span className="text-brand-500">{t("pitch.events.titleLine2")}</span>
          </Title>
          <Lede>
            {t("pitch.events.ledePart1")} <strong className="text-text-primary">{t("pitch.events.ledePart2")}</strong> {t("pitch.events.ledePart3")}
          </Lede>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
            <div className="bg-white rounded-xl border border-surface-tertiary p-6">
              <div className="font-display text-4xl text-brand-500 tracking-tight leading-none">
                {t("pitch.events.card1Value")}
              </div>
              <div className="text-xs uppercase tracking-wider text-text-tertiary mt-2 mb-4">
                {t("pitch.events.card1Label")}
              </div>
              <p className="text-sm text-text-secondary leading-relaxed">
                {t("pitch.events.card1Body")}
              </p>
            </div>

            <div className="bg-white rounded-xl border border-surface-tertiary p-6">
              <div className="font-display text-4xl text-brand-500 tracking-tight leading-none">
                {t("pitch.events.card2Value")}
              </div>
              <div className="text-xs uppercase tracking-wider text-text-tertiary mt-2 mb-4">
                {t("pitch.events.card2Label")}
              </div>
              <p className="text-sm text-text-secondary leading-relaxed">
                {t("pitch.events.card2Body")}
              </p>
            </div>

            <div className="bg-white rounded-xl border border-surface-tertiary p-6">
              <div className="font-display text-4xl text-brand-500 tracking-tight leading-none">
                {t("pitch.events.card3Value")}
              </div>
              <div className="text-xs uppercase tracking-wider text-text-tertiary mt-2 mb-4">
                {t("pitch.events.card3Label")}
              </div>
              <p className="text-sm text-text-secondary leading-relaxed">
                {t("pitch.events.card3Body")}
              </p>
            </div>
          </div>

          <div className="mt-10 bg-brand-50 rounded-xl p-6 border-l-4 border-brand-500">
            <p className="text-sm text-text-primary leading-relaxed italic">
              {t("pitch.events.quote")}
            </p>
          </div>
        </Slide>

        {/* ────────────────────────────── 8 · RESILIENCE / STRESS ────────────────────────────── */}
        <Slide id="resilience">
          <Eyebrow>{t("pitch.resilience.eyebrow")}</Eyebrow>
          <Title>{t("pitch.resilience.title")}</Title>
          <Lede>{t("pitch.resilience.lede")}</Lede>

          {heatmap && (
            <div className="mt-10 bg-white rounded-xl border border-surface-tertiary p-8 overflow-x-auto">
              <div className="inline-block">
                <div className="flex">
                  <div className="w-20" />
                  {heatmap.adrRange.map((a) => (
                    <div
                      key={a}
                      className="w-20 text-center text-xs text-text-tertiary font-mono"
                    >
                      €{(a / 1000).toFixed(1)}K
                    </div>
                  ))}
                </div>
                {heatmap.nightsRange
                  .slice()
                  .reverse()
                  .map((n) => (
                    <div key={n} className="flex">
                      <div className="w-20 text-right pr-3 text-xs text-text-tertiary font-mono self-center">
                        {n} {t("pitch.resilience.nightsUnit")}
                      </div>
                      {heatmap.adrRange.map((a) => {
                        const cell = heatmap.grid.find(
                          (g) => g.nights === n && g.adr === a
                        );
                        const dscr = cell?.dscr ?? 0;
                        return (
                          <div
                            key={a}
                            className="w-20 h-12 m-0.5 rounded flex items-center justify-center text-xs font-mono font-medium text-white"
                            style={{ backgroundColor: dscrColor(dscr) }}
                            title={`${n} nts × €${a} ADR → ${dscr.toFixed(2)}×`}
                          >
                            {dscr.toFixed(2)}×
                          </div>
                        );
                      })}
                    </div>
                  ))}
              </div>
              <div className="mt-6 flex flex-wrap items-center gap-4 text-xs text-text-tertiary">
                <span className="uppercase tracking-wider">{t("pitch.resilience.dscrLabel")}</span>
                {[
                  { c: "#9E3B3B", l: t("pitch.resilience.legendBelow110") },
                  { c: "#C4754B", l: t("pitch.resilience.legend110_125") },
                  { c: "#C4A55E", l: t("pitch.resilience.legend125_150") },
                  { c: "#8FA359", l: t("pitch.resilience.legend150_175") },
                  { c: "#6B7A3D", l: t("pitch.resilience.legendAbove175") },
                ].map((s) => (
                  <span key={s.l} className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded" style={{ backgroundColor: s.c }} />
                    {s.l}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="mt-8 grid grid-cols-3 gap-6">
            <Stat
              value={`${Math.round(km.breakEvenNights ?? 58)}`}
              label={t("pitch.resilience.statBeNightsLabel")}
              sub={t("pitch.resilience.statBeNightsSub")}
            />
            <Stat
              value={formatCurrency(470000, true, locale)}
              label={t("pitch.resilience.statRevolverLabel")}
              sub={t("pitch.resilience.statRevolverSub")}
            />
            <Stat
              value={`${(((km.bufferToBreakEven ?? 0.34) * 100) | 0)}%`}
              label={t("pitch.resilience.statBufferLabel")}
              sub={t("pitch.resilience.statBufferSub")}
            />
          </div>
        </Slide>

        {/* ────────────────────────────── 9 · COLLATERAL ────────────────────────────── */}
        <Slide id="collateral" className="bg-surface-secondary">
          <Eyebrow>{t("pitch.collateral.eyebrow")}</Eyebrow>
          <Title>
            {t("pitch.collateral.titlePart1")} {formatMultiple(km.assetCoverage)} {t("pitch.collateral.titlePart2")}
          </Title>
          <Lede>
            {t("pitch.collateral.ledePart1")}{" "}
            {formatMultiple(model.collateral.stress.coverage)}
            {t("pitch.collateral.ledePart2")}
          </Lede>

          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
            <CollateralCard
              label={t("pitch.collateral.tierStress")}
              coverageLabel={t("pitch.collateral.cardCoverageLabel")}
              ltvLabel={t("pitch.collateral.cardLtv")}
              priceLabel={t("pitch.collateral.cardPriceM2")}
              valueLabel={t("pitch.collateral.cardValue")}
              coverage={model.collateral.stress.coverage}
              ltv={model.collateral.stress.ltv}
              price={model.collateral.stress.valuationPerM2}
              value={model.collateral.stress.value}
              tone="stress"
              locale={locale}
            />
            <CollateralCard
              label={t("pitch.collateral.tierMarket")}
              coverageLabel={t("pitch.collateral.cardCoverageLabel")}
              ltvLabel={t("pitch.collateral.cardLtv")}
              priceLabel={t("pitch.collateral.cardPriceM2")}
              valueLabel={t("pitch.collateral.cardValue")}
              coverage={model.collateral.market.coverage}
              ltv={model.collateral.market.ltv}
              price={model.collateral.market.valuationPerM2}
              value={model.collateral.market.value}
              tone="market"
              locale={locale}
              featured
            />
            <CollateralCard
              label={t("pitch.collateral.tierPositive")}
              coverageLabel={t("pitch.collateral.cardCoverageLabel")}
              ltvLabel={t("pitch.collateral.cardLtv")}
              priceLabel={t("pitch.collateral.cardPriceM2")}
              valueLabel={t("pitch.collateral.cardValue")}
              coverage={model.collateral.optimistic.coverage}
              ltv={model.collateral.optimistic.ltv}
              price={model.collateral.optimistic.valuationPerM2}
              value={model.collateral.optimistic.value}
              tone="optimistic"
              locale={locale}
            />
          </div>
        </Slide>

        {/* ────────────────────────────── 10 · FINANCING OPTIONALITY ────────────────────────────── */}
        <Slide id="optionality">
          <Eyebrow>{t("pitch.optionality.eyebrow")}</Eyebrow>
          <Title>{t("pitch.optionality.title")}</Title>
          <Lede>
            {t("pitch.optionality.ledePart1")}{" "}
            <strong className="text-text-primary">€2.17M</strong>{t("pitch.optionality.ledePart2")}{" "}
            <strong className="text-text-primary">3.4×</strong>{t("pitch.optionality.ledePart3")}
          </Lede>

          <div className="mt-10 bg-white rounded-xl border border-surface-tertiary p-8 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-tertiary">
                  <th className="text-left py-3 pr-4 text-xs uppercase tracking-wider text-text-tertiary font-medium">
                    {t("pitch.optionality.tableMetric")}
                  </th>
                  <th className="text-right py-3 px-3 text-xs uppercase tracking-wider text-text-tertiary font-medium">
                    {t("pitch.optionality.tableCommercial")}
                  </th>
                  <th className="text-right py-3 px-3 text-xs uppercase tracking-wider text-text-tertiary font-medium">
                    {t("pitch.optionality.tableRrf")}
                  </th>
                  <th className="text-right py-3 px-3 text-xs uppercase tracking-wider text-positive font-medium">
                    {t("pitch.optionality.tableGrant")}
                  </th>
                  <th
                    className="text-right py-3 px-3 text-xs uppercase tracking-wider font-medium"
                    style={{ color: "#7B5EA7" }}
                  >
                    {t("pitch.optionality.tableTepix")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {model.financingComparison.map((row, i) => {
                  const fmt = (v: string | number) =>
                    typeof v === "number"
                      ? row.metric.includes("DSCR")
                        ? formatMultiple(v)
                        : formatCurrency(v, true, locale)
                      : v;
                  return (
                    <tr key={i} className="border-b border-surface-secondary/60">
                      <td className="py-3 pr-4 text-text-secondary">{row.metric}</td>
                      <td className="text-right py-3 px-3 data-cell">{fmt(row.commercial)}</td>
                      <td className="text-right py-3 px-3 data-cell">{fmt(row.rrf)}</td>
                      <td className="text-right py-3 px-3 data-cell text-positive font-medium">
                        {fmt(row.grant)}
                      </td>
                      <td
                        className="text-right py-3 px-3 data-cell"
                        style={{ color: "#7B5EA7" }}
                      >
                        {fmt(row.tepixLoan)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Slide>

        {/* ────────────────────────────── 11 · TEAM + ASK ────────────────────────────── */}
        <Slide id="close" className="bg-brand-50">
          <div className="text-center">
            <Eyebrow>{t("pitch.close.eyebrow")}</Eyebrow>
            <Title>{t("pitch.close.title")}</Title>
            <Lede>
              <span className="block mx-auto">{t("pitch.close.lede")}</span>
            </Lede>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
            <div className="bg-white rounded-xl border border-surface-tertiary p-6">
              <div className="text-xs uppercase tracking-wider text-text-tertiary mb-3">
                {t("pitch.close.operatorLabel")}
              </div>
              <div className="font-display text-xl text-text-primary mb-2">{t("pitch.close.operatorName")}</div>
              <div className="text-sm text-text-secondary leading-relaxed">
                {t("pitch.close.operatorBody")}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-surface-tertiary p-6">
              <div className="text-xs uppercase tracking-wider text-text-tertiary mb-3">
                {t("pitch.close.timelineLabel")}
              </div>
              <ul className="space-y-2 text-sm text-text-secondary">
                <li>
                  <span className="data-cell text-text-primary mr-2">{t("pitch.close.timeline1Date")}</span> {t("pitch.close.timeline1Body")}
                </li>
                <li>
                  <span className="data-cell text-text-primary mr-2">{t("pitch.close.timeline2Date")}</span>{" "}
                  {t("pitch.close.timeline2Body")}
                </li>
                <li>
                  <span className="data-cell text-text-primary mr-2">{t("pitch.close.timeline3Date")}</span>{" "}
                  {t("pitch.close.timeline3Body")}
                </li>
                <li>
                  <span className="data-cell text-text-primary mr-2">{t("pitch.close.timeline4Date")}</span>{" "}
                  {t("pitch.close.timeline4Body")}
                </li>
              </ul>
            </div>

            <div className="bg-brand-500 text-white rounded-xl p-6">
              <div className="text-xs uppercase tracking-wider text-brand-100 mb-3">
                {t("pitch.close.askLabel")}
              </div>
              <div className="font-display text-3xl mb-2">
                {formatCurrency(km.loanAmount, true, locale)}
              </div>
              <div className="text-sm text-brand-100 leading-relaxed">
                {t("pitch.close.askBody")}
              </div>
            </div>
          </div>

          <p className="text-center mt-16 text-xs text-text-tertiary uppercase tracking-widest">
            {t("pitch.close.footer")} · {new Date().toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
          </p>
        </Slide>
      </div>
    </>
  );
}

// ── Small components ──

function HeroStat({ value, label, sub }: { value: string; label: string; sub?: string }) {
  return (
    <div className="text-center">
      <div className="kpi-hero text-text-primary">{value}</div>
      <div className="text-xs font-medium uppercase tracking-wider text-brand-500 mt-2">
        {label}
      </div>
      {sub && <div className="text-xs text-text-tertiary mt-1">{sub}</div>}
    </div>
  );
}

function Stat({ value, label, sub }: { value: string; label: string; sub?: string }) {
  return (
    <div className="text-center">
      <div className="font-display text-3xl text-text-primary tracking-tight">{value}</div>
      <div className="text-xs text-text-tertiary mt-1.5 uppercase tracking-wider">
        {label}
      </div>
      {sub && <div className="text-xs text-text-tertiary mt-1 italic normal-case tracking-normal">{sub}</div>}
    </div>
  );
}

function KV({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`flex justify-between items-center py-3 border-b border-surface-tertiary ${
        highlight ? "bg-brand-50 -mx-3 px-3 rounded-lg border-0 border-b-0" : ""
      }`}
    >
      <span className="text-sm text-text-secondary">{label}</span>
      <span
        className={`data-cell font-medium ${
          highlight ? "text-brand-600 text-base" : "text-text-primary"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function PropertyCard({
  name,
  type,
  capex,
  detail,
  accent,
}: {
  name: string;
  type: string;
  capex: string;
  detail: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-xl p-6 border ${
        accent
          ? "bg-brand-500 text-white border-brand-500"
          : "bg-white border-surface-tertiary"
      }`}
    >
      <div
        className={`text-xs uppercase tracking-wider mb-3 ${
          accent ? "text-brand-100" : "text-text-tertiary"
        }`}
      >
        {type}
      </div>
      <div className={`font-display text-xl mb-2 ${accent ? "text-white" : "text-text-primary"}`}>
        {name}
      </div>
      <div className={`data-cell text-lg mb-4 ${accent ? "text-white" : "text-brand-600"}`}>
        {capex}
      </div>
      <div
        className={`text-sm leading-relaxed ${
          accent ? "text-brand-100" : "text-text-secondary"
        }`}
      >
        {detail}
      </div>
    </div>
  );
}

function CollateralCard({
  label,
  coverageLabel,
  ltvLabel,
  priceLabel,
  valueLabel,
  coverage,
  ltv,
  price,
  value,
  tone,
  featured,
  locale,
}: {
  label: string;
  coverageLabel: string;
  ltvLabel: string;
  priceLabel: string;
  valueLabel: string;
  coverage: number;
  ltv: number;
  price: number;
  value: number;
  tone: "stress" | "market" | "optimistic";
  featured?: boolean;
  locale: Locale;
}) {
  const color =
    tone === "stress"
      ? "text-earth-terracotta"
      : tone === "optimistic"
        ? "text-positive"
        : "text-brand-600";
  return (
    <div
      className={`bg-white rounded-xl p-8 text-center ${
        featured ? "border-2 border-brand-500 shadow-sm" : "border border-surface-tertiary"
      }`}
    >
      <div className="text-xs uppercase tracking-wider text-text-tertiary mb-4">{label}</div>
      <div className={`kpi-hero ${color}`}>{formatMultiple(coverage)}</div>
      <div className="text-xs text-text-tertiary mt-2 mb-6">{coverageLabel}</div>
      <div className="space-y-2 text-sm border-t border-surface-tertiary pt-4">
        <div className="flex justify-between">
          <span className="text-text-tertiary">{ltvLabel}</span>
          <span className="data-cell text-text-primary">{formatPercent(ltv)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-text-tertiary">{priceLabel}</span>
          <span className="data-cell text-text-primary">
            {formatCurrency(price, false, locale)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-text-tertiary">{valueLabel}</span>
          <span className="data-cell text-text-primary">
            {formatCurrency(value, true, locale)}
          </span>
        </div>
      </div>
    </div>
  );
}
