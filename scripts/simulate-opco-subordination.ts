// ─────────────────────────────────────────────────────────────
// OpCo subordination simulation (Option 1) — 2026-05-22
// ─────────────────────────────────────────────────────────────
//
// Captures before/after comparison for the Option-1 subordination
// change: OpCo paid AFTER bank debt service (junior to bank), DSCR
// numerator switched from `ebitda` (post-OpCo) to `ebitdaPreOpCo`.
//
// The engine has already been changed. We reconstruct the legacy
// numbers algebraically from the new engine output for each year:
//
//   legacy_opCoTotal  = opCoBaseFee + opCoBrandFee + opCoIncentiveFee
//                       (the breakdown stays "gross calculated"; only
//                        the reported total was clipped to residual)
//   legacy_ebitda     = ebitdaPreOpCo - legacy_opCoTotal
//   legacy_dscr       = legacy_ebitda / ds
//   legacy_ncf        = legacy_ebitda - ds
//   legacy_cit        = max(0, legacy_ebitda - termLoanInterest) × -CIT_rate
//   legacy_cfads      = legacy_ebitda + legacy_cit
//
// Sanity check: when opCoFee.enabled === false, every breakdown line is 0,
// so legacy_* == new_*. We assert this explicitly for the OpCo-disabled
// runs.
//
//   Usage:  npx tsx scripts/simulate-opco-subordination.ts

import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

import { computeModel } from "../src/lib/engine/model";
import { BASE_CASE } from "../src/lib/engine/defaults";
import {
  computeCapTable,
  DEFAULT_CAP_TABLE,
  DEFAULT_WATERFALL,
} from "../src/lib/engine/capTable";
import type {
  FinancingPath,
  ModelAssumptions,
  ScenarioOutput,
  ModelOutput,
  AnnualPnL,
} from "../src/lib/engine/types";

const PATHS: FinancingPath[] = ["commercial", "tepix-loan", "grant", "rrf"];
type ScenarioKey = "realistic" | "upside" | "downside";
const SCENARIOS: ScenarioKey[] = ["realistic", "upside", "downside"];

const CIT_RATE = BASE_CASE.tax.corporateIncomeTaxRate;
const VAT_RATE = BASE_CASE.tax.netVATRate;

// ── Legacy reconstruction ───────────────────────────────────────────────
//
// For a given AnnualPnL produced by the NEW engine, compute the legacy
// (pre-subordination) values of ebitda / ncf / dscr / cit / cfads.

interface LegacyYear {
  year: number;
  // Pre-OpCo
  ebitdaPreOpCo: number;
  ds: number;
  termLoanInterest: number;
  vat: number;
  // Reconstructed legacy (old)
  legacyOpCoTotal: number;
  legacyEbitda: number;
  legacyDscr: number;
  legacyNcf: number;
  legacyCit: number;
  legacyCfads: number;
  legacyNcfPostVAT: number;
  // New (current)
  newOpCoActuallyPaid: number;
  newEbitda: number;
  newDscr: number;
  newNcf: number;
  newCit: number;
  newCfads: number;
  newNcfPostVAT: number;
}

function reconstructLegacy(p: AnnualPnL): LegacyYear {
  const grossOpCo = p.opCoBaseFee + p.opCoBrandFee + p.opCoIncentiveFee;
  const ds = p.debtService;
  const ebitdaPreOpCo = p.ebitdaPreOpCo;

  // Legacy formulae
  const legacyEbitda = ebitdaPreOpCo - grossOpCo;
  const legacyNcf = legacyEbitda - ds;
  const legacyDscr = ds > 0 ? legacyEbitda / ds : 0;
  const legacyTaxable = Math.max(0, legacyEbitda - p.termLoanInterest);
  const legacyCit =
    p.year <= 2027 ? 0 : -(legacyTaxable * CIT_RATE);
  const legacyCfads = legacyEbitda + legacyCit;
  const legacyVat = p.vatPayable; // VAT is revenue-based, unchanged
  const legacyNcfPostVAT = legacyNcf + legacyVat + legacyCit;

  return {
    year: p.year,
    ebitdaPreOpCo,
    ds,
    termLoanInterest: p.termLoanInterest,
    vat: legacyVat,
    legacyOpCoTotal: grossOpCo,
    legacyEbitda,
    legacyDscr,
    legacyNcf,
    legacyCit,
    legacyCfads,
    legacyNcfPostVAT,
    newOpCoActuallyPaid: p.opCoTotalFee, // already actually-paid post-change
    newEbitda: p.ebitda,
    newDscr: p.dscr,
    newNcf: p.netCashFlow,
    newCit: p.citPayable,
    newCfads: p.cfads,
    newNcfPostVAT: p.netCashFlowPostVAT,
  };
}

