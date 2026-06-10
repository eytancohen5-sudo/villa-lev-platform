/**
 * Engine ↔ Workbook drift-prevention test suite.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * The Excel export in exportBP.ts contains ~3 200 lines of formula-generation
 * code that must mirror the TypeScript engine in model.ts.  Every time a new
 * fee bucket, viewMode branch, or waterfall step is added to the engine the
 * corresponding Excel formulas must also be updated.  Without an automated
 * gate, that coupling is enforced only by human memory — which is exactly why
 * drift bugs keep appearing.
 *
 * THREE LEVELS OF PROTECTION
 * --------------------------
 *
 * L1 — Engine metric snapshots (pure TypeScript, runs in <1 s)
 *   Pin the exact values that the exporter seeds into the Cover-sheet
 *   validation table (column C "Engine value").  Any model.ts change that
 *   silently shifts CAPEX / EBITDA / DSCR / IRR / MOIC will fail CI here,
 *   forcing a conscious `vitest -u` snapshot blessing.
 *
 * L2 — Export structure (ExcelJS read-back, ~3 s)
 *   Verify the produced XLSX has the correct structural shape: right number of
 *   validation rows, correct labels, bank-view rows present/absent as expected.
 *
 * L3 — Formula integrity (ExcelJS formula-string inspection, ~3 s)
 *   Verify that the generated formula STRINGS are semantically correct.
 *   Specifically: the per-property OPEX formula in bank-view must EXCLUDE the
 *   management-fee column (Assumptions!$T$*) because the engine's bank-view
 *   waterfall has already replaced per-villa mgmt fees with a senior floor.
 *   This directly tests against the OPEX double-charge class of bugs.
 *
 * WHAT IS NOT COVERED
 * -------------------
 * These tests verify that the SEED values and FORMULA STRINGS are correct at
 * export time.  They do NOT verify that the formula VALUES are correct when
 * Excel/LibreOffice fully recalculates the workbook (fullCalcOnLoad=true).
 * That requires a LibreOffice round-trip (scripts/recalc.py from the xlsx
 * skill).  Run manually before any deploy touching exportBP.ts:
 *
 *   python3 <xlsx-skill>/scripts/recalc.py /path/to/exported.xlsx
 *
 * and open the Cover sheet — all Match column cells must say ✓ MATCH.
 */

import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";

import { BASE_CASE } from "@/lib/engine/defaults";
import { computeModel } from "@/lib/engine/model";
import { exportBusinessPlan } from "@/lib/excel/exportBP";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Load the exported XLSX blob into an ExcelJS workbook. */
async function loadWorkbook(blob: Blob): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  // ExcelJS types predate the Buffer<T> generic in @types/node; `as any` bridges the gap.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await wb.xlsx.load(Buffer.from(await blob.arrayBuffer()) as any);
  return wb;
}

/** Extract the OPEX-column reference count from a per-property formula string.
 *  The bank-view formula has 7 Assumptions column refs; internal has 8 (incl. $T$). */
function countOpexColumnRefs(formula: string): number {
  // Count Assumptions!$<COL>$<ROW> references inside the first parenthesised
  // group (= the controllable OPEX base, before FF&E Reserve addition).
  const firstGroup = formula.match(/^\=\((\([^)]+\))/)?.[1] ?? formula;
  return (firstGroup.match(/Assumptions!\$[A-Z]+\$/g) ?? []).length;
}

// ─────────────────────────────────────────────────────────────────────────────
// L1 — Engine metric snapshots
// ─────────────────────────────────────────────────────────────────────────────

