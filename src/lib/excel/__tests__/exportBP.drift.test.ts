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
  await wb.xlsx.load(Buffer.from(await blob.arrayBuffer()));
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
  it("bank-view metrics snapshot (commercial path, realistic scenario)", () => {
    const m = computeModel({ ...BASE_CASE, viewMode: "bank" });
    const pnl2031 = m.scenarios.realistic.pnl.find((p) => p.year === 2031);

    // Inline DSCR — same computation the exporter uses (Coverage-sheet basis,
    // NOT keyMetrics.stabilisedDSCR which uses a different DS basis).
    const totalDs2031 = pnl2031
      ? pnl2031.termLoanInterest +
        pnl2031.termLoanPrincipal +
        pnl2031.wcInterestExpense
      : 0;
    const dscr2031 =
      totalDs2031 > 0 ? (pnl2031?.ebitda ?? 0) / totalDs2031 : 0;

    const metrics = {
      totalCAPEX: m.capex.portfolioTotal,
      stabilisedRevenue2031: pnl2031?.totalRevenue ?? 0,
      stabilisedEBITDA2031: pnl2031?.ebitda ?? 0,
      stabilisedDSCR2031_coverageBasis: dscr2031,
      // IRR / MOIC live inside the Coverage sheet computation; keyMetrics
      // exposes them at the model level.
      leveredEquityIRR: m.keyMetrics.equityIRR,
      equityMOIC: m.keyMetrics.equityMOIC,
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
      (p) => p.year === 2031
    )?.ebitda;
    const internalEbitda = internal.scenarios.realistic.pnl.find(
      (p) => p.year === 2031
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
  it("validation table has exactly 7 rows in bank-view (no cap-table rows)", async () => {
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

    // Bank-view export omits cap-table rows (investor deal economics).
    expect(labels).toHaveLength(7);
    expect(labels[0]).toBe("Total CAPEX");
    expect(labels[1]).toBe("Stabilised revenue (2031)");
    expect(labels[2]).toBe("Stabilised EBITDA (2031)");
    expect(labels[3]).toMatch(/Stabilised DSCR/);
    expect(labels[4]).toBe("Unlevered Project IRR");
    expect(labels[5]).toBe("Levered Equity IRR");
    expect(labels[6]).toBe("Equity MOIC");
    // No cap-table or waterfall rows in banker pack
    expect(labels.some((l) => l.includes("Cap Table"))).toBe(false);
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

    expect(results).toHaveLength(7); // bank-view omits 3 cap-table rows
    results.forEach((result, i) => {
      expect(result, `row ${i + 1} match cell`).toBe("✓ MATCH");
    });
  });

  it("bank-view P&L contains 'Senior management floor' row", async () => {
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

    expect(labels.some((l) => l.includes("Senior management floor"))).toBe(true);
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
   * Bank-view totalOpex SUM must include the Senior management floor row.
   * This guards against the floor row being added to the P&L but accidentally
   * excluded from the SUM (which would make EBITDA too high).
   */
  it("bank-view: totalOpex SUM formula references the Senior management floor row", async () => {
    const a = { ...BASE_CASE, viewMode: "bank" as const };
    const m = computeModel(a);
    const blob = await exportBusinessPlan(a, m, "realistic", undefined, undefined, "en");
    const wb = await loadWorkbook(blob);
    const pnl = wb.getWorksheet("OPEX & P&L")!;

    // Find the Total OPEX row (label = "Total OPEX")
    let totalOpexRow = -1;
    let seniorFloorRow = -1;
    pnl.eachRow((row, rn) => {
      const label = String(row.getCell("A").value ?? "").trim();
      if (label === "Total OPEX") totalOpexRow = rn;
      if (label.includes("Senior management floor")) seniorFloorRow = rn;
    });

    expect(totalOpexRow).toBeGreaterThan(0);
    expect(seniorFloorRow).toBeGreaterThan(0);

    const sumFormula = String(
      (pnl.getRow(totalOpexRow).getCell("G").value as ExcelJS.CellFormulaValue)
        ?.formula ?? ""
    );

    // The SUM must contain an explicit reference to the senior floor row
    // e.g. =SUM(G8,G9,G10) where G10 is the senior floor
    expect(sumFormula).toContain(`G${seniorFloorRow}`);
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

    // Column G = year 2031 (stabilised) — must be a plain number > 0 (engine-seeded, no formula)
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
