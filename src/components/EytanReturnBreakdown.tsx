"use client";

import { useTranslation } from "@/lib/i18n/I18nProvider";
import { useEffectiveAuth } from "@/lib/data/useEffectiveAuth";
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

/**
 * Sponsor equity breakdown — three capacities (co-invest, promote, grant uplift).
 * Heading is provided by the caller (cap-table/page.tsx). This component does not self-label.
 */
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
  const { isImpersonating } = useEffectiveAuth();

  // Sponsor promote details are admin-only (HO-13 P2-05).
  // When an admin is previewing as a banker, suppress this breakdown entirely.
  if (isImpersonating) return null;

  if (!founderResult) return null;

  const b = result.founderBreakdown;
  const cashIn = founderResult.stakeholder.cashIn;

  // ── % values for each capacity ──
  // Ratchet (Layer C) excluded from all display — only pari-passu + devEq + grant shown.
  const investorPct  = b.pariPassuPct;
  const developerPct = b.developerEquityPct;
  const grantPct     = b.grantBonusPct;          // 0 when grant inactive
  const combinedPct  = investorPct + developerPct + grantPct;

  return (
    <div id="captable-eytan-return" className="mb-6">

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
          extra={undefined}
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
          extra={undefined}
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

        {/* Arithmetic breakdown — makes the combined % self-evident */}
        <div className="mt-3 pt-3 border-t border-surface-tertiary/60 flex items-center gap-1.5 flex-wrap text-[11px] font-mono text-text-tertiary">
          <span className="font-semibold text-text-secondary">{formatPercent(investorPct)}</span>
          <span className="text-text-tertiary/50">{t("ct.roles.total.breakdownCoInvestor")}</span>
          <span className="text-text-tertiary/40">+</span>
          <span className="font-semibold text-text-secondary">{formatPercent(developerPct)}</span>
          <span className="text-text-tertiary/50">{t("ct.roles.total.breakdownDeveloper")}</span>
          {grantApproved && grantPct > 0 && (
            <>
              <span className="text-text-tertiary/40">+</span>
              <span className="font-semibold text-text-secondary">{formatPercent(grantPct)}</span>
              <span className="text-text-tertiary/50">{t("ct.roles.total.breakdownGrant")}</span>
            </>
          )}
          <span className="text-text-tertiary/40">=</span>
          <span className="font-bold text-text-primary">{formatPercent(combinedPct)}</span>
        </div>
      </div>

    </div>
  );
}
