// ─────────────────────────────────────────────────────────────
// Founder/OpCo fee cleanup simulation (Option A vs Baseline)
// ─────────────────────────────────────────────────────────────
//
// Throwaway diagnostic. Eytan is considering zeroing three fees
// without shipping any code change yet:
//   1. opCoFee.brandFeeRate          (2% × room revenue, OpCo split)
//   2. opCoFee.ownerPriorityReturnRate (8% × initial equity, OpCo split)
//   3. Layer B grant bonus pathway   (founderFeePct - consultantSharePct)
//
// We run computeModel + computeCapTable twice (Baseline, Option A)
// across every {financing path × scenario} and emit a markdown table.
//
// NOTHING in src/lib/engine/ is mutated. Overrides are passed at runtime.
//
//   Usage:  npx tsx scripts/simulate-fee-cleanup.ts
//
// Outputs:
//   - stdout:        progress + summary
//   - docs/...md:    side-by-side markdown comparison

import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

import { computeModel } from "../src/lib/engine/model";
import { BASE_CASE } from "../src/lib/engine/defaults";
import {
  computeCapTable,
  DEFAULT_CAP_TABLE,
  DEFAULT_WATERFALL,
} from "../src/lib/engine/capTable";
import {
  DEFAULT_CONSULTANT_SHARE_PCT,
  DEFAULT_FOUNDER_FEE_PCT,
} from "../src/lib/engine/founderWaterfall";
import type {
  FinancingPath,
  ModelAssumptions,
  ScenarioOutput,
  ModelOutput,
} from "../src/lib/engine/types";

// ── Overrides ──────────────────────────────────────────────────────────

type ScenarioKey = "realistic" | "upside" | "downside";

interface Variant {
  label: string;
  // Apply to a clone of BASE_CASE before computeModel.
  assumptionsTransform: (a: ModelAssumptions) => ModelAssumptions;
  // Override passed to computeCapTable. The grant-bonus pathway zeros
  // when founderFeePct === consultantSharePct (founder_net = 0 → bonus = 0).
  founderFeePctOverride?: number;
}

const BASELINE: Variant = {
  label: "Baseline",
  assumptionsTransform: (a) => a,
  // undefined → engine uses DEFAULT_FOUNDER_FEE_PCT (10%)
  founderFeePctOverride: undefined,
};

const OPTION_A: Variant = {
  label: "Option A",
  assumptionsTransform: (a) => ({
    ...a,
    opCoFee: {
      ...a.opCoFee,
      brandFeeRate: 0,
      ownerPriorityReturnRate: 0,
    },
  }),
  // Set founderFeePct = consultantSharePct so founder_net = 0 → grant bonus = 0.
  founderFeePctOverride: DEFAULT_CONSULTANT_SHARE_PCT,
};

const PATHS: FinancingPath[] = ["commercial", "tepix-loan", "grant", "rrf"];
const SCENARIOS: ScenarioKey[] = ["realistic", "upside", "downside"];

// ── Metric extraction ──────────────────────────────────────────────────

interface Metrics {
  stabDSCR: number;
  minDSCRLoanLife: number;
  stabilisedNCF: number;
  equityIRR: number;
  projectIRR: number;
  llcr: number;
  founderTake: number;     // cumulative founder cash across the projection
  investorTake: number;    // cumulative non-founder cash across the projection
  founderTotalPct: number; // headline founder equity share
}

function extract(
  model: ModelOutput,
  scenario: ScenarioOutput,
  grantApproved: boolean,
  founderFeePctOverride: number | undefined,
): Metrics {
  const stab = scenario.stabilisedYear;
  const cap = computeCapTable(scenario, DEFAULT_CAP_TABLE, DEFAULT_WATERFALL, {
    grantApproved,
    founderFeePct: founderFeePctOverride,
    bankLoanAmount: model.keyMetrics.loanAmount,
  });
  const founder = cap.stakeholders.find((s) => s.stakeholder.isPromoter);
  const founderTake = founder?.totalReceived ?? 0;
  const investorTake = cap.stakeholders
    .filter((s) => !s.stakeholder.isPromoter)
    .reduce((s, sh) => s + sh.totalReceived, 0);
  return {
    stabDSCR: stab?.dscr ?? 0,
    minDSCRLoanLife: scenario.minDSCRLoanLife,
    stabilisedNCF: stab?.netCashFlowPostVAT ?? 0,
    equityIRR: scenario.equityIRR,
    projectIRR: scenario.projectIRR,
    llcr: scenario.llcr,
    founderTake,
    investorTake,
    founderTotalPct: cap.founderBreakdown.founderTotalPct,
  };
}