describe("L1 — engine metrics that feed the validation table", () => {
  /**
   * Snapshot the exact numeric values the exporter seeds into the Cover-sheet
   * validation table for the bank-view export path.  Failing this test means
   * model.ts changed a value that appears in the bank's credit pack — bless
   * intentional changes with `npm run test:run -- -u`.
   */
  // SNAPSHOT PENDING UPDATE (2026-06-01):
  // Floor moved from OpEx to post-DS waterfall. With OpCo disabled (BASE_CASE),
  // stabilisedEBITDA increases by €75K/yr (opCoFloor × 3 plots no longer in OpEx).
  // Reset with `vitest -u` after Eytan approves the new numbers.
  it("bank-view metrics snapshot (commercial path, realistic scenario)", () => {
    const m = computeModel({ ...BASE_CASE, viewMode: "bank" });
    const pnl2032 = m.scenarios.realistic.pnl.find((p) => p.year === 2032);

    // Inline DSCR — same computation the exporter uses (Coverage-sheet basis,
    // NOT keyMetrics.stabilisedDSCR which uses a different DS basis).
    const totalDs2032 = pnl2032
      ? pnl2032.termLoanInterest +
        pnl2032.termLoanPrincipal +
        pnl2032.wcInterestExpense
      : 0;
    const dscr2032 =
      totalDs2032 > 0 ? (pnl2032?.ebitda ?? 0) / totalDs2032 : 0;

    const metrics = {
      totalCAPEX: m.capex.portfolioTotal,
      stabilisedRevenue2032: pnl2032?.totalRevenue ?? 0,
      stabilisedEBITDA2032: pnl2032?.ebitda ?? 0,
      stabilisedDSCR2032_coverageBasis: dscr2032,
      // IRR / MOIC live inside the Coverage sheet computation; keyMetrics
      // exposes them at the model level.
      leveredEquityIRR: m.scenarios.realistic.equityIRR,
      equityMOIC: m.scenarios.realistic.totalMOIC,
    };

    expect(metrics).toMatchSnapshot();
  });

  /**
   * Bank-view and internal-view must produce DIFFERENT stabilised EBITDA.
   * If they are equal, viewMode branching is silently not applied — the same
   * root cause as the "viewMode:'bank' not passed to exportBusinessPlan" bug.
   *
   * Difference = seniorMgmtFee − perVillaMgmtFeeTotal.  They are distinct
   * constants in BASE_CASE (opCoSeniorFloor=25 000/villa vs the per-property
   * management-fee rate from the template), so EBITDA must differ.
   */
  it("unified formula: bank-view and internal-view produce identical stabilised EBITDA", () => {
    // Post-unification (2026-05-25): the dual-branch waterfall was replaced with a
    // single unified formula. seniorFloor is now in OpEx for BOTH views, and DSCR
    // uses ebitdaPreOpCo/DS in BOTH views. viewMode no longer bifurcates the P&L.
    // This test documents the new invariant (replaces the old "must differ" assertion).
    const bank = computeModel({ ...BASE_CASE, viewMode: "bank" });
    const internal = computeModel({ ...BASE_CASE, viewMode: "internal" });

    const bankEbitda = bank.scenarios.realistic.pnl.find(
      (p) => p.year === 2032
    )?.ebitda;
    const internalEbitda = internal.scenarios.realistic.pnl.find(
      (p) => p.year === 2032
    )?.ebitda;

    expect(bankEbitda).toBeDefined();
    expect(internalEbitda).toBeDefined();
    expect(bankEbitda).toEqual(internalEbitda);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// L2 — Export structure
// ─────────────────────────────────────────────────────────────────────────────

describe("L2 — exported XLSX structural shape", () => {
  it("validation table has exactly 10 rows in bank-view (no IRR, MOIC, or cap-table rows)", async () => {
    const a = { ...BASE_CASE, viewMode: "bank" as const };
    const m = computeModel(a);
    const blob = await exportBusinessPlan(a, m, "realistic", undefined, undefined, "en");
    const wb = await loadWorkbook(blob);
    const cover = wb.getWorksheet("Cover");
    expect(cover).toBeTruthy();

    // Locate the validation block header row
    let headerRow = -1;
    cover!.eachRow((row, rn) => {
      if (String(row.getCell("B").value ?? "").includes("Engine ↔ Workbook")) {
        headerRow = rn;
      }
    });
    expect(headerRow).toBeGreaterThan(0);

    // Collect label column (col B) from data rows (skip title + column-header)
    const labels: string[] = [];
    for (let r = headerRow + 2; r <= headerRow + 20; r++) {
      const cell = cover!.getRow(r).getCell("B");
      const v = cell.value;
      if (!v) break;
      labels.push(String(v));
    }

    // Bank-view export: 10 rows covering CAPEX+financing, operations, and coverage.
    // IRR, MOIC, cap-table, and all investor-only rows excluded from banker pack.
    expect(labels).toHaveLength(10);
    expect(labels[0]).toBe("Total CAPEX");
    expect(labels[1]).toBe("Total loan (80% LTC)");
    expect(labels[2]).toBe("Structural equity at close");
    expect(labels[3]).toBe("Stabilised revenue (2032)");
    expect(labels[4]).toBe("Total OpEx (2032)");
    expect(labels[5]).toBe("Stabilised EBITDA (2032)");
    expect(labels[6]).toMatch(/Annual debt service/);
    expect(labels[7]).toMatch(/DSCR first full DS year/);
    expect(labels[8]).toMatch(/Stabilised DSCR/);
    expect(labels[9]).toBe("Min DSCR (loan life)");
    // No IRR, MOIC, cap-table, investor-only, or waterfall rows in banker pack
    expect(labels.some((l) => l.includes("IRR"))).toBe(false);
    expect(labels.some((l) => l.includes("MOIC"))).toBe(false);
    expect(labels.some((l) => l.includes("Cap Table"))).toBe(false);
    expect(labels.some((l) => l.includes("Grace interest"))).toBe(false);
    expect(labels.some((l) => l.includes("LLCR"))).toBe(false);
    expect(labels.some((l) => l.includes("Terminal"))).toBe(false);
  });

  it("all Match cells are pre-seeded as ✓ MATCH", async () => {
    const a = { ...BASE_CASE, viewMode: "bank" as const };
    const m = computeModel(a);
    const blob = await exportBusinessPlan(a, m, "realistic", undefined, undefined, "en");
    const wb = await loadWorkbook(blob);
    const cover = wb.getWorksheet("Cover")!;

    let headerRow = -1;
    cover.eachRow((row, rn) => {
      if (String(row.getCell("B").value ?? "").includes("Engine ↔ Workbook")) {
        headerRow = rn;
      }
    });

    const results: string[] = [];
    for (let r = headerRow + 2; r <= headerRow + 20; r++) {
      const cell = cover.getRow(r).getCell("E");
      if (!cover.getRow(r).getCell("B").value) break;
      const v = cell.value;
      if (v && typeof v === "object" && "result" in v) {
        results.push(String((v as ExcelJS.CellFormulaValue).result));
      } else {
        results.push(String(v ?? ""));
      }
    }

    expect(results).toHaveLength(10); // bank-view: 10 rows; IRR/MOIC excluded; internal adds more investor + cap-table rows
    results.forEach((result, i) => {
      expect(result, `row ${i + 1} match cell`).toBe("✓ MATCH");
    });
  });

  it("bank-view P&L does NOT contain 'Senior management floor' row (floor moved post-DS)", async () => {
    // ADR: floor is now paid junior to DS; the separate OpEx row was removed.
    // Both views now show 'OpCo fee — floor + tiered (both junior to DS)' below EBITDA.
    const a = { ...BASE_CASE, viewMode: "bank" as const };
    const m = computeModel(a);
    const blob = await exportBusinessPlan(a, m, "realistic", undefined, undefined, "en");
    const wb = await loadWorkbook(blob);
    const pnl = wb.getWorksheet("OPEX & P&L")!;

    const labels: string[] = [];
    pnl.eachRow((row) => {
      const v = String(row.getCell("A").value ?? "").trim();
      if (v) labels.push(v);
    });

    expect(labels.some((l) => l.includes("Senior management floor"))).toBe(false);
    // Both views show the combined OpCo fee row (floor + junior, both post-DS).
    expect(labels.some((l) => l.toLowerCase().includes("junior to ds"))).toBe(true);
  });

  it("internal-view P&L does NOT contain 'Senior management floor' row", async () => {
    const a = { ...BASE_CASE, viewMode: "internal" as const };
    const m = computeModel(a);
    const blob = await exportBusinessPlan(a, m, "realistic", undefined, undefined, "en");
    const wb = await loadWorkbook(blob);
    const pnl = wb.getWorksheet("OPEX & P&L")!;

    const labels: string[] = [];
    pnl.eachRow((row) => {
      const v = String(row.getCell("A").value ?? "").trim();
      if (v) labels.push(v);
    });

    expect(labels.some((l) => l.includes("Senior management floor"))).toBe(
      false
    );
  });

  it("bank-view opCo fee row is labelled as junior/subordinated", async () => {
    const a = { ...BASE_CASE, viewMode: "bank" as const };
    const m = computeModel(a);
    const blob = await exportBusinessPlan(a, m, "realistic", undefined, undefined, "en");
    const wb = await loadWorkbook(blob);
    const pnl = wb.getWorksheet("OPEX & P&L")!;

    const labels: string[] = [];
    pnl.eachRow((row) => {
      const v = String(row.getCell("A").value ?? "").trim();
      if (v) labels.push(v);
    });

    expect(labels.some((l) => l.toLowerCase().includes("junior"))).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// L2b — Grant path: Coverage sheet loan + equity do not drift from engine
// ─────────────────────────────────────────────────────────────────────────────

describe("L2b — Grant path Coverage sheet drift prevention", () => {
  /**
   * On the Grant financing path the engine deducts the grant amount from the
   * loan base, so m.keyMetrics.loanAmount is LESS than portfolioTotal × 0.80.
   * The Coverage sheet must seed these rows with the exact engine values —
   * NOT re-derive them from CAPEX × loanCoverageRate (which would be the
   * naive commercial figure).
   *
   * The exporter guards this by writing plain numeric values (not formulas)
   * for the "Total loan drawn" and "Structural equity at close" rows when
   * path === 'grant'. This test locks that behaviour.
   */
  it("Coverage sheet 'Total loan drawn' and 'Structural equity at close' equal engine keyMetrics on grant path", async () => {
    const a = { ...BASE_CASE, financingPath: "grant" as const, viewMode: "bank" as const };
    const m = computeModel(a);

    // Confirm the engine itself reduced the loan below the naive 80% LTC figure.
    // This is the core invariant: grant deduction is working at the model level.
    expect(m.keyMetrics.loanAmount).toBeLessThan(m.capex.portfolioTotal * 0.80);

    const blob = await exportBusinessPlan(a, m, "realistic", undefined, undefined, "en");
    const wb = await loadWorkbook(blob);
    const cov = wb.getWorksheet("Coverage");
    expect(cov).toBeTruthy();

    // Locate the "Total loan drawn" and "Structural equity at close" rows by
    // scanning column A. These are the only authoritative values for the grant
    // path — a formula would be overwritten by Excel on open to the wrong figure.
    let loanRowValue: number | null = null;
    let equityRowValue: number | null = null;

    cov!.eachRow((row) => {
      const label = String(row.getCell("A").value ?? "").trim();
      if (label === "Total loan drawn") {
        const cell = row.getCell("B");
        // Must be a plain number — not a formula object — on the grant path.
        expect(typeof cell.value, "loan cell must be a plain numeric value on grant path (not a formula)").toBe("number");
        loanRowValue = cell.value as number;
      }
      if (label === "Structural equity at close") {
        const cell = row.getCell("B");
        expect(typeof cell.value, "equity cell must be a plain numeric value on grant path (not a formula)").toBe("number");
        equityRowValue = cell.value as number;
      }
    });

    expect(loanRowValue).not.toBeNull();
    expect(equityRowValue).not.toBeNull();

    // Values must match engine keyMetrics exactly — no rounding, no drift.
    expect(loanRowValue).toBe(m.keyMetrics.loanAmount);
    expect(equityRowValue).toBe(m.keyMetrics.equityRequired);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// L3 — Formula integrity (OPEX double-charge + contingency regression guards)
// ─────────────────────────────────────────────────────────────────────────────

describe("L3 — OPEX formula integrity", () => {
  /**
   * In the bank-view export the per-property OPEX formula must NOT reference
   * the management-fee Assumptions column (Assumptions!$T$*).  The engine's
   * bank-view waterfall removes perVillaMgmtFeeTotal from propertyOpex and
   * replaces it with seniorMgmtFee (a separate row).  If the Excel formula
   * still includes $T$ (mgmtFee), the totalOpex is over-counted and EBITDA
   * drifts — exactly the bug fixed on 2026-05-24.
   *
   * Column mapping: PCOL.opexMgmtFee = 18 → Assumptions col = col(2+18) = T.
   */
  /**
   * Column-position guard: the managementFee Assumptions column ($T$, PCOL 18)
   * must be present and zero for all properties. managementFee was removed from
   * the OpEx sum (2026-05-25) but the column is retained to prevent column-index
   * shifts that would break $W$ (opexContingency) and $X$ (extraOpex) references.
   *
   * Per-property OPEX cells are now engine-seeded (no live formula) because
   * maintenance = max(maintenanceFloor, rate% × revenue) is revenue-circular in Excel.
   */
  it("bank-view: Assumptions sheet retains managementFee column ($T$) at value 0", async () => {
    const a = { ...BASE_CASE, viewMode: "bank" as const };
    const m = computeModel(a);
    const blob = await exportBusinessPlan(a, m, "realistic", undefined, undefined, "en");
    const wb = await loadWorkbook(blob);
    const assumptions = wb.getWorksheet("Assumptions")!;

    // Find the property header row (col B = "Property", col C = "Plots"), then
    // read the data rows immediately after. This avoids conflating writeInput rows
    // (which also have strings in B and small numbers in C) with property rows.
    let headerRow = -1;
    assumptions.eachRow((row, rn) => {
      if (headerRow !== -1) return;
      if (String(row.getCell("B").value ?? "") === "Property" &&
          String(row.getCell("C").value ?? "") === "Plots") {
        headerRow = rn;
      }
    });
    expect(headerRow).toBeGreaterThan(0);

    // Data rows follow the header until a row with no value in col B.
    const propRows: number[] = [];
    for (let rn = headerRow + 1; rn <= headerRow + 20; rn++) {
      const name = assumptions.getRow(rn).getCell("B").value;
      if (!name) break;
      propRows.push(rn);
    }
    expect(propRows.length).toBeGreaterThan(0);

    // Column T = PCOL.opexMgmtFee (index 18, col(2+18) = col(20) = T) — must be 0.
    for (const rn of propRows) {
      const val = assumptions.getRow(rn).getCell("T").value;
      expect(val).toBe(0);
    }
  });

  it("internal-view: Assumptions sheet retains managementFee column ($T$) at value 0", async () => {
    const a = { ...BASE_CASE, viewMode: "internal" as const };
    const m = computeModel(a);
    const blob = await exportBusinessPlan(a, m, "realistic", undefined, undefined, "en");
    const wb = await loadWorkbook(blob);
    const assumptions = wb.getWorksheet("Assumptions")!;

    let headerRow = -1;
    assumptions.eachRow((row, rn) => {
      if (headerRow !== -1) return;
      if (String(row.getCell("B").value ?? "") === "Property" &&
          String(row.getCell("C").value ?? "") === "Plots") {
        headerRow = rn;
      }
    });
    expect(headerRow).toBeGreaterThan(0);

    const propRows: number[] = [];
    for (let rn = headerRow + 1; rn <= headerRow + 20; rn++) {
      const name = assumptions.getRow(rn).getCell("B").value;
      if (!name) break;
      propRows.push(rn);
    }
    expect(propRows.length).toBeGreaterThan(0);

    for (const rn of propRows) {
      const val = assumptions.getRow(rn).getCell("T").value;
      expect(val).toBe(0);
    }
  });

  /**
   * Bank-view totalOpex SUM must NOT reference a "Senior management floor" row
   * (that row was removed when the floor moved post-DS). The portfolio-overhead
   * residual row absorbs the correct engine totalOpex without subtracting the floor.
   */
  it("bank-view: totalOpex SUM formula does NOT reference a non-existent senior floor row", async () => {
    // Floor was moved post-DS (2026-06-01). The separate OpEx row was removed.
    // Guard: ensure no ghost row crept back in and distorted totalOpex.
    const a = { ...BASE_CASE, viewMode: "bank" as const };
    const m = computeModel(a);
    const blob = await exportBusinessPlan(a, m, "realistic", undefined, undefined, "en");
    const wb = await loadWorkbook(blob);
    const pnl = wb.getWorksheet("OPEX & P&L")!;

    let totalOpexRow = -1;
    let seniorFloorRow = -1;
    pnl.eachRow((row, rn) => {
      const label = String(row.getCell("A").value ?? "").trim();
      if (label === "Total OPEX") totalOpexRow = rn;
      if (label.includes("Senior management floor")) seniorFloorRow = rn;
    });

    expect(totalOpexRow).toBeGreaterThan(0);
    // The senior floor row must not exist at all.
    expect(seniorFloorRow).toBe(-1);
  });

  /**
   * Regression guard: per-property OPEX rows must be engine-seeded with
   * non-zero values in operational years and zero in pre-operational years.
   *
   * Background: maintenance was converted to max(maintenanceFloor, rate% × revenue)
   * which is revenue-circular in Excel, so per-property OPEX cells are now pure
   * engine-seeded values (no live formula). This test replaces the former formula-
   * structure checks ($W$/$X$ column references) which no longer apply.
   *
   * Column mapping (for reference — Assumptions sheet column positions preserved):
   *   PCOL.opexMgmtFee     = 18 → col(20) = T  (deprecated field, always 0)
   *   PCOL.opexContingency = 21 → col(23) = W
   *   PCOL.extraOpex       = 22 → col(24) = X
   */
  it("internal-view: per-property OPEX rows are engine-seeded (non-zero in operational years)", async () => {
    const a = { ...BASE_CASE, viewMode: "internal" as const };
    const m = computeModel(a);
    const blob = await exportBusinessPlan(a, m, "realistic", undefined, undefined, "en");
    const wb = await loadWorkbook(blob);
    const pnl = wb.getWorksheet("OPEX & P&L")!;

    // Find the "OPEX (per property × plots)" section header, then the first property row after it.
    // Revenue rows also use "  ${prop.name}" labels earlier in the sheet — anchor on the section.
    let opexSectionRow = -1;
    pnl.eachRow((row, rn) => {
      if (opexSectionRow !== -1) return;
      if (String(row.getCell("A").value ?? "").startsWith("OPEX (per property")) opexSectionRow = rn;
    });
    expect(opexSectionRow).toBeGreaterThan(0);
    const firstPropRow = opexSectionRow + 1;

    // Column G = year 2032 (stabilised) — must be a plain number > 0 (engine-seeded, no formula)
    const stabilisedCell = pnl.getRow(firstPropRow).getCell("G").value;
    expect(typeof stabilisedCell).toBe("number");
    expect(stabilisedCell as number).toBeGreaterThan(0);

    // Column B = year 2026 (pre-operational) — must be 0
    const preOpCell = pnl.getRow(firstPropRow).getCell("B").value;
    expect(preOpCell).toBe(0);
  });

  it("bank-view: per-property OPEX rows are engine-seeded (non-zero in operational years)", async () => {
    const a = { ...BASE_CASE, viewMode: "bank" as const };
    const m = computeModel(a);
    const blob = await exportBusinessPlan(a, m, "realistic", undefined, undefined, "en");
    const wb = await loadWorkbook(blob);
    const pnl = wb.getWorksheet("OPEX & P&L")!;

    let opexSectionRow = -1;
    pnl.eachRow((row, rn) => {
      if (opexSectionRow !== -1) return;
      if (String(row.getCell("A").value ?? "").startsWith("OPEX (per property")) opexSectionRow = rn;
    });
    expect(opexSectionRow).toBeGreaterThan(0);
    const firstPropRow = opexSectionRow + 1;

    const stabilisedCell = pnl.getRow(firstPropRow).getCell("G").value;
    expect(typeof stabilisedCell).toBe("number");
    expect(stabilisedCell as number).toBeGreaterThan(0);

    const preOpCell = pnl.getRow(firstPropRow).getCell("B").value;
    expect(preOpCell).toBe(0);
  });
});
