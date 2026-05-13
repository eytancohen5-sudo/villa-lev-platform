// Snapshot of the current single-villa operation pulled from the live ops
// dashboard at https://admin.villalevantiparos.com/dashboard.
// Pulled: 2026-05-14. Replace with a live fetch once the ops app exposes an
// authenticated read endpoint — the shape of `currentSeason` and
// `historicalYears` is the contract the comparative dashboard depends on.

export type SeasonActuals = {
  year: number;
  status: "in-progress" | "complete";
  villas: number;
  // Season window: 15 May → 15 Sept, 120 available nights.
  availableNights: number;
  bookedNights: number;
  confirmedBookings: number;
  occupancy: number; // 0..1
  grossADR: number;
  netADR: number;
  rentalGross: number;
  commissions: number; // signed negative magnitude on the live app; stored positive here
  rentalNet: number;
  services: {
    chef: number;
    boat: number;
    car: number;
    quad: number;
    other: number;
    total: number;
  };
  events: number;
  totalRevenueNet: number;
  cash: {
    received: number;
    outstanding: number;
    depositsHeld: number;
  };
  platformMix: { name: string; revenue: number; bookings: number }[];
  monthlyRevenue: { month: string; revenue: number }[];
};

export type HistoricalYear = {
  year: number;
  rental: number;
  services: number;
  total: number;
  yoy: number | null; // 0..1, null for first year
};

export const currentSeason: SeasonActuals = {
  year: 2026,
  status: "in-progress",
  villas: 1,
  availableNights: 120,
  bookedNights: 95,
  confirmedBookings: 10,
  occupancy: 95 / 120,
  grossADR: 4091,
  netADR: 3584,
  rentalGross: 388_632, // gross revenue 422,732 − services 34,100
  commissions: 48_165,
  rentalNet: 340_467,
  services: {
    chef: 22_600,
    boat: 6_700,
    quad: 1_800,
    car: 1_200,
    other: 1_800,
    total: 34_100,
  },
  events: 0,
  totalRevenueNet: 374_567,
  cash: {
    received: 155_730,
    outstanding: 218_837,
    depositsHeld: 15_000,
  },
  platformMix: [
    { name: "Direct", revenue: 121_100, bookings: 4 },
    { name: "Airbnb", revenue: 116_047, bookings: 4 },
    { name: "Le Collectionist", revenue: 97_440, bookings: 1 },
    { name: "Greek Villas Boutique", revenue: 26_880, bookings: 1 },
  ],
  monthlyRevenue: [
    { month: "May", revenue: 26_618 },
    { month: "Jun", revenue: 44_617 },
    { month: "Jul", revenue: 129_440 },
    { month: "Aug", revenue: 154_792 },
    { month: "Sep", revenue: 0 },
  ],
};

export const historicalYears: HistoricalYear[] = [
  { year: 2022, rental: 116_000, services: 0, total: 116_000, yoy: null },
  { year: 2023, rental: 177_000, services: 10_000, total: 187_000, yoy: 0.612 },
  { year: 2024, rental: 185_143, services: 20_165, total: 205_308, yoy: 0.098 },
  { year: 2025, rental: 277_853, services: 76_717, total: 354_570, yoy: 0.727 },
  { year: 2026, rental: 340_467, services: 34_100, total: 374_567, yoy: 0.056 },
];

// 2025 is the most recently completed full season — preferred baseline for
// "Current Villa Lev" comparisons against the stabilised future portfolio.
export const lastCompletedSeason = historicalYears.find((y) => y.year === 2025)!;

export const ACTUALS_SOURCE = {
  url: "https://admin.villalevantiparos.com/dashboard",
  pulledAt: "2026-05-14",
} as const;
