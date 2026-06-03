/**
 * One-shot patch: set commercialLoan.graceMode = 'two-phase' on every Firestore
 * scenario where it is currently set to 'rolling'.
 *
 * Uses the Firebase CLI's stored OAuth token (no service-account key needed).
 * Requires you to be logged in: firebase login
 *
 * Usage:
 *   cd villa-lev-platform
 *   node scripts/patch-gracemode-two-phase.mjs
 */

import { readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const PROJECT_ID = 'villa-lev-admin';
const COLLECTION  = 'scenarios';
const BASE_URL    = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

function getAccessToken() {
  const configPath = join(homedir(), '.config', 'configstore', 'firebase-tools.json');
  const config = JSON.parse(readFileSync(configPath, 'utf8'));
  const token = config?.tokens?.access_token;
  if (!token) throw new Error('No access_token in firebase-tools.json — run: firebase login');
  return token;
}

async function refreshedToken(token) {
  const probe = await fetch(`${BASE_URL}/${COLLECTION}?pageSize=1`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (probe.ok) return token;

  const configPath = join(homedir(), '.config', 'configstore', 'firebase-tools.json');
  const config = JSON.parse(readFileSync(configPath, 'utf8'));
  const refreshToken = config?.tokens?.refresh_token;
  if (!refreshToken) throw new Error('No refresh_token — run: firebase login');

  const CLIENT_ID     = '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com';
  const CLIENT_SECRET = 'j9iVZfS8ggxm4kIZpAzYVDVb';

  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  if (!resp.ok) throw new Error(`Token refresh failed: ${resp.status} ${await resp.text()}`);
  const { access_token } = await resp.json();
  return access_token;
}

async function listAllDocs(token) {
  const docs = [];
  let pageToken = null;
  do {
    const url = `${BASE_URL}/${COLLECTION}?pageSize=100${pageToken ? `&pageToken=${pageToken}` : ''}`;
    const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!resp.ok) throw new Error(`List failed: ${resp.status} ${await resp.text()}`);
    const body = await resp.json();
    if (body.documents) docs.push(...body.documents);
    pageToken = body.nextPageToken ?? null;
  } while (pageToken);
  return docs;
}

function getField(doc, path) {
  let node = doc.fields ?? {};
  for (const part of path.split('.')) {
    node = node?.[part]?.mapValue?.fields ?? node?.[part];
    if (!node) return undefined;
  }
  return node?.stringValue ?? node?.integerValue ?? node?.booleanValue;
}

function getName(doc) {
  return doc.fields?.name?.stringValue ?? doc.name.split('/').pop();
}

async function patchGraceMode(token, docName) {
  const url = `https://firestore.googleapis.com/v1/${docName}` +
    `?updateMask.fieldPaths=assumptions.commercialLoan.graceMode`;

  const body = {
    fields: {
      assumptions: {
        mapValue: {
          fields: {
            commercialLoan: {
              mapValue: {
                fields: {
                  graceMode: { stringValue: 'two-phase' },
                },
              },
            },
          },
        },
      },
    },
  };

  const resp = await fetch(url, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!resp.ok) throw new Error(`Patch failed for ${docName}: ${resp.status} ${await resp.text()}`);
}

async function main() {
  console.log(`Connecting to Firestore project: ${PROJECT_ID}\n`);

  let token = getAccessToken();
  token = await refreshedToken(token);

  const docs = await listAllDocs(token);
  if (!docs.length) { console.log('No scenarios found.'); return; }

  console.log(`Found ${docs.length} scenario(s). Scanning...\n`);

  let patchCount = 0;
  for (const doc of docs) {
    const scenarioName = getName(doc);
    const graceMode    = getField(doc, 'assumptions.commercialLoan.graceMode');

    if (graceMode === 'rolling') {
      await patchGraceMode(token, doc.name);
      console.log(`  PATCH graceMode: "${scenarioName}"  (rolling → two-phase)`);
      patchCount++;
    } else {
      console.log(`  OK    graceMode: "${scenarioName}"  (= ${graceMode ?? 'not set / using default'})`);
    }
  }

  console.log(patchCount > 0
    ? `\nPatched ${patchCount} scenario(s). Done.`
    : '\nNo scenarios had graceMode = rolling — nothing to patch.');
}

main().catch((err) => {
  console.error('\nScript failed:', err.message ?? err);
  process.exit(1);
});
