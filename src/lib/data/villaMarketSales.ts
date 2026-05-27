// Villa sale market & rental comparables — Paros + Antiparos, 2025-2026 study.
//
// Two datasets:
//   1. SALE_COMPARABLES  — property transactions (price/m²). Supports the
//      collateral valuation at €9,000/m² in the engine: market average across
//      both islands is ~€9,784/m² (all sizes) and ~€11,178/m² (Antiparos only).
//      The engine's €9,000 market tier is conservative.
//
//   2. RENTAL_COMPARABLES — nightly rates from Le Collectionist + Kinglike
//      (luxury villa platforms). Validates the BP villa ADR of €3,500/night.
//      Market avg for comparable Paros villas: ~€2,593 shoulder / €4,179 peak;
//      Antiparos commands a further premium for exclusivity.
//
// Source: VillaLevGroup market research, 2025-2026. Referenced in bank
// submission under Collateral Evidence and Revenue Assumptions.

export type VillaSaleComparable = {
  id: number;
  island: "Antiparos" | "Paros";
  area: string;
  houseSqm: number;
  plotSqm: number;
  bedrooms: number;
  priceEur: number;
  pricePerSqm: number;
  seaView: boolean;
  plotCategory: "large" | "small";
};

export type VillaRentalComparable = {
  name: string;
  island: "Antiparos" | "Paros";
  sizeSqm: number;
  bedrooms: number;
  maxGuests: number;
  shoulderEurPerNight: number;
  peakEurPerNight: number;
  shoulderNetEurPerNight: number;
  peakNetEurPerNight: number;
  platform: "Le Collectionist" | "Kinglike";
  seaView: boolean;
};