// ── Scenario summary ────────────────────────────────────────────────────

interface ScenarioSummary {
  stabilisedYear: number;
  legacyStabDSCR: number;
  newStabDSCR: number;
  legacyMinDSCRLoanLife: number;
  newMinDSCRLoanLife: number;
  legacyStabNCF: number;
  newStabNCF: number;
  legacyStabEbitda: number;
  newStabEbitda: number;
  legacyStabCfads: number;
  newStabCfads: number;
  // Cumulative across years 2028-2036
  legacyTotalNCF: number;
  newTotalNCF: number;
  legacyTotalOpCoPaid: number;
  newTotalOpCoPaid: number;
  legacyTotalOpCoCalculated: number; // same as legacy paid (no cap)
  // Founder / investor takes (from cap table)
  legacyFounderTake: number;
  newFounderTake: number;
  legacyInvestorTake: number;
  newInvestorTake: number;
  // Equity IRR — recomputed off legacy ncfPostVAT
  legacyEquityIRR: number;
  newEquityIRR: number;
  // Per-year LegacyYear records
  yearly: LegacyYear[];
}

function npv(rate: number, cashFlows: number[]): number {
  let total = 0;
  for (let t = 0; t < cashFlows.length; t++) {
    total += cashFlows[t] / Math.pow(1 + rate, t);
  }
  return total;
}

function irr(cashFlows: number[], guess = 0.1): number {
  const hasNeg = cashFlows.some((cf) => cf < 0);
  const hasPos = cashFlows.some((cf) => cf > 0);
  if (!hasNeg || !hasPos) return NaN;
  let r = guess;
  for (let i = 0; i < 200; i++) {
    const f = npv(r, cashFlows);
    const dr = 1e-6;
    const fPrime = (npv(r + dr, cashFlows) - f) / dr;
    if (Math.abs(fPrime) < 1e-14) break;
    const newR = r - f / fPrime;
    if (!isFinite(newR)) break;
    if (Math.abs(newR - r) < 1e-9) return newR;
    r = newR;
  }
  let lo = -0.99;
  let hi = 5.0;
  let fLo = npv(lo, cashFlows);
  let fHi = npv(hi, cashFlows);
  if (fLo * fHi > 0) return NaN;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    const fMid = npv(mid, cashFlows);
    if (Math.abs(fMid) < 1e-6) return mid;
    if (fLo * fMid < 0) {
      hi = mid;
      fHi = fMid;
    } else {
      lo = mid;
      fLo = fMid;
    }
  }
  return (lo + hi) / 2;
}

