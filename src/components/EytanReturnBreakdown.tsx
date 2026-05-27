"use client";

import { useTranslation } from "@/lib/i18n/I18nProvider";
import { SectionHeader, KPICard } from "@/components/AdminUI";
import type { CapTableResult, StakeholderResult } from "@/lib/engine/capTable";

interface EytanReturnBreakdownProps {
  result: CapTableResult;
  founderResult: StakeholderResult;
  terminalEquityValue: number;
  grantApproved: boolean;
  locale: string;
  formatCurrency: (v: number) => string;
  formatPercent: (v: number) => string;
  formatMultiple: (v: number) => string;
}

function MetricRow({
  label,
  sub,
  value,
  valueClass,
  indent,
}: {
  label: string;
  sub?: string;
  value: string;
  valueClass?: string;
  indent?: boolean;
}) {
  return (
    <div className={`flex items-start justify-between gap-2 py-1.5 ${indent ? "pl-4" : ""}`}>
      <div className="flex-1 min-w-0">
        <div className="text-xs text-text-secondary leading-tight">{label}</div>
        {sub && <div className="text-[10px] text-text-tertiary mt-0.5 leading-tight">{sub}</div>}
      </div>
      <div className={`font-mono text-xs font-medium tabular-nums shrink-0 ${valueClass ?? "text-text-primary"}`}>
        {value}
      </div>
    </div>
  );
}

function PanelTotal({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between pt-2 mt-1 border-t border-gray-200/60">
      <span className="text-xs font-semibold text-text-primary">{label}</span>
      <span className="font-mono text-xs font-semibold text-text-primary tabular-nums">{value}</span>
    </div>
  );
}

