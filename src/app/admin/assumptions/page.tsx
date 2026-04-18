"use client";

import { useModelStore } from "@/lib/store/modelStore";
import {
  formatCurrency,
  formatPercent,
  formatMultiple,
} from "@/lib/hooks/useModel";
import { useTranslation } from "@/lib/i18n/I18nProvider";
import { useState } from "react";
import { FinancingPath } from "@/lib/engine/types";

function EditableCell({
  value,
  onChange,
  format = "number",
}: {
  value: number;
  onChange: (v: number) => void;
  format?: "number" | "currency" | "percent";
}) {
  const { locale } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [inputValue, setInputValue] = useState("");

  const display =
    format === "currency"
      ? formatCurrency(value, false, locale)
      : format === "percent"
        ? formatPercent(value)
        : value.toLocaleString();

  if (editing) {
    return (
      <input
        type="number"
        className="w-full px-2 py-1 text-right data-cell bg-blue-50 border border-blue-300 rounded outline-none"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onBlur={() => {
          setEditing(false);
          const parsed = parseFloat(inputValue);
          if (!isNaN(parsed)) {
            onChange(format === "percent" ? parsed / 100 : parsed);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") setEditing(false);
        }}
        autoFocus
      />
    );
  }

  return (
    <div
      className="px-2 py-1 text-right data-cell bg-blue-50/50 rounded cursor-pointer hover:bg-blue-100/50 transition-colors"
      onClick={() => {
        setInputValue(
          format === "percent" ? (value * 100).toString() : value.toString()
        );
        setEditing(true);
      }}
    >
      {display}
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <h3 className="font-display text-lg text-text-primary mt-8 mb-4 pb-2 border-b border-surface-tertiary">
      {title}
    </h3>
  );
}

function AssumptionRow({
  label,
  value,
  path,
  format = "number",
  note,
}: {
  label: string;
  value: number;
  path: string;
  format?: "number" | "currency" | "percent";
  note?: string;
}) {
  const { setAssumption } = useModelStore();
  return (
    <tr className="border-b border-surface-secondary/50">
      <td className="py-2 pr-4 text-sm text-text-secondary">{label}</td>
      <td className="py-2 w-36">
        <EditableCell
          value={value}
          format={format}
          onChange={(v) => setAssumption(path, v)}
        />
      </td>
      <td className="py-2 pl-4 text-xs text-text-tertiary">{note}</td>
    </tr>
  );
}

export default function AssumptionsPage() {
  const { t, locale } = useTranslation();
  const { model, assumptions, setFinancingPath, resetToDefaults } =
    useModelStore();
  const [tab, setTab] = useState<
    "general" | "revenue" | "opex" | "financing" | "capex"
  >("financing");

  if (!model) return null;

  const a = assumptions;

  return (
    <div>
      <div className="flex items-baseline justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl text-text-primary">
            {t('as.title')}
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            {t('as.subtitle')}
          </p>
        </div>
        <button
          onClick={resetToDefaults}
          className="text-sm text-text-tertiary hover:text-negative transition-colors"
        >
          {t('as.resetDefaults')}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-surface-secondary rounded-lg p-1">
        {(
          [
            { id: "financing", label: t('as.financingPaths') },
            { id: "general", label: t('as.general') },
            { id: "revenue", label: t('as.revenue') },
            { id: "opex", label: t('as.opexTab') },
            { id: "capex", label: t('as.capexTab') },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-md text-sm transition-colors ${
              tab === t.id
                ? "bg-white text-text-primary font-medium shadow-sm"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── FINANCING PATHS TAB ── */}
      {tab === "financing" && (
        <div>
          <p className="text-sm text-text-secondary mb-6">
            {t('as.selectPath')}
          </p>

          {/* Financing path selector */}
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
            {(
              [
                {
                  id: "commercial" as FinancingPath,
                  title: t('path.commercial'),
                  desc: t('path.commercialDesc'),
                  highlight: `${t('term.ds')}: ${formatCurrency(model.financingComparison[3]?.commercial as number, true, locale)}/yr`,
                  color: "brand",
                  borderColor: "#8B6914",
                  bgColor: "#FAF7F0",
                },
                {
                  id: "rrf" as FinancingPath,
                  title: t('path.rrf'),
                  desc: t('path.rrfDesc'),
                  highlight: `${t('term.ds')}: ${formatCurrency(model.financingComparison[3]?.rrf as number, true, locale)}/yr`,
                  color: "info",
                  borderColor: "#4A6A8B",
                  bgColor: "#F0F4F8",
                },
                {
                  id: "grant" as FinancingPath,
                  title: t('path.grant'),
                  desc: t('path.grantDesc'),
                  highlight: `${t('term.ds')}: ${formatCurrency(model.financingComparison[3]?.grant as number, true, locale)}/yr`,
                  color: "positive",
                  borderColor: "#4A7C3F",
                  bgColor: "#F0F8EF",
                },
                {
                  id: "tepix-loan" as FinancingPath,
                  title: t('path.tepixLoan'),
                  desc: t('path.tepixLoanDesc'),
                  highlight: `${t('term.ds')}: ${formatCurrency(model.financingComparison[3]?.tepixLoan as number, true, locale)}/yr`,
                  color: "tepix",
                  borderColor: "#7B5EA7",
                  bgColor: "#F5F0FA",
                },
                {
                  id: "tepix-guarantee" as FinancingPath,
                  title: t('path.tepixGuarantee'),
                  desc: t('path.tepixGuaranteeDesc'),
                  highlight: `${t('term.ds')}: ${formatCurrency(model.financingComparison[3]?.tepixGuarantee as number, true, locale)}/yr`,
                  color: "tepixg",
                  borderColor: "#C4754B",
                  bgColor: "#FDF5F0",
                },
              ] as const
            ).map((path) => {
              const isActive = a.financingPath === path.id;
              return (
                <button
                  key={path.id}
                  onClick={() => setFinancingPath(path.id)}
                  className={`text-left rounded-xl border-2 p-5 transition-all ${
                    isActive
                      ? `border-${path.color} bg-${path.color}/5 shadow-md`
                      : "border-surface-tertiary bg-white hover:border-surface-tertiary/80 hover:shadow-sm"
                  }`}
                  style={
                    isActive
                      ? {
                          borderColor: path.borderColor,
                          backgroundColor: path.bgColor,
                        }
                      : {}
                  }
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div
                      className={`w-3 h-3 rounded-full ${isActive ? "ring-2 ring-offset-2" : ""}`}
                      style={{
                        backgroundColor: path.borderColor,
                      }}
                    />
                    <h3 className="font-medium text-text-primary">
                      {path.title}
                    </h3>
                  </div>
                  <p className="text-xs text-text-secondary mb-3">
                    {path.desc}
                  </p>
                  <p className="text-sm font-mono font-medium text-text-primary">
                    {path.highlight}
                  </p>
                </button>
              );
            })}
          </div>

          {/* Active path details */}
          <div className="bg-white rounded-xl border border-surface-tertiary p-6">
            <h3 className="font-display text-lg text-text-primary mb-4">
              {t('as.activeParams')}
            </h3>

            {a.financingPath === "commercial" && (
              <table className="w-full">
                <tbody>
                  <AssumptionRow
                    label={t('field.loanCoverage')}
                    value={a.commercialLoan.loanCoverageRate}
                    path="commercialLoan.loanCoverageRate"
                    format="percent"
                    note="75% of total project cost"
                  />
                  <AssumptionRow
                    label={t('field.interestRate')}
                    value={a.commercialLoan.interestRate}
                    path="commercialLoan.interestRate"
                    format="percent"
                    note="Indicative commercial rate"
                  />
                  <AssumptionRow
                    label={t('field.gracePeriod')}
                    value={a.commercialLoan.gracePeriodYears}
                    path="commercialLoan.gracePeriodYears"
                    note="Interest-only, starts Q4 2026"
                  />
                  <AssumptionRow
                    label={t('field.repaymentTerm')}
                    value={a.commercialLoan.repaymentTermYears}
                    path="commercialLoan.repaymentTermYears"
                    note="Full DS from 2029"
                  />
                  <AssumptionRow
                    label={t('field.workingCapital')}
                    value={a.commercialLoan.workingCapitalFacility}
                    path="commercialLoan.workingCapitalFacility"
                    format="currency"
                    note="Revolving, self-liquidating"
                  />
                </tbody>
              </table>
            )}

            {a.financingPath === "rrf" && (
              <table className="w-full">
                <tbody>
                  <AssumptionRow
                    label={t('field.rrfShare')}
                    value={a.rrf.rrfShareOfLoan}
                    path="rrf.rrfShareOfLoan"
                    format="percent"
                    note="80% of total financing at concessional rate"
                  />
                  <AssumptionRow
                    label={t('field.rrfRate')}
                    value={a.rrf.rrfInterestRate}
                    path="rrf.rrfInterestRate"
                    format="percent"
                    note="0.35% per annum"
                  />
                  <AssumptionRow
                    label={t('field.commShare')}
                    value={a.rrf.commercialShareRate}
                    path="rrf.commercialShareRate"
                    format="percent"
                    note="20% at commercial rate"
                  />
                  <AssumptionRow
                    label={t('field.commRate')}
                    value={a.rrf.commercialInterestRate}
                    path="rrf.commercialInterestRate"
                    format="percent"
                    note="5% standard"
                  />
                  <AssumptionRow
                    label={t('field.totalLoanDrawn')}
                    value={a.rrf.totalLoanDrawn}
                    path="rrf.totalLoanDrawn"
                    format="currency"
                    note="Indicative €4,939,200"
                  />
                  <AssumptionRow
                    label={t('field.equityRequired')}
                    value={a.rrf.equityRequired}
                    path="rrf.equityRequired"
                    format="currency"
                    note="Indicative €1,234,800"
                  />
                </tbody>
              </table>
            )}

            {a.financingPath === "grant" && (
              <table className="w-full">
                <tbody>
                  <AssumptionRow
                    label={t('field.grantRate')}
                    value={a.grant.grantRate}
                    path="grant.grantRate"
                    format="percent"
                    note="60% confirmed — Antiparos max aid zone"
                  />
                  <tr className="border-b border-surface-secondary/50">
                    <td className="py-2 pr-4 text-sm text-text-secondary">
                      {t('field.nonPlotEligible')}
                    </td>
                    <td className="py-2 data-cell text-right pr-2">
                      {formatCurrency(
                        model.capex.portfolioTotal -
                          (a.properties.propertyA.landCost *
                            a.numberOfPropertyA +
                            a.properties.propertyB.landCost) -
                          a.acquisitionLegalPerPlot * 3,
                        false, locale
                      )}
                    </td>
                    <td className="py-2 pl-4 text-xs text-text-tertiary">
                      CAPEX less land and acquisition legal
                    </td>
                  </tr>
                  <tr className="border-b border-surface-secondary/50">
                    <td className="py-2 pr-4 text-sm font-medium text-positive">
                      {t('field.grantAmount')}
                    </td>
                    <td className="py-2 data-cell text-right pr-2 font-medium text-positive">
                      {formatCurrency(
                        (model.capex.portfolioTotal -
                          (a.properties.propertyA.landCost *
                            a.numberOfPropertyA +
                            a.properties.propertyB.landCost) -
                          a.acquisitionLegalPerPlot * 3) *
                          a.grant.grantRate,
                        false, locale
                      )}
                    </td>
                    <td className="py-2 pl-4 text-xs text-text-tertiary">
                      Non-plot eligible × grant rate
                    </td>
                  </tr>
                  <AssumptionRow
                    label="Interest rate (on remaining loan)"
                    value={a.commercialLoan.interestRate}
                    path="commercialLoan.interestRate"
                    format="percent"
                    note="5% on reduced loan amount"
                  />
                  <AssumptionRow
                    label="Repayment term (years)"
                    value={a.commercialLoan.repaymentTermYears}
                    path="commercialLoan.repaymentTermYears"
                    note="13 years from 2029"
                  />
                </tbody>
              </table>
            )}

            {a.financingPath === "tepix-loan" && (
              <table className="w-full">
                <tbody>
                  <AssumptionRow
                    label={t('field.tepixCoverage')}
                    value={a.tepixLoan.coverageRate}
                    path="tepixLoan.coverageRate"
                    format="percent"
                    note="90% — 10% equity"
                  />
                  <AssumptionRow
                    label={t('field.tepixHdbShare')}
                    value={a.tepixLoan.hdbShareOfLoan}
                    path="tepixLoan.hdbShareOfLoan"
                    format="percent"
                    note="40% interest-free from HDB/EAT"
                  />
                  <AssumptionRow
                    label={t('field.tepixBankShare')}
                    value={a.tepixLoan.bankShareOfLoan}
                    path="tepixLoan.bankShareOfLoan"
                    format="percent"
                    note="60% from partner bank"
                  />
                  <AssumptionRow
                    label={t('field.tepixBankRate')}
                    value={a.tepixLoan.bankInterestRate}
                    path="tepixLoan.bankInterestRate"
                    format="percent"
                    note="Indicative bank rate"
                  />
                  <AssumptionRow
                    label={t('field.tepixSubsidy')}
                    value={a.tepixLoan.interestSubsidy}
                    path="tepixLoan.interestSubsidy"
                    format="percent"
                    note="2pp — South Aegean (verified HDB)"
                  />
                  <AssumptionRow
                    label={t('field.tepixSubsidyDuration')}
                    value={a.tepixLoan.subsidyDurationYears}
                    path="tepixLoan.subsidyDurationYears"
                    note="From first disbursement"
                  />
                  <AssumptionRow
                    label={t('field.tepixTotalTerm')}
                    value={a.tepixLoan.totalTermYears}
                    path="tepixLoan.totalTermYears"
                    note="12 years amortization + 2 years grace = 14 total"
                  />
                  <AssumptionRow
                    label={t('field.tepixGrace')}
                    value={a.tepixLoan.gracePeriodYears}
                    path="tepixLoan.gracePeriodYears"
                    note="Within total term"
                  />
                </tbody>
              </table>
            )}

            {a.financingPath === "tepix-guarantee" && (
              <table className="w-full">
                <tbody>
                  <AssumptionRow
                    label={t('field.tepixCoverage')}
                    value={a.tepixGuarantee.coverageRate}
                    path="tepixGuarantee.coverageRate"
                    format="percent"
                    note="90% — 10% equity"
                  />
                  <AssumptionRow
                    label={t('field.tepixGuaranteeRate')}
                    value={a.tepixGuarantee.guaranteeRate}
                    path="tepixGuarantee.guaranteeRate"
                    format="percent"
                    note="70% — General Entrepreneurship"
                  />
                  <AssumptionRow
                    label={t('field.tepixBankRate')}
                    value={a.tepixGuarantee.bankInterestRate}
                    path="tepixGuarantee.bankInterestRate"
                    format="percent"
                    note="Full loan at bank rate"
                  />
                  <AssumptionRow
                    label={t('field.tepixSubsidy')}
                    value={a.tepixGuarantee.interestSubsidy}
                    path="tepixGuarantee.interestSubsidy"
                    format="percent"
                    note="2pp — South Aegean"
                  />
                  <AssumptionRow
                    label={t('field.tepixSubsidyDuration')}
                    value={a.tepixGuarantee.subsidyDurationYears}
                    path="tepixGuarantee.subsidyDurationYears"
                    note="From first disbursement"
                  />
                  <AssumptionRow
                    label={t('field.tepixTotalTerm')}
                    value={a.tepixGuarantee.totalTermYears}
                    path="tepixGuarantee.totalTermYears"
                    note="12 years amortization + 2 years grace = 14 total"
                  />
                  <AssumptionRow
                    label={t('field.tepixGrace')}
                    value={a.tepixGuarantee.gracePeriodYears}
                    path="tepixGuarantee.gracePeriodYears"
                    note="Within total term"
                  />
                  <AssumptionRow
                    label={t('field.tepixCollateralCap')}
                    value={a.tepixGuarantee.collateralCapRate}
                    path="tepixGuarantee.collateralCapRate"
                    format="percent"
                    note="30% of loan principal (statutory)"
                  />
                </tbody>
              </table>
            )}
          </div>

          {/* Impact Summary */}
          <div className="mt-6 grid grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-surface-tertiary p-4 text-center">
              <div className="text-xs uppercase tracking-wider text-text-tertiary mb-1">
                {t('kpi.loanAmount')}
              </div>
              <div className="kpi-value text-text-primary text-2xl">
                {formatCurrency(model.keyMetrics.loanAmount, true, locale)}
              </div>
            </div>
            <div className="bg-white rounded-xl border border-surface-tertiary p-4 text-center">
              <div className="text-xs uppercase tracking-wider text-text-tertiary mb-1">
                {t('kpi.equityRequired')}
              </div>
              <div className="kpi-value text-text-primary text-2xl">
                {formatCurrency(model.keyMetrics.equityRequired, true, locale)}
              </div>
            </div>
            <div className="bg-white rounded-xl border border-surface-tertiary p-4 text-center">
              <div className="text-xs uppercase tracking-wider text-text-tertiary mb-1">
                {t('term.dscr')} ({t('phase.stabilised')})
              </div>
              <div className="kpi-value text-text-primary text-2xl">
                {formatMultiple(model.keyMetrics.stabilisedDSCR)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── GENERAL TAB ── */}
      {tab === "general" && (
        <div className="bg-white rounded-xl border border-surface-tertiary p-6">
          <SectionHeader title={t('as.rampUp')} />
          <table className="w-full">
            <tbody>
              <AssumptionRow
                label={t('field.y1Ramp')}
                value={a.general.year1RampFactor}
                path="general.year1RampFactor"
                format="percent"
                note="% of mature revenue"
              />
              <AssumptionRow
                label={t('field.y2Ramp')}
                value={a.general.year2RampFactor}
                path="general.year2RampFactor"
                format="percent"
                note="% of mature revenue"
              />
              <AssumptionRow
                label={t('field.nightsGrowth')}
                value={a.general.nightsGrowthPerYear}
                path="general.nightsGrowthPerYear"
                note="Added per year"
              />
              <AssumptionRow
                label={t('field.nightsCap')}
                value={a.general.nightsCap}
                path="general.nightsCap"
                note="Upper bound"
              />
            </tbody>
          </table>

          <SectionHeader title={t('as.tax')} />
          <table className="w-full">
            <tbody>
              <AssumptionRow
                label={t('field.citRate')}
                value={a.tax.corporateIncomeTaxRate}
                path="tax.corporateIncomeTaxRate"
                format="percent"
                note="Greek CIT — Law 4172/2013"
              />
              <AssumptionRow
                label={t('field.vatRate')}
                value={a.tax.netVATRate}
                path="tax.netVATRate"
                format="percent"
                note="7% net after input credits"
              />
            </tbody>
          </table>
        </div>
      )}

      {/* ── REVENUE TAB ── */}
      {tab === "revenue" && (
        <div className="bg-white rounded-xl border border-surface-tertiary p-6">
          <SectionHeader title={t('as.realisticScenario')} />
          <table className="w-full">
            <tbody>
              <AssumptionRow
                label={t('field.villaADR')}
                value={a.revenueRealistic.villaADR}
                path="revenueRealistic.villaADR"
                format="currency"
                note="Net of all commissions"
              />
              <AssumptionRow
                label={t('field.villaNights')}
                value={a.revenueRealistic.villaBaseNights}
                path="revenueRealistic.villaBaseNights"
                note="Per project"
              />
              <AssumptionRow
                label={t('field.stdSuiteADR')}
                value={a.revenueRealistic.suiteStandardADR}
                path="revenueRealistic.suiteStandardADR"
                format="currency"
                note="×2 suites"
              />
              <AssumptionRow
                label={t('field.dblSuiteADR')}
                value={a.revenueRealistic.suiteDoubleADR}
                path="revenueRealistic.suiteDoubleADR"
                format="currency"
                note="×2 suites"
              />
              <AssumptionRow
                label={t('field.suiteNights')}
                value={a.revenueRealistic.suiteBaseNights}
                path="revenueRealistic.suiteBaseNights"
              />
              <AssumptionRow
                label={t('field.eventsPerYear')}
                value={a.revenueRealistic.eventsPerYear}
                path="revenueRealistic.eventsPerYear"
              />
              <AssumptionRow
                label={t('field.profitPerEvent')}
                value={a.revenueRealistic.netProfitPerEvent}
                path="revenueRealistic.netProfitPerEvent"
                format="currency"
              />
              <AssumptionRow
                label={t('field.ancillaryProfit')}
                value={a.revenueRealistic.ancillaryBaseProfit}
                path="revenueRealistic.ancillaryBaseProfit"
                format="currency"
                note="Chef, boat, car rentals"
              />
              <AssumptionRow
                label={t('field.ancillaryGrowth')}
                value={a.revenueRealistic.ancillaryGrowthRate}
                path="revenueRealistic.ancillaryGrowthRate"
                format="percent"
                note="+10%/yr from 2028"
              />
            </tbody>
          </table>

          <SectionHeader title={t('as.upsideScenario')} />
          <table className="w-full">
            <tbody>
              <AssumptionRow
                label="Villa ADR — upside (€/night)"
                value={a.revenueUpside.villaADR}
                path="revenueUpside.villaADR"
                format="currency"
              />
              <AssumptionRow
                label="Villa nights — upside (mature)"
                value={a.revenueUpside.villaBaseNights}
                path="revenueUpside.villaBaseNights"
              />
              <AssumptionRow
                label="Standard Suite ADR — upside"
                value={a.revenueUpside.suiteStandardADR}
                path="revenueUpside.suiteStandardADR"
                format="currency"
              />
              <AssumptionRow
                label="Double Suite ADR — upside"
                value={a.revenueUpside.suiteDoubleADR}
                path="revenueUpside.suiteDoubleADR"
                format="currency"
              />
              <AssumptionRow
                label="Suite nights — upside"
                value={a.revenueUpside.suiteBaseNights}
                path="revenueUpside.suiteBaseNights"
              />
              <AssumptionRow
                label="Events — upside"
                value={a.revenueUpside.eventsPerYear}
                path="revenueUpside.eventsPerYear"
              />
            </tbody>
          </table>
        </div>
      )}

      {/* ── OPEX TAB ── */}
      {tab === "opex" && (
        <div className="bg-white rounded-xl border border-surface-tertiary p-6">
          <SectionHeader title={t('as.propAOpex')} />
          <table className="w-full">
            <tbody>
              {Object.entries(a.opex.propertyA).map(([key, val]) => (
                <AssumptionRow
                  key={key}
                  label={key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase())}
                  value={val}
                  path={`opex.propertyA.${key}`}
                  format="currency"
                />
              ))}
            </tbody>
          </table>

          <SectionHeader title={t('as.propBOpex')} />
          <table className="w-full">
            <tbody>
              {Object.entries(a.opex.propertyB).map(([key, val]) => (
                <AssumptionRow
                  key={key}
                  label={key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase())}
                  value={val}
                  path={`opex.propertyB.${key}`}
                  format="currency"
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── CAPEX TAB ── */}
      {tab === "capex" && (
        <div className="bg-white rounded-xl border border-surface-tertiary p-6">
          <SectionHeader title={t('as.propATwinVillas')} />
          <table className="w-full">
            <tbody>
              <AssumptionRow label={t('field.landCost')} value={a.properties.propertyA.landCost} path="properties.propertyA.landCost" format="currency" />
              <AssumptionRow label={t('field.constructionArea')} value={a.properties.propertyA.constructionArea} path="properties.propertyA.constructionArea" />
              <AssumptionRow label={t('field.costPerM2')} value={a.properties.propertyA.constructionCostPerM2} path="properties.propertyA.constructionCostPerM2" format="currency" />
              <AssumptionRow label={t('term.ffe')} value={a.properties.propertyA.ffeCost} path="properties.propertyA.ffeCost" format="currency" />
              <AssumptionRow label={t('field.legalNotary')} value={a.properties.propertyA.legalFees} path="properties.propertyA.legalFees" format="currency" />
              <AssumptionRow label={t('field.architectDesign')} value={a.properties.propertyA.architectFees} path="properties.propertyA.architectFees" format="currency" />
              <AssumptionRow label={t('field.civilEngineer')} value={a.properties.propertyA.civilEngineerFees} path="properties.propertyA.civilEngineerFees" format="currency" />
              <AssumptionRow label={t('field.contingencyRate')} value={a.properties.propertyA.contingencyRate} path="properties.propertyA.contingencyRate" format="percent" />
            </tbody>
          </table>

          <SectionHeader title={t('as.propBSuites')} />
          <table className="w-full">
            <tbody>
              <AssumptionRow label={t('field.landCost')} value={a.properties.propertyB.landCost} path="properties.propertyB.landCost" format="currency" />
              <AssumptionRow label={t('field.constructionArea')} value={a.properties.propertyB.constructionArea} path="properties.propertyB.constructionArea" />
              <AssumptionRow label={t('field.costPerM2')} value={a.properties.propertyB.constructionCostPerM2} path="properties.propertyB.constructionCostPerM2" format="currency" />
              <AssumptionRow label={t('term.ffe')} value={a.properties.propertyB.ffeCost} path="properties.propertyB.ffeCost" format="currency" />
              <AssumptionRow label={t('field.legalNotary')} value={a.properties.propertyB.legalFees} path="properties.propertyB.legalFees" format="currency" />
              <AssumptionRow label={t('field.architectDesign')} value={a.properties.propertyB.architectFees} path="properties.propertyB.architectFees" format="currency" />
              <AssumptionRow label={t('field.civilEngineer')} value={a.properties.propertyB.civilEngineerFees} path="properties.propertyB.civilEngineerFees" format="currency" />
              <AssumptionRow label={t('field.contingencyRate')} value={a.properties.propertyB.contingencyRate} path="properties.propertyB.contingencyRate" format="percent" />
            </tbody>
          </table>

          <SectionHeader title={t('as.other')} />
          <table className="w-full">
            <tbody>
              <AssumptionRow label={t('field.acqLegalPerPlot')} value={a.acquisitionLegalPerPlot} path="acquisitionLegalPerPlot" format="currency" note="×3 plots" />
              <AssumptionRow label={t('field.numPropA')} value={a.numberOfPropertyA} path="numberOfPropertyA" note="Twin Villa projects" />
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
