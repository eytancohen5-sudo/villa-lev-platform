// One-off URL validator for HOTEL_URLS. Run via:
//   cd villa-lev-platform && npx tsx scripts/validate_hotel_urls.mjs
import { HOTEL_URLS } from "../src/lib/data/marketBenchmarks.ts";

const urls = Object.entries(HOTEL_URLS);
console.log(`Validating ${urls.length} URLs (HEAD with GET fallback, 8s max)...`);

async function check(name, url) {
  const tryReq = async (method) => {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    try {
      const r = await fetch(url, {
        method,
        redirect: "follow",
        signal: ctrl.signal,
        headers: { "User-Agent": "Mozilla/5.0 (compatible; VillaLev-link-check/1.0)" },
      });
      clearTimeout(t);
      return { ok: r.status >= 200 && r.status < 400, status: r.status };
    } catch (e) {
      clearTimeout(t);
      return { ok: false, err: (e.message || "").slice(0, 80) };
    }
  };
  // Many properties refuse HEAD (405) — retry with GET if HEAD fails.
  let r = await tryReq("HEAD");
  if (!r.ok && (r.status === 405 || r.status === 403 || !r.status)) {
    r = await tryReq("GET");
  }
  return { name, url, ...r };
}

const results = [];
const queue = [...urls];
const workers = Array.from({ length: 6 }, async () => {
  while (queue.length) {
    const n = queue.shift();
    if (!n) break;
    results.push(await check(n[0], n[1]));
  }
});
await Promise.all(workers);
results.sort((a, b) => a.name.localeCompare(b.name));
const bad = results.filter((r) => !r.ok);
console.log(`\n${results.length - bad.length} OK · ${bad.length} failed\n`);
if (bad.length) {
  console.log("FAILED URLs (consider stripping from HOTEL_URLS):");
  for (const r of bad) {
    console.log(`  [${r.status ?? "ERR"}] ${r.name}`);
    console.log(`         → ${r.url}`);
    if (r.err) console.log(`         · ${r.err}`);
  }
}
