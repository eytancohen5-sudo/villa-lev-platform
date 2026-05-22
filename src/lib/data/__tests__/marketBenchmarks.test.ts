// Unit tests for market-benchmarks helpers. Uses fixtures so the live data
// in MARKET_BENCHMARKS_2026 can churn without breaking tests.

import { describe, it, expect } from "vitest";
import {
  HotelBenchmark,
  median,
  tierMedian,
  operationalSeasonBlend,
  captureCoverage,
  computeMarketPosition,
  computeMarketPositionWithFallback,
  MARKET_2025_BACKSTOP,
  MARKET_2025_PER_HOTEL,
  HOTEL_URLS,
  HOTELS_DIRECT_SITE_BROKEN,
  resolveHotelUrl,
  DEFAULT_FRESH_THRESHOLD,
  OPERATIONAL_SEASON_WEIGHTS,
} from "@/lib/data/marketBenchmarks";

function fixture(
  name: string,
  high: { double?: number | null; premium?: number | null; villa?: number | null },
  med: { double?: number | null; premium?: number | null; villa?: number | null },
): HotelBenchmark {
  return {
    name,
    location: "Paros",
    stars: 5,
    rooms: 30,
    directUrl: "https://example.test",
    capturedAt: "2026-05-22",
    pricing: [
      {
        season: "HIGH",
        basicRoomEur: null,
        doubleRoomEur: high.double ?? null,
        premiumSuiteEur: high.premium ?? null,
        luxurySuiteEur: null,
        villaEur: high.villa ?? null,
      },
      {
        season: "MED",
        basicRoomEur: null,
        doubleRoomEur: med.double ?? null,
        premiumSuiteEur: med.premium ?? null,
        luxurySuiteEur: null,
        villaEur: med.villa ?? null,
      },
    ],
  };
}

describe("median", () => {
  it("returns null for empty input", () => {
    expect(median([])).toBeNull();
  });
  it("middle for odd-length", () => {
    expect(median([700, 900, 1200])).toBe(900);
  });
  it("avg of middles for even-length", () => {
    expect(median([700, 900, 1100, 1300])).toBe(1000);
  });
  it("filters non-finite", () => {
    expect(median([900, Number.NaN, Number.POSITIVE_INFINITY, 1100])).toBe(1000);
  });
});

describe("tierMedian", () => {
  const hotels: HotelBenchmark[] = [
    fixture("A", { double: 800 }, { double: 600 }),
    fixture("B", { double: 1000 }, { double: 700 }),
    fixture("C", { double: 1200 }, { double: 900 }),
  ];
  it("returns the median per tier-season", () => {
    expect(tierMedian(hotels, "doubleRoom", "HIGH")).toBe(1000);
    expect(tierMedian(hotels, "doubleRoom", "MED")).toBe(700);
  });
  it("null when no data", () => {
    expect(tierMedian(hotels, "villa", "HIGH")).toBeNull();
  });
});

describe("operationalSeasonBlend", () => {
  it("50/50 weighting", () => {
    const hotels: HotelBenchmark[] = [
      fixture("A", { double: 1200 }, { double: 800 }),
      fixture("B", { double: 1200 }, { double: 800 }),
    ];
    expect(operationalSeasonBlend(hotels, "doubleRoom")).toBe(1000);
  });
  it("weights sum to 1", () => {
    expect(OPERATIONAL_SEASON_WEIGHTS.HIGH + OPERATIONAL_SEASON_WEIGHTS.MED).toBe(1);
  });
  it("MED-only fallback", () => {
    const hotels: HotelBenchmark[] = [fixture("A", {}, { double: 700 }), fixture("B", {}, { double: 900 })];
    expect(operationalSeasonBlend(hotels, "doubleRoom")).toBe(800);
  });
  it("HIGH-only fallback", () => {
    const hotels: HotelBenchmark[] = [fixture("A", { double: 1100 }, {}), fixture("B", { double: 1300 }, {})];
    expect(operationalSeasonBlend(hotels, "doubleRoom")).toBe(1200);
  });
  it("null when empty", () => {
    expect(operationalSeasonBlend([fixture("A", {}, {})], "doubleRoom")).toBeNull();
  });
});

describe("captureCoverage", () => {
  it("counts populated cells", () => {
    const hotels: HotelBenchmark[] = [
      fixture("A", { double: 800 }, { double: 600 }),
      fixture("B", { villa: 3500 }, {}),
      fixture("C", {}, {}),
    ];
    const coverage = captureCoverage(hotels);
    expect(coverage.totalHotels).toBe(3);
    expect(coverage.capturedHotels).toBe(2);
    expect(coverage.totalCells).toBe(3 * 2 * 5);
    expect(coverage.capturedCells).toBe(3);
  });
});

