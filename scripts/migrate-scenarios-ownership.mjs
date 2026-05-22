// migrate-scenarios-ownership.mjs
//
// One-shot legacy migration to stamp ownership fields on /scenarios docs in the
// villa-lev-admin Firestore project. Backfills:
//   - userId             -> EYTAN_UID
//   - ownerDisplayName   -> EYTAN_DISPLAY_NAME
//   - copiedFrom         -> null (if absent)
//   - published          -> true on the appConfig/current reference doc,
//                           false on everything else (if absent)
//
// Idempotent: docs that already have all required fields are skipped.
//
// Dependency: requires firebase-admin. If not already installed:
//   npm i -D firebase-admin
//
// Invocation:
//
//   # Dry-run (default):
//   GOOGLE_APPLICATION_CREDENTIALS=path/to/sa.json \
//     EXPECTED_PROJECT_ID=villa-lev-admin \
//     EYTAN_UID=xxx \
//     EYTAN_DISPLAY_NAME="Eytan" \
//     node scripts/migrate-scenarios-ownership.mjs
//
//   # Apply:
//   GOOGLE_APPLICATION_CREDENTIALS=path/to/sa.json \
//     EXPECTED_PROJECT_ID=villa-lev-admin \
//     EYTAN_UID=xxx \
//     EYTAN_DISPLAY_NAME="Eytan" \
//     node scripts/migrate-scenarios-ownership.mjs --apply
//
// EXPECTED_PROJECT_ID is asserted against the SA JSON's `project_id` BEFORE the
// admin SDK is initialised, so a misconfigured GOOGLE_APPLICATION_CREDENTIALS
// pointing at a different Firebase project fails fast instead of silently
// writing to the wrong database. See security-auditor M2 (2026-05-22).
//
// DEPLOY ORDERING (per plan-challenger m2):
//   1. Run this script with --apply (stamps userId + ownerDisplayName on all docs,
//      flips published=true on the appConfig/current reference).
//   2. THEN deploy firestore.rules (the new read predicate denies docs missing
//      userId, so step 1 must precede step 2).
//   3. THEN deploy the new platform build.

import { readFileSync } from 'node:fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const BATCH_LIMIT = 400; // Firestore hard limit is 500; 400 = headroom.

const args = new Set(process.argv.slice(2));
const APPLY = args.has('--apply');
const DRY_RUN = args.has('--dry-run') || !APPLY; // default behavior = dry-run

function fail(msg) {
  console.error(`[migrate-scenarios-ownership] ERROR: ${msg}`);
  process.exit(1);
}

const {
  GOOGLE_APPLICATION_CREDENTIALS,
  EXPECTED_PROJECT_ID,
  EYTAN_UID,
  EYTAN_DISPLAY_NAME,
} = process.env;

if (!GOOGLE_APPLICATION_CREDENTIALS) fail('GOOGLE_APPLICATION_CREDENTIALS env var is required (path to SA JSON).');
if (!EXPECTED_PROJECT_ID) fail('EXPECTED_PROJECT_ID env var is required (e.g. villa-lev-admin) — guards against writing to the wrong project.');
if (!EYTAN_UID) fail('EYTAN_UID env var is required (Firebase auth uid).');
if (!EYTAN_DISPLAY_NAME) fail('EYTAN_DISPLAY_NAME env var is required (display name string).');

// Parse the SA JSON ourselves so we can assert the project_id BEFORE the
// admin SDK initialises. `applicationDefault()` would silently resolve to
// whatever project the SA points at, and a misconfigured env var pointing
// at a different Firebase project would write to the wrong database. See
// security-auditor M2 (2026-05-22).
let parsedSa;
try {
  parsedSa = JSON.parse(readFileSync(GOOGLE_APPLICATION_CREDENTIALS, 'utf8'));
} catch (err) {
  fail(`could not read/parse GOOGLE_APPLICATION_CREDENTIALS at ${GOOGLE_APPLICATION_CREDENTIALS}: ${err.message}`);
}

if (!parsedSa.project_id) {
  fail(`SA JSON at ${GOOGLE_APPLICATION_CREDENTIALS} is missing project_id — is this a Firebase service-account key?`);
}

if (parsedSa.project_id !== EXPECTED_PROJECT_ID) {
  fail(
    `project_id mismatch: SA JSON says "${parsedSa.project_id}" but EXPECTED_PROJECT_ID="${EXPECTED_PROJECT_ID}". ` +
    `Refusing to initialise — set EXPECTED_PROJECT_ID to the project the SA actually targets, or point GOOGLE_APPLICATION_CREDENTIALS at the right SA.`,
  );
}

initializeApp({ credential: cert(parsedSa), projectId: parsedSa.project_id });
const db = getFirestore();