// ── Property Sale Comparables ──────────────────────────────────────────────
// Big plots (4,000–8,000+ m²): 20 properties. Avg: 544 m² / 9,122 €/m².
// Small plots (<2,000 m²):      9 properties. Avg: 272 m² / 10,446 €/m².
// Combined average: 9,784 €/m² (all) / ~11,178 €/m² (Antiparos only).
export const VILLA_SALE_COMPARABLES: VillaSaleComparable[] = [
  // ── Big plots ──
  { id: 1,  island: "Antiparos", area: "Makria Miti",   houseSqm: 345, plotSqm:  5900, bedrooms:  6, priceEur: 5_000_000, pricePerSqm: 14493, seaView: true,  plotCategory: "large" },
  { id: 2,  island: "Antiparos", area: "Antiparos",     houseSqm: 583, plotSqm:  4590, bedrooms:  8, priceEur: 6_700_000, pricePerSqm: 11492, seaView: true,  plotCategory: "large" },
  { id: 3,  island: "Paros",     area: "Makria Miti",   houseSqm: 546, plotSqm: 12000, bedrooms:  6, priceEur: 4_500_000, pricePerSqm:  8242, seaView: true,  plotCategory: "large" },
  { id: 4,  island: "Antiparos", area: "Antiparos Town",houseSqm: 531, plotSqm:  4500, bedrooms: 13, priceEur: 4_000_000, pricePerSqm:  7533, seaView: true,  plotCategory: "large" },
  { id: 5,  island: "Paros",     area: "Glysidia",      houseSqm: 506, plotSqm:  4815, bedrooms:  5, priceEur: 2_500_000, pricePerSqm:  4941, seaView: true,  plotCategory: "large" },
  { id: 6,  island: "Antiparos", area: "Soros",         houseSqm: 651, plotSqm:  4013, bedrooms:  8, priceEur: 6_400_000, pricePerSqm:  9831, seaView: true,  plotCategory: "large" },
  { id: 7,  island: "Antiparos", area: "Antiparos",     houseSqm: 720, plotSqm:  4100, bedrooms:  9, priceEur: 6_000_000, pricePerSqm:  8333, seaView: true,  plotCategory: "large" },
  { id: 8,  island: "Antiparos", area: "Antiparos",     houseSqm: 545, plotSqm:  5608, bedrooms:  6, priceEur: 5_200_000, pricePerSqm:  9541, seaView: true,  plotCategory: "large" },
  { id: 9,  island: "Paros",     area: "Santa Maria",   houseSqm: 800, plotSqm:  8296, bedrooms: 14, priceEur: 7_600_000, pricePerSqm:  9500, seaView: true,  plotCategory: "large" },
  { id: 10, island: "Paros",     area: "Naousa",        houseSqm: 550, plotSqm: 13718, bedrooms:  6, priceEur: 5_500_000, pricePerSqm: 10000, seaView: true,  plotCategory: "large" },
  { id: 11, island: "Paros",     area: "Drios",         houseSqm: 465, plotSqm:  4006, bedrooms:  7, priceEur: 4_700_000, pricePerSqm: 10108, seaView: true,  plotCategory: "large" },
  { id: 12, island: "Paros",     area: "Makria Miti",   houseSqm: 545, plotSqm: 12020, bedrooms:  6, priceEur: 4_500_000, pricePerSqm:  8257, seaView: true,  plotCategory: "large" },
  { id: 13, island: "Paros",     area: "Agkeria",       houseSqm: 717, plotSqm:  8012, bedrooms:  9, priceEur: 4_250_000, pricePerSqm:  5927, seaView: true,  plotCategory: "large" },
  { id: 14, island: "Paros",     area: "Glysidia",      houseSqm: 507, plotSqm:  4815, bedrooms:  5, priceEur: 2_500_000, pricePerSqm:  4931, seaView: true,  plotCategory: "large" },
  { id: 15, island: "Paros",     area: "Krotiri",       houseSqm: 425, plotSqm:  4170, bedrooms:  4, priceEur: 3_000_000, pricePerSqm:  7059, seaView: false, plotCategory: "large" },
  { id: 16, island: "Antiparos", area: "Antiparos",     houseSqm: 551, plotSqm:  4013, bedrooms:  5, priceEur: 6_400_000, pricePerSqm: 11615, seaView: true,  plotCategory: "large" },
  { id: 17, island: "Antiparos", area: "Antiparos",     houseSqm: 542, plotSqm:  4018, bedrooms:  5, priceEur: 6_150_000, pricePerSqm: 11347, seaView: true,  plotCategory: "large" },
  { id: 18, island: "Antiparos", area: "Antiparos",     houseSqm: 518, plotSqm:  4018, bedrooms:  6, priceEur: 5_900_000, pricePerSqm: 11390, seaView: true,  plotCategory: "large" },
  { id: 19, island: "Antiparos", area: "Antiparos",     houseSqm: 528, plotSqm:  8323, bedrooms:  5, priceEur: 3_900_000, pricePerSqm:  7386, seaView: true,  plotCategory: "large" },
  { id: 20, island: "Antiparos", area: "Antiparos",     houseSqm: 300, plotSqm:  7830, bedrooms:  4, priceEur: 4_500_000, pricePerSqm: 15000, seaView: true,  plotCategory: "large" },
  // ── Small plots ──
  { id: 21, island: "Antiparos", area: "Agios Georgios", houseSqm: 220, plotSqm:  526, bedrooms: 3, priceEur: 2_000_000, pricePerSqm:  9091, seaView: true,  plotCategory: "small" },
  { id: 22, island: "Antiparos", area: "Agios Georgios", houseSqm: 300, plotSqm: 1133, bedrooms: 5, priceEur: 3_000_000, pricePerSqm: 10000, seaView: true,  plotCategory: "small" },
  { id: 23, island: "Antiparos", area: "Agios Georgios", houseSqm: 340, plotSqm: 1012, bedrooms: 6, priceEur: 2_900_000, pricePerSqm:  8529, seaView: true,  plotCategory: "small" },
  { id: 24, island: "Paros",     area: "Glysiadia",      houseSqm: 206, plotSqm: 2065, bedrooms: 3, priceEur: 1_950_000, pricePerSqm:  9466, seaView: true,  plotCategory: "small" },
  { id: 25, island: "Antiparos", area: "Antiparos",      houseSqm: 285, plotSqm: 1050, bedrooms: 6, priceEur: 2_800_000, pricePerSqm:  9825, seaView: false, plotCategory: "small" },
  { id: 26, island: "Paros",     area: "Ampelas",        houseSqm: 320, plotSqm: 3480, bedrooms: 4, priceEur: 3_500_000, pricePerSqm: 10938, seaView: true,  plotCategory: "small" },
  { id: 27, island: "Paros",     area: "Tsoukalia",      houseSqm: 180, plotSqm: 3318, bedrooms: 4, priceEur: 3_000_000, pricePerSqm: 16667, seaView: true,  plotCategory: "small" },
  { id: 28, island: "Paros",     area: "Glysidia",       houseSqm: 300, plotSqm: 2350, bedrooms: 5, priceEur: 2_850_000, pricePerSqm:  9500, seaView: true,  plotCategory: "small" },
  { id: 29, island: "Paros",     area: "Ampelas",        houseSqm: 300, plotSqm: 1540, bedrooms: 5, priceEur: 3_000_000, pricePerSqm: 10000, seaView: true,  plotCategory: "small" },
];

