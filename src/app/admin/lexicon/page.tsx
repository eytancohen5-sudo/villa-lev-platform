"use client";

import { useTranslation } from "@/lib/i18n/I18nProvider";
import { useState } from "react";

function Formula({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-3 px-4 py-3 bg-surface-secondary/60 rounded-xl border border-surface-tertiary font-mono text-sm text-text-primary overflow-x-auto">
      {children}
    </div>
  );
}

function Variable({ name, desc }: { name: string; desc: string }) {
  return (
    <div className="flex gap-3 items-baseline py-1">
      <code className="font-mono text-sm text-brand-600 whitespace-nowrap">{name}</code>
      <span className="text-sm text-text-secondary">{desc}</span>
    </div>
  );
}

function Section({
  id,
  title,
  children,
  open,
  onToggle,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="bg-white rounded-2xl border border-surface-tertiary shadow-sm overflow-hidden transition-all" id={id}>
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-surface-secondary/20 transition-colors"
      >
        <h3 className="font-display text-lg text-text-primary">{title}</h3>
        <span className={`text-text-tertiary text-xl transition-transform ${open ? 'rotate-180' : ''}`}>
          &#9662;
        </span>
      </button>
      {open && (
        <div className="px-6 pb-6 pt-0 text-sm text-text-secondary leading-relaxed space-y-4 border-t border-surface-secondary/60">
          {children}
        </div>
      )}
    </div>
  );
}

