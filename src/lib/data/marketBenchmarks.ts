// Market benchmarks for the Conservatism Check section's "Market" column.
//
// What this is:
//   Comparable hotels in Villa Lev's competitive set (Paros + Antiparos),
//   re-priced for the 2026 season. Used by the Conservatism Check rows in
//   admin/dashboard and LiveTrackRecord to show that BP assumptions sit
//   below market on a tier-matched, season-blended basis.
//
// Source methodology:
//   - Stay window: 2 adults, 1 room, no extras, pay-at-property rate.
//   - HIGH: stay 2026-08-04 → 2026-08-06 (mid-week, peak August).
//   - MED:  stay 2026-09-08 → 2026-09-10 (mid-week, late shoulder).
//   - LOW (Oct–Apr) omitted: Villa Lev operates 15 May–15 Sep.
//   - Direct search captures + opportunistic capture from booking.com
//     "More properties you might like" sidebar panels at the same dates.
//
// Tier matching contract (load-bearing for the Conservatism Check UI):
//   BP suiteStandardADR → market doubleRoom (standard double-occupancy room)
//   BP suiteDoubleADR   → market premiumSuite (junior suite / cave class)
//   BP villaADR         → NOT compared here — Villa Lev actuals in
//                          LiveTrackRecord are the comparable.

export type HotelLocation = "Paros" | "Antiparos";

export type Season = "HIGH" | "MED";

export type SeasonalRates = {
  season: Season;
  basicRoomEur: number | null;
  doubleRoomEur: number | null;
  premiumSuiteEur: number | null;
  luxurySuiteEur: number | null;
  villaEur: number | null;
};

export type HotelBenchmark = {
  name: string;
  location: HotelLocation;
  locationDetail?: string;
  stars: 4 | 5;
  rooms: number | null;
  directUrl: string;
  pricing: SeasonalRates[];
  capturedAt: string | null;
  notes?: string;
};

// Curated 14-hotel Paros + Antiparos comparable set. Captured 2026-05-22.
// Rate convention: per-night Flex rate for 2 adults / 1 room, in EUR.
//
// Curation (2026-05-22, post-capture): six Paros properties from the original
// 20-hotel scrape were excluded as outside Villa Lev's competitive set —
// they sit in the value-resort / mid-tier-5★ band rather than the
// luxury-boutique / villa-class segment Villa Lev competes in:
//   - Poseidon of Paros (52 rooms, headline rates €314–€582)
//   - Kouros Blanc Resort & Suites (38 rooms, €400–€535)
//   - Summer Senses Luxury Resort (40 rooms, €411–€529)
//   - Paros Agnanti Resort & Spa (55 rooms, €438–€510)
//   - Calme Boutique Hotel (15 rooms, €510–€525)
//   - Mythic Paros (40 rooms, €522–€614)
// Provenance preserved in git history at commit prior to 2026-05-22 cut.
//
// NOTE (2026-05-22): the visible Conservatism Triangle and the static Market
// Position grid both render against MARKET_2025_BACKSTOP, not this array — so
// the curation here does not affect the bank-facing comparison today. Kept
// curated in case a future surface wires through to the live 2026 capture.
// 2026 booking.com scrape removed 2026-05-22 per Eytan directive (only the
// Greek 2025 study aggregates feed the bank-facing comparison). The empty
// array keeps the call signature so computeMarketPositionWithFallback still
// type-checks; every tier auto-falls to MARKET_2025_BACKSTOP.
export const MARKET_BENCHMARKS_2026: HotelBenchmark[] = [];

// ── Aggregation helpers ──

export type TierKey = "basicRoom" | "doubleRoom" | "premiumSuite" | "luxurySuite" | "villa";

const TIER_FIELDS: Record<TierKey, keyof SeasonalRates> = {
  basicRoom: "basicRoomEur",
  doubleRoom: "doubleRoomEur",
  premiumSuite: "premiumSuiteEur",
  luxurySuite: "luxurySuiteEur",
  villa: "villaEur",
};