// ── Villa Rental Comparables ───────────────────────────────────────────────
// 20 luxury villas from Le Collectionist + Kinglike (Paros, 2025-2026).
// Avg: 464 m² / 6 beds / €2,593 shoulder / €4,179 peak per night.
// Villa Lev ADR assumption: €3,500/night — in line with / slightly below
// the Paros peak average; Antiparos exclusivity premium expected on top.
export const VILLA_RENTAL_COMPARABLES: VillaRentalComparable[] = [
  { name: "Villa Elega",       island: "Paros", sizeSqm: 474, bedrooms:  6, maxGuests: 12, shoulderEurPerNight:  1821, peakEurPerNight:  4372, shoulderNetEurPerNight: 1457, peakNetEurPerNight: 3498, platform: "Le Collectionist", seaView: true  },
  { name: "Villa Adamante",    island: "Paros", sizeSqm: 600, bedrooms:  7, maxGuests: 14, shoulderEurPerNight:  4531, peakEurPerNight:  5437, shoulderNetEurPerNight: 3625, peakNetEurPerNight: 4350, platform: "Le Collectionist", seaView: true  },
  { name: "Villa Milaya",      island: "Paros", sizeSqm: 380, bedrooms:  4, maxGuests:  8, shoulderEurPerNight:  1636, peakEurPerNight:  2142, shoulderNetEurPerNight: 1309, peakNetEurPerNight: 1714, platform: "Le Collectionist", seaView: true  },
  { name: "Villa Athina",      island: "Paros", sizeSqm: 235, bedrooms:  5, maxGuests: 12, shoulderEurPerNight:  1821, peakEurPerNight:  2404, shoulderNetEurPerNight: 1457, peakNetEurPerNight: 1923, platform: "Le Collectionist", seaView: true  },
  { name: "Villa Cera",        island: "Paros", sizeSqm: 550, bedrooms:  7, maxGuests: 14, shoulderEurPerNight:  1750, peakEurPerNight:  5246, shoulderNetEurPerNight: 1400, peakNetEurPerNight: 4197, platform: "Le Collectionist", seaView: true  },
  { name: "Villa Parosia",     island: "Paros", sizeSqm: 440, bedrooms:  5, maxGuests: 10, shoulderEurPerNight:  1236, peakEurPerNight:  2696, shoulderNetEurPerNight:  989, peakNetEurPerNight: 2157, platform: "Le Collectionist", seaView: true  },
  { name: "Villa Tsiropoules", island: "Paros", sizeSqm: 400, bedrooms:  6, maxGuests: 14, shoulderEurPerNight:  1913, peakEurPerNight:  2486, shoulderNetEurPerNight: 1530, peakNetEurPerNight: 1989, platform: "Le Collectionist", seaView: true  },
  { name: "Villa Niggy",       island: "Paros", sizeSqm: 630, bedrooms:  7, maxGuests: 14, shoulderEurPerNight:  1750, peakEurPerNight:  5537, shoulderNetEurPerNight: 1400, peakNetEurPerNight: 4430, platform: "Le Collectionist", seaView: true  },
  { name: "Villa Kite",        island: "Paros", sizeSqm: 330, bedrooms:  5, maxGuests: 12, shoulderEurPerNight:  1036, peakEurPerNight:  2678, shoulderNetEurPerNight:  829, peakNetEurPerNight: 2142, platform: "Le Collectionist", seaView: true  },
  { name: "Villa Gemmah",      island: "Paros", sizeSqm: 550, bedrooms:  8, maxGuests: 16, shoulderEurPerNight:  3060, peakEurPerNight:  5100, shoulderNetEurPerNight: 2448, peakNetEurPerNight: 4080, platform: "Le Collectionist", seaView: true  },
  { name: "Villa Mitera",      island: "Paros", sizeSqm: 400, bedrooms:  5, maxGuests: 10, shoulderEurPerNight:  2040, peakEurPerNight:  2449, shoulderNetEurPerNight: 1632, peakNetEurPerNight: 1959, platform: "Le Collectionist", seaView: true  },
  { name: "Villa Lya",         island: "Paros", sizeSqm: 900, bedrooms: 13, maxGuests: 26, shoulderEurPerNight: 10893, peakEurPerNight: 13750, shoulderNetEurPerNight: 8714, peakNetEurPerNight: 11000, platform: "Le Collectionist", seaView: true  },
  { name: "Villa Kyros",       island: "Paros", sizeSqm: 450, bedrooms:  7, maxGuests: 14, shoulderEurPerNight:  3643, peakEurPerNight:  5100, shoulderNetEurPerNight: 2914, peakNetEurPerNight: 4080, platform: "Le Collectionist", seaView: true  },
  { name: "Villa Orian",       island: "Paros", sizeSqm: 375, bedrooms:  5, maxGuests: 10, shoulderEurPerNight:  1618, peakEurPerNight:  2017, shoulderNetEurPerNight: 1294, peakNetEurPerNight: 1614, platform: "Le Collectionist", seaView: true  },
  { name: "Villa Myrthe",      island: "Paros", sizeSqm: 400, bedrooms:  5, maxGuests: 10, shoulderEurPerNight:  2315, peakEurPerNight:  3572, shoulderNetEurPerNight: 1852, peakNetEurPerNight: 2858, platform: "Kinglike",          seaView: true  },
  { name: "Villa Ruby",        island: "Paros", sizeSqm: 480, bedrooms:  8, maxGuests: 16, shoulderEurPerNight:  3215, peakEurPerNight:  5000, shoulderNetEurPerNight: 2572, peakNetEurPerNight: 4000, platform: "Kinglike",          seaView: true  },
  { name: "Villa Calise",      island: "Paros", sizeSqm: 250, bedrooms:  4, maxGuests:  8, shoulderEurPerNight:  2054, peakEurPerNight:  3304, shoulderNetEurPerNight: 1643, peakNetEurPerNight: 2643, platform: "Kinglike",          seaView: true  },
  { name: "Villa Lucien",      island: "Paros", sizeSqm: 600, bedrooms:  6, maxGuests: 14, shoulderEurPerNight:  1400, peakEurPerNight:  2500, shoulderNetEurPerNight: 1120, peakNetEurPerNight: 2000, platform: "Kinglike",          seaView: true  },
  { name: "Villa Kenzie",      island: "Paros", sizeSqm: 530, bedrooms:  6, maxGuests: 12, shoulderEurPerNight:  3000, peakEurPerNight:  5143, shoulderNetEurPerNight: 2400, peakNetEurPerNight: 4114, platform: "Kinglike",          seaView: true  },
  { name: "Villa Evane",       island: "Paros", sizeSqm: 297, bedrooms:  6, maxGuests: 12, shoulderEurPerNight:  1136, peakEurPerNight:  2652, shoulderNetEurPerNight:  909, peakNetEurPerNight: 2122, platform: "Le Collectionist", seaView: true  },
];