describe("computeMarketPosition", () => {
  it("computes BP-vs-market for both tiers, villa excluded", () => {
    const hotels: HotelBenchmark[] = [
      fixture("A", { double: 800, premium: 1200 }, { double: 600, premium: 900 }),
      fixture("B", { double: 1000, premium: 1400 }, { double: 800, premium: 1100 }),
    ];
    const pos = computeMarketPosition({ suiteStandardADR: 650, suiteDoubleADR: 920 }, hotels);
    expect(pos.hasAnyMarketData).toBe(true);
    expect(pos.rows).toHaveLength(2);
    expect(pos.rows[0].metric).toBe("suiteStandardADR");
    expect(pos.rows[1].metric).toBe("suiteDoubleADR");
    // doubleRoom medians: HIGH = 900 (avg 800,1000), MED = 700 (avg 600,800)
    // blend = (900+700)/2 = 800. BP 650 vs 800 = -18.75%
    expect(pos.rows[0].market).toBe(800);
    expect(pos.rows[0].deltaPct).toBeCloseTo(-0.1875, 4);
    // premiumSuite medians: HIGH 1300, MED 1000, blend 1150. BP 920 vs 1150 = -20%
    expect(pos.rows[1].market).toBe(1150);
    expect(pos.rows[1].deltaPct).toBeCloseTo(-0.2, 4);
  });

  it("returns hasAnyMarketData=false when no data", () => {
    const pos = computeMarketPosition(
      { suiteStandardADR: 650, suiteDoubleADR: 920 },
      [fixture("A", {}, {})],
    );
    expect(pos.hasAnyMarketData).toBe(false);
    expect(pos.rows[0].market).toBeNull();
  });
});

describe("MARKET_2025_BACKSTOP — sanity blends (hand-computed from CSV)", () => {
  // Each blend is (HIGH + MED) / 2 per the operational-season 50/50 contract.
  // Source: /tmp/hotel_market_study.csv rows 87-95. If the CSV is re-sourced
  // these expected values must change in lockstep.
  it("villa backstop blend = 4371 (luxury villa, 2-5 rooms; HIGH 4467 / MED 4275)", () => {
    const b = MARKET_2025_BACKSTOP.villa;
    expect((b.high + b.med) / 2).toBe(4371);
  });
  it("luxurySuite backstop blend = 1724 (HIGH 1992 / MED 1456)", () => {
    const b = MARKET_2025_BACKSTOP.luxurySuite;
    expect((b.high + b.med) / 2).toBe(1724);
  });
  it("premiumSuite backstop blend = 1261.5 (HIGH 1482 / MED 1041)", () => {
    const b = MARKET_2025_BACKSTOP.premiumSuite;
    expect((b.high + b.med) / 2).toBe(1261.5);
  });
  it("doubleRoom backstop blend = 846 (HIGH 993 / MED 699; mapped to BASIC tier — no separate double row in CSV)", () => {
    const b = MARKET_2025_BACKSTOP.doubleRoom;
    expect((b.high + b.med) / 2).toBe(846);
  });
});