function runVariant(variant: Variant): Record<
  FinancingPath,
  Record<ScenarioKey, Metrics>
> {
  const out: Partial<Record<FinancingPath, Record<ScenarioKey, Metrics>>> = {};
  for (const fp of PATHS) {
    const assumptions = variant.assumptionsTransform({
      ...BASE_CASE,
      financingPath: fp,
    });
    const model = computeModel(assumptions);
    const grantApproved = fp === "grant";
    out[fp] = {
      realistic: extract(
        model,
        model.scenarios.realistic,
        grantApproved,
        variant.founderFeePctOverride,
      ),
      upside: extract(
        model,
        model.scenarios.upside,
        grantApproved,
        variant.founderFeePctOverride,
      ),
      downside: extract(
        model,
        model.scenarios.downside,
        grantApproved,
        variant.founderFeePctOverride,
      ),
    };
  }
  return out as Record<FinancingPath, Record<ScenarioKey, Metrics>>;
}

// ── Formatting helpers ─────────────────────────────────────────────────

function fmtPct(n: number, digits = 2): string {
  if (!isFinite(n)) return "n/a";
  return `${(n * 100).toFixed(digits)}%`;
}

function fmtNum(n: number): string {
  if (!isFinite(n)) return "n/a";
  return `${n >= 0 ? "" : "-"}€${Math.round(Math.abs(n)).toLocaleString()}`;
}

function fmtRatio(n: number, digits = 3): string {
  if (!isFinite(n)) return "n/a";
  return n.toFixed(digits);
}

function deltaPct(a: number, b: number): string {
  const d = b - a;
  if (Math.abs(d) < 1e-9) return "0.00pp";
  return `${d >= 0 ? "+" : ""}${(d * 100).toFixed(2)}pp`;
}

function deltaNum(a: number, b: number): string {
  const d = b - a;
  if (Math.abs(d) < 0.5) return "€0";
  return `${d >= 0 ? "+" : "-"}€${Math.round(Math.abs(d)).toLocaleString()}`;
}

function deltaRatio(a: number, b: number): string {
  const d = b - a;
  if (Math.abs(d) < 1e-9) return "0.000";
  return `${d >= 0 ? "+" : ""}${d.toFixed(3)}`;
}

// ── Run + write markdown ───────────────────────────────────────────────

console.log("Running Baseline...");
const baseline = runVariant(BASELINE);
console.log("Running Option A (brand=0, priorityReturn=0, grant-bonus=0)...");
const optionA = runVariant(OPTION_A);

// Sanity: did anything go non-finite?
const anomalies: string[] = [];
for (const fp of PATHS) {
  for (const sc of SCENARIOS) {
    const sets: Array<[string, Metrics]> = [
      ["Baseline", baseline[fp][sc]],
      ["Option A", optionA[fp][sc]],
    ];
    for (const [label, m] of sets) {
      for (const [k, v] of Object.entries(m)) {
        if (!isFinite(v as number)) {
          anomalies.push(`${label} / ${fp} / ${sc} / ${k}: ${v}`);
        }
        // Negative IRR / negative NCF are legit under stress scenarios; only
        // flag negatives where the engine semantics forbid it.
        const mustBeNonNeg = new Set<string>([
          "stabDSCR",
          "minDSCRLoanLife",
          "llcr",
          "founderTake",
          "investorTake",
          "founderTotalPct",
        ]);
        if ((v as number) < 0 && mustBeNonNeg.has(k)) {
          anomalies.push(
            `${label} / ${fp} / ${sc} / ${k}: ${v} (unexpected negative)`,
          );
        }
      }
    }
  }
}

const lines: string[] = [];
lines.push("# Founder/OpCo fee cleanup simulation — 2026-05-22");
lines.push("");
lines.push(
  "Side-by-side comparison: **Baseline** (BASE_CASE as-is) vs **Option A** " +
    "(opCoFee.brandFeeRate=0, opCoFee.ownerPriorityReturnRate=0, founder Layer B " +
    "grant bonus pathway zeroed by setting founderFeePct = consultantSharePct = 5%).",
);
lines.push("");
lines.push(
  "**Important context:** `BASE_CASE.opCoFee.enabled === false`. The OpCo " +
    "brand fee and owner priority return are *defined but not applied* in the " +
    "engine today (`model.ts:516-518`). Zeroing them therefore has no effect " +
    "on `computeModel`-derived metrics. The Layer B grant-bonus change does " +
    "affect `computeCapTable` outputs (founder take, founder %), and only on " +
    "the `grant` financing path (other paths have `grantApproved = false`).",
);
lines.push("");
lines.push("Script: `scripts/simulate-fee-cleanup.ts` — re-run via `npx tsx scripts/simulate-fee-cleanup.ts`.");
lines.push("");