// ── Summary statistics ─────────────────────────────────────────────────────

export const VILLA_SALE_SUMMARY = {
  allIslands: { count: 29, avgHouseSqm: 474, avgPricePerSqm: 9784 },
  antiparos:  { count: 16, avgHouseSqm: 468, avgPricePerSqm: 10446 },
  paros:      { count: 13, avgHouseSqm: 482, avgPricePerSqm:  8895 },
  largePlots: { count: 20, avgHouseSqm: 544, avgPricePerSqm:  9122 },
  smallPlots: { count:  9, avgHouseSqm: 272, avgPricePerSqm: 10446 },
} as const;

export const VILLA_RENTAL_SUMMARY = {
  count: 20,
  avgSizeSqm: 464,
  avgBedrooms: 6,
  avgShoulderEurPerNight: 2593,
  avgPeakEurPerNight: 4179,
  blendedAvg: 3386,
  avgShoulderNetEurPerNight: 2074,   // round(2593 * 0.80)
  avgPeakNetEurPerNight: 3343,       // round(4179 * 0.80)
  blendedNetAvg: 2709,               // round(3386 * 0.80)
} as const;

// Collateral engine comparison: market data vs engine tiers
export const COLLATERAL_MARKET_CONTEXT = {
  engineMarketTier: 9000,       // €/m² used in the finance engine
  marketAvgAllIslands: 9784,    // €/m² from this study (all 29 properties)
  marketAvgAntiparos: 10446,    // €/m² Antiparos only (our target island)
  engineVsMarketPct: (9000 - 9784) / 9784, // -8.0% conservative vs market
} as const;

// ADR engine comparison: market data vs BP assumption
export const ADR_MARKET_CONTEXT = {
  bpVillaADR: 3500,                  // €/night in BP
  marketBlendedAvg: 3386,            // €/night Paros market avg (shoulder/peak 50/50)
  marketPeakAvg: 4179,               // €/night high season avg
  marketShoulderAvg: 2593,           // €/night shoulder avg
  bpVsBlendedPct: (3500 - 3386) / 3386, // +3.4% vs blended — in line with market
  otaDeductionPct: 0.20,
  marketBlendedNetAvg: 2709,
  marketPeakNetAvg: 3343,
  bpVsNetPeakPct: (3500 - 3343) / 3343,   // +4.7% — BP ADR is above market net peak
} as const;

export const VILLA_MARKET_SOURCE = {
  name: "Villa Lev Group Market Research — Paros / Antiparos",
  collectionPeriod: "2025–2026",
  saleProperties: 29,
  rentalProperties: 20,
  platforms: ["Le Collectionist", "Kinglike"],
  note: "Sale prices: active listings and recent transactions on Paros + Antiparos. Rental rates: peak (Jul–Aug) and shoulder (May–Jun, Sep) per-night whole-villa rates from ultra-luxury rental platforms.",
} as const;
