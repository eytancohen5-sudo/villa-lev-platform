// migrate-projects-to-2.mjs
//
// One-shot migration: reduces every scenario's `projects` array from 3 entries
// to 2 by dropping `proj-3` ("11 Villa Suites"). Keeps proj-1 (Luxury Villa)
// and proj-2 (Boutique Suites) untouched.
//
// Idempotent: scenarios already at ≤2 projects, or with no proj-3, are skipped.
//
// Invocation:
//
//   # Dry-run (default — prints what would change, writes nothing):
//   GOOGLE_APPLICATION_CREDENTIALS=/Users/esmacbookprom2/Downloads/villa-lev-admin-eaafff96dd96.json \
//     EXPECTED_PROJECT_ID=villa-lev-admin \
//     node scripts/migrate-projects-to-2.mjs
//
//   # Apply:
//   GOOGLE_APPLICATION_CREDENTIALS=/Users/esmacbookprom2/Downloads/villa-lev-admin-eaafff96dd96.json \
//     EXPECTED_PROJECT_ID=villa-lev-admin \
//     node scripts/migrate-projects-to-2.mjs --apply

import { readFileSync } from 'fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const APPLY = process.argv.includes('--apply');
const SCENARIOS_COLLECTION = 'scenarios';

const fail = (msg) => { console.error('ERROR:', msg); process.exit(1); };

const SA_PATH = process.env.GOOGLE_APPLICATION_CREDENTIALS;
const EXPECTED_PROJECT_ID = process.env.EXPECTED_PROJECT_ID;

if (!SA_PATH)             fail('GOOGLE_APPLICATION_CREDENTIALS env var required.');
if (!EXPECTED_PROJECT_ID) fail('EXPECTED_PROJECT_ID env var required (e.g. villa-lev-admin).');

let parsedSa;
try {
  parsedSa = JSON.parse(readFileSync(SA_PATH, 'utf8'));
} catch (e) {
  fail(`Could not read service account JSON at ${SA_PATH}: ${e.message}`);
}

if (parsedSa.project_id !== EXPECTED_PROJECT_ID) {
  fail(`Service account project_id "${parsedSa.project_id}" does not match EXPECTED_PROJECT_ID "${EXPECTED_PROJECT_ID}".`);
}

initializeApp({ credential: cert(parsedSa) });
const db = getFirestore();

console.log(`\n${APPLY ? '🔴 APPLY MODE' : '🟡 DRY-RUN MODE (pass --apply to write)'}\n`);

const snap = await db.collection(SCENARIOS_COLLECTION).get();
console.log(`Found ${snap.size} scenario docs.\n`);

let skipped = 0;
let toUpdate = 0;
const batch = db.batch();

for (const docSnap of snap.docs) {
  const data = docSnap.data();
  const projects = data.projects;

  // Skip: no projects field, or already ≤2, or no proj-3 present
  if (!Array.isArray(projects)) { skipped++; continue; }
  const hasProj3 = projects.some(p => p.id === 'proj-3');
  if (!hasProj3) { skipped++; continue; }

  const updated = projects.filter(p => p.id !== 'proj-3');
  console.log(`  ✏  ${docSnap.id} "${data.name ?? '(unnamed)'}": ${projects.length} projects → ${updated.length}`);
  updated.forEach(p => console.log(`       keep  ${p.id}: "${p.name}"`));
  console.log(`       drop  proj-3: "${projects.find(p => p.id === 'proj-3')?.name}"`);

  if (APPLY) {
    batch.update(docSnap.ref, { projects: updated });
  }
  toUpdate++;
}

console.log(`\nSummary: ${toUpdate} to update, ${skipped} skipped.\n`);

if (APPLY && toUpdate > 0) {
  await batch.commit();
  console.log('✅ Batch committed.\n');
} else if (!APPLY && toUpdate > 0) {
  console.log('Dry-run complete — re-run with --apply to write changes.\n');
} else {
  console.log('Nothing to do.\n');
}
