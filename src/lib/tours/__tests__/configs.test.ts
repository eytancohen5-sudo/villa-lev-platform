import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DASHBOARD_TOUR,
  PNL_TOUR,
  SCENARIOS_TOUR,
  BREAKEVEN_TOUR,
  CAPEX_TOUR,
  SENSITIVITY_TOUR,
  OPCO_SPLIT_TOUR,
  TEAM_TOUR,
  BANK_TOUR,
  ASSUMPTIONS_TOUR,
  CAP_TABLE_TOUR,
  LEXICON_TOUR,
  RETURNS_TOUR,
} from "../configs";
import type { TourConfig, TourStep } from "../types";

const ALL_TOURS: TourConfig[] = [
  DASHBOARD_TOUR,
  PNL_TOUR,
  SCENARIOS_TOUR,
  BREAKEVEN_TOUR,
  CAPEX_TOUR,
  SENSITIVITY_TOUR,
  OPCO_SPLIT_TOUR,
  TEAM_TOUR,
  BANK_TOUR,
  ASSUMPTIONS_TOUR,
  CAP_TABLE_TOUR,
  LEXICON_TOUR,
  RETURNS_TOUR,
];

const STORAGE_KEY_RE = /^villaLev\..+\.seen\.v\d+$/;

/** Every localized string (title + body, all locales present) on a step. */
function stepStrings(step: TourStep): string[] {
  return [...Object.values(step.title), ...Object.values(step.body)].filter(
    (v): v is string => typeof v === "string",
  );
}

function tourStrings(tour: TourConfig): string[] {
  return tour.steps.flatMap(stepStrings);
}

describe("tour configs — storageKey uniqueness", () => {
  it("all storageKeys are unique across every tour", () => {
    const keys = ALL_TOURS.map((t) => t.storageKey);
    const unique = new Set(keys);
    expect(unique.size).toBe(keys.length);
  });

  it("all storageKeys match naming convention villaLev.*.seen.vN", () => {
    for (const tour of ALL_TOURS) {
      expect(tour.storageKey).toMatch(STORAGE_KEY_RE);
    }
  });

  it("BANK_TOUR stays on the v4 stem — v5 is reserved for the rehaul rewrite", () => {
    // Copy-only hotfix must not re-pulse the trigger for bankers who have
    // already seen the tour, and must keep `…seen.v5` virgin for the
    // authored BANK_TOUR v5 on the rehaul branch (plan rev 2, finding 5).
    expect(BANK_TOUR.storageKey).toBe("villaLev.bankTour.seen.v4");
  });
});

describe("tour configs — step shape", () => {
  it("every tour has at least one step", () => {
    for (const tour of ALL_TOURS) {
      expect(tour.steps.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("every step has a non-empty English title and body (en required; el/he optional per language policy 2026-06-11)", () => {
    for (const tour of ALL_TOURS) {
      for (const step of tour.steps) {
        expect(step.title.en).toBeTruthy();
        expect(step.body.en).toBeTruthy();
      }
    }
  });

  it("locale entries that are present are non-empty strings", () => {
    for (const tour of ALL_TOURS) {
      for (const step of tour.steps) {
        for (const value of stepStrings(step)) {
          expect(value.trim().length).toBeGreaterThan(0);
        }
      }
    }
  });

  it("no step has an empty-string target (must be undefined or non-empty)", () => {
    for (const tour of ALL_TOURS) {
      for (const step of tour.steps) {
        if (step.target !== undefined) {
          expect(step.target.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it("targeted steps use CSS id selectors (#...)", () => {
    for (const tour of ALL_TOURS) {
      for (const step of tour.steps) {
        if (step.target !== undefined) {
          expect(step.target).toMatch(/^#[a-z]/);
        }
      }
    }
  });
});

describe("tour copy — banned scenario labels (locked decision 2026-06-11)", () => {
  // Scenario names are Conservative / Realistic / Downside everywhere.
  // "Upside" and "Base" as scenario names are dead. "Base management fee" /
  // "Base fee" is fee-bucket terminology, not a scenario name — exempt.
  const FEE_TERMINOLOGY_RE = /\bBase (management )?fee\b/g;

  it("no locale string in any tour uses 'Upside' or 'Base' as a label", () => {
    for (const tour of ALL_TOURS) {
      for (const value of tourStrings(tour)) {
        const scrubbed = value.replace(FEE_TERMINOLOGY_RE, "");
        expect(scrubbed).not.toMatch(/\bUpside\b/);
        expect(scrubbed).not.toMatch(/\bBase\b/);
        expect(scrubbed).not.toMatch(/\bBase case\b/i);
      }
    }
  });

  it("the 'Break-Even' label appears only inside BREAKEVEN_TOUR (its own analysis page)", () => {
    // Case-sensitive on purpose: lowercase "break-even" is analysis
    // terminology (break-even methods, break-even nights) and stays legal;
    // the capitalized label as a scenario name is what is banned.
    for (const tour of ALL_TOURS) {
      if (tour === BREAKEVEN_TOUR) continue;
      for (const value of tourStrings(tour)) {
        expect(value).not.toMatch(/Break-Even/);
      }
    }
  });
});

describe("BANK_TOUR — bank-suppressed items (locked decision 2026-06-11)", () => {
  // Interest reserve, working-capital usage breakdown, and CAPEX sensitivity
  // must never appear in or be referenced by any bank-facing surface.
  const SUPPRESSED = [
    /interest reserve/i,
    /working[- ]capital usage/i,
    /capex sensitivity/i,
  ];

  it("no BANK_TOUR string references a suppressed item", () => {
    for (const value of tourStrings(BANK_TOUR)) {
      for (const re of SUPPRESSED) {
        expect(value).not.toMatch(re);
      }
    }
  });
});

describe("BANK_TOUR — static dead-anchor guard", () => {
  // Every spotlight target must exist as an id in the page that mounts the
  // tour. On main, all live BANK_TOUR targets are in src/app/bank/page.tsx.
  const here = dirname(fileURLToPath(import.meta.url));
  const bankPageSource = readFileSync(
    resolve(here, "../../../app/bank/page.tsx"),
    "utf-8",
  );

  it("every BANK_TOUR step.target resolves to an id in src/app/bank/page.tsx", () => {
    for (const step of BANK_TOUR.steps) {
      if (!step.target) continue; // welcome / centered informational steps
      const id = step.target.slice(1);
      expect(
        bankPageSource.includes(`id="${id}"`),
        `BANK_TOUR target ${step.target} has no matching id="${id}" in src/app/bank/page.tsx — dead spotlight`,
      ).toBe(true);
    }
  });
});

describe("tour copy — aggregate plot disclosure (locked decision 2026-06-11)", () => {
  it("no step hardcodes a plot count (the dead 3-plot identity)", () => {
    for (const tour of ALL_TOURS) {
      for (const value of tourStrings(tour)) {
        expect(value).not.toMatch(/\b(three|two|3|2) plots?\b/i);
      }
    }
  });
});