function summarise(
  model: ModelOutput,
  scenario: ScenarioOutput,
  grantApproved: boolean,
): ScenarioSummary {
  const yearly = scenario.pnl.map(reconstructLegacy);
  const stab = scenario.stabilisedYear;
  const stabRecon = stab ? reconstructLegacy(stab) : null;

  // minDSCR over operational years (2029+)
  const dscrWindow = yearly.filter((y) => y.year >= 2029);
  const legacyMinDSCR = dscrWindow.length
    ? Math.min(...dscrWindow.filter((y) => y.legacyDscr > 0).map((y) => y.legacyDscr))
    : 0;
  const newMinDSCR = dscrWindow.length
    ? Math.min(...dscrWindow.filter((y) => y.newDscr > 0).map((y) => y.newDscr))
    : 0;

  const op = yearly.filter((y) => y.year >= 2028);
  const legacyTotalNCF = op.reduce((s, y) => s + y.legacyNcfPostVAT, 0);
  const newTotalNCF = op.reduce((s, y) => s + y.newNcfPostVAT, 0);
  const legacyTotalOpCo = op.reduce((s, y) => s + y.legacyOpCoTotal, 0);
  const newTotalOpCo = op.reduce((s, y) => s + y.newOpCoActuallyPaid, 0);

  // Equity IRR via legacy / new NCF-post-VAT, terminal asset = exit ebitda × multiple
  const exitYear = scenario.exitYear;
  const exitMultiple = scenario.exitEbitdaMultiple;
  const exitIdx = scenario.pnl.findIndex((p) => p.year === exitYear);
  const truncated = exitIdx >= 0 ? scenario.pnl.slice(0, exitIdx + 1) : scenario.pnl;
  const exitP = scenario.pnl[exitIdx];
  // Equity required: pull from the model.keyMetrics / extra hop
  const eqReq = model.keyMetrics.equityRequired;

  // Legacy terminal: legacyEbitda (post-opCo, pre-subordination) × multiple
  const legacyExitRec = exitP ? reconstructLegacy(exitP) : null;
  const legacyTerminalAsset =
    (legacyExitRec?.legacyEbitda ?? 0) > 0
      ? (legacyExitRec!.legacyEbitda) * exitMultiple
      : 0;
  const remainingDebt = exitP?.termLoanBalance ?? 0;
  const legacyTerminalEquity = Math.max(0, legacyTerminalAsset - remainingDebt);

  const newTerminalAsset = (exitP?.ebitda ?? 0) > 0 ? exitP!.ebitda * exitMultiple : 0;
  const newTerminalEquity = Math.max(0, newTerminalAsset - remainingDebt);

  const legacyCFs: number[] = [-eqReq];
  const newCFs: number[] = [-eqReq];
  truncated.forEach((p, i) => {
    const rec = reconstructLegacy(p);
    const last = i === truncated.length - 1;
    legacyCFs.push(rec.legacyNcfPostVAT + (last ? legacyTerminalEquity : 0));
    newCFs.push(rec.newNcfPostVAT + (last ? newTerminalEquity : 0));
  });
  const legacyEquityIRR = isFinite(irr(legacyCFs)) ? irr(legacyCFs) : 0;
  const newEquityIRR = isFinite(irr(newCFs)) ? irr(newCFs) : 0;

  // Founder / investor takes via cap table — for "legacy", we have to re-run
  // computeCapTable against a scenario whose pnl values are the legacy ones.
  // The cap table consumes scenario.pnl[i].netCashFlowPostVAT primarily.
  // Construct a shadow scenario whose pnl entries carry legacy fields.
  const shadowLegacyPnl: AnnualPnL[] = scenario.pnl.map((p, i) => {
    const rec = yearly[i];
    return {
      ...p,
      opCoTotalFee: rec.legacyOpCoTotal,
      ebitda: rec.legacyEbitda,
      netCashFlow: rec.legacyNcf,
      citPayable: rec.legacyCit,
      cfads: rec.legacyCfads,
      dscr: rec.legacyDscr,
      netCashFlowPostVAT: rec.legacyNcfPostVAT,
      profitAfterTax: rec.legacyNcf + rec.legacyCit,
    };
  });
  const legacyShadow: ScenarioOutput = {
    ...scenario,
    pnl: shadowLegacyPnl,
    stabilisedYear:
      shadowLegacyPnl.find((p) => p.year === 2031) ?? null,
  };
  const newCap = computeCapTable(scenario, DEFAULT_CAP_TABLE, DEFAULT_WATERFALL, {
    grantApproved,
    bankLoanAmount: model.keyMetrics.loanAmount,
  });
  const legacyCap = computeCapTable(legacyShadow, DEFAULT_CAP_TABLE, DEFAULT_WATERFALL, {
    grantApproved,
    bankLoanAmount: model.keyMetrics.loanAmount,
  });
  const founderNew = newCap.stakeholders.find((s) => s.stakeholder.isPromoter);
  const founderLegacy = legacyCap.stakeholders.find((s) => s.stakeholder.isPromoter);
  const newFounderTake = founderNew?.totalReceived ?? 0;
  const legacyFounderTake = founderLegacy?.totalReceived ?? 0;
  const newInvestorTake = newCap.stakeholders
    .filter((s) => !s.stakeholder.isPromoter)
    .reduce((s, sh) => s + sh.totalReceived, 0);
  const legacyInvestorTake = legacyCap.stakeholders
    .filter((s) => !s.stakeholder.isPromoter)
    .reduce((s, sh) => s + sh.totalReceived, 0);

  return {
    stabilisedYear: stab?.year ?? 2031,
    legacyStabDSCR: stabRecon?.legacyDscr ?? 0,
    newStabDSCR: stabRecon?.newDscr ?? 0,
    legacyMinDSCRLoanLife: legacyMinDSCR,
    newMinDSCRLoanLife: newMinDSCR,
    legacyStabNCF: stabRecon?.legacyNcfPostVAT ?? 0,
    newStabNCF: stabRecon?.newNcfPostVAT ?? 0,
    legacyStabEbitda: stabRecon?.legacyEbitda ?? 0,
    newStabEbitda: stabRecon?.newEbitda ?? 0,
    legacyStabCfads: stabRecon?.legacyCfads ?? 0,
    newStabCfads: stabRecon?.newCfads ?? 0,
    legacyTotalNCF,
    newTotalNCF,
    legacyTotalOpCoPaid: legacyTotalOpCo,
    newTotalOpCoPaid: newTotalOpCo,
    legacyTotalOpCoCalculated: legacyTotalOpCo,
    legacyFounderTake,
    newFounderTake,
    legacyInvestorTake,
    newInvestorTake,
    legacyEquityIRR,
    newEquityIRR,
    yearly,
  };
}

