// Shared financial math utilities.
// Consumers: capTable.ts, founderWaterfall.ts

export function npv(rate: number, cashFlows: number[]): number {
  let total = 0;
  for (let t = 0; t < cashFlows.length; t++) {
    total += cashFlows[t] / Math.pow(1 + rate, t);
  }
  return total;
}

export function irrNewton(cashFlows: number[], guess = 0.1): number {
  const hasNeg = cashFlows.some((cf) => cf < 0);
  const hasPos = cashFlows.some((cf) => cf > 0);
  if (!hasNeg || !hasPos) return 0;
  let r = guess;
  for (let i = 0; i < 200; i++) {
    const f = npv(r, cashFlows);
    const dr = 1e-6;
    const fPrime = (npv(r + dr, cashFlows) - f) / dr;
    if (Math.abs(fPrime) < 1e-14) break;
    const newR = r - f / fPrime;
    if (!isFinite(newR)) break;
    if (Math.abs(newR - r) < 1e-9) return newR;
    r = newR;
  }
  // Bisection fallback.
  let lo = -0.99;
  let hi = 5.0;
  const fLo0 = npv(lo, cashFlows);
  const fHi0 = npv(hi, cashFlows);
  if (fLo0 * fHi0 > 0) return 0;
  let fLo = fLo0;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    const fMid = npv(mid, cashFlows);
    if (Math.abs(fMid) < 1e-6) return mid;
    if (fLo * fMid < 0) {
      hi = mid;
    } else {
      lo = mid;
      fLo = fMid;
    }
  }
  return (lo + hi) / 2;
}
