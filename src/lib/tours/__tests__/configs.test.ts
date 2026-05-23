import { describe, it, expect } from "vitest";
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
} from "../configs";
import type { TourConfig } from "../types";

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
];

const LOCALES = ["en", "el", "fr", "he"] as const;
const STORAGE_KEY_RE = /^villaLev\..+\.seen\.v\d+$/;

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
});

describe("tour configs — step shape", () => {
  it("every tour has at least one step", () => {
    for (const tour of ALL_TOURS) {
      expect(tour.steps.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("every step has all four locales with non-empty title and body", () => {
    for (const tour of ALL_TOURS) {
      for (const step of tour.steps) {
        for (const locale of LOCALES) {
          expect(step.title[locale]).toBeTruthy();
          expect(step.body[locale]).toBeTruthy();
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