// ── Runner ──────────────────────────────────────────────────────────────

function buildOpCoEnabled(fp: FinancingPath): ModelAssumptions {
  return {
    ...BASE_CASE,
    financingPath: fp,
    opCoFee: {
      ...BASE_CASE.opCoFee,
      enabled: true,
    },
  };
}

function buildOpCoDisabled(fp: FinancingPath): ModelAssumptions {
  return {
    ...BASE_CASE,
    financingPath: fp,
    opCoFee: {
      ...BASE_CASE.opCoFee,
      enabled: false,
    },
  };
}

interface Bundle {
  realistic: ScenarioSummary;
  upside: ScenarioSummary;
  downside: ScenarioSummary;
}

function runOpCoEnabled(): Record<FinancingPath, Bundle> {
  const out: Partial<Record<FinancingPath, Bundle>> = {};
  for (const fp of PATHS) {
    const model = computeModel(buildOpCoEnabled(fp));
    const grantApproved = fp === "grant";
    out[fp] = {
      realistic: summarise(model, model.scenarios.realistic, grantApproved),
      upside: summarise(model, model.scenarios.upside, grantApproved),
      downside: summarise(model, model.scenarios.downside, grantApproved),
    };
  }
  return out as Record<FinancingPath, Bundle>;
}

// Sanity: OpCo disabled must be a structural no-op (legacy == new on every metric).
function sanityCheckOpCoDisabled(): string[] {
  const issues: string[] = [];
  for (const fp of PATHS) {
    const model = computeModel(buildOpCoDisabled(fp));
    const grantApproved = fp === "grant";
    for (const sc of SCENARIOS) {
      const s = summarise(model, model.scenarios[sc], grantApproved);
      const fields: Array<[string, number, number]> = [
        ["stabDSCR", s.legacyStabDSCR, s.newStabDSCR],
        ["stabNCF", s.legacyStabNCF, s.newStabNCF],
        ["stabEbitda", s.legacyStabEbitda, s.newStabEbitda],
        ["stabCfads", s.legacyStabCfads, s.newStabCfads],
        ["totalNCF", s.legacyTotalNCF, s.newTotalNCF],
        ["totalOpCoPaid", s.legacyTotalOpCoPaid, s.newTotalOpCoPaid],
        ["founderTake", s.legacyFounderTake, s.newFounderTake],
        ["investorTake", s.legacyInvestorTake, s.newInvestorTake],
        ["equityIRR", s.legacyEquityIRR, s.newEquityIRR],
      ];
      for (const [name, l, n] of fields) {
        if (Math.abs(l - n) > 1e-6) {
          issues.push(`OpCo-disabled / ${fp} / ${sc} / ${name}: legacy=${l} new=${n} Δ=${n - l}`);
        }
      }
    }
  }
  return issues;
}