if (anomalies.length > 0) {
  lines.push("## Anomalies");
  lines.push("");
  for (const a of anomalies) lines.push(`- ${a}`);
  lines.push("");
} else {
  lines.push("No NaN / unexpected-negative values surfaced.");
  lines.push("");
}

// Per-metric tables.
type MetricKey = keyof Metrics;
const metricDefs: Array<{
  key: MetricKey;
  label: string;
  fmt: (n: number) => string;
  diff: (a: number, b: number) => string;
}> = [
  { key: "stabDSCR", label: "stabDSCR", fmt: fmtRatio, diff: deltaRatio },
  { key: "minDSCRLoanLife", label: "minDSCR (loan life)", fmt: fmtRatio, diff: deltaRatio },
  { key: "stabilisedNCF", label: "Stabilised NCF (post-VAT)", fmt: fmtNum, diff: deltaNum },
  { key: "equityIRR", label: "Equity IRR", fmt: (n) => fmtPct(n), diff: deltaPct },
  { key: "projectIRR", label: "Project IRR", fmt: (n) => fmtPct(n), diff: deltaPct },
  { key: "llcr", label: "LLCR", fmt: fmtRatio, diff: deltaRatio },
  { key: "founderTake", label: "Founder cumulative cash", fmt: fmtNum, diff: deltaNum },
  { key: "investorTake", label: "Investor cumulative cash", fmt: fmtNum, diff: deltaNum },
  { key: "founderTotalPct", label: "Founder total %", fmt: (n) => fmtPct(n), diff: deltaPct },
];

for (const sc of SCENARIOS) {
  lines.push(`## Scenario: ${sc}`);
  lines.push("");
  for (const md of metricDefs) {
    lines.push(`### ${md.label}`);
    lines.push("");
    lines.push("| Path | Baseline | Option A | Δ |");
    lines.push("| --- | ---: | ---: | ---: |");
    for (const fp of PATHS) {
      const b = baseline[fp][sc][md.key];
      const a = optionA[fp][sc][md.key];
      lines.push(
        `| ${fp} | ${md.fmt(b)} | ${md.fmt(a)} | ${md.diff(b, a)} |`,
      );
    }
    lines.push("");
  }
}

// Tight realistic-only summary at the top of the doc body.
lines.splice(
  6,
  0,
  ...(() => {
    const out: string[] = [];
    out.push("## Realistic-scenario summary (one row per path)");
    out.push("");
    out.push(
      "| Path | stabDSCR Δ | equityIRR Δ | projectIRR Δ | founder cash Δ | investor cash Δ | founder % Δ |",
    );
    out.push(
      "| --- | ---: | ---: | ---: | ---: | ---: | ---: |",
    );
    for (const fp of PATHS) {
      const b = baseline[fp].realistic;
      const a = optionA[fp].realistic;
      out.push(
        `| ${fp} | ${deltaRatio(b.stabDSCR, a.stabDSCR)} | ${deltaPct(
          b.equityIRR,
          a.equityIRR,
        )} | ${deltaPct(b.projectIRR, a.projectIRR)} | ${deltaNum(
          b.founderTake,
          a.founderTake,
        )} | ${deltaNum(b.investorTake, a.investorTake)} | ${deltaPct(
          b.founderTotalPct,
          a.founderTotalPct,
        )} |`,
      );
    }
    out.push("");
    return out;
  })(),
);

// stdout summary
console.log("");
console.log("Realistic-scenario summary:");
for (const fp of PATHS) {
  const b = baseline[fp].realistic;
  const a = optionA[fp].realistic;
  console.log(
    `  ${fp.padEnd(12)}  stabDSCR Δ=${deltaRatio(b.stabDSCR, a.stabDSCR)}  ` +
      `equityIRR Δ=${deltaPct(b.equityIRR, a.equityIRR)}  ` +
      `founder Δ=${deltaNum(b.founderTake, a.founderTake)}  ` +
      `founder% Δ=${deltaPct(b.founderTotalPct, a.founderTotalPct)}`,
  );
}
if (anomalies.length > 0) {
  console.log("");
  console.log(`Anomalies: ${anomalies.length}`);
  for (const a of anomalies) console.log(`  - ${a}`);
}

const platformRoot =
  "/Users/esmacbookprom2/Desktop/Villa Project Saint George Claude/villa-lev-platform";
const docPath = path.join(
  platformRoot,
  "docs/founder-fee-cleanup-simulation-2026-05-22.md",
);
mkdirSync(path.dirname(docPath), { recursive: true });
writeFileSync(docPath, lines.join("\n"));
console.log(`\nWrote: ${docPath}`);
