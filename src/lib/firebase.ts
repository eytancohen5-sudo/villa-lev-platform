// Firebase client init. The web SDK config below is *public by design* —
// Firebase API keys identify the project, not authenticate it. Authorisation
// is enforced by Firestore security rules.
//
// Persistence model: the `scenarios` collection holds one document per saved
// scenario, keyed by the scenario's UUID. Multiple browsers reading/writing
// the same collection see each other's changes (no auth, see firestore.rules).

import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyA-YnSf0FKpecug5P9ZeAdO_DrPwQVOSrg',
  authDomain: 'villa-lev-admin.firebaseapp.com',
  projectId: 'villa-lev-admin',
  storageBucket: 'villa-lev-admin.firebasestorage.app',
  messagingSenderId: '514605460254',
  appId: '1:514605460254:web:f90b0022a924bb76b0770f',
};

let app: FirebaseApp | null = null;
let db: Firestore | null = null;

export function getFirebaseApp(): FirebaseApp | null {
  if (typeof window === 'undefined') return null;
  if (!app) {
    app = getApps()[0] ?? initializeApp(firebaseConfig);
  }
  return app;
}

export function getDb(): Firestore | null {
  if (typeof window === 'undefined') return null;
  if (!db) {
    const a = getFirebaseApp();
    if (!a) return null;
    db = getFirestore(a);
  }
  return db;
}

export const SCENARIOS_COLLECTION = 'scenarios';