export function median(values: number[]): number | null {
  const cleaned = values.filter((v) => Number.isFinite(v));
  if (cleaned.length === 0) return null;
  const sorted = [...cleaned].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

export function tierMedian(
  benchmarks: HotelBenchmark[],
  tier: TierKey,
  season: Season,
): number | null {
  const field = TIER_FIELDS[tier];
  const values: number[] = [];
  for (const b of benchmarks) {
    const s = b.pricing.find((p) => p.season === season);
    if (!s) continue;
    const v = s[field];
    if (typeof v === "number") values.push(v);
  }
  return median(values);
}

export const OPERATIONAL_SEASON_WEIGHTS = { HIGH: 0.5, MED: 0.5 } as const;

export function operationalSeasonBlend(
  benchmarks: HotelBenchmark[],
  tier: TierKey,
): number | null {
  const high = tierMedian(benchmarks, tier, "HIGH");
  const med = tierMedian(benchmarks, tier, "MED");
  if (high === null && med === null) return null;
  if (high === null) return med;
  if (med === null) return high;
  return high * OPERATIONAL_SEASON_WEIGHTS.HIGH + med * OPERATIONAL_SEASON_WEIGHTS.MED;
}

export const PAROS_BENCHMARKS = MARKET_BENCHMARKS_2026.filter((b) => b.location === "Paros");
export const ANTIPAROS_BENCHMARKS = MARKET_BENCHMARKS_2026.filter((b) => b.location === "Antiparos");

export function captureCoverage(benchmarks: HotelBenchmark[] = MARKET_BENCHMARKS_2026): {
  totalHotels: number;
  capturedHotels: number;
  totalCells: number;
  capturedCells: number;
} {
  const totalCells = benchmarks.length * 2 * 5;
  let capturedCells = 0;
  let capturedHotels = 0;
  for (const b of benchmarks) {
    let hotelHas = false;
    for (const s of b.pricing) {
      for (const tier of Object.values(TIER_FIELDS)) {
        if (typeof s[tier] === "number") {
          capturedCells += 1;
          hotelHas = true;
        }
      }
    }
    if (hotelHas) capturedHotels += 1;
  }
  return {
    totalHotels: benchmarks.length,
    capturedHotels,
    totalCells,
    capturedCells,
  };
}

export const MARKET_STUDY_SOURCE = {
  collectionSheet: "MarketStudy_2026_ParosAntiparos.csv",
  scope: "Paros + Antiparos, 2026 season, HIGH (Aug 4–6) + MED (Sep 8–10)",
  populatedAt: "2026-05-22",
} as const;

// ── Headline market-comparison used by the Credit Summary "Market Position" strip ──
// Villa is INTENTIONALLY EXCLUDED from this strip.

export type MarketComparisonRow = {
  metric: "suiteStandardADR" | "suiteDoubleADR";
  bp: number;
  market: number | null;
  deltaPct: number | null;
  coverageHotels: number;
};

export type MarketPosition = {
  rows: MarketComparisonRow[];
  totalHotels: number;
  capturedHotels: number;
  hasAnyMarketData: boolean;
};

export function computeMarketPosition(
  bpAssumptions: { suiteStandardADR: number; suiteDoubleADR: number },
  benchmarks: HotelBenchmark[] = MARKET_BENCHMARKS_2026,
): MarketPosition {
  const tierToBpField: Array<{
    metric: MarketComparisonRow["metric"];
    bp: number;
    tier: TierKey;
  }> = [
    { metric: "suiteStandardADR", bp: bpAssumptions.suiteStandardADR, tier: "doubleRoom" },
    { metric: "suiteDoubleADR", bp: bpAssumptions.suiteDoubleADR, tier: "premiumSuite" },
  ];

  const rows: MarketComparisonRow[] = tierToBpField.map(({ metric, bp, tier }) => {
    const market = operationalSeasonBlend(benchmarks, tier);
    const coverageHotels = countHotelsContributing(benchmarks, tier);
    const deltaPct = market === null ? null : (bp - market) / market;
    return { metric, bp, market, deltaPct, coverageHotels };
  });

  const { totalHotels, capturedHotels } = captureCoverage(benchmarks);
  const hasAnyMarketData = rows.some((r) => r.market !== null);

  return { rows, totalHotels, capturedHotels, hasAnyMarketData };
}

function countHotelsContributing(benchmarks: HotelBenchmark[], tier: TierKey): number {
  const field = TIER_FIELDS[tier];
  let n = 0;
  for (const b of benchmarks) {
    for (const s of b.pricing) {
      if (typeof s[field] === "number") {
        n += 1;
        break;
      }
    }
  }
  return n;
}

// ── 2025 backstop ──────────────────────────────────────────────
// Pre-computed Greek-islands market averages from the 2025 hotel market study
// (root-level /tmp/hotel_market_study.csv, rows 87-95). Used when fresh 2026
// capture coverage for a tier is too thin for a credible median (single-
// property results would mislead the bank narrative). Mapping rationale:
//
//   - basicRoom / doubleRoom backstop  = CSV "BASIC"   row (HIGH 993 / MED 699)
//   - premiumSuite backstop            = CSV "PREMIUM" row (HIGH 1482 / MED 1041)
//   - luxurySuite backstop             = CSV "LUXURY"  row (HIGH 1992 / MED 1456)
//   - villa backstop                   = CSV "LUXURY VILLA, 2-5 rooms" row
//                                         (HIGH 4467 / MED 4275). NOT the all-
//                                         villas average — Villa Lev positions
//                                         in the luxury whole-villa tier.
//
// LOW (Oct-Apr) intentionally absent: Villa Lev operates 15 May – 15 Sep.
export const MARKET_2025_BACKSTOP: Record<TierKey, { high: number; med: number }> = {
  basicRoom: { high: 993, med: 699 },
  doubleRoom: { high: 993, med: 699 },
  premiumSuite: { high: 1482, med: 1041 },
  luxurySuite: { high: 1992, med: 1456 },
  villa: { high: 4467, med: 4275 },
};

export const MARKET_BACKSTOP_SOURCE = {
  name: "Greek Islands Hotel Market Study (2025 averages)",
  sheet: "MarketStudy_2025_GreekIslands_Hotels.csv",
  rows: "Pre-computed averages, rows 87-95",
} as const;

function backstopBlend(tier: TierKey): number {
  const b = MARKET_2025_BACKSTOP[tier];
  return (b.high + b.med) / 2;
}

// ── Hybrid Market column data feed ─────────────────────────────
// Used by the Conservatism Check "Market" column in LiveTrackRecord. Returns
// the live 2026 median when coverage meets `freshThreshold` hotels, otherwise
// falls back to the 2025 Greek-market backstop. Each row carries a
// `coverageStatus` so the UI can footnote which row used which source.

export type CoverageStatus = "fresh" | "2025-backstop" | "no-data";

export type MarketRowWithFallback = {
  metric: "suiteStandardADR" | "suiteDoubleADR" | "villaADR";
  tier: TierKey;
  bp: number;
  market: number;
  deltaPct: number;
  coverageHotels: number;
  status: CoverageStatus;
};

export type MarketPositionWithFallback = {
  rows: MarketRowWithFallback[];
  freshThreshold: number;
  source: {
    fresh: typeof MARKET_STUDY_SOURCE;
    backstop: typeof MARKET_BACKSTOP_SOURCE;
  };
};

// Default minimum-N. Below 3 hotels contributing data for a tier we don't
// trust the median (parallel session captured 1 hotel for premiumSuite and
// luxurySuite, both Mythic Paros — a single-property "median" would tell a
// misleading story for the bank).
export const DEFAULT_FRESH_THRESHOLD = 3;

export function computeMarketPositionWithFallback(
  bpAssumptions: {
    suiteStandardADR: number;
    suiteDoubleADR: number;
    villaADR: number;
  },
  benchmarks: HotelBenchmark[] = MARKET_BENCHMARKS_2026,
  freshThreshold: number = DEFAULT_FRESH_THRESHOLD,
): MarketPositionWithFallback {
  // Tier mapping per the file header contract:
  //   suiteStandardADR → doubleRoom
  //   suiteDoubleADR   → premiumSuite (junior suite / cave class)
  //   villaADR         → villa
  const mapping: Array<{
    metric: MarketRowWithFallback["metric"];
    bp: number;
    tier: TierKey;
  }> = [
    { metric: "suiteStandardADR", bp: bpAssumptions.suiteStandardADR, tier: "doubleRoom" },
    { metric: "suiteDoubleADR", bp: bpAssumptions.suiteDoubleADR, tier: "premiumSuite" },
    { metric: "villaADR", bp: bpAssumptions.villaADR, tier: "villa" },
  ];

  const rows: MarketRowWithFallback[] = mapping.map(({ metric, bp, tier }) => {
    const coverageHotels = countHotelsContributing(benchmarks, tier);
    const freshBlend = operationalSeasonBlend(benchmarks, tier);
    let market: number;
    let status: CoverageStatus;
    if (freshBlend !== null && coverageHotels >= freshThreshold) {
      market = freshBlend;
      status = "fresh";
    } else {
      market = backstopBlend(tier);
      status = "2025-backstop";
    }
    return {
      metric,
      tier,
      bp,
      market,
      deltaPct: (bp - market) / market,
      coverageHotels,
      status,
    };
  });

  return {
    rows,
    freshThreshold,
    source: { fresh: MARKET_STUDY_SOURCE, backstop: MARKET_BACKSTOP_SOURCE },
  };
}
// ── 2025 Greek Islands Hotel Market Study — per-hotel comparables ─────────
// Loaded faithfully from the 2025 study CSV (rows 7-86 Greek + rows 134-194
// international, file line numbers). Powers the MarketComparablesDrawer drill-
// down on /admin/dashboard, /investor, /pitch. Headline numbers continue to
// read from MARKET_2025_BACKSTOP (Greek-only pre-computed averages from CSV
// rows 87-95) — this array is for transparency / drill-down only.
//
// Notes on name fidelity:
//   - CSV typo 'Asitr' → 'Astir of Paros' (the canonical name).
//   - 'Summer Sense' → 'Summer Senses Luxury Resort'.
//   - 'Cap d Antibes' → 'Cap d\'Antibes Beach Hotel'.
//   - All other names preserved verbatim from the source CSV.
//
// URL policy: the 2025 study's CSV "LINK" column carried free-text labels
// (descriptive titles) for most rows rather than real URLs. Only one entry
// (Grand Hotel du Cap-Ferrat → fourseasons.com) had a canonical URL we can
// keep. For every other entry the field is empty (`url: ""`), and the
// MarketComparablesDrawer renders a booking.com search URL as the fallback
// — see urlOrBookingFallback() in components/MarketComparablesDrawer.tsx.
// That gives bankers a one-click verify path while keeping the data faithful
// to what the study actually captured.
export type PerHotelComparable = {
  name: string;
  location: string;          // sub-island / region within country (e.g. "Paros Agia Irini")
  country: string;           // "Greece" for the Greek block, raw country (e.g. "Italy", "Marocco") for the international block
  stars: 4 | 5 | null;
  rooms: number | null;
  tier: "Basic" | "Premium" | "Luxury" | "Villa";
  tierRaw: string;           // original CSV string ("Villa Basic", "Villa (7 adults)", etc.) preserved for the drawer
  highEur: number | null;    // HIGH season per-night (Jul–Aug)
  medEur: number | null;     // MED season per-night (May–Jun + Sep)
  lowEur: number | null;     // LOW season per-night (Oct–Apr) — unused for the Greek-only headline blend
  annualEur: number | null;  // annual average per-night from CSV column 'AVRGE.'
  url: string;               // empty when no usable URL
};

export const MARKET_2025_PER_HOTEL: PerHotelComparable[] = [
  // ── Greek Islands (23 hotels, 4–5★) — CSV file lines 7–86 ──
  {
    name: "Lilly Residence",
    location: "Paros",
    country: "Greece",
    stars: 4,
    rooms: 12,
    tier: "Basic",
    tierRaw: "Basic",
    highEur: 725,
    medEur: 640,
    lowEur: 390,
    annualEur: 508,
    url: "",
  },
  {
    name: "Lilly Residence",
    location: "Paros",
    country: "Greece",
    stars: 4,
    rooms: 12,
    tier: "Premium",
    tierRaw: "Premium",
    highEur: 1400,
    medEur: 1135,
    lowEur: 670,
    annualEur: 908,
    url: "",
  },
  {
    name: "Lilly Residence",
    location: "Paros",
    country: "Greece",
    stars: 4,
    rooms: 12,
    tier: "Luxury",
    tierRaw: "Luxury",
    highEur: 2385,
    medEur: 1340,
    lowEur: 950,
    annualEur: 1287,
    url: "",
  },
  {
    name: "Mythic Paros",
    location: "Paros Agia Irini",
    country: "Greece",
    stars: 5,
    rooms: 40,
    tier: "Basic",
    tierRaw: "Basic",
    highEur: 770,
    medEur: 500,
    lowEur: 405,
    annualEur: 490,
    url: "",
  },
  {
    name: "Mythic Paros",
    location: "Paros Agia Irini",
    country: "Greece",
    stars: 5,
    rooms: 40,
    tier: "Premium",
    tierRaw: "Premium",
    highEur: 875,
    medEur: 625,
    lowEur: 600,
    annualEur: 652,
    url: "",
  },
  {
    name: "Mythic Paros",
    location: "Paros Agia Irini",
    country: "Greece",
    stars: 5,
    rooms: 40,
    tier: "Luxury",
    tierRaw: "Luxury",
    highEur: 1460,
    medEur: 1050,
    lowEur: 900,
    annualEur: 1031,
    url: "",
  },
  {
    name: "Hotel Senia",
    location: "Paros",
    country: "Greece",
    stars: 4,
    rooms: 30,
    tier: "Basic",
    tierRaw: "Basic",
    highEur: 520,
    medEur: 290,
    lowEur: 180,
    annualEur: 264,
    url: "",
  },
  {
    name: "Hotel Senia",
    location: "Paros",
    country: "Greece",
    stars: 4,
    rooms: 30,
    tier: "Premium",
    tierRaw: "Premium",
    highEur: 1170,
    medEur: 530,
    lowEur: 460,
    annualEur: 596,
    url: "",
  },
  {
    name: "Hotel Senia",
    location: "Paros",
    country: "Greece",
    stars: 4,
    rooms: 30,
    tier: "Luxury",
    tierRaw: "Luxury",
    highEur: 1730,
    medEur: 1680,
    lowEur: 809,
    annualEur: 1180,
    url: "",
  },
  {
    name: "The Rooster Antiparos",
    location: "Antiparos Livadia Bay",
    country: "Greece",
    stars: 5,
    rooms: 17,
    tier: "Villa",
    tierRaw: "Villa Basic",
    highEur: 1620,
    medEur: 855,
    lowEur: 855,
    annualEur: 983,
    url: "",
  },
  {
    name: "The Rooster Antiparos",
    location: "Antiparos Livadia Bay",
    country: "Greece",
    stars: 5,
    rooms: 17,
    tier: "Villa",
    tierRaw: "Villa Premium",
    highEur: 2310,
    medEur: 1300,
    lowEur: 1300,
    annualEur: 1468,
    url: "",
  },
  {
    name: "The Rooster Antiparos",
    location: "Antiparos Livadia Bay",
    country: "Greece",
    stars: 5,
    rooms: 17,
    tier: "Villa",
    tierRaw: "Villa Luxury",
    highEur: 3350,
    medEur: 1880,
    lowEur: 1880,
    annualEur: 2125,
    url: "",
  },
  {
    name: "Kameo Antiparos",
    location: "Antiparos Livadia Bay",
    country: "Greece",
    stars: 5,
    rooms: null,
    tier: "Basic",
    tierRaw: "Basic",
    highEur: 1740,
    medEur: 1100,
    lowEur: 1100,
    annualEur: 1207,
    url: "",
  },
  {
    name: "Kameo Antiparos",
    location: "Antiparos Livadia Bay",
    country: "Greece",
    stars: 5,
    rooms: null,
    tier: "Premium",
    tierRaw: "Premium",
    highEur: 1950,
    medEur: 1300,
    lowEur: 1300,
    annualEur: 1408,
    url: "",
  },
  {
    name: "Kameo Antiparos",
    location: "Antiparos Livadia Bay",
    country: "Greece",
    stars: 5,
    rooms: null,
    tier: "Luxury",
    tierRaw: "Luxury",
    highEur: 2040,
    medEur: 1360,
    lowEur: 1360,
    annualEur: 1473,
    url: "",
  },
  {
    name: "Andronis",
    location: "Paros",
    country: "Greece",
    stars: 5,
    rooms: 44,
    tier: "Basic",
    tierRaw: "Basic",
    highEur: 765,
    medEur: 445,
    lowEur: 445,
    annualEur: 498,
    url: "",
  },
  {
    name: "Andronis",
    location: "Paros",
    country: "Greece",
    stars: 5,
    rooms: 44,
    tier: "Premium",
    tierRaw: "Premium",
    highEur: 1315,
    medEur: 665,
    lowEur: 665,
    annualEur: 773,
    url: "",
  },
  {
    name: "Andronis",
    location: "Paros",
    country: "Greece",
    stars: 5,
    rooms: 44,
    tier: "Luxury",
    tierRaw: "Luxury",
    highEur: 2515,
    medEur: 1065,
    lowEur: 1065,
    annualEur: 1307,
    url: "",
  },
  {
    name: "Parilio",
    location: "Paros",
    country: "Greece",
    stars: 5,
    rooms: 33,
    tier: "Basic",
    tierRaw: "Basic",
    highEur: 1650,
    medEur: 550,
    lowEur: 420,
    annualEur: 658,
    url: "",
  },
  {
    name: "Parilio",
    location: "Paros",
    country: "Greece",
    stars: 5,
    rooms: 33,
    tier: "Premium",
    tierRaw: "Premium",
    highEur: 1800,
    medEur: 750,
    lowEur: 620,
    annualEur: 849,
    url: "",
  },
  {
    name: "Parilio",
    location: "Paros",
    country: "Greece",
    stars: 5,
    rooms: 33,
    tier: "Luxury",
    tierRaw: "Luxury",
    highEur: 2400,
    medEur: 1080,
    lowEur: 950,
    annualEur: 1224,
    url: "",
  },
  {
    name: "Parilio",
    location: "Paros",
    country: "Greece",
    stars: 5,
    rooms: 33,
    tier: "Villa",
    tierRaw: "Villa (7 adults)",
    highEur: 4000,
    medEur: 3000,
    lowEur: 1620,
    annualEur: 2362,
    url: "",
  },
  {
    name: "Parilio",
    location: "Paros",
    country: "Greece",
    stars: 5,
    rooms: 33,
    tier: "Villa",
    tierRaw: "Villa (11 adults)",
    highEur: 6000,
    medEur: 5000,
    lowEur: 1950,
    annualEur: 3388,
    url: "",
  },
  {
    name: "Cove",
    location: "Paros",
    country: "Greece",
    stars: 5,
    rooms: 45,
    tier: "Basic",
    tierRaw: "Basic",
    highEur: 875,
    medEur: 570,
    lowEur: 280,
    annualEur: 452,
    url: "",
  },
  {
    name: "Cove",
    location: "Paros",
    country: "Greece",
    stars: 5,
    rooms: 45,
    tier: "Premium",
    tierRaw: "Premium",
    highEur: 1225,
    medEur: 615,
    lowEur: 350,
    annualEur: 562,
    url: "",
  },
  {
    name: "Cove",
    location: "Paros",
    country: "Greece",
    stars: 5,
    rooms: 45,
    tier: "Luxury",
    tierRaw: "Luxury",
    highEur: 1390,
    medEur: 700,
    lowEur: 440,
    annualEur: 663,
    url: "",
  },
  {
    name: "Cosme",
    location: "Paros",
    country: "Greece",
    stars: 5,
    rooms: 40,
    tier: "Basic",
    tierRaw: "Basic",
    highEur: 2250,
    medEur: 2250,
    lowEur: 558,
    annualEur: 1263,
    url: "",
  },
  {
    name: "Cosme",
    location: "Paros",
    country: "Greece",
    stars: 5,
    rooms: 40,
    tier: "Premium",
    tierRaw: "Premium",
    highEur: 2655,
    medEur: 2520,
    lowEur: 918,
    annualEur: 1608,
    url: "",
  },
  {
    name: "Cosme",
    location: "Paros",
    country: "Greece",
    stars: 5,
    rooms: 40,
    tier: "Luxury",
    tierRaw: "Luxury",
    highEur: 3375,
    medEur: 2817,
    lowEur: 1430,
    annualEur: 2101,
    url: "",
  },
  {
    name: "Summer Senses Luxury Resort",
    location: "Paros",
    country: "Greece",
    stars: 5,
    rooms: 40,
    tier: "Basic",
    tierRaw: "Basic",
    highEur: 510,
    medEur: 250,
    lowEur: 250,
    annualEur: 293,
    url: "",
  },
  {
    name: "Summer Senses Luxury Resort",
    location: "Paros",
    country: "Greece",
    stars: 5,
    rooms: 40,
    tier: "Premium",
    tierRaw: "Premium",
    highEur: 850,
    medEur: 540,
    lowEur: 540,
    annualEur: 592,
    url: "",
  },
  {
    name: "Summer Senses Luxury Resort",
    location: "Paros",
    country: "Greece",
    stars: 5,
    rooms: 40,
    tier: "Luxury",
    tierRaw: "Luxury",
    highEur: 1180,
    medEur: 775,
    lowEur: 775,
    annualEur: 843,
    url: "",
  },
  {
    name: "Astir of Paros",
    location: "Paros",
    country: "Greece",
    stars: 5,
    rooms: 40,
    tier: "Basic",
    tierRaw: "Basic",
    highEur: 640,
    medEur: 420,
    lowEur: 420,
    annualEur: 457,
    url: "",
  },
  {
    name: "Astir of Paros",
    location: "Paros",
    country: "Greece",
    stars: 5,
    rooms: 40,
    tier: "Premium",
    tierRaw: "Premium",
    highEur: 1545,
    medEur: 950,
    lowEur: 950,
    annualEur: 1049,
    url: "",
  },
  {
    name: "Astir of Paros",
    location: "Paros",
    country: "Greece",
    stars: 5,
    rooms: 40,
    tier: "Luxury",
    tierRaw: "Luxury",
    highEur: 2545,
    medEur: 1445,
    lowEur: 1445,
    annualEur: 1628,
    url: "",
  },
  {
    name: "Parocks",
    location: "Paros",
    country: "Greece",
    stars: 5,
    rooms: 41,
    tier: "Basic",
    tierRaw: "Basic",
    highEur: 970,
    medEur: 550,
    lowEur: 550,
    annualEur: 620,
    url: "",
  },
  {
    name: "Parocks",
    location: "Paros",
    country: "Greece",
    stars: 5,
    rooms: 41,
    tier: "Premium",
    tierRaw: "Premium",
    highEur: 1910,
    medEur: 890,
    lowEur: 890,
    annualEur: 1060,
    url: "",
  },
  {
    name: "Parocks",
    location: "Paros",
    country: "Greece",
    stars: 5,
    rooms: 41,
    tier: "Luxury",
    tierRaw: "Luxury",
    highEur: 2720,
    medEur: 1730,
    lowEur: 1730,
    annualEur: 1895,
    url: "",
  },
  {
    name: "Yria Boutique Hotel",
    location: "Paros",
    country: "Greece",
    stars: 5,
    rooms: 60,
    tier: "Basic",
    tierRaw: "Basic",
    highEur: 535,
    medEur: 315,
    lowEur: 315,
    annualEur: 352,
    url: "",
  },
  {
    name: "Yria Boutique Hotel",
    location: "Paros",
    country: "Greece",
    stars: 5,
    rooms: 60,
    tier: "Premium",
    tierRaw: "Premium",
    highEur: 665,
    medEur: 615,
    lowEur: 600,
    annualEur: 615,
    url: "",
  },
  {
    name: "Yria Boutique Hotel",
    location: "Paros",
    country: "Greece",
    stars: 5,
    rooms: 60,
    tier: "Luxury",
    tierRaw: "Luxury",
    highEur: 945,
    medEur: 855,
    lowEur: 750,
    annualEur: 809,
    url: "",
  },
  {
    name: "Yria Boutique Hotel",
    location: "Paros",
    country: "Greece",
    stars: 5,
    rooms: 60,
    tier: "Villa",
    tierRaw: "Villa (8adults)",
    highEur: 4215,
    medEur: 3415,
    lowEur: 3415,
    annualEur: 3548,
    url: "",
  },
  {
    name: "Kouros Blanc Resort",
    location: "Paros",
    country: "Greece",
    stars: 5,
    rooms: 38,
    tier: "Basic",
    tierRaw: "Basic",
    highEur: 421,
    medEur: 225,
    lowEur: 200,
    annualEur: 243,
    url: "",
  },
  {
    name: "Kouros Blanc Resort",
    location: "Paros",
    country: "Greece",
    stars: 5,
    rooms: 38,
    tier: "Premium",
    tierRaw: "Premium",
    highEur: 681,
    medEur: 392,
    lowEur: 300,
    annualEur: 387,
    url: "",
  },
  {
    name: "Kouros Blanc Resort",
    location: "Paros",
    country: "Greece",
    stars: 5,
    rooms: 38,
    tier: "Luxury",
    tierRaw: "Luxury",
    highEur: 930,
    medEur: 450,
    lowEur: 330,
    annualEur: 460,
    url: "",
  },
  {
    name: "Avant Mar",
    location: "Paros",
    country: "Greece",
    stars: 5,
    rooms: 38,
    tier: "Basic",
    tierRaw: "Basic",
    highEur: 930,
    medEur: 825,
    lowEur: 560,
    annualEur: 688,
    url: "",
  },
  {
    name: "Avant Mar",
    location: "Paros",
    country: "Greece",
    stars: 5,
    rooms: 38,
    tier: "Premium",
    tierRaw: "Premium",
    highEur: 1925,
    medEur: 1890,
    lowEur: 1070,
    annualEur: 1418,
    url: "",
  },
  {
    name: "Avant Mar",
    location: "Paros",
    country: "Greece",
    stars: 5,
    rooms: 38,
    tier: "Luxury",
    tierRaw: "Luxury",
    highEur: 3125,
    medEur: 2800,
    lowEur: 2280,
    annualEur: 2551,
    url: "",
  },
  {
    name: "Agnanti",
    location: "Paros",
    country: "Greece",
    stars: 5,
    rooms: 55,
    tier: "Basic",
    tierRaw: "Basic",
    highEur: 448,
    medEur: 268,
    lowEur: 268,
    annualEur: 298,
    url: "",
  },
  {
    name: "Agnanti",
    location: "Paros",
    country: "Greece",
    stars: 5,
    rooms: 55,
    tier: "Premium",
    tierRaw: "Premium",
    highEur: 1025,
    medEur: 422,
    lowEur: 390,
    annualEur: 504,
    url: "",
  },
  {
    name: "Agnanti",
    location: "Paros",
    country: "Greece",
    stars: 5,
    rooms: 55,
    tier: "Luxury",
    tierRaw: "Luxury",
    highEur: 1260,
    medEur: 516,
    lowEur: 516,
    annualEur: 640,
    url: "",
  },
  {
    name: "The Beach House",
    location: "Antiparos",
    country: "Greece",
    stars: 5,
    rooms: 9,
    tier: "Basic",
    tierRaw: "Basic",
    highEur: 562,
    medEur: 551,
    lowEur: 425,
    annualEur: 479,
    url: "",
  },
  {
    name: "The Beach House",
    location: "Antiparos",
    country: "Greece",
    stars: 5,
    rooms: 9,
    tier: "Premium",
    tierRaw: "Premium",
    highEur: 933,
    medEur: 816,
    lowEur: 720,
    annualEur: 780,
    url: "",
  },
  {
    name: "The Beach House",
    location: "Antiparos",
    country: "Greece",
    stars: 5,
    rooms: 9,
    tier: "Luxury",
    tierRaw: "Luxury",
    highEur: 1037,
    medEur: 1022,
    lowEur: 825,
    annualEur: 910,
    url: "",
  },
  {
    name: "Iconic",
    location: "Santorini",
    country: "Greece",
    stars: 5,
    rooms: 19,
    tier: "Basic",
    tierRaw: "Basic",
    highEur: 815,
    medEur: 615,
    lowEur: 580,
    annualEur: 628,
    url: "",
  },
  {
    name: "Iconic",
    location: "Santorini",
    country: "Greece",
    stars: 5,
    rooms: 19,
    tier: "Premium",
    tierRaw: "Premium",
    highEur: 1615,
    medEur: 1285,
    lowEur: 980,
    annualEur: 1162,
    url: "",
  },
  {
    name: "Iconic",
    location: "Santorini",
    country: "Greece",
    stars: 5,
    rooms: 19,
    tier: "Luxury",
    tierRaw: "Luxury",
    highEur: 1765,
    medEur: 1415,
    lowEur: 1080,
    annualEur: 1278,
    url: "",
  },
  {
    name: "Andronis",
    location: "Santorini",
    country: "Greece",
    stars: 5,
    rooms: 25,
    tier: "Basic",
    tierRaw: "Basic",
    highEur: 1080,
    medEur: 844,
    lowEur: 693,
    annualEur: 795,
    url: "",
  },
  {
    name: "Andronis",
    location: "Santorini",
    country: "Greece",
    stars: 5,
    rooms: 25,
    tier: "Premium",
    tierRaw: "Premium",
    highEur: 1347,
    medEur: 1122,
    lowEur: 835,
    annualEur: 992,
    url: "",
  },
  {
    name: "Andronis",
    location: "Santorini",
    country: "Greece",
    stars: 5,
    rooms: 25,
    tier: "Luxury",
    tierRaw: "Luxury",
    highEur: 2220,
    medEur: 2088,
    lowEur: 1445,
    annualEur: 1735,
    url: "",
  },
  {
    name: "Andronis",
    location: "Santorini",
    country: "Greece",
    stars: 5,
    rooms: 25,
    tier: "Villa",
    tierRaw: "Villa",
    highEur: 2824,
    medEur: 2824,
    lowEur: 1606,
    annualEur: 2114,
    url: "",
  },
  {
    name: "Omna Caldera",
    location: "Santorini",
    country: "Greece",
    stars: 5,
    rooms: null,
    tier: "Basic",
    tierRaw: "Basic",
    highEur: 635,
    medEur: 580,
    lowEur: 448,
    annualEur: 512,
    url: "",
  },
  {
    name: "Omna Caldera",
    location: "Santorini",
    country: "Greece",
    stars: 5,
    rooms: null,
    tier: "Premium",
    tierRaw: "Premium",
    highEur: 662,
    medEur: 662,
    lowEur: 607,
    annualEur: 630,
    url: "",
  },
  {
    name: "Omna Caldera",
    location: "Santorini",
    country: "Greece",
    stars: 5,
    rooms: null,
    tier: "Luxury",
    tierRaw: "Luxury",
    highEur: 745,
    medEur: 690,
    lowEur: 635,
    annualEur: 667,
    url: "",
  },
  {
    name: "Nomad",
    location: "Mykonos",
    country: "Greece",
    stars: 5,
    rooms: 14,
    tier: "Basic",
    tierRaw: "Basic",
    highEur: 1388,
    medEur: 702,
    lowEur: 702,
    annualEur: 816,
    url: "",
  },
  {
    name: "Nomad",
    location: "Mykonos",
    country: "Greece",
    stars: 5,
    rooms: 14,
    tier: "Premium",
    tierRaw: "Premium",
    highEur: 1711,
    medEur: 1065,
    lowEur: 903,
    annualEur: 1078,
    url: "",
  },
  {
    name: "Nomad",
    location: "Mykonos",
    country: "Greece",
    stars: 5,
    rooms: 14,
    tier: "Luxury",
    tierRaw: "Luxury",
    highEur: 2599,
    medEur: 2115,
    lowEur: 1388,
    annualEur: 1772,
    url: "",
  },
  {
    name: "Cavo Tagoo",
    location: "Mykonos",
    country: "Greece",
    stars: 5,
    rooms: 80,
    tier: "Basic",
    tierRaw: "Basic",
    highEur: 1765,
    medEur: 1515,
    lowEur: 715,
    annualEur: 1090,
    url: "",
  },
  {
    name: "Cavo Tagoo",
    location: "Mykonos",
    country: "Greece",
    stars: 5,
    rooms: 80,
    tier: "Premium",
    tierRaw: "Premium",
    highEur: 2265,
    medEur: 1973,
    lowEur: 1065,
    annualEur: 1492,
    url: "",
  },
  {
    name: "Cavo Tagoo",
    location: "Mykonos",
    country: "Greece",
    stars: 5,
    rooms: 80,
    tier: "Luxury",
    tierRaw: "Luxury",
    highEur: 2965,
    medEur: 2965,
    lowEur: 1665,
    annualEur: 2207,
    url: "",
  },
  {
    name: "Cavo Tagoo",
    location: "Mykonos",
    country: "Greece",
    stars: 5,
    rooms: 80,
    tier: "Villa",
    tierRaw: "Villa",
    highEur: 4665,
    medEur: 4665,
    lowEur: 2515,
    annualEur: 3411,
    url: "",
  },
  {
    name: "Santa Marina (Marriott)",
    location: "Mykonos",
    country: "Greece",
    stars: 5,
    rooms: 114,
    tier: "Basic",
    tierRaw: "Basic",
    highEur: 1850,
    medEur: 1378,
    lowEur: 530,
    annualEur: 962,
    url: "",
  },
  {
    name: "Santa Marina (Marriott)",
    location: "Mykonos",
    country: "Greece",
    stars: 5,
    rooms: 114,
    tier: "Premium",
    tierRaw: "Premium",
    highEur: 2274,
    medEur: 1739,
    lowEur: 727,
    annualEur: 1238,
    url: "",
  },
  {
    name: "Santa Marina (Marriott)",
    location: "Mykonos",
    country: "Greece",
    stars: 5,
    rooms: 114,
    tier: "Luxury",
    tierRaw: "Luxury",
    highEur: 2480,
    medEur: 2185,
    lowEur: 983,
    annualEur: 1533,
    url: "",
  },
  {
    name: "Santa Marina (Marriott)",
    location: "Mykonos",
    country: "Greece",
    stars: 5,
    rooms: 114,
    tier: "Villa",
    tierRaw: "Villa",
    highEur: 4467,
    medEur: 4275,
    lowEur: 2138,
    annualEur: 3060,
    url: "",
  },
  // ── International (18 hotels, 4–5★) — CSV file lines 134–194 ──
  {
    name: "Royal Mansour Tamuda Bay",
    location: "Marocco",
    country: "Marocco",
    stars: 5,
    rooms: 55,
    tier: "Basic",
    tierRaw: "Basic",
    highEur: 2490,
    medEur: 1130,
    lowEur: 800,
    annualEur: 1164,
    url: "",
  },
  {
    name: "Royal Mansour Tamuda Bay",
    location: "Marocco",
    country: "Marocco",
    stars: 5,
    rooms: 55,
    tier: "Premium",
    tierRaw: "Premium",
    highEur: 3350,
    medEur: 1720,
    lowEur: 1000,
    annualEur: 1572,
    url: "",
  },
  {
    name: "Royal Mansour Tamuda Bay",
    location: "Marocco",
    country: "Marocco",
    stars: 5,
    rooms: 55,
    tier: "Luxury",
    tierRaw: "Luxury",
    highEur: 4020,
    medEur: 2480,
    lowEur: 1880,
    annualEur: 2387,
    url: "",
  },
  {
    name: "Royal Mansour Tamuda Bay",
    location: "Marocco",
    country: "Marocco",
    stars: 5,
    rooms: 55,
    tier: "Villa",
    tierRaw: "Villa",
    highEur: 12000,
    medEur: 7730,
    lowEur: 5180,
    annualEur: 6954,
    url: "",
  },
  {
    name: "The Oberoi",
    location: "Marocco",
    country: "Marocco",
    stars: 5,
    rooms: 84,
    tier: "Basic",
    tierRaw: "Basic",
    highEur: 765,
    medEur: 1004,
    lowEur: 1500,
    annualEur: 1254,
    url: "",
  },
  {
    name: "The Oberoi",
    location: "Marocco",
    country: "Marocco",
    stars: 5,
    rooms: 84,
    tier: "Premium",
    tierRaw: "Premium",
    highEur: 956,
    medEur: 1195,
    lowEur: 1692,
    annualEur: 1445,
    url: "",
  },
  {
    name: "The Oberoi",
    location: "Marocco",
    country: "Marocco",
    stars: 5,
    rooms: 84,
    tier: "Luxury",
    tierRaw: "Luxury",
    highEur: 1720,
    medEur: 1959,
    lowEur: 2456,
    annualEur: 2209,
    url: "",
  },
  {
    name: "The Oberoi",
    location: "Marocco",
    country: "Marocco",
    stars: 5,
    rooms: 84,
    tier: "Villa",
    tierRaw: "Villa",
    highEur: 4300,
    medEur: 4540,
    lowEur: 5036,
    annualEur: 4789,
    url: "",
  },
  {
    name: "Cape of Senses",
    location: "Italy",
    country: "Italy",
    stars: 5,
    rooms: 55,
    tier: "Basic",
    tierRaw: "Basic",
    highEur: 816,
    medEur: 650,
    lowEur: 625,
    annualEur: 663,
    url: "",
  },
  {
    name: "Cape of Senses",
    location: "Italy",
    country: "Italy",
    stars: 5,
    rooms: 55,
    tier: "Premium",
    tierRaw: "Premium",
    highEur: 931,
    medEur: 754,
    lowEur: 725,
    annualEur: 767,
    url: "",
  },
  {
    name: "Cape of Senses",
    location: "Italy",
    country: "Italy",
    stars: 5,
    rooms: 55,
    tier: "Luxury",
    tierRaw: "Luxury",
    highEur: 1972,
    medEur: 1274,
    lowEur: 1225,
    annualEur: 1362,
    url: "",
  },
  {
    name: "Lefay",
    location: "Italy",
    country: "Italy",
    stars: 5,
    rooms: 96,
    tier: "Basic",
    tierRaw: "Basic",
    highEur: 695,
    medEur: 565,
    lowEur: 515,
    annualEur: 558,
    url: "",
  },
  {
    name: "Lefay",
    location: "Italy",
    country: "Italy",
    stars: 5,
    rooms: 96,
    tier: "Premium",
    tierRaw: "Premium",
    highEur: 1785,
    medEur: 1085,
    lowEur: 1085,
    annualEur: 1202,
    url: "",
  },
  {
    name: "Lefay",
    location: "Italy",
    country: "Italy",
    stars: 5,
    rooms: 96,
    tier: "Luxury",
    tierRaw: "Luxury",
    highEur: 2995,
    medEur: 2005,
    lowEur: 1505,
    annualEur: 1878,
    url: "",
  },
  {
    name: "Belmond Romazzino",
    location: "Italy",
    country: "Italy",
    stars: 5,
    rooms: 100,
    tier: "Basic",
    tierRaw: "Basic",
    highEur: 2788,
    medEur: 1110,
    lowEur: 842,
    annualEur: 1233,
    url: "",
  },
  {
    name: "Belmond Romazzino",
    location: "Italy",
    country: "Italy",
    stars: 5,
    rooms: 100,
    tier: "Premium",
    tierRaw: "Premium",
    highEur: 2950,
    medEur: 1770,
    lowEur: 886,
    annualEur: 1451,
    url: "",
  },
  {
    name: "Belmond Romazzino",
    location: "Italy",
    country: "Italy",
    stars: 5,
    rooms: 100,
    tier: "Luxury",
    tierRaw: "Luxury",
    highEur: 3497,
    medEur: 2100,
    lowEur: 1231,
    annualEur: 1826,
    url: "",
  },
  {
    name: "Belmond Romazzino",
    location: "Italy",
    country: "Italy",
    stars: 5,
    rooms: 100,
    tier: "Villa",
    tierRaw: "Villa",
    highEur: 3700,
    medEur: 2500,
    lowEur: 2000,
    annualEur: 2408,
    url: "",
  },
  {
    name: "Lily of the Valley",
    location: "France",
    country: "France",
    stars: 5,
    rooms: 50,
    tier: "Basic",
    tierRaw: "Basic",
    highEur: 2000,
    medEur: 1400,
    lowEur: 750,
    annualEur: 1121,
    url: "",
  },
  {
    name: "Lily of the Valley",
    location: "France",
    country: "France",
    stars: 5,
    rooms: 50,
    tier: "Premium",
    tierRaw: "Premium",
    highEur: 2250,
    medEur: 1650,
    lowEur: 950,
    annualEur: 1342,
    url: "",
  },
  {
    name: "Lily of the Valley",
    location: "France",
    country: "France",
    stars: 5,
    rooms: 50,
    tier: "Luxury",
    tierRaw: "Luxury",
    highEur: 3050,
    medEur: 2200,
    lowEur: 1400,
    annualEur: 1875,
    url: "",
  },
  {
    name: "Lily of the Valley",
    location: "France",
    country: "France",
    stars: 5,
    rooms: 50,
    tier: "Villa",
    tierRaw: "Villa",
    highEur: 5900,
    medEur: 5000,
    lowEur: 4500,
    annualEur: 4858,
    url: "",
  },
  {
    name: "Hotel Royal | Evian Resort",
    location: "France",
    country: "France",
    stars: 5,
    rooms: 150,
    tier: "Basic",
    tierRaw: "Basic",
    highEur: 708,
    medEur: 666,
    lowEur: 485,
    annualEur: 567,
    url: "",
  },
  {
    name: "Hotel Royal | Evian Resort",
    location: "France",
    country: "France",
    stars: 5,
    rooms: 150,
    tier: "Premium",
    tierRaw: "Premium",
    highEur: 2040,
    medEur: 2180,
    lowEur: 2120,
    annualEur: 2122,
    url: "",
  },
  {
    name: "Hotel Royal | Evian Resort",
    location: "France",
    country: "France",
    stars: 5,
    rooms: 150,
    tier: "Luxury",
    tierRaw: "Luxury",
    highEur: 2900,
    medEur: 2780,
    lowEur: 2780,
    annualEur: 2800,
    url: "",
  },
  {
    name: "Grand Hotel du Cap-Ferrat",
    location: "France",
    country: "France",
    stars: 5,
    rooms: 8,
    tier: "Basic",
    tierRaw: "Basic",
    highEur: 2800,
    medEur: 2800,
    lowEur: 1700,
    annualEur: 2158,
    url: "https://www.fourseasons.com/capferrat/",
  },
  {
    name: "Grand Hotel du Cap-Ferrat",
    location: "France",
    country: "France",
    stars: 5,
    rooms: 8,
    tier: "Premium",
    tierRaw: "Premium",
    highEur: 4180,
    medEur: 4180,
    lowEur: 3530,
    annualEur: 3801,
    url: "",
  },
  {
    name: "Grand Hotel du Cap-Ferrat",
    location: "France",
    country: "France",
    stars: 5,
    rooms: 8,
    tier: "Luxury",
    tierRaw: "Luxury",
    highEur: 9660,
    medEur: 9660,
    lowEur: 8045,
    annualEur: 8718,
    url: "",
  },
  {
    name: "Grand Hotel du Cap-Ferrat",
    location: "France",
    country: "France",
    stars: 5,
    rooms: 8,
    tier: "Villa",
    tierRaw: "Villa",
    highEur: 13800,
    medEur: 13800,
    lowEur: 10970,
    annualEur: 12149,
    url: "",
  },
  {
    name: "Cap d'Antibes Beach Hotel",
    location: "France",
    country: "France",
    stars: 5,
    rooms: 46,
    tier: "Basic",
    tierRaw: "Basic",
    highEur: 1700,
    medEur: 820,
    lowEur: 442,
    annualEur: 746,
    url: "",
  },
  {
    name: "Cap d'Antibes Beach Hotel",
    location: "France",
    country: "France",
    stars: 5,
    rooms: 46,
    tier: "Premium",
    tierRaw: "Premium",
    highEur: 2500,
    medEur: 1270,
    lowEur: 586,
    annualEur: 1076,
    url: "",
  },
  {
    name: "Cap d'Antibes Beach Hotel",
    location: "France",
    country: "France",
    stars: 5,
    rooms: 46,
    tier: "Luxury",
    tierRaw: "Luxury",
    highEur: 3400,
    medEur: 1600,
    lowEur: 910,
    annualEur: 1498,
    url: "",
  },
  {
    name: "Tiara Miramar",
    location: "France",
    country: "France",
    stars: 5,
    rooms: 59,
    tier: "Basic",
    tierRaw: "Basic",
    highEur: 742,
    medEur: 742,
    lowEur: 265,
    annualEur: 464,
    url: "",
  },
  {
    name: "Tiara Miramar",
    location: "France",
    country: "France",
    stars: 5,
    rooms: 59,
    tier: "Premium",
    tierRaw: "Premium",
    highEur: 823,
    medEur: 823,
    lowEur: 453,
    annualEur: 607,
    url: "",
  },
  {
    name: "Tiara Miramar",
    location: "France",
    country: "France",
    stars: 5,
    rooms: 59,
    tier: "Luxury",
    tierRaw: "Luxury",
    highEur: 1816,
    medEur: 1672,
    lowEur: 1069,
    annualEur: 1344,
    url: "",
  },
  {
    name: "Teranka",
    location: "Spain",
    country: "Spain",
    stars: 5,
    rooms: 35,
    tier: "Basic",
    tierRaw: "Basic",
    highEur: 1400,
    medEur: 810,
    lowEur: 690,
    annualEur: 838,
    url: "",
  },
  {
    name: "Teranka",
    location: "Spain",
    country: "Spain",
    stars: 5,
    rooms: 35,
    tier: "Premium",
    tierRaw: "Premium",
    highEur: 1750,
    medEur: 1160,
    lowEur: 1040,
    annualEur: 1188,
    url: "",
  },
  {
    name: "Teranka",
    location: "Spain",
    country: "Spain",
    stars: 5,
    rooms: 35,
    tier: "Luxury",
    tierRaw: "Luxury",
    highEur: 1950,
    medEur: 1360,
    lowEur: 1240,
    annualEur: 1388,
    url: "",
  },
  {
    name: "Teranka",
    location: "Spain",
    country: "Spain",
    stars: 5,
    rooms: 35,
    tier: "Villa",
    tierRaw: "Villa",
    highEur: 2650,
    medEur: 2060,
    lowEur: 1940,
    annualEur: 2088,
    url: "",
  },
  {
    name: "Es Racó d'arta",
    location: "Spain",
    country: "Spain",
    stars: 5,
    rooms: 31,
    tier: "Basic",
    tierRaw: "Basic",
    highEur: 775,
    medEur: 696,
    lowEur: 550,
    annualEur: 624,
    url: "",
  },
  {
    name: "Es Racó d'arta",
    location: "Spain",
    country: "Spain",
    stars: 5,
    rooms: 31,
    tier: "Premium",
    tierRaw: "Premium",
    highEur: 900,
    medEur: 837,
    lowEur: 693,
    annualEur: 764,
    url: "",
  },
  {
    name: "Es Racó d'arta",
    location: "Spain",
    country: "Spain",
    stars: 5,
    rooms: 31,
    tier: "Luxury",
    tierRaw: "Luxury",
    highEur: 1395,
    medEur: 1242,
    lowEur: 837,
    annualEur: 1031,
    url: "",
  },
  {
    name: "Es Racó d'arta",
    location: "Spain",
    country: "Spain",
    stars: 5,
    rooms: 31,
    tier: "Villa",
    tierRaw: "Villa",
    highEur: 2030,
    medEur: 1913,
    lowEur: 1400,
    annualEur: 1633,
    url: "",
  },
  {
    name: "Eco hotel el agua",
    location: "Spain",
    country: "Spain",
    stars: 5,
    rooms: 21,
    tier: "Villa",
    tierRaw: "Villa",
    highEur: 1960,
    medEur: 1860,
    lowEur: 1860,
    annualEur: 1877,
    url: "",
  },
  {
    name: "Quinta da Comporta",
    location: "Portugal",
    country: "Portugal",
    stars: 5,
    rooms: 22,
    tier: "Basic",
    tierRaw: "Basic",
    highEur: 887,
    medEur: 660,
    lowEur: 604,
    annualEur: 665,
    url: "",
  },
  {
    name: "Quinta da Comporta",
    location: "Portugal",
    country: "Portugal",
    stars: 5,
    rooms: 22,
    tier: "Premium",
    tierRaw: "Premium",
    highEur: 1020,
    medEur: 696,
    lowEur: 575,
    annualEur: 679,
    url: "",
  },
  {
    name: "Quinta da Comporta",
    location: "Portugal",
    country: "Portugal",
    stars: 5,
    rooms: 22,
    tier: "Luxury",
    tierRaw: "Luxury",
    highEur: 1240,
    medEur: 875,
    lowEur: 604,
    annualEur: 778,
    url: "",
  },
  {
    name: "Quinta da Comporta",
    location: "Portugal",
    country: "Portugal",
    stars: 5,
    rooms: 22,
    tier: "Villa",
    tierRaw: "Villa",
    highEur: 2700,
    medEur: 2500,
    lowEur: 1890,
    annualEur: 2178,
    url: "",
  },
  {
    name: "Azulik",
    location: "Mexico",
    country: "Mexico",
    stars: 5,
    rooms: 44,
    tier: "Villa",
    tierRaw: "Villa Basic",
    highEur: 412,
    medEur: 366,
    lowEur: 275,
    annualEur: 321,
    url: "",
  },
  {
    name: "Azulik",
    location: "Mexico",
    country: "Mexico",
    stars: 5,
    rooms: 44,
    tier: "Villa",
    tierRaw: "Villa Premium",
    highEur: 915,
    medEur: 549,
    lowEur: 389,
    annualEur: 516,
    url: "",
  },
  {
    name: "Azulik",
    location: "Mexico",
    country: "Mexico",
    stars: 5,
    rooms: 44,
    tier: "Villa",
    tierRaw: "Villa Luxury",
    highEur: 3279,
    medEur: 3279,
    lowEur: 3279,
    annualEur: 3279,
    url: "",
  },
  {
    name: "Nomade",
    location: "Mexico",
    country: "Mexico",
    stars: 5,
    rooms: 86,
    tier: "Basic",
    tierRaw: "Basic",
    highEur: 377,
    medEur: 267,
    lowEur: 253,
    annualEur: 277,
    url: "",
  },
  {
    name: "Nomade",
    location: "Mexico",
    country: "Mexico",
    stars: 5,
    rooms: 86,
    tier: "Premium",
    tierRaw: "Premium",
    highEur: 732,
    medEur: 621,
    lowEur: 608,
    annualEur: 632,
    url: "",
  },
  {
    name: "Nomade",
    location: "Mexico",
    country: "Mexico",
    stars: 5,
    rooms: 86,
    tier: "Luxury",
    tierRaw: "Luxury",
    highEur: 1087,
    medEur: 976,
    lowEur: 963,
    annualEur: 987,
    url: "",
  },
  {
    name: "Fogo Island Inn",
    location: "Iceland",
    country: "Iceland",
    stars: 5,
    rooms: 29,
    tier: "Basic",
    tierRaw: "Basic",
    highEur: 2408,
    medEur: 1834,
    lowEur: 1834,
    annualEur: 1930,
    url: "",
  },
  {
    name: "Fogo Island Inn",
    location: "Iceland",
    country: "Iceland",
    stars: 5,
    rooms: 29,
    tier: "Premium",
    tierRaw: "Premium",
    highEur: 2982,
    medEur: 2727,
    lowEur: 2599,
    annualEur: 2695,
    url: "",
  },
  {
    name: "Fogo Island Inn",
    location: "Iceland",
    country: "Iceland",
    stars: 5,
    rooms: 29,
    tier: "Luxury",
    tierRaw: "Luxury",
    highEur: 3747,
    medEur: 3365,
    lowEur: 3365,
    annualEur: 3429,
    url: "",
  },
  {
    name: "Fogo Island Inn",
    location: "Iceland",
    country: "Iceland",
    stars: 5,
    rooms: 29,
    tier: "Villa",
    tierRaw: "Villa",
    highEur: 5023,
    medEur: 4513,
    lowEur: 4513,
    annualEur: 4598,
    url: "",
  },
  {
    name: "Inkaterra",
    location: "Peru",
    country: "Peru",
    stars: 5,
    rooms: 85,
    tier: "Basic",
    tierRaw: "Basic",
    highEur: 438,
    medEur: 438,
    lowEur: 423,
    annualEur: 429,
    url: "",
  },
  {
    name: "Inkaterra",
    location: "Peru",
    country: "Peru",
    stars: 5,
    rooms: 85,
    tier: "Premium",
    tierRaw: "Premium",
    highEur: 524,
    medEur: 524,
    lowEur: 505,
    annualEur: 513,
    url: "",
  },
  {
    name: "Inkaterra",
    location: "Peru",
    country: "Peru",
    stars: 5,
    rooms: 85,
    tier: "Luxury",
    tierRaw: "Luxury",
    highEur: 829,
    medEur: 829,
    lowEur: 800,
    annualEur: 812,
    url: "",
  },
];
// ── Per-hotel helpers (used by MarketComparablesDrawer) ──

export type ComparableCountryFilter = "Greek" | "International" | "All";

export function filterPerHotel(
  arr: PerHotelComparable[],
  countryFilter: ComparableCountryFilter,
): PerHotelComparable[] {
  if (countryFilter === "All") return arr;
  if (countryFilter === "Greek") return arr.filter((e) => e.country === "Greece");
  return arr.filter((e) => e.country !== "Greece");
}

export function filterPerHotelByTier(
  arr: PerHotelComparable[],
  tier: PerHotelComparable["tier"],
): PerHotelComparable[] {
  return arr.filter((e) => e.tier === tier);
}

// Sum/mean ignoring nulls. Used by the drawer's blend recomputation and by
// the headline-validation test (Greek-only Basic mean should ≈ MARKET_2025_BACKSTOP.basicRoom).
export function mean(values: Array<number | null>): number | null {
  const cleaned = values.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  if (cleaned.length === 0) return null;
  return cleaned.reduce((s, v) => s + v, 0) / cleaned.length;
}

// Recompute the Greek-only HIGH / MED mean + 50/50 blend from MARKET_2025_PER_HOTEL.
// The headline strip and the MARKET_2025_BACKSTOP table are the canonical source —
// this helper exists to (a) let the drawer footnote the recomputed values for
// transparency and (b) gate the financial-accuracy test that the per-hotel array
// faithfully reconstructs the Basic / Luxury backstops.
//
// Premium tier is a known mild discrepancy: the source CSV's pre-computed
// PREMIUM row 88 average inconsistently included Rooster Antiparos's "Villa
// Premium" entries, while BASIC row 87 excluded "Villa Basic". The per-hotel
// schema is consistent (Villa-prefixed → tier='Villa'), so the recomputed
// Premium mean lands ~2.5% below the published average. We accept that as the
// price of a consistent schema and document it here. The headline number still
// reads from MARKET_2025_BACKSTOP for source-of-truth fidelity.
export function recomputeGreekTierBlend(
  tier: PerHotelComparable["tier"],
  source: PerHotelComparable[] = MARKET_2025_PER_HOTEL,
): { high: number | null; med: number | null; blend: number | null; n: number } {
  const rows = filterPerHotelByTier(filterPerHotel(source, "Greek"), tier);
  const high = mean(rows.map((r) => r.highEur));
  const med = mean(rows.map((r) => r.medEur));
  const n = rows.length;
  let blend: number | null = null;
  if (high !== null && med !== null) blend = (high + med) / 2;
  else if (high !== null) blend = high;
  else if (med !== null) blend = med;
  return { high, med, blend, n };
}

// MARKET_2025_PER_HOTEL grouped by hotel (name + location). Each hotel can
// have multiple tier rows. Used by the drawer when grouping/expanding by hotel.
export type HotelComparableGroup = {
  name: string;
  location: string;
  country: string;
  stars: 4 | 5 | null;
  rooms: number | null;
  tiers: PerHotelComparable[];
};

export function groupPerHotelByListing(
  arr: PerHotelComparable[] = MARKET_2025_PER_HOTEL,
): HotelComparableGroup[] {
  const map = new Map<string, HotelComparableGroup>();
  for (const e of arr) {
    const key = `${e.name}::${e.location}`;
    const g = map.get(key);
    if (g) {
      g.tiers.push(e);
    } else {
      map.set(key, {
        name: e.name,
        location: e.location,
        country: e.country,
        stars: e.stars,
        rooms: e.rooms,
        tiers: [e],
      });
    }
  }
  return Array.from(map.values());
}

// Total comparable-rows count exposed for the "See the N comparables" CTA.
// Counts (hotel, tier) entries, not distinct hotels, because the drawer shows
// each tier on its own row.
export function comparableCount(
  arr: PerHotelComparable[] = MARKET_2025_PER_HOTEL,
  filter: ComparableCountryFilter = "All",
): number {
  return filterPerHotel(arr, filter).length;
}

// Distinct-hotel count (used for "23 Greek + 18 international" copy verification).
export function distinctHotelCount(
  arr: PerHotelComparable[] = MARKET_2025_PER_HOTEL,
  filter: ComparableCountryFilter = "All",
): number {
  return groupPerHotelByListing(filterPerHotel(arr, filter)).length;
}

// ── Hotel URL map (drawer hyperlinks) ───────────────────────────
//
// Curated mapping from hotel name → canonical landing URL. Used by
// MarketComparablesDrawer to turn the hotel name into a clickable link.
//
// Priority per hotel:
//   1. Hotel's own website (preferred — direct booking, no OTA markup)
//   2. booking.com property page (fallback for known-good properties)
//   3. Omitted entirely (falls through to booking.com SEARCH at render
//      time via `urlOrBookingFallback`)
//
// Three properties are intentionally booking.com-only because their direct
// sites were reachability-broken during the 2026-05-22 capture work:
//   - Lilly Residence    (SSL cert chain broken)
//   - Hotel Senia        (returns server error page)
//   - Kameo Antiparos    (site unreachable)
//
// Keys MUST match the `name` field in MARKET_2025_PER_HOTEL exactly.
// The HOTEL_URLS_ORPHAN_GUARD test in __tests__/marketBenchmarks.test.ts
// enforces this — adding an entry here that doesn't match a known hotel
// will fail CI.
export const HOTEL_URLS: Record<string, string> = {
  // ── Greek (Paros / Antiparos / Mykonos / Santorini) ──
  "Agnanti": "https://www.parosagnanti.com",
  "Andronis": "https://www.andronisarcadia.com", // Santorini property in the CSV
  "Astir of Paros": "https://www.astirofparos.com",
  "Avant Mar": "https://avantmar.com",
  "Cavo Tagoo": "https://www.cavotagoo.com",
  // Cosme: Marriott Luxury Collection slug returned 404 in 2026-05-22
  // validation pass — letting it fall through to booking.com search avoids
  // shipping a broken link until the correct Marriott URL is confirmed.
  // "Cosme": ...stripped — falls through to resolveHotelUrl fallback.

  "Cove": "https://www.coveparos.com",
  "Hotel Senia": "https://www.booking.com/hotel/gr/senia.html", // own site broken
  "Iconic": "https://iconicsantorini.com",
  "Kameo Antiparos": "https://www.booking.com/searchresults.html?ss=Kameo+Antiparos", // own site broken
  "Kouros Blanc Resort": "https://www.kourosvillage.gr",
  "Lilly Residence": "https://www.booking.com/hotel/gr/lilly-residence.html", // own site SSL broken
  "Mythic Paros": "https://www.mythicparos.com",
  "Nomad": "https://nomadmykonos.com",
  "Omna Caldera": "https://www.omnacaldera.com",
  "Parilio": "https://www.pariliohotelparos.com",
  "Parocks": "https://parocks.com",
  // Santa Marina (Marriott): same Marriott URL pattern returned 404. Stripped.
  // "Santa Marina (Marriott)": ...stripped — falls through to booking.com search.

  "Summer Senses Luxury Resort": "https://www.summersenses.com",
  "The Beach House": "https://thebeachhouseantiparos.com",
  "The Rooster Antiparos": "https://theroosterantiparos.com",
  "Yria Boutique Hotel": "https://www.yriahotel.gr",
  // ── International ──
  "Azulik": "https://www.azulik.com",
  "Belmond Romazzino": "https://www.belmond.com/hotels/europe/italy/sardinia/belmond-hotel-romazzino/",
  "Cap d'Antibes Beach Hotel": "https://www.ca-beachhotel.com",
  "Cape of Senses": "https://www.capeofsenses.com",
  "Es Racó d'arta": "https://www.esracodarta.com",
  "Fogo Island Inn": "https://fogoislandinn.ca",
  "Grand Hotel du Cap-Ferrat": "https://www.fourseasons.com/capferrat/",
  "Hotel Royal | Evian Resort": "https://www.evianresort.com",
  "Inkaterra": "https://www.inkaterra.com",
  "Lefay": "https://www.lefayresorts.com",
  "Lily of the Valley": "https://www.lilyofthevalley.com",
  "Nomade": "https://nomadehotels.com",
  "Quinta da Comporta": "https://www.quintadacomporta.com",
  "Royal Mansour Tamuda Bay": "https://www.royalmansour.com/en/tamuda-bay",
  "Teranka": "https://terankaformentera.com",
  "The Oberoi": "https://www.oberoihotels.com/hotels-in-marrakech/",
  "Tiara Miramar": "https://www.tiara-hotels.com/en/miramar-beach",
  // ── Intentionally omitted (no reliably resolvable URL) ──
  //   - "Eco hotel el agua" (Spain) — no canonical site found; drawer falls
  //     through to booking.com search.
};

// Hotels whose own site is broken; the drawer should NOT show a direct-site
// chip even when one is provided via HOTEL_URLS — these go straight to OTA.
// Kept as a separate const so the orphan-guard test can assert the matching
// values in HOTEL_URLS are booking.com URLs (not direct sites).
export const HOTELS_DIRECT_SITE_BROKEN: ReadonlySet<string> = new Set([
  "Lilly Residence",
  "Hotel Senia",
  "Kameo Antiparos",
]);

// Resolver used by the drawer. Falls back to booking.com search when no
// curated URL exists, preserving the existing fallback contract.
export function resolveHotelUrl(name: string, fallbackSearch?: string): string {
  const curated = HOTEL_URLS[name];
  if (curated) return curated;
  return fallbackSearch ?? `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(name)}`;
}
