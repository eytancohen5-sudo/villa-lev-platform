// One-shot: copy missing keys from en.ts to el.ts and he.ts as English stubs.
// Marks each stubbed line with `// TODO i18n` so they're greppable for a
// proper translation pass later.

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const i18n = resolve(here, "..", "src", "lib", "i18n");

const KEY_LINE = /^(\s*)('([^']+)')\s*:\s*(.*?,)\s*(\/\/.*)?$/;

function parseDictionary(text) {
  const entries = new Map();
  for (const line of text.split("\n")) {
    const m = line.match(KEY_LINE);
    if (!m) continue;
    const [, indent, , key, valueWithComma, trailing] = m;
    entries.set(key, { indent, valueWithComma, trailing: trailing ?? "" });
  }
  return entries;
}

const en = readFileSync(resolve(i18n, "en.ts"), "utf8");
const enEntries = parseDictionary(en);

for (const locale of ["el", "he"]) {
  const file = resolve(i18n, `${locale}.ts`);
  const text = readFileSync(file, "utf8");
  const present = parseDictionary(text);
  const missing = [...enEntries.keys()].filter((k) => !present.has(k));

  if (missing.length === 0) {
    console.log(`${locale}.ts: nothing to add`);
    continue;
  }

  const lines = missing.map((k) => {
    const { valueWithComma } = enEntries.get(k);
    return `  '${k}': ${valueWithComma} // TODO i18n`;
  });

  // Insert before the closing `};` of the dictionary literal.
  const closeIdx = text.lastIndexOf("};");
  if (closeIdx === -1) {
    console.error(`${locale}.ts: closing }; not found`);
    process.exit(1);
  }
  const block = `\n  // ── TODO i18n: English stubs for keys missing from this locale ──\n${lines.join("\n")}\n`;
  const patched = text.slice(0, closeIdx) + block + text.slice(closeIdx);
  writeFileSync(file, patched);
  console.log(`${locale}.ts: stubbed ${missing.length} missing keys`);
}