describe("computeMarketPositionWithFallback", () => {
  const bp = { suiteStandardADR: 650, suiteDoubleADR: 920, villaADR: 3500 };

  it("falls back to 2025-backstop for every tier when 2026 array is empty", () => {
    const pos = computeMarketPositionWithFallback(bp, []);
    expect(pos.rows).toHaveLength(3);
    expect(pos.rows.every((r) => r.status === "2025-backstop")).toBe(true);
    expect(pos.rows.every((r) => r.coverageHotels === 0)).toBe(true);

    // BP 650 vs doubleRoom backstop 846 = (650 - 846) / 846 = -0.2317
    expect(pos.rows[0].metric).toBe("suiteStandardADR");
    expect(pos.rows[0].market).toBe(846);
    expect(pos.rows[0].deltaPct).toBeCloseTo(-0.2317, 4);

    // BP 920 vs premiumSuite backstop 1261.5 = (920 - 1261.5) / 1261.5 = -0.2707
    expect(pos.rows[1].metric).toBe("suiteDoubleADR");
    expect(pos.rows[1].market).toBe(1261.5);
    expect(pos.rows[1].deltaPct).toBeCloseTo(-0.2707, 4);

    // BP 3500 vs villa backstop 4371 = (3500 - 4371) / 4371 = -0.1993
    expect(pos.rows[2].metric).toBe("villaADR");
    expect(pos.rows[2].market).toBe(4371);
    expect(pos.rows[2].deltaPct).toBeCloseTo(-0.1993, 4);
  });

  it("uses fresh 2026 data when coverage meets default threshold N=3", () => {
    const hotels: HotelBenchmark[] = [
      fixture("A", { double: 800 }, { double: 600 }),
      fixture("B", { double: 1000 }, { double: 700 }),
      fixture("C", { double: 1200 }, { double: 900 }),
    ];
    const pos = computeMarketPositionWithFallback(bp, hotels);
    // doubleRoom has 3 hotels → fresh
    expect(pos.rows[0].status).toBe("fresh");
    expect(pos.rows[0].coverageHotels).toBe(3);
    // HIGH median 1000, MED median 700 → blend 850
    expect(pos.rows[0].market).toBe(850);
    // suiteDouble (→premiumSuite) and villa both 0 hotels → 2025-backstop
    expect(pos.rows[1].status).toBe("2025-backstop");
    expect(pos.rows[2].status).toBe("2025-backstop");
  });

  it("respects a custom freshThreshold parameter", () => {
    const hotels: HotelBenchmark[] = [fixture("A", { double: 800 }, { double: 600 })];
    const lenient = computeMarketPositionWithFallback(bp, hotels, 1);
    expect(lenient.rows[0].status).toBe("fresh");
    expect(lenient.rows[0].market).toBe(700); // (800+600)/2
    const strict = computeMarketPositionWithFallback(bp, hotels, 5);
    expect(strict.rows[0].status).toBe("2025-backstop");
  });

  it("default threshold is 3", () => {
    expect(DEFAULT_FRESH_THRESHOLD).toBe(3);
  });

  it("mixed coverage: fresh on doubleRoom, backstop on premium/villa", () => {
    const hotels: HotelBenchmark[] = [
      fixture("A", { double: 700, premium: 1500 }, { double: 500, premium: 1100 }),
      fixture("B", { double: 800 }, { double: 600 }),
      fixture("C", { double: 900 }, { double: 700 }),
      // Only A has premium data → coverageHotels=1 < threshold=3 → backstop
    ];
    const pos = computeMarketPositionWithFallback(bp, hotels);
    expect(pos.rows[0].status).toBe("fresh"); // doubleRoom: 3 hotels
    expect(pos.rows[1].status).toBe("2025-backstop"); // premium: 1 hotel
    expect(pos.rows[2].status).toBe("2025-backstop"); // villa: 0 hotels
    // doubleRoom: HIGH median 800, MED median 600 → blend 700
    expect(pos.rows[0].market).toBe(700);
    // premium falls back to backstop 1261.5
    expect(pos.rows[1].market).toBe(1261.5);
  });

  it("end-to-end against the real BP values and the on-disk 2026 benchmarks", () => {
    // No fixtures: uses MARKET_BENCHMARKS_2026 default. Verifies the rendered
    // story stays a coherent BP-below-market narrative.
    const pos = computeMarketPositionWithFallback({
      suiteStandardADR: 650,
      suiteDoubleADR: 920,
      villaADR: 3500,
    });
    expect(pos.rows).toHaveLength(3);
    // Every row's delta should be negative (BP below market). If a future
    // capture or a BP edit flips this, the test fails — that's intentional,
    // because flipping the story above market needs a banker-facing decision.
    for (const row of pos.rows) {
      expect(row.deltaPct).toBeLessThan(0);
    }
  });
});

// ── 2025 per-hotel per-tier comparables array ─────────────────────────────

import {
  type PerHotelComparable,
  filterPerHotel,
  filterPerHotelByTier,
  mean,
  recomputeGreekTierBlend,
  groupPerHotelByListing,
  comparableCount,
  distinctHotelCount,
} from "@/lib/data/marketBenchmarks";

