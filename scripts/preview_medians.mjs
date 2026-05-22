// One-off preview: compute medians from the captured market benchmarks.
import {
  MARKET_BENCHMARKS_2026,
  tierMedian,
  operationalSeasonBlend,
  captureCoverage,
  computeMarketPosition,
} from "../src/lib/data/marketBenchmarks.ts";

console.log("CAPTURE COVERAGE:", captureCoverage(MARKET_BENCHMARKS_2026));
console.log();
console.log("DOUBLE ROOM medians:");
console.log("  HIGH:", tierMedian(MARKET_BENCHMARKS_2026, "doubleRoom", "HIGH"));
console.log("  MED: ", tierMedian(MARKET_BENCHMARKS_2026, "doubleRoom", "MED"));
console.log("  Operational-season blend:", operationalSeasonBlend(MARKET_BENCHMARKS_2026, "doubleRoom"));
console.log();
console.log("PREMIUM SUITE medians:");
console.log("  HIGH:", tierMedian(MARKET_BENCHMARKS_2026, "premiumSuite", "HIGH"));
console.log("  MED: ", tierMedian(MARKET_BENCHMARKS_2026, "premiumSuite", "MED"));
console.log("  Operational-season blend:", operationalSeasonBlend(MARKET_BENCHMARKS_2026, "premiumSuite"));
console.log();
console.log("MARKET POSITION (BP 650 / 920):");
const pos = computeMarketPosition({ suiteStandardADR: 650, suiteDoubleADR: 920 }, MARKET_BENCHMARKS_2026);
console.log(JSON.stringify(pos, null, 2));
