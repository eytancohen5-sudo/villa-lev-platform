"use client";

import { useModelStore } from "@/lib/store/modelStore";
import { formatCurrency, formatMultiple } from "@/lib/hooks/useModel";
import { useTranslation } from "@/lib/i18n/I18nProvider";
import { computeModel } from "@/lib/engine/model";
import { useMemo } from "react";

export default function SensitivityPage() {
  const { t, locale } = useTranslation();
  const { assumptions } = useModelStore();

  const sensitivityData = useMemo(() => {
    // ADR sensitivity
    const adrDeltas = [-500, -250, -100, 0, 100, 250, 500];
    const adrRows = adrDeltas.map((delta) => {
      const modified = {
        ...assumptions,
        revenueRealistic: {
          ...assumptions.revenueRealistic,
          villaADR: assumptions.revenueRealistic.villaADR + delta,
        },
      };
      const result = computeModel(modified);
      const stab = result.scenarios.realistic.stabilisedYear;
      return {
        label: delta === 0 ? t('sens.base') : `${delta > 0 ? "+" : ""}€${delta}`,
        adr: assumptions.revenueRealistic.villaADR + delta,
        ebitda: stab?.ebitda ?? 0,
        dscr: stab?.dscr ?? 0,
        ncf: stab?.netCashFlowPostVAT ?? 0,
        isBase: delta === 0,
      };
    });

    // Nights sensitivity
    const nightsDeltas = [-20, -10, -5, 0, 5, 10, 15];
    const nightsRows = nightsDeltas.map((delta) => {
      const modified = {
        ...assumptions,
        revenueRealistic: {
          ...assumptions.revenueRealistic,
          villaBaseNights: assumptions.revenueRealistic.villaBaseNights + delta,
          suiteBaseNights: assumptions.revenueRealistic.suiteBaseNights + delta,
        },
      };
      const result = computeModel(modified);
      const stab = result.scenarios.realistic.stabilisedYear;
      return {
        label: delta === 0 ? t('sens.base') : `${delta > 0 ? "+" : ""}${delta} nights`,
        nights: assumptions.revenueRealistic.villaBaseNights + delta,
        ebitda: stab?.ebitda ?? 0,
        dscr: stab?.dscr ?? 0,
        ncf: stab?.netCashFlowPostVAT ?? 0,
        isBase: delta === 0,
      };
    });

    // Interest rate sensitivity
    const rateDeltas = [-0.02, -0.01, -0.005, 0, 0.005, 0.01, 0.02];
    const rateRows = rateDeltas.map((delta) => {
      const modified = {
        ...assumptions,
        commercialLoan: {
          ...assumptions.commercialLoan,
          interestRate: assumptions.commercialLoan.interestRate + delta,
        },
      };
      const result = computeModel(modified);
      const stab = result.scenarios.realistic.stabilisedYear;
      return {
        label: delta === 0 ? t('sens.base') : `${delta > 0 ? "+" : ""}${(delta * 100).toFixed(1)}%`,
        rate: ((assumptions.commercialLoan.interestRate + delta) * 100).toFixed(2) + "%",
        ebitda: stab?.ebitda ?? 0,
        dscr: stab?.dscr ?? 0,
        ncf: stab?.netCashFlowPostVAT ?? 0,
        ds: stab?.debtService ?? 0,
        isBase: delta === 0,
      };
    });

    return { adrRows, nightsRows, rateRows };
  }, [assumptions]);

  return (
    <div>
      <h1 className="font-display text-2xl text-text-primary mb-1">{t('sens.title')}</h1>
      <p className="text-sm text-text-secondary mb-6">{t('sens.subtitle')}</p>

      {/* ADR Sensitivity */}
      <div className="bg-white rounded-xl border border-surface-tertiary p-5 mb-6">
        <h3 className="text-sm font-medium uppercase tracking-wider text-text-tertiary mb-4">
          {t('sens.adrSensitivity')} ({t('sens.base')}: €{assumptions.revenueRealistic.villaADR})
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-tertiary">
                <th className="text-left py-2 pr-4 text-xs uppercase tracking-wider text-text-tertiary font-medium">{t('sens.change')}</th>
                <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-text-tertiary font-medium">{t('term.adr')}</th>
                <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-text-tertiary font-medium">{t('term.ebitda')}</th>
                <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-text-tertiary font-medium">{t('term.dscr')}</th>
                <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-text-tertiary font-medium">{t('pnl.ncfPostVAT')}</th>
              </tr>
            </thead>
            <tbody>
              {sensitivityData.adrRows.map((row) => (
                <tr key={row.label} className={`border-b border-surface-secondary/50 ${row.isBase ? "bg-brand-50/50 font-medium" : ""}`}>
                  <td className="py-2 pr-4">{row.label}</td>
                  <td className="text-right py-2 px-3 data-cell">€{row.adr.toLocaleString()}</td>
                  <td className="text-right py-2 px-3 data-cell">{formatCurrency(row.ebitda, true, locale)}</td>
                  <td className={`text-right py-2 px-3 data-cell ${row.dscr >= 1.25 ? "text-positive" : "text-warning"}`}>
                    {formatMultiple(row.dscr)}
                  </td>
                  <td className={`text-right py-2 px-3 data-cell ${row.ncf >= 0 ? "text-positive" : "text-negative"}`}>
                    {formatCurrency(row.ncf, true, locale)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Nights Sensitivity */}
      <div className="bg-white rounded-xl border border-surface-tertiary p-5 mb-6">
        <h3 className="text-sm font-medium uppercase tracking-wider text-text-tertiary mb-4">
          {t('sens.occupancySensitivity')} ({t('sens.base')}: {assumptions.revenueRealistic.villaBaseNights} nights)
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-tertiary">
                <th className="text-left py-2 pr-4 text-xs uppercase tracking-wider text-text-tertiary font-medium">{t('sens.change')}</th>
                <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-text-tertiary font-medium">Nights</th>
                <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-text-tertiary font-medium">{t('term.ebitda')}</th>
                <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-text-tertiary font-medium">{t('term.dscr')}</th>
                <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-text-tertiary font-medium">{t('pnl.ncfPostVAT')}</th>
              </tr>
            </thead>
            <tbody>
              {sensitivityData.nightsRows.map((row) => (
                <tr key={row.label} className={`border-b border-surface-secondary/50 ${row.isBase ? "bg-brand-50/50 font-medium" : ""}`}>
                  <td className="py-2 pr-4">{row.label}</td>
                  <td className="text-right py-2 px-3 data-cell">{row.nights}</td>
                  <td className="text-right py-2 px-3 data-cell">{formatCurrency(row.ebitda, true, locale)}</td>
                  <td className={`text-right py-2 px-3 data-cell ${row.dscr >= 1.25 ? "text-positive" : "text-warning"}`}>
                    {formatMultiple(row.dscr)}
                  </td>
                  <td className={`text-right py-2 px-3 data-cell ${row.ncf >= 0 ? "text-positive" : "text-negative"}`}>
                    {formatCurrency(row.ncf, true, locale)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Interest Rate Sensitivity */}
      <div className="bg-white rounded-xl border border-surface-tertiary p-5">
        <h3 className="text-sm font-medium uppercase tracking-wider text-text-tertiary mb-4">
          {t('sens.interestSensitivity')} ({t('sens.base')}: {(assumptions.commercialLoan.interestRate * 100).toFixed(1)}%)
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-tertiary">
                <th className="text-left py-2 pr-4 text-xs uppercase tracking-wider text-text-tertiary font-medium">{t('sens.change')}</th>
                <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-text-tertiary font-medium">Rate</th>
                <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-text-tertiary font-medium">{t('kpi.annualDS')}</th>
                <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-text-tertiary font-medium">{t('term.dscr')}</th>
                <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-text-tertiary font-medium">{t('pnl.ncfPostVAT')}</th>
              </tr>
            </thead>
            <tbody>
              {sensitivityData.rateRows.map((row) => (
                <tr key={row.label} className={`border-b border-surface-secondary/50 ${row.isBase ? "bg-brand-50/50 font-medium" : ""}`}>
                  <td className="py-2 pr-4">{row.label}</td>
                  <td className="text-right py-2 px-3 data-cell">{row.rate}</td>
                  <td className="text-right py-2 px-3 data-cell">{formatCurrency(row.ds, true, locale)}</td>
                  <td className={`text-right py-2 px-3 data-cell ${row.dscr >= 1.25 ? "text-positive" : "text-warning"}`}>
                    {formatMultiple(row.dscr)}
                  </td>
                  <td className={`text-right py-2 px-3 data-cell ${row.ncf >= 0 ? "text-positive" : "text-negative"}`}>
                    {formatCurrency(row.ncf, true, locale)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
