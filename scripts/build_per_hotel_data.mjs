// Parse /tmp/hotel_market_study.csv → emit MARKET_2025_PER_HOTEL TS literal.
// Run via: node scripts/build_per_hotel_data.mjs > /tmp/per_hotel.ts.frag
//
// CSV structure: rows 7-86 = Greek section (one new hotel when col[1] has a
// star rating); rows 100-108 = Greek addenda; rows 134-194 = International;
// rows 208+ = International addenda. Summary rows (87-95, 195-205) skipped
// by detection (col[0] = 'AVERAGE' / 'AVG ...').
//
// Each hotel emits one row per priced tier (Basic, Premium, Luxury, Apartments,
// Villa). The first sub-row carries the hotel metadata; subsequent rows
// carry only `tier` + prices.

import fs from "node:fs";
import path from "node:path";

const CSV = "/tmp/hotel_market_study.csv";

function parseCsvLine(line) {
  const out = [];
  let cur = "";
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { inQuote = !inQuote; continue; }
    if (c === "," && !inQuote) { out.push(cur); cur = ""; continue; }
    cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function parseEur(s) {
  if (!s) return null;
  const cleaned = s.replace(/[€,\s]/g, "").trim();
  if (cleaned === "" || cleaned === "#REF!" || cleaned === "#ERROR!") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function urlSlug(name) {
  // Mark known-broken URLs (from 2026 capture work-log) so the drawer
  // strips them. Otherwise return the booking.com property page guess.
  const broken = new Set([
    "Lilly Residence",
    "Hotel Senia",
    "Kameo Antiparos",
  ]);
  return broken.has(name) ? null : null; // No URLs in CSV per-row; drawer can lookup separately
}

const raw = fs.readFileSync(CSV, "utf8").split("\n");
const lines = raw.map((l, i) => ({ i: i + 1, cells: parseCsvLine(l) }));

let section = null; // "Greece" | "International"
let current = null; // current hotel metadata
const out = [];

for (const { i, cells } of lines) {
  const txt = cells.join(",");
  if (txt.includes("GREEK ISLANDS COMPARABLE HOTELS")) { section = "Greece"; continue; }
  if (txt.includes("OTHER COUNTRIES COMPARABLE LUXURY")) { section = "International"; continue; }
  if (!section) continue;
  // Skip the villa-only appendix table at the bottom of the CSV — these rows
  // re-list villas of properties already parsed above (e.g. "Parilio Villa (7
  // adults)", "Cavo Tagoo Villa (13 adults)", "Azulik Villa Luxury (2
  // adults)") and are NOT new hotels. Detect by the parenthetical adult-count
  // suffix anywhere in the tier column.
  if (/\(\s*\d+\s*adults?\s*\)/i.test(cells[5] || "")) continue;

  // Skip summary / "AVERAGE" rows
  const col1 = cells[1] || "";
  const col2 = cells[2] || "";
  if (col1.startsWith("AVERAGE") || col1.startsWith("AVG ")) continue;

  // New-hotel row: col[1] is a single digit (stars). Continuation row: col[1] empty.
  const stars = parseInt(col1, 10);
  if (Number.isFinite(stars) && (stars === 4 || stars === 5)) {
    // Start a new hotel
    current = {
      name: cells[2],
      location: cells[3],
      rooms: cells[4] && cells[4] !== "na" ? parseInt(cells[4], 10) || null : null,
      stars,
      country: section === "Greece" ? "Greece" : (cells[3] || "Unknown"),
      url: cells[10] || null,
    };
    // Fall through to also parse this row's tier
  }
  if (!current) continue;

  // Parse tier row
  const tier = cells[5];
  if (!tier) continue;
  const high = parseEur(cells[6]);
  const med = parseEur(cells[7]);
  const low = parseEur(cells[8]);
  const annual = parseEur(cells[9]);
  if (high === null && med === null && low === null && annual === null) continue;

  out.push({
    name: current.name,
    country: current.country,
    location: current.location,
    stars: current.stars,
    rooms: current.rooms,
    tier: tier.replace(/^\s+|\s+$/g, ""),
    highEur: high,
    medEur: med,
    lowEur: low,
    annualEur: annual,
    url: current.url || null,
    sourceRow: i,
  });
}

// Emit TS literal
console.log("// AUTO-GENERATED from /tmp/hotel_market_study.csv via");
console.log("// scripts/build_per_hotel_data.mjs. Do not hand-edit; re-run the script.");
console.log("// Each row = one (hotel × tier) cell from the 2025 Greek Islands Hotel");
console.log("// Market Study. Greece + International sections preserved; broken");
console.log("// summary rows (#REF! etc.) intentionally excluded.");
console.log("export const MARKET_2025_PER_HOTEL: PerHotelComparable[] = [");
for (const r of out) {
  const fields = [
    `name: ${JSON.stringify(r.name)}`,
    `country: ${JSON.stringify(r.country)}`,
    `location: ${JSON.stringify(r.location)}`,
    `stars: ${r.stars}`,
    `rooms: ${r.rooms === null ? "null" : r.rooms}`,
    `tier: ${JSON.stringify(r.tier)}`,
    `highEur: ${r.highEur === null ? "null" : r.highEur}`,
    `medEur: ${r.medEur === null ? "null" : r.medEur}`,
    `lowEur: ${r.lowEur === null ? "null" : r.lowEur}`,
    `annualEur: ${r.annualEur === null ? "null" : r.annualEur}`,
  ];
  console.log(`  { ${fields.join(", ")} },`);
}
console.log("];");

// Validation sanity check — print counts
console.error(`\n# Wrote ${out.length} (hotel × tier) rows.`);
const greekHotels = new Set(out.filter((r) => r.country === "Greece").map((r) => r.name));
const intlHotels = new Set(out.filter((r) => r.country !== "Greece").map((r) => r.name));
console.error(`# Greek hotels: ${greekHotels.size} (expected ~23+3 addenda = 26)`);
console.error(`# International hotels: ${intlHotels.size} (expected ~18+ addenda)`);

// Cross-check: re-compute Greek Basic average HIGH and compare to backstop 993
const greekBasicHigh = out.filter((r) => r.country === "Greece" && r.tier === "Basic" && r.highEur !== null);
const meanHigh = greekBasicHigh.reduce((s, r) => s + r.highEur, 0) / greekBasicHigh.length;
console.error(`# Greek Basic HIGH mean: ${meanHigh.toFixed(0)} (CSV cell 87 says 993; small drift OK if addenda are mixed in)`);
const greekBasicMed = out.filter((r) => r.country === "Greece" && r.tier === "Basic" && r.medEur !== null);
const meanMed = greekBasicMed.reduce((s, r) => s + r.medEur, 0) / greekBasicMed.length;
console.error(`# Greek Basic MED mean: ${meanMed.toFixed(0)} (CSV cell 87 says 699)`);
