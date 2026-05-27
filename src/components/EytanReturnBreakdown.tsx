"use client";

import { useTranslation } from "@/lib/i18n/I18nProvider";
import type { CapTableResult, StakeholderResult } from "@/lib/engine/capTable";

interface EytanReturnBreakdownProps {
  result: CapTableResult;
  founderResult: StakeholderResult;
  grantApproved: boolean;
  grantAmount: number;
  locale: string;
  formatCurrency: (v: number) => string;
  formatPercent: (v: number) => string;
}

// Single capacity panel — big % hero + short explanation
function CapacityPanel({
  pct,
  pctLabel,
  title,
  caption,
  note,
  extra,
  colorClass,
  dimmed,
  chip,
}: {
  pct: string;
  pctLabel: string;
  title: string;
  caption: string;
  note: string;
  extra?: React.ReactNode;
  colorClass: string; // Tailwind classes for border + heading colour
  dimmed?: boolean;
  chip?: React.ReactNode;
}) {
  return (
    <div className={`rounded-xl border p-5 flex flex-col gap-3 ${colorClass} ${dimmed ? "opacity-50" : ""}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.13em] text-text-tertiary mb-0.5">
            {title}
          </div>
          <div className="text-xs text-text-secondary leading-snug">{caption}</div>
        </div>
        {chip}
      </div>

      {/* Hero % */}
      <div>
        <div className="text-4xl font-bold font-mono tabular-nums tracking-tight leading-none">
          {pct}
        </div>
        <div className="text-[10px] text-text-tertiary mt-1">{pctLabel}</div>
      </div>

      {/* Note */}
      <p className="text-[11px] text-text-tertiary leading-snug border-t border-current/10 pt-2">
        {note}
      </p>

      {extra}
    </div>
  );
}

function StatusChip({ active, labelOn, labelOff }: { active: boolean; labelOn: string; labelOff: string }) {
  return (
    <span
      className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold uppercase tracking-wider shrink-0 ${
        active
          ? "bg-[#4A6A8B]/15 text-[#4A6A8B]"
          : "bg-neutral-200 text-text-tertiary"
      }`}
    >
      {active ? labelOn : labelOff}
    </span>
  );
}

export function EytanReturnBreakdown({
  result,
  founderResult,
  grantApproved,
  grantAmount,
  locale,
  formatCurrency,
  formatPercent,
}: EytanReturnBreakdownProps) {
  const { t } = useTranslation();

  if (!founderResult) return null;

  const b = result.founderBreakdown;
  const cashIn = founderResult.stakeholder.cashIn;

  // ── % values for each capacity ──
  const investorPct  = b.pariPassuPct;
  const developerPct = b.developerEquityPct;
  const grantPct     = b.grantBonusPct;          // 0 when grant inactive
  const ratchetPct   = b.performanceRatchetPct;
  const combinedPct  = b.founderTotalPct;

  return (
    <div id="captable-eytan-return" className="mb-6">

      {/* Section heading */}
      <div className="mb-4">
        <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-text-tertiary">
          {t("ct.roles.sectionTitle")}
        </div>
        <p className="text-xs text-text-secondary mt-0.5">
          {t("ct.roles.sectionSub")
            .replace("{pct}", formatPercent(combinedPct))}
        </p>
      </div>

      {/* Three capacity panels */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">

        {/* Panel 1 — Co-investor */}
        <CapacityPanel
          pct={formatPercent(investorPct)}
          pctLabel={t("ct.roles.panel1.pctLabel")}
          title={t("ct.roles.panel1.title")}
          caption={t("ct.roles.panel1.caption")
            .replace("{cash}", formatCurrency(cashIn))}
          note={t("ct.roles.panel1.note")}
          colorClass="border-blue-200/70 bg-blue-50/30"
        />

        {/* Panel 2 — Developer & Manager */}
        <CapacityPanel
          pct={formatPercent(developerPct)}
          pctLabel={t("ct.roles.panel2.pctLabel")}
          title={t("ct.roles.panel2.title")}
          caption={t("ct.roles.panel2.caption")}
          note={t("ct.roles.panel2.note")}
          colorClass="border-amber-300/60 bg-amber-50/30"
          extra={
            <>
              {ratchetPct > 0 && (
                <div className="text-[10px] text-amber-700/70 -mt-1">
                  {t("ct.roles.panel2.ratchetAdd")
                    .replace("{pct}", formatPercent(ratchetPct))}
                </div>
              )}
              {b.aggelakakisPromotePct > 0 && (
                <div className="text-[10px] text-amber-700/60 mt-0.5">
                  {t("ct.roles.panel2.aggelakakisSub")
                    .replace("{pct}", formatPercent(b.aggelakakisPromotePct))}
                </div>
              )}
            </>
          }
        />

        {/* Panel 3 — Grant originator */}
        <CapacityPanel
          pct={grantApproved ? formatPercent(grantPct) : "—"}
          pctLabel={t("ct.roles.panel3.pctLabel")}
          title={t("ct.roles.panel3.title")}
          caption={t("ct.roles.panel3.caption")}
          note={grantApproved
            ? t("ct.roles.panel3.note")
                .replace("{amt}", formatCurrency(grantAmount))
            : t("ct.roles.panel3.inactive")}
          colorClass={grantApproved
            ? "border-[#4A6A8B]/40 bg-[#4A6A8B]/5"
            : "border-neutral-200 bg-neutral-50/50"}
          dimmed={!grantApproved}
          chip={
            <StatusChip
              active={grantApproved}
              labelOn={t("ct.roles.panel3.activeChip")}
              labelOff={t("ct.roles.panel3.inactiveChip")}
            />
          }
          extra={
            grantApproved && b.aggelakakisExitPct > 0 ? (
              <div className="text-[10px] text-[#4A6A8B]/60 mt-0.5">
                {t("ct.roles.panel3.aggelakakisSub")
                  .replace("{pct}", formatPercent(b.aggelakakisExitPct))}
              </div>
            ) : undefined
          }
        />
      </div>

      {/* ── Combined result strip ── */}
      <div className="mt-3 rounded-xl border border-surface-tertiary bg-surface-secondary/40 p-4">
        <div className="flex items-baseline gap-3 flex-wrap">
          <span className="text-2xl font-bold font-mono tabular-nums tracking-tight">
            {formatPercent(combinedPct)}
          </span>
          <div>
            <div className="text-xs font-semibold text-text-primary">
              {t("ct.roles.total.combinedStake")}
            </div>
            <div className="text-[11px] text-text-tertiary mt-0.5 max-w-lg">
              {t("ct.roles.total.sameWaterfall")}
            </div>
          </div>
          {/* Secondary: distributions, de-emphasised */}
          <div className="ml-auto text-right shrink-0">
            <div className="text-[10px] text-text-tertiary uppercase tracking-wider">
              {t("ct.roles.total.distributions")}
            </div>
            <div className="font-mono text-sm text-text-secondary tabular-nums">
              {formatCurrency(founderResult.totalReceived)}
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