describe("MARKET_2025_PER_HOTEL — shape and counts", () => {
  it("exists with at least the brief-promised 41 distinct hotels (23 Greek + 18 international)", () => {
    expect(distinctHotelCount(MARKET_2025_PER_HOTEL, "Greek")).toBe(23);
    expect(distinctHotelCount(MARKET_2025_PER_HOTEL, "International")).toBe(18);
    expect(distinctHotelCount(MARKET_2025_PER_HOTEL, "All")).toBe(41);
  });

  it("every entry has the required tier value", () => {
    const allowed: PerHotelComparable["tier"][] = ["Basic", "Premium", "Luxury", "Villa"];
    for (const e of MARKET_2025_PER_HOTEL) {
      expect(allowed).toContain(e.tier);
    }
  });

  it("every entry has at least one price datapoint (HIGH or MED)", () => {
    for (const e of MARKET_2025_PER_HOTEL) {
      const hasAny =
        e.highEur !== null || e.medEur !== null || e.lowEur !== null || e.annualEur !== null;
      expect(hasAny).toBe(true);
    }
  });

  it("Greek entries are tagged country='Greece'; international are not", () => {
    const greek = filterPerHotel(MARKET_2025_PER_HOTEL, "Greek");
    expect(greek.length).toBeGreaterThan(0);
    for (const e of greek) expect(e.country).toBe("Greece");
    const intl = filterPerHotel(MARKET_2025_PER_HOTEL, "International");
    expect(intl.length).toBeGreaterThan(0);
    for (const e of intl) expect(e.country).not.toBe("Greece");
  });
});

describe("filterPerHotel / filterPerHotelByTier", () => {
  const fixture: PerHotelComparable[] = [
    {
      name: "A",
      location: "Paros",
      country: "Greece",
      stars: 5,
      rooms: 30,
      tier: "Basic",
      tierRaw: "Basic",
      highEur: 900,
      medEur: 700,
      lowEur: 400,
      annualEur: 600,
      url: "",
    },
    {
      name: "B",
      location: "Italy",
      country: "Italy",
      stars: 5,
      rooms: 50,
      tier: "Premium",
      tierRaw: "Premium",
      highEur: 1500,
      medEur: 1100,
      lowEur: 600,
      annualEur: 900,
      url: "",
    },
    {
      name: "C",
      location: "Antiparos",
      country: "Greece",
      stars: 5,
      rooms: 10,
      tier: "Villa",
      tierRaw: "Villa (8 adults)",
      highEur: 4000,
      medEur: 3500,
      lowEur: 1800,
      annualEur: 2700,
      url: "",
    },
  ];

  it("All filter returns the full list", () => {
    expect(filterPerHotel(fixture, "All")).toHaveLength(3);
  });
  it("Greek filter excludes non-Greece countries", () => {
    const r = filterPerHotel(fixture, "Greek");
    expect(r.map((e) => e.name).sort()).toEqual(["A", "C"]);
  });
  it("International filter is the complement of Greek", () => {
    const r = filterPerHotel(fixture, "International");
    expect(r.map((e) => e.name)).toEqual(["B"]);
  });
  it("filterPerHotelByTier picks one tier", () => {
    expect(filterPerHotelByTier(fixture, "Villa").map((e) => e.name)).toEqual(["C"]);
    expect(filterPerHotelByTier(fixture, "Basic").map((e) => e.name)).toEqual(["A"]);
  });
});

describe("mean helper", () => {
  it("ignores nulls", () => {
    expect(mean([100, null, 200, null, 300])).toBe(200);
  });
  it("returns null when there's no usable number", () => {
    expect(mean([null, null])).toBeNull();
    expect(mean([])).toBeNull();
  });
});

describe("recomputeGreekTierBlend — financial-accuracy check vs MARKET_2025_BACKSTOP", () => {
  // The published MARKET_2025_BACKSTOP values are pre-computed averages from
  // CSV rows 87-95. The per-hotel array (loaded from CSV rows 7-86) must be
  // able to reconstruct those values within rounding (Basic & Luxury). The
  // Premium tier carries a documented ~2.5% gap because the CSV's PREMIUM
  // pre-computed row inconsistently included Rooster Antiparos's "Villa
  // Premium" entries, while BASIC excluded "Villa Basic". The per-hotel
  // schema is internally consistent (Villa-prefixed → tier='Villa'), and the
  // headline reads from MARKET_2025_BACKSTOP (not from this recomputation),
  // so the gap doesn't leak to the strip — but we lock it in here so a
  // future schema change can't silently widen it.
  it("Basic blend recomputes to ≈ MARKET_2025_BACKSTOP.basicRoom (846)", () => {
    const r = recomputeGreekTierBlend("Basic");
    expect(r.n).toBe(22); // Rooster (villa-only) → not in Basic
    expect(r.high).not.toBeNull();
    expect(r.med).not.toBeNull();
    expect(Math.round((r.high ?? 0))).toBe(993); // matches MARKET_2025_BACKSTOP.basicRoom.high
    expect(Math.round((r.med ?? 0))).toBe(699); // matches MARKET_2025_BACKSTOP.basicRoom.med
    expect(Math.round((r.blend ?? 0))).toBe(846); // matches the headline number used by the strip
  });

  it("Luxury blend recomputes to ≈ MARKET_2025_BACKSTOP.luxurySuite (1724)", () => {
    const r = recomputeGreekTierBlend("Luxury");
    expect(r.n).toBe(22);
    expect(Math.abs((r.high ?? 0) - 1992)).toBeLessThanOrEqual(2); // CSV says 1992
    expect(Math.abs((r.med ?? 0) - 1456)).toBeLessThanOrEqual(6); // CSV says 1456
    expect(Math.abs((r.blend ?? 0) - 1724)).toBeLessThanOrEqual(3);
  });

  it("Premium blend has a known ~30 EUR documented discrepancy vs backstop 1261.5", () => {
    // Documented in the file header. If a schema refactor closes the gap or
    // widens it past 50 EUR, that's a banker-relevant change and we want the
    // test to scream.
    const r = recomputeGreekTierBlend("Premium");
    expect(r.n).toBe(22);
    const gap = Math.abs((r.blend ?? 0) - 1261.5);
    expect(gap).toBeGreaterThan(10); // not zero
    expect(gap).toBeLessThan(50); // not unbounded
  });
});