// Redact a uid for log output. We keep the first 4 + last 4 chars and the
// length so the operator can sanity-check which uid was used without
// leaking the full identifier into session logs. See security-auditor M4
// (2026-05-22).
function redactUid(uid) {
  if (!uid || uid.length < 8) return '<too-short-to-redact>';
  return `${uid.slice(0, 4)}…${uid.slice(-4)} (len=${uid.length})`;
}

/**
 * Compute the partial update for a doc. Returns null if nothing needs to change.
 */
function computeUpdate(docId, data, referenceScenarioId) {
  const update = {};

  if (data.userId === undefined || data.userId === null) {
    update.userId = EYTAN_UID;
  }

  if (data.ownerDisplayName === undefined || data.ownerDisplayName === null) {
    update.ownerDisplayName = EYTAN_DISPLAY_NAME;
  }

  if (data.copiedFrom === undefined) {
    update.copiedFrom = null;
  }

  const isReference = docId === referenceScenarioId;
  if (isReference && data.published !== true) {
    update.published = true;
  } else if (!isReference && data.published === undefined) {
    update.published = false;
  }

  return Object.keys(update).length > 0 ? update : null;
}

async function main() {
  console.log(`[migrate-scenarios-ownership] mode=${APPLY ? 'APPLY' : 'DRY-RUN'}`);
  console.log(`[migrate-scenarios-ownership] projectId=${parsedSa.project_id}`);
  console.log(`[migrate-scenarios-ownership] EYTAN_UID=${redactUid(EYTAN_UID)}`);
  console.log(`[migrate-scenarios-ownership] EYTAN_DISPLAY_NAME=${EYTAN_DISPLAY_NAME}`);

  // Step 1: read appConfig/current for the reference scenario id.
  const appConfigSnap = await db.collection('appConfig').doc('current').get();
  const referenceScenarioId = appConfigSnap.exists
    ? (appConfigSnap.data()?.referenceScenarioId ?? null)
    : null;
  console.log(`[migrate-scenarios-ownership] referenceScenarioId=${referenceScenarioId ?? '<none>'}`);

  // Step 2: read all scenarios.
  const scenariosSnap = await db.collection('scenarios').get();
  console.log(`[migrate-scenarios-ownership] scanned ${scenariosSnap.size} scenarios`);

  // Step 3: compute diffs.
  const planned = []; // [{ id, ref, update, data }]
  let stamped = 0;
  let publishedFlipped = 0;
  let skipped = 0;

  scenariosSnap.forEach((doc) => {
    const data = doc.data();
    const update = computeUpdate(doc.id, data, referenceScenarioId);
    if (update === null) {
      skipped += 1;
      return;
    }
    if (update.userId !== undefined || update.ownerDisplayName !== undefined || update.copiedFrom !== undefined) {
      stamped += 1;
    }
    if (update.published === true) {
      publishedFlipped += 1;
    }
    planned.push({ id: doc.id, ref: doc.ref, update, data });
  });

  // Step 4: print a 3-doc sample of planned updates BEFORE any writes.
  // We redact any `userId` field in the printed sample so the operator's
  // uid doesn't leak into stdout / session logs (security-auditor M4).
  console.log(`[migrate-scenarios-ownership] planned updates: ${planned.length} (sample of up to 3 below)`);
  planned.slice(0, 3).forEach((p) => {
    const printable = { ...p.update };
    if (typeof printable.userId === 'string') {
      printable.userId = redactUid(printable.userId);
    }
    console.log(`  - ${p.id}: ${JSON.stringify(printable)}`);
  });

  if (DRY_RUN) {
    console.log(
      `[migrate-scenarios-ownership] DRY-RUN summary: would_stamp=${stamped} would_publish=${publishedFlipped} skipped=${skipped} planned=${planned.length}`,
    );
    console.log('[migrate-scenarios-ownership] DRY-RUN: no writes committed. Re-run with --apply to commit.');
    process.exit(0);
  }

  // Step 5: chunk + commit.
  let chunks = 0;
  for (let i = 0; i < planned.length; i += BATCH_LIMIT) {
    const slice = planned.slice(i, i + BATCH_LIMIT);
    const batch = db.batch();
    slice.forEach((p) => batch.update(p.ref, p.update));
    await batch.commit();
    chunks += 1;
    console.log(`[migrate-scenarios-ownership] committed chunk ${chunks} (${slice.length} docs)`);
  }

  console.log(
    `[migrate-scenarios-ownership] APPLY summary: stamped=${stamped} published=${publishedFlipped} skipped=${skipped} chunks=${chunks}`,
  );
}

main().catch((err) => {
  console.error('[migrate-scenarios-ownership] FATAL', err);
  process.exit(1);
});