export function EytanReturnBreakdown({
  result,
  founderResult,
  terminalEquityValue,
  grantApproved,
  locale,
  formatCurrency,
  formatPercent,
  formatMultiple,
}: EytanReturnBreakdownProps) {
  const { t } = useTranslation();

  if (!founderResult) return null;

  const b = result.founderBreakdown;

  // ── Panel 1 — As investor (pari-passu distributions only, informational) ──
  // Used for display only — NOT summed for grand total.
  const ppDistributions = founderResult.yearly.reduce(
    (s, y) => s + (y.pariPassuShare ?? 0),
    0,
  );

  // ── Panel 2 — As promoter (informational component breakdowns) ──
  const devEquityEarnings = founderResult.yearly.reduce(
    (s, y) => s + (y.developerEquityShare ?? 0),
    0,
  );
  const ratchetEarnings = founderResult.yearly.reduce(
    (s, y) => s + (y.performanceRatchetShare ?? 0),
    0,
  );
  const manCoFees = result.totalFounderManCoFee;
  const bucket1BCash = grantApproved ? (b.eytan1BCash ?? 0) : 0;

  // ── Panel 3 — As grant recipient (informational) ──
  const grantBonusEarnings = founderResult.yearly.reduce(
    (s, y) => s + (y.grantBonusShare ?? 0),
    0,
  );
  // grantExitValue is ALREADY included within grantBonusEarnings (exit-year contribution).
  // Displayed as "of which exit component" — NOT additive.
  const grantExitValue = b.grantBonusPct * terminalEquityValue;

  // ── Grand total — CANONICAL formula ──
  // founderResult.totalReceived is the authoritative equity total (engine-computed).
  // manCoFees and bucket1BCash are additive pre-split fee deductions, no double-count.
  const grandTotal = founderResult.totalReceived + manCoFees + bucket1BCash;
  const combinedMoic =
    founderResult.stakeholder.cashIn > 0
      ? grandTotal / founderResult.stakeholder.cashIn
      : 0;

  const cashIn = founderResult.stakeholder.cashIn;

  return (
    <div id="captable-eytan-return" className="mb-6">
      <SectionHeader
        title={t("ct.roles.sectionTitle")}
        sub={t("ct.roles.sectionSub")}
      />

      {/* Three-panel grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">

        {/* ── Panel 1 — As investor ── */}
        <div className="rounded-xl border border-blue-200/60 bg-blue-50/30 dark:border-blue-800/40 dark:bg-blue-900/10 p-4">
          <div className="mb-3">
            <h3 className="text-[11px] font-semibold uppercase tracking-widest text-blue-800/80 dark:text-blue-300">
              {t("ct.roles.panel1.title")}
            </h3>
            <p className="text-xs text-text-tertiary mt-0.5">
              {t("ct.roles.panel1.sub")}
            </p>
          </div>

          <div className="space-y-0 divide-y divide-gray-100/60">
            <MetricRow
              label={t("ct.roles.panel1.cashInvested")}
              value={formatCurrency(cashIn)}
            />
            <MetricRow
              label={t("ct.roles.panel1.equityStake")}
              value={formatPercent(founderResult.economicStake)}
            />
            <MetricRow
              label={t("ct.roles.panel1.distributions")}
              value={formatCurrency(founderResult.totalReceived)}
              valueClass="text-positive"
            />
            <MetricRow
              label={t("ct.roles.panel1.netProfit")}
              value={formatCurrency(founderResult.netProfit)}
              valueClass={founderResult.netProfit >= 0 ? "text-positive" : "text-warning"}
            />
            <MetricRow
              label={t("ct.roles.panel1.moic")}
              value={formatMultiple(founderResult.moic)}
              valueClass={founderResult.moic >= 2 ? "text-positive" : "text-text-primary"}
            />
            <MetricRow
              label={t("ct.roles.panel1.irr")}
              value={founderResult.irr > 0 ? formatPercent(founderResult.irr) : "—"}
              valueClass={founderResult.irr >= 0.15 ? "text-positive" : "text-text-primary"}
            />
            <MetricRow
              label={t("ct.roles.panel1.payback")}
              value={founderResult.paybackYear != null ? String(founderResult.paybackYear) : "—"}
            />
          </div>
        </div>

        {/* ── Panel 2 — As promoter ── */}
        <div className="rounded-xl border border-amber-300/50 bg-amber-50/30 dark:border-amber-800/40 dark:bg-amber-900/10 p-4">
          <div className="mb-3">
            <h3 className="text-[11px] font-semibold uppercase tracking-widest text-amber-800/80 dark:text-amber-300">
              {t("ct.roles.panel2.title")}
            </h3>
            <p className="text-xs text-text-tertiary mt-0.5">
              {t("ct.roles.panel2.sub")}
            </p>
          </div>

          <div className="space-y-0 divide-y divide-gray-100/60">
            <MetricRow
              label={t("ct.roles.panel2.manCoFees")}
              sub={t("ct.roles.panel2.manCoSub")}
              value={formatCurrency(manCoFees)}
              valueClass="text-positive"
            />
            <MetricRow
              label={t("ct.roles.panel2.devEquityPromote")}
              sub={t("ct.roles.panel2.devEquitySub")}
              value={formatCurrency(devEquityEarnings)}
              valueClass="text-positive"
            />
            <MetricRow
              label={t("ct.roles.panel2.ratchet")}
              sub={t("ct.roles.panel2.ratchetSub")}
              value={ratchetEarnings > 0 ? formatCurrency(ratchetEarnings) : "—"}
              valueClass="text-positive"
            />
            {grantApproved && (
              <MetricRow
                label={t("ct.roles.panel2.bucket1BCash")}
                sub={t("ct.roles.panel2.bucket1BSub")}
                value={bucket1BCash > 0 ? formatCurrency(bucket1BCash) : "—"}
                valueClass="text-positive"
              />
            )}
          </div>

          <PanelTotal
            label={t("ct.roles.panel2.total")}
            value={formatCurrency(manCoFees + devEquityEarnings + ratchetEarnings + bucket1BCash)}
          />
        </div>

        {/* ── Panel 3 — As grant recipient ── */}
        <div
          className={`rounded-xl border p-4 ${
            grantApproved
              ? "border-[#4A6A8B]/40 bg-[#4A6A8B]/5"
              : "border-neutral-200 bg-neutral-50/50 dark:border-neutral-700 dark:bg-neutral-800/20 opacity-60"
          }`}
        >
          <div className="mb-3">
            <div className="flex items-center gap-2">
              <h3
                className={`text-[11px] font-semibold uppercase tracking-widest ${
                  grantApproved ? "text-[#4A6A8B]" : "text-text-tertiary"
                }`}
              >
                {t("ct.roles.panel3.title")}
              </h3>
              <span
                className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium uppercase tracking-wider ${
                  grantApproved
                    ? "bg-[#4A6A8B]/15 text-[#4A6A8B]"
                    : "bg-neutral-200 text-text-tertiary"
                }`}
              >
                {grantApproved
                  ? t("ct.roles.panel3.activeChip")
                  : t("ct.roles.panel3.inactiveChip")}
              </span>
            </div>
            <p className="text-xs text-text-tertiary mt-0.5">
              {t("ct.roles.panel3.sub")}
            </p>
          </div>

          {grantApproved ? (
            <>
              <div className="space-y-0 divide-y divide-gray-100/60">
                <MetricRow
                  label={t("ct.roles.panel3.grantBonusPct")}
                  sub={t("ct.roles.panel3.grantBonusSub")}
                  value={"+" + formatPercent(b.grantBonusPct)}
                />
                <MetricRow
                  label={t("ct.roles.panel3.feePrincipal")}
                  value={formatCurrency(b.founderNetGrantCash)}
                />
                <div className="py-1.5">
                  <MetricRow
                    label={t("ct.roles.panel3.grantDistributions")}
                    value={formatCurrency(grantBonusEarnings)}
                    valueClass="text-positive"
                  />
                  {grantExitValue > 0 && (
                    <div className="pl-4 flex items-center justify-between mt-0.5">
                      <span className="text-[10px] text-gray-400">
                        {t("ct.roles.panel3.grantAtExit")}
                      </span>
                      <span className="font-mono text-[10px] text-gray-400 tabular-nums">
                        {formatCurrency(grantExitValue)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              <PanelTotal
                label={t("ct.roles.panel3.grantDistributions")}
                value={formatCurrency(grantBonusEarnings)}
              />
            </>
          ) : (
            <p className="text-xs text-text-tertiary mt-2">
              {t("ct.roles.panel3.inactive")}
            </p>
          )}
        </div>
      </div>

      {/* ── Total row ── */}
      <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-4 mt-4">
        <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-text-tertiary mb-3">
          {t("ct.roles.total.heading")}
        </div>
        <p className="text-xs text-text-tertiary mb-3">
          {t("ct.roles.total.sub")}
        </p>
        <div className="grid grid-cols-2 gap-3">
          <KPICard
            label={t("ct.roles.total.euros")}
            value={formatCurrency(grandTotal)}
            sublabel={`${t("ct.roles.panel1.cashInvested")}: ${formatCurrency(cashIn)}`}
            tone="positive"
            valueSize="compact"
          />
          <KPICard
            label={t("ct.roles.total.moicCombined")}
            value={formatMultiple(combinedMoic)}
            sublabel={t("ct.roles.total.moicSub")}
            tone={combinedMoic >= 3 ? "positive" : "neutral"}
            valueSize="compact"
          />
        </div>
        <p className="text-xs text-gray-400 mt-3">
          {t("ct.roles.total.footnote")}
        </p>
      </div>
    </div>
  );
}