export default function LexiconPage() {
  const { t } = useTranslation();
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(['capex']));

  const toggle = (id: string) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const expandAll = () => {
    setOpenSections(new Set(['capex', 'revenue', 'opex', 'ebitda', 'pmt', 'dscr', 'breakeven', 'collateral', 'paths']));
  };

  return (
    <div>
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl text-text-primary">{t('lex.title')}</h1>
          <p className="text-sm text-text-secondary mt-1">{t('lex.subtitle')}</p>
        </div>
        <button onClick={expandAll} className="text-xs text-brand-600 hover:text-brand-700 font-medium transition-colors">
          Expand all
        </button>
      </div>

      {/* Quick nav */}
      <div className="flex flex-wrap gap-2 mb-6">
        {[
          { id: 'capex', label: 'CAPEX' },
          { id: 'revenue', label: 'Revenue' },
          { id: 'opex', label: 'OPEX' },
          { id: 'ebitda', label: 'EBITDA' },
          { id: 'pmt', label: 'PMT' },
          { id: 'dscr', label: 'DSCR' },
          { id: 'breakeven', label: 'Break-Even' },
          { id: 'collateral', label: 'Collateral' },
          { id: 'paths', label: 'Financing' },
        ].map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            onClick={() => setOpenSections((prev) => new Set(prev).add(s.id))}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-surface-secondary hover:bg-surface-tertiary text-text-secondary transition-colors"
          >
            {s.label}
          </a>
        ))}
      </div>

      <div className="space-y-4">
        {/* CAPEX */}
        <Section id="capex" title={t('lex.capex')} open={openSections.has('capex')} onToggle={() => toggle('capex')}>
          <p>Total project cost is computed per property type, then scaled by the number of units.</p>
          <Formula>
            Per Unit Cost = Land + Construction + FF&E + Legal + Architect + Civil Engineer + Contingency
          </Formula>
          <Formula>
            Construction = Area (m&sup2;) &times; Cost per m&sup2;
          </Formula>
          <Formula>
            Contingency = (Construction + FF&E) &times; Contingency Rate
          </Formula>
          <Formula>
            Portfolio Total = (Per Unit A &times; n<sub>A</sub>) + (Per Unit B &times; n<sub>B</sub>) + Acquisition Legal
          </Formula>
          <Formula>
            Acquisition Legal = Cost per Plot &times; (n<sub>A</sub> + n<sub>B</sub>)
          </Formula>
          <div className="mt-3">
            <Variable name="n_A" desc="Number of Property A units (Twin Villas)" />
            <Variable name="n_B" desc="Number of Property B units (Boutique Suites)" />
            <Variable name="Contingency Rate" desc="Default 10% of construction + FF&E" />
          </div>
        </Section>

        {/* Revenue */}
        <Section id="revenue" title={t('lex.revenue')} open={openSections.has('revenue')} onToggle={() => toggle('revenue')}>
          <p>Revenue is computed per property unit, then aggregated across the portfolio. A ramp factor applies during the first two operating years.</p>
          <Formula>
            Villa Revenue (per unit) = Nights &times; ADR &times; Ramp Factor
          </Formula>
          <Formula>
            Suite Revenue (per unit) = (2 &times; Standard ADR + 2 &times; Double ADR) &times; Nights &times; Ramp Factor
          </Formula>
          <Formula>
            Total Revenue = Villa Rev &times; n<sub>A</sub> + Suite Rev &times; n<sub>B</sub> + Events + Ancillary
          </Formula>
          <div className="mt-3 space-y-1">
            <p className="font-medium text-text-primary">Ramp Factor:</p>
            <Variable name="Year 1 (2028)" desc="75% of mature revenue — partial opening season" />
            <Variable name="Year 2 (2029)" desc="88% — building brand recognition" />
            <Variable name="Year 3+ (2030+)" desc="100% — stabilised operations" />
          </div>
          <div className="mt-3 space-y-1">
            <p className="font-medium text-text-primary">Nights Growth:</p>
            <Formula>
              Nights(year) = min(Cap, Base Nights + max(0, year - 2030) &times; Growth/yr)
            </Formula>
            <Variable name="Base Nights" desc="Starting occupancy in mature year (default: 95 villa, 100 suite)" />
            <Variable name="Growth" desc="+3 nights per year from 2030" />
            <Variable name="Cap" desc="Maximum 110 nights per year" />
          </div>
          <div className="mt-3 space-y-1">
            <p className="font-medium text-text-primary">Ancillary Revenue:</p>
            <Formula>
              Ancillary(year) = Base Profit &times; (1 + Growth Rate)<sup>year - 2028</sup>
            </Formula>
          </div>
        </Section>

        {/* OPEX */}
        <Section id="opex" title={t('lex.opex')} open={openSections.has('opex')} onToggle={() => toggle('opex')}>
          <p>Operating expenses are computed per property type with a phased maintenance schedule reflecting building age.</p>
          <Formula>
            OPEX (per unit) = Housekeeping + Maintenance + Utilities + Insurance + Property Tax + Marketing + Management + Consumables + Accounting
          </Formula>
          <Formula>
            Total OPEX = OPEX<sub>A</sub> &times; n<sub>A</sub> + OPEX<sub>B</sub> &times; n<sub>B</sub>
          </Formula>
          <div className="mt-3 space-y-1">
            <p className="font-medium text-text-primary">Maintenance Phasing (% of construction cost):</p>
            <Variable name="Years 1-2 (2028-2029)" desc="0.5% — new build, minimal maintenance" />
            <Variable name="Year 3 (2030)" desc="1.0% — first full service cycle" />
            <Variable name="Year 4+ (2031+)" desc="1.5% — stabilised maintenance run-rate" />
          </div>
        </Section>

        {/* EBITDA */}
        <Section id="ebitda" title={t('lex.ebitda')} open={openSections.has('ebitda')} onToggle={() => toggle('ebitda')}>
          <p>Earnings Before Interest, Tax, Depreciation and Amortisation. The primary measure of operating profitability.</p>
          <Formula>
            EBITDA = Total Revenue - Total OPEX
          </Formula>
          <Formula>
            EBITDA Margin = EBITDA / Total Revenue
          </Formula>
          <p>EBITDA is the numerator in the DSCR calculation and represents the cash available to service debt obligations.</p>
        </Section>

        {/* PMT */}
        <Section id="pmt" title={t('lex.pmt')} open={openSections.has('pmt')} onToggle={() => toggle('pmt')}>
          <p>The PMT (Payment) function calculates the fixed periodic payment required to fully amortise a loan. This matches the Excel PMT function.</p>
          <Formula>
            PMT = r &times; PV / (1 - (1 + r)<sup>-n</sup>)
          </Formula>
          <div className="mt-3">
            <Variable name="r" desc="Annual interest rate (e.g., 0.05 for 5%)" />
            <Variable name="PV" desc="Present value — the loan principal" />
            <Variable name="n" desc="Number of amortisation periods (years)" />
          </div>
          <p className="mt-3">When the interest rate is zero (e.g., HDB portion of TEPIX loans), the formula simplifies to:</p>
          <Formula>
            PMT = PV / n
          </Formula>
          <div className="mt-3 space-y-1">
            <p className="font-medium text-text-primary">Grace Period:</p>
            <p>During the grace period (typically 2 years, covering acquisition and construction), only interest is payable — no principal amortisation. The full PMT-based debt service begins after the grace period ends.</p>
          </div>
        </Section>

        {/* DSCR */}
        <Section id="dscr" title={t('lex.dscr')} open={openSections.has('dscr')} onToggle={() => toggle('dscr')}>
          <p>The Debt Service Coverage Ratio measures the project's ability to cover its debt obligations from operating cash flow.</p>
          <Formula>
            DSCR = EBITDA / Annual Debt Service
          </Formula>
          <div className="mt-3">
            <Variable name="DSCR > 1.25x" desc="Comfortable — standard bank covenant threshold" />
            <Variable name="DSCR 1.0x - 1.25x" desc="Marginal — debt is serviceable but with limited buffer" />
            <Variable name="DSCR < 1.0x" desc="Distressed — operating income insufficient to cover debt" />
          </div>
          <p className="mt-3">Banks typically require a minimum DSCR of 1.20x-1.30x as a loan covenant. The model targets 1.25x as the benchmark.</p>
        </Section>

        {/* Break-Even */}
        <Section id="breakeven" title={t('lex.breakeven')} open={openSections.has('breakeven')} onToggle={() => toggle('breakeven')}>
          <p>Break-even analysis determines the minimum operating performance required to cover all costs including debt service (DSCR = 1.0x).</p>
          <div className="mt-3 space-y-1">
            <p className="font-medium text-text-primary">Method A — Nights Only:</p>
            <Formula>
              Break-Even Nights = (DS + OPEX - Fixed Revenue) / Revenue per Night
            </Formula>
          </div>
          <div className="mt-3 space-y-1">
            <p className="font-medium text-text-primary">Method B — ADR Only:</p>
            <Formula>
              Break-Even ADR = (DS + OPEX - Suite Revenue - Fixed Revenue) / (n<sub>A</sub> &times; Base Nights)
            </Formula>
          </div>
          <div className="mt-3 space-y-1">
            <p className="font-medium text-text-primary">Method C — Proportional Drop:</p>
            <p>Both nights and ADRs each fall by the square root of the required reduction factor:</p>
            <Formula>
              Factor = &radic;((DS + OPEX - Fixed Revenue) / Occupancy-Linked Revenue)
            </Formula>
            <p>This gives the proportional drop where both dimensions contribute equally to reaching DSCR = 1.0x.</p>
          </div>
        </Section>

        {/* Collateral */}
        <Section id="collateral" title={t('lex.collateral')} open={openSections.has('collateral')} onToggle={() => toggle('collateral')}>
          <p>Asset valuation provides collateral comfort to lenders. Three valuation scenarios are computed.</p>
          <Formula>
            Built Surface = Area<sub>A</sub> &times; n<sub>A</sub> + Area<sub>B</sub> &times; n<sub>B</sub>
          </Formula>
          <Formula>
            Asset Value = Built Surface &times; Valuation per m&sup2;
          </Formula>
          <Formula>
            LTV = Loan Amount / Asset Value
          </Formula>
          <Formula>
            Asset Coverage = Asset Value / Loan Amount
          </Formula>
          <div className="mt-3">
            <Variable name="Stress" desc="Conservative valuation — distressed market conditions" />
            <Variable name="Market" desc="Current comparable market valuation" />
            <Variable name="Optimistic" desc="Premium positioning reflecting brand value" />
          </div>
        </Section>

        {/* Financing Paths */}
        <Section id="paths" title={t('lex.paths')} open={openSections.has('paths')} onToggle={() => toggle('paths')}>
          <div className="space-y-6">
            <div>
              <h4 className="font-medium text-text-primary mb-2">Commercial Loan</h4>
              <p>Standard bank financing at market terms.</p>
              <Formula>
                Loan = Total CAPEX &times; 75% (LTV)
                <br />
                Equity = Total CAPEX &times; 25%
                <br />
                Annual DS = PMT(5%, 13 years, Loan)
              </Formula>
              <Variable name="Grace" desc="2 years (interest only during construction)" />
            </div>

            <div>
              <h4 className="font-medium text-text-primary mb-2">RRF (Recovery & Resilience Facility)</h4>
              <p>EU-backed blended rate financing with 80% at subsidised rate.</p>
              <Formula>
                RRF Portion = Loan &times; 80% at 0.35%
                <br />
                Commercial Portion = Loan &times; 20% at 5%
                <br />
                Annual DS = PMT(0.35%, 13yr, RRF) + PMT(5%, 13yr, Commercial)
              </Formula>
            </div>

            <div>
              <h4 className="font-medium text-text-primary mb-2">Grant (Anaptyxiakos)</h4>
              <p>60% grant on non-plot eligible costs. The grant reduces the required loan amount.</p>
              <Formula>
                Non-Plot Eligible = CAPEX - Land - Acquisition Legal
                <br />
                Grant = Non-Plot Eligible &times; 60%
                <br />
                Remaining Loan = (CAPEX - Grant) &times; 75%
              </Formula>
            </div>

            <div>
              <h4 className="font-medium text-text-primary mb-2">TEPIX III — Loan Fund</h4>
              <p>HDB/EAT co-investment: 40% interest-free from the fund, 60% from partner bank. Subject to a 10% land cap with a supplementary commercial loan for the residual.</p>
              <Formula>
                Non-Land Loan = Non-Land Cost &times; 90%
                <br />
                Land Funded by TEPIX = (Cap &times; Non-Land Loan) / (1 - Cap)
                <br />
                Primary Loan = Non-Land Loan + Land Funded by TEPIX
                <br />
                Land Gap = Total Land - Land Funded by TEPIX
                <br />
                Supplementary Loan = Land Gap &times; 75%
              </Formula>
              <Variable name="Cap" desc="10% — statutory limit on land portion of fund contribution" />
              <Variable name="HDB share" desc="40% of primary loan — interest-free, amortised over 12 years" />
              <Variable name="Bank share" desc="60% of primary loan — at bank rate (5%), amortised over 12 years" />
              <Variable name="Subsidy" desc="2pp interest rate reduction for first 2 years (South Aegean)" />
            </div>

            <div>
              <h4 className="font-medium text-text-primary mb-2">TEPIX III — Guarantee Fund</h4>
              <p>70% guarantee on the full bank loan, reducing collateral requirements. Same land cap and supplementary loan structure as the Loan Fund.</p>
              <Formula>
                Primary Loan = Non-Land Loan + Land Funded by TEPIX
                <br />
                Annual DS = PMT(5%, 12yr, Primary Loan) + PMT(5%, 13yr, Supplementary Loan)
              </Formula>
              <Variable name="Guarantee" desc="70% of primary loan covered — General Entrepreneurship programme" />
              <Variable name="Collateral cap" desc="30% of loan principal (statutory maximum)" />
            </div>
          </div>
        </Section>
      </div>

      <div className="mt-8 bg-surface-secondary rounded-2xl p-6 text-xs text-text-tertiary">
        <p>This lexicon documents the mathematical methodology implemented in the Villa Lev Group financial engine. All formulas are deterministic and match the Excel Business Plan v4 model. The engine computes all five financing paths simultaneously, producing a complete 11-year P&L projection (2026-2036) for each scenario in under 10ms.</p>
      </div>
    </div>
  );
}
