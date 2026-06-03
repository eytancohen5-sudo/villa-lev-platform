/**
 * Scale all explicit constructionDirectorCost values ×0.6 across all scenarios.
 * 40K→24K, 20K→12K — brings a 3-type portfolio (1+2+1 plots) from €100K to €60K/yr.
 * Uses the client Firebase SDK (no admin/service account needed).
 * Run from villa-lev-platform directory:
 *   node scripts/patch-construction-director-cost.mjs
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

const SCALE = 0.6;

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

async function main() {
  console.log('Signing in anonymously...');
  const cred = await signInAnonymously(auth);
  console.log(`Auth UID: ${cred.user.uid}`);

  const configSnap = await getDoc(doc(db, 'appConfig', 'current'));
  const referenceId = configSnap.exists() ? configSnap.data()?.referenceScenarioId : null;
  console.log(`Reference scenario ID: ${referenceId ?? '(none)'}`);

  const snap = await getDocs(query(collection(db, 'scenarios'), where('published', '==', true)));
  console.log(`Found ${snap.size} scenario(s).`);

  let patchedScenarios = 0;

  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    const isRef = docSnap.id === referenceId;
    const portfolio = data?.assumptions?.portfolio;
    if (!Array.isArray(portfolio)) continue;

    let changed = false;
    const updatedPortfolio = portfolio.map((p) => {
      if (typeof p.constructionDirectorCost === 'number' && p.constructionDirectorCost > 0) {
        const newVal = Math.round(p.constructionDirectorCost * SCALE);
        console.log(`  ${isRef ? '[REF] ' : ''}${data.name}: constructionDirectorCost ${p.constructionDirectorCost} → ${newVal}`);
        changed = true;
        return { ...p, constructionDirectorCost: newVal };
      }
      return p;
    });

    if (changed) {
      await updateDoc(docSnap.ref, { 'assumptions.portfolio': updatedPortfolio });
      patchedScenarios++;
    }
  }

  if (patchedScenarios > 0) {
    console.log(`\nDone. Patched ${patchedScenarios} scenario(s).`);
  } else {
    console.log('\nNothing to patch — no explicit constructionDirectorCost values found.');
  }
  process.exit(0);
}

main().catch((err) => {
  console.error('Script failed:', err.message ?? err);
  process.exit(1);
});