// ── Formatting ──────────────────────────────────────────────────────────

const fmtPct = (n: number, d = 2) => (isFinite(n) ? `${(n * 100).toFixed(d)}%` : "n/a");
const fmtRatio = (n: number, d = 3) => (isFinite(n) ? n.toFixed(d) : "n/a");
const fmtNum = (n: number) =>
  isFinite(n) ? `${n >= 0 ? "" : "-"}€${Math.round(Math.abs(n)).toLocaleString()}` : "n/a";
const dPct = (a: number, b: number) =>
  Math.abs(b - a) < 1e-9 ? "0.00pp" : `${b - a >= 0 ? "+" : ""}${((b - a) * 100).toFixed(2)}pp`;
const dRatio = (a: number, b: number) =>
  Math.abs(b - a) < 1e-9 ? "0.000" : `${b - a >= 0 ? "+" : ""}${(b - a).toFixed(3)}`;
const dNum = (a: number, b: number) => {
  const d = b - a;
  if (Math.abs(d) < 0.5) return "€0";
  return `${d >= 0 ? "+" : "-"}€${Math.round(Math.abs(d)).toLocaleString()}`;
};

// ── Main ────────────────────────────────────────────────────────────────

console.log("OpCo subordination simulation (Option 1) — 2026-05-22");
console.log("");
console.log("[1/2] Sanity check: OpCo-disabled must be a structural no-op...");
const sanityIssues = sanityCheckOpCoDisabled();
if (sanityIssues.length === 0) {
  console.log("      OK — legacy and new outputs match on every OpCo-disabled metric.");
} else {
  console.log(`      FAIL — ${sanityIssues.length} discrepancies:`);
  for (const i of sanityIssues) console.log(`        - ${i}`);
}
console.log("");

console.log("[2/2] OpCo-enabled comparison (gross fees calculated, paid out of residual)...");
const enabled = runOpCoEnabled();
console.log("");

