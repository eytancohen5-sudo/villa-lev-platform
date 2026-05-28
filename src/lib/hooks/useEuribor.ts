'use client';
import { useEffect, useState } from 'react';

const ECB_URL =
  'https://data-api.ecb.europa.eu/service/data/FM/B.U2.EUR.RT0.BB.B.A.A.TA.N?lastNObservations=1&format=jsondata';
const SESSION_KEY = 'euribor_3m_cache';
const TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

interface CacheEntry {
  rate: number;
  date: string;
  timestamp: number;
}

export interface EuriborResult {
  rate: number | null;
  date: string | null;
  status: 'idle' | 'loading' | 'live' | 'error';
}

export function useEuribor(): EuriborResult {
  const [result, setResult] = useState<EuriborResult>({ rate: null, date: null, status: 'idle' });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      // Check sessionStorage first
      try {
        const raw = sessionStorage.getItem(SESSION_KEY);
        if (raw) {
          const cached: CacheEntry = JSON.parse(raw);
          if (Date.now() - cached.timestamp < TTL_MS) {
            if (!cancelled) setResult({ rate: cached.rate, date: cached.date, status: 'live' });
            return;
          }
        }
      } catch { /* sessionStorage unavailable */ }

      if (!cancelled) setResult(r => ({ ...r, status: 'loading' }));

      try {
        const res = await fetch(ECB_URL, { headers: { Accept: 'application/json' } });
        if (!res.ok) throw new Error(`ECB HTTP ${res.status}`);
        const data = await res.json();
        const series = data.dataSets[0].series;
        const seriesKey = Object.keys(series)[0];
        const observations = series[seriesKey].observations;
        const obsKeys = Object.keys(observations);
        const lastKey = obsKeys[obsKeys.length - 1];
        const ratePercent: number = observations[lastKey][0];
        const rate = ratePercent / 100;
        const timeIndex = parseInt(lastKey, 10);
        const date: string = data.structure.dimensions.observation[0].values[timeIndex].id;

        const entry: CacheEntry = { rate, date, timestamp: Date.now() };
        try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(entry)); } catch { /* ignore */ }

        if (!cancelled) setResult({ rate, date, status: 'live' });
      } catch {
        if (!cancelled) setResult(r => ({ ...r, status: 'error' }));
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  return result;
}
