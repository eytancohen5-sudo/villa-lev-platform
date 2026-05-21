// One-off diagnostic: compare year-by-year DSCR under the broken
// `interestSubsidy: 0.02` default vs the corrected `0.05` (Antiparos
// island-region rate). Not committed long-term — delete after Eytan has
// seen the output.
//
// Usage:  npx tsx scripts/dscr-subsidy-probe.ts

import { computeModel } from "../src/lib/engine/model";
import { BASE_CASE } from "../src/lib/engine/defaults";

function run(label: string, subsidy: number) {
  const assumptions = {
    ...BASE_CASE,
    financingPath: "tepix-loan" as const,
    tepixLoan: { ...BASE_CASE.tepixLoan, interestSubsidy: subsidy },
  };
  const out = computeModel(assumptions);
  const pnl = out.scenarios.realistic.pnl;
  console.log(`\n${label} (subsidy=${subsidy}):`);
  console.log(
    "  Year  | DSCR    | EBITDA       | Term-loan interest"
  );
  for (const row of pnl.slice(0, 6)) {
    const dscr = row.dscr != null ? row.dscr.toFixed(3) : "  n/a";
    const ebitda = Math.round(row.ebitda).toLocaleString().padStart(11);
    const ti = Math.round(row.termLoanInterest ?? 0).toLocaleString().padStart(11);
    console.log(`  Y${row.year} | ${dscr.padStart(7)} | ${ebitda} | ${ti}`);
  }
  console.log(`  stabilisedDSCR: ${out.keyMetrics.stabilisedDSCR.toFixed(4)}`);
}

run("BEFORE (broken default 0.02)", 0.02);
run("AFTER  (correct island 0.05)", 0.05);