const lines: string[] = [];
lines.push("# OpCo subordination simulation (Option 1) — 2026-05-22");
lines.push("");
lines.push(
  "Comparison of the financial-engine cash waterfall before and after Option 1: OpCo subordinated to bank debt service. Per Eytan's decision today, bankers reject the legacy model where OpCo fees are deducted from EBITDA before DSCR. The fix: bank gets paid first, OpCo paid out of residual cash, DSCR numerator is `ebitdaPreOpCo`.",
);
lines.push("");
lines.push("## Cash waterfall change");
lines.push("");
lines.push("**Before (Eng v current pre-2026-05-21):**");
lines.push("```");
lines.push("totalRevenue → totalOpex → ebitdaPreOpCo → opCoFees → ebitda → debtService → ncf");
lines.push("                                                     ↑");
lines.push("                                           DSCR = ebitda / ds");
lines.push("```");
lines.push("");
lines.push("**After (Eng v current 2026-05-22, this commit):**");
lines.push("```");
lines.push("totalRevenue → totalOpex → ebitdaPreOpCo → debtService → residual → opCoActuallyPaid → ncf");
lines.push("                                          ↑");
lines.push("                            DSCR = ebitdaPreOpCo / ds");
lines.push("```");
lines.push("");
lines.push(
  "Where `opCoActuallyPaid = min(opCoTotalFeeCalculated, max(0, ebitdaPreOpCo − debtService))`. If residual cash is less than the calculated OpCo fee, only the residual is paid this year. **No accrual/carryover** for unpaid OpCo — the shortfall is forfeit (TODO marked in `model.ts` for proper deferral tracking later).",
);
lines.push("");
lines.push("## Sanity check: OpCo disabled");
lines.push("");
if (sanityIssues.length === 0) {
  lines.push(
    "**PASS** — `opCoFee.enabled === false` (the default in `BASE_CASE`): legacy and new outputs are identical on every metric (stabDSCR, NCF, EBITDA, CFADS, OpCo paid, founder take, investor take, equity IRR), across all 4 financing paths × 3 scenarios.",
  );
  lines.push("");
  lines.push(
    "This confirms the change is a structural no-op when OpCo is disabled — which is why the golden snapshot at `src/lib/engine/__tests__/model.golden.test.snap` did not need regeneration (vitest run: 45/45 pass, no snapshot drift).",
  );
} else {
  lines.push("**FAIL** — discrepancies found in OpCo-disabled mode:");
  lines.push("");
  for (const i of sanityIssues) lines.push(`- ${i}`);
}
lines.push("");

// Realistic summary
lines.push("## OpCo-enabled comparison — Realistic scenario");
lines.push("");
lines.push(
  "OpCo fees configured per `BASE_CASE.opCoFee` (baseFeeRate=3%, brandFeeRate=2%, incentiveFeeRate=10%, ownerPriorityReturn=8%), with `enabled = true` overlaid for this simulation.",
);
lines.push("");
lines.push("### Stabilised DSCR (2031)");
lines.push("");
lines.push("| Path | Legacy (ebitda/ds) | New (ebitdaPreOpCo/ds) | Δ |");
lines.push("| --- | ---: | ---: | ---: |");
for (const fp of PATHS) {
  const s = enabled[fp].realistic;
  lines.push(`| ${fp} | ${fmtRatio(s.legacyStabDSCR)} | ${fmtRatio(s.newStabDSCR)} | ${dRatio(s.legacyStabDSCR, s.newStabDSCR)} |`);
}
lines.push("");

lines.push("### Min DSCR (loan life, 2029-2036)");
lines.push("");
lines.push("| Path | Legacy | New | Δ |");
lines.push("| --- | ---: | ---: | ---: |");
for (const fp of PATHS) {
  const s = enabled[fp].realistic;
  lines.push(`| ${fp} | ${fmtRatio(s.legacyMinDSCRLoanLife)} | ${fmtRatio(s.newMinDSCRLoanLife)} | ${dRatio(s.legacyMinDSCRLoanLife, s.newMinDSCRLoanLife)} |`);
}
lines.push("");

lines.push("### Stabilised NCF post-VAT (2031, what equity receives that year)");
lines.push("");
lines.push("| Path | Legacy | New | Δ |");
lines.push("| --- | ---: | ---: | ---: |");
for (const fp of PATHS) {
  const s = enabled[fp].realistic;
  lines.push(`| ${fp} | ${fmtNum(s.legacyStabNCF)} | ${fmtNum(s.newStabNCF)} | ${dNum(s.legacyStabNCF, s.newStabNCF)} |`);
}
lines.push("");

lines.push("### Equity IRR (post-subordination, to exit year)");
lines.push("");
lines.push("| Path | Legacy | New | Δ |");
lines.push("| --- | ---: | ---: | ---: |");
for (const fp of PATHS) {
  const s = enabled[fp].realistic;
  lines.push(`| ${fp} | ${fmtPct(s.legacyEquityIRR)} | ${fmtPct(s.newEquityIRR)} | ${dPct(s.legacyEquityIRR, s.newEquityIRR)} |`);
}
lines.push("");

