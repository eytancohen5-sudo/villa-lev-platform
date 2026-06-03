/**
 * REVERT: undo the ×0.6 patch applied by patch-construction-director-cost.mjs.
 *
 * Maps exact patched values back to their originals:
 *   24_000 → 40_000  (main 15K plot: the prior patch went 40K → 24K)
 *   12_000 → 20_000  (small plots: the prior patch went 20K → 12K)
 *
 * Scope: published == true scenarios only (matches the forward-patch scope).
 * Idempotent: only touches entries whose value is exactly 24_000 or 12_000.
 *
 * Run from villa-lev-platform directory:
 *   node scripts/patch-revert-construction-director-cost.mjs
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, doc, getDoc, updateDoc } from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';

const firebaseConfig = {
  apiKey: 'AIzaSyA-YnSf0FKpecug5P9ZeAdO_DrPwQVOSrg',
  authDomain: 'villa-lev-admin.firebaseapp.com',
  projectId: 'villa-lev-admin',
  storageBucket: 'villa-lev-admin.firebasestorage.app',
  messagingSenderId: '514605460254',
  appId: '1:514605460254:web:f90b0022a924bb76b0770f',
};

// Exact revert map — do NOT use a blanket multiply
const REVERT_MAP = new Map([
  [24_000, 40_000],
  [12_000, 20_000],
]);

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

async function main() {
  console.log('Signing in anonymously...');
  const cred = await signInAnonymously(auth);
  console.log(`Auth UID: ${cred.user.uid}`);

  const configSnap = await getDoc(doc(db, 'appConfig', 'current'));
  const referenceId = configSnap.exists() ? configSnap.data()?.referenceScenarioId : null;
  console.log(`Reference scenario: ${referenceId ?? '(none)'}`);

  const snap = await getDocs(query(collection(db, 'scenarios'), where('published', '==', true)));
  console.log(`Found ${snap.size} published scenario(s).\n`);

  let patchedScenarios = 0;

  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    const isRef = docSnap.id === referenceId;
    const portfolio = data?.assumptions?.portfolio;
    if (!Array.isArray(portfolio)) continue;

    let changed = false;
    const updatedPortfolio = portfolio.map((p) => {
      const revertTo = REVERT_MAP.get(p.constructionDirectorCost);
      if (revertTo !== undefined) {
        console.log(`  ${isRef ? '[REF] ' : ''}${data.name}: constructionDirectorCost ${p.constructionDirectorCost} → ${revertTo}`);
        changed = true;
        return { ...p, constructionDirectorCost: revertTo };
      }
      return p;
    });

    if (changed) {
      await updateDoc(docSnap.ref, { 'assumptions.portfolio': updatedPortfolio });
      patchedScenarios++;
    }
  }

  console.log(patchedScenarios > 0
    ? `\nDone. Reverted ${patchedScenarios} scenario(s).`
    : '\nNothing to revert — no matching values found (already at original values).');
  process.exit(0);
}

main().catch((err) => {
  console.error('Script failed:', err.message ?? err);
  process.exit(1);
});