describe("groupPerHotelByListing", () => {
  it("collapses tier rows under one hotel group", () => {
    const groups = groupPerHotelByListing(MARKET_2025_PER_HOTEL);
    expect(groups.length).toBe(41);
    // Andronis appears twice (Paros + Santorini); they must NOT be collapsed
    const andronis = groups.filter((g) => g.name === "Andronis");
    expect(andronis.length).toBe(2);
  });
  it("each group carries its tier rows", () => {
    const groups = groupPerHotelByListing(MARKET_2025_PER_HOTEL);
    for (const g of groups) {
      expect(g.tiers.length).toBeGreaterThanOrEqual(1);
    }
  });
});

describe("comparableCount — for the 'See the N comparables' CTA", () => {
  it("All count matches the brief's 41 distinct hotels claim, expressed as ≥41 entries", () => {
    // entries can exceed 41 because hotels have multiple tier rows
    expect(comparableCount(MARKET_2025_PER_HOTEL, "All")).toBeGreaterThanOrEqual(41);
  });
  it("Greek count is non-zero and ≤ All count", () => {
    const gk = comparableCount(MARKET_2025_PER_HOTEL, "Greek");
    const all = comparableCount(MARKET_2025_PER_HOTEL, "All");
    expect(gk).toBeGreaterThan(0);
    expect(gk).toBeLessThanOrEqual(all);
  });
});

describe("HOTEL_URLS — orphan + format guard", () => {
  // Build the set of known hotel names so the orphan check is O(1).
  const known = new Set(MARKET_2025_PER_HOTEL.map((h) => h.name));

  it("every key in HOTEL_URLS matches a hotel name in MARKET_2025_PER_HOTEL", () => {
    const orphans = Object.keys(HOTEL_URLS).filter((name) => !known.has(name));
    expect(orphans).toEqual([]);
  });

  it("every URL is https://", () => {
    for (const [name, url] of Object.entries(HOTEL_URLS)) {
      expect(url, `HOTEL_URLS[${name}]`).toMatch(/^https:\/\//);
    }
  });

  it("the 3 broken-site hotels point at booking.com", () => {
    for (const name of HOTELS_DIRECT_SITE_BROKEN) {
      const url = HOTEL_URLS[name];
      expect(url, `HOTEL_URLS[${name}]`).toBeDefined();
      expect(url).toMatch(/booking\.com/);
    }
  });

  it("resolveHotelUrl returns curated URL when known", () => {
    expect(resolveHotelUrl("Mythic Paros")).toBe("https://www.mythicparos.com");
  });

  it("resolveHotelUrl falls back to booking.com search when not curated", () => {
    const url = resolveHotelUrl("Unknown Property XYZ");
    expect(url).toMatch(/^https:\/\/www\.booking\.com\/searchresults\.html\?ss=/);
    expect(url).toContain("Unknown%20Property%20XYZ");
  });

  it("resolveHotelUrl honors explicit fallbackSearch override", () => {
    const url = resolveHotelUrl("Unknown Property", "https://example.test/search?q=foo");
    expect(url).toBe("https://example.test/search?q=foo");
  });

  it("HOTELS_DIRECT_SITE_BROKEN names are all in MARKET_2025_PER_HOTEL", () => {
    for (const name of HOTELS_DIRECT_SITE_BROKEN) {
      expect(known.has(name), name).toBe(true);
    }
  });
});