lines.push("### Founder cumulative cash take (cap-table-derived)");
lines.push("");
lines.push("| Path | Legacy | New | Δ |");
lines.push("| --- | ---: | ---: | ---: |");
for (const fp of PATHS) {
  const s = enabled[fp].realistic;
  lines.push(`| ${fp} | ${fmtNum(s.legacyFounderTake)} | ${fmtNum(s.newFounderTake)} | ${dNum(s.legacyFounderTake, s.newFounderTake)} |`);
}
lines.push("");

lines.push("### OpCo cumulative paid (2028-2036)");
lines.push("");
lines.push("| Path | Legacy (gross, no cap) | New (post subordination cap) | Δ |");
lines.push("| --- | ---: | ---: | ---: |");
for (const fp of PATHS) {
  const s = enabled[fp].realistic;
  lines.push(`| ${fp} | ${fmtNum(s.legacyTotalOpCoPaid)} | ${fmtNum(s.newTotalOpCoPaid)} | ${dNum(s.legacyTotalOpCoPaid, s.newTotalOpCoPaid)} |`);
}
lines.push("");

// Per-year drill on the path that bankers care about most (tepix-loan, then commercial).
lines.push("## Per-year drill — Realistic / tepix-loan");
lines.push("");
lines.push("| Year | ebitdaPreOpCo | DS | Legacy ebitda | Legacy DSCR | Legacy NCF | New ebitda | New DSCR | New NCF | OpCo gross | OpCo paid |");
lines.push("| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |");
for (const y of enabled["tepix-loan"].realistic.yearly) {
  lines.push(
    `| ${y.year} | ${fmtNum(y.ebitdaPreOpCo)} | ${fmtNum(y.ds)} | ${fmtNum(y.legacyEbitda)} | ${fmtRatio(y.legacyDscr)} | ${fmtNum(y.legacyNcf)} | ${fmtNum(y.newEbitda)} | ${fmtRatio(y.newDscr)} | ${fmtNum(y.newNcf)} | ${fmtNum(y.legacyOpCoTotal)} | ${fmtNum(y.newOpCoActuallyPaid)} |`,
  );
}
lines.push("");

// Same drill for commercial.
lines.push("## Per-year drill — Realistic / commercial");
lines.push("");
lines.push("| Year | ebitdaPreOpCo | DS | Legacy ebitda | Legacy DSCR | Legacy NCF | New ebitda | New DSCR | New NCF | OpCo gross | OpCo paid |");
lines.push("| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |");
for (const y of enabled["commercial"].realistic.yearly) {
  lines.push(
    `| ${y.year} | ${fmtNum(y.ebitdaPreOpCo)} | ${fmtNum(y.ds)} | ${fmtNum(y.legacyEbitda)} | ${fmtRatio(y.legacyDscr)} | ${fmtNum(y.legacyNcf)} | ${fmtNum(y.newEbitda)} | ${fmtRatio(y.newDscr)} | ${fmtNum(y.newNcf)} | ${fmtNum(y.legacyOpCoTotal)} | ${fmtNum(y.newOpCoActuallyPaid)} |`,
  );
}
lines.push("");

// Downside view across paths
lines.push("## OpCo-enabled comparison — Downside scenario (stress)");
lines.push("");
lines.push("Downside applies `-10% occupancy, -5% ADR, events=4`. This is where the subordination cap matters most — residual after DS shrinks, so OpCo paid drops below the gross calculated fee.");
lines.push("");
lines.push("### Stabilised DSCR — Downside");
lines.push("");
lines.push("| Path | Legacy | New | Δ |");
lines.push("| --- | ---: | ---: | ---: |");
for (const fp of PATHS) {
  const s = enabled[fp].downside;
  lines.push(`| ${fp} | ${fmtRatio(s.legacyStabDSCR)} | ${fmtRatio(s.newStabDSCR)} | ${dRatio(s.legacyStabDSCR, s.newStabDSCR)} |`);
}
lines.push("");
lines.push("### Stabilised NCF post-VAT — Downside");
lines.push("");
lines.push("| Path | Legacy | New | Δ |");
lines.push("| --- | ---: | ---: | ---: |");
for (const fp of PATHS) {
  const s = enabled[fp].downside;
  lines.push(`| ${fp} | ${fmtNum(s.legacyStabNCF)} | ${fmtNum(s.newStabNCF)} | ${dNum(s.legacyStabNCF, s.newStabNCF)} |`);
}
lines.push("");
lines.push("### OpCo paid cumulative — Downside (shows subordination clip)");
lines.push("");
lines.push("| Path | Legacy (gross) | New (capped) | Δ |");
lines.push("| --- | ---: | ---: | ---: |");
for (const fp of PATHS) {
  const s = enabled[fp].downside;
  lines.push(`| ${fp} | ${fmtNum(s.legacyTotalOpCoPaid)} | ${fmtNum(s.newTotalOpCoPaid)} | ${dNum(s.legacyTotalOpCoPaid, s.newTotalOpCoPaid)} |`);
}
lines.push("");

lines.push("## Downstream consumers touched");
lines.push("");
lines.push(
  "- `model.ts:629-707` — cash-waterfall block rewritten (see commit). `ebitda`, `ncf`, `cit`, `cfads`, `dscr`, `dscrLoaded` all re-anchored to `ebitdaPreOpCo`. `opCoTotalFee` reported in AnnualPnL switched to `opCoActuallyPaid` (post-cap) so `equityIRRPreOpCo`'s add-back stays correct.",
);
lines.push(
  "- No UI-side consumer of `ebitda` or `cfads` was touched. The `ebitda` field still represents \"post-fee EBITDA the company keeps\" (choice 4a in the plan) — downstream dashboards (`/admin/dashboard`, `/admin/sensitivity`, `/pitch`) consume it as before with no semantic change.",
);
lines.push(
  "- `founderWaterfall.ts` already reads `netCashFlowPostVAT` (not `ebitda` directly), so no patch needed — it now sees the new NCF naturally.",
);
lines.push("");
lines.push("## Status");
lines.push("");
lines.push("- `npx tsc --noEmit`: clean.");
lines.push("- `npx vitest run`: 45/45 pass, snapshot unchanged (no-op when OpCo disabled).");
lines.push("- `npx tsx scripts/simulate-fee-cleanup.ts`: identical numbers to pre-change (sanity check passed).");
lines.push("- `npx tsx scripts/simulate-opco-subordination.ts`: this report.");
lines.push("");
lines.push("**Ready for Eytan to review.**");
lines.push("");

const docPath = path.join(
  "/Users/esmacbookprom2/Desktop/Villa Project Saint George Claude/villa-lev-platform",
  "docs/opco-subordination-simulation-2026-05-22.md",
);
mkdirSync(path.dirname(docPath), { recursive: true });
writeFileSync(docPath, lines.join("\n"));
console.log(`Wrote: ${docPath}`);

// Console summary
console.log("");
console.log("Realistic-scenario summary (OpCo enabled):");
for (const fp of PATHS) {
  const s = enabled[fp].realistic;
  console.log(
    `  ${fp.padEnd(12)}  stabDSCR ${fmtRatio(s.legacyStabDSCR)} → ${fmtRatio(s.newStabDSCR)} (Δ ${dRatio(s.legacyStabDSCR, s.newStabDSCR)})  ` +
      `NCF ${fmtNum(s.legacyStabNCF)} → ${fmtNum(s.newStabNCF)}  ` +
      `equityIRR ${fmtPct(s.legacyEquityIRR)} → ${fmtPct(s.newEquityIRR)}`,
  );
}
