// Firebase client init. The web SDK config below is *public by design* —
// Firebase API keys identify the project, not authenticate it. Authorisation
// is enforced by Firestore security rules.
//
// Persistence model: the `scenarios` collection holds one document per saved
// scenario, keyed by the scenario's UUID. Multiple browsers reading/writing
// the same collection see each other's changes. Reads are public; writes now
// require `request.auth != null` (see firestore.rules), so the auth singleton
// below feeds the sign-in flow that gates the save UI.

import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAuth, type Auth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: 'AIzaSyA-YnSf0FKpecug5P9ZeAdO_DrPwQVOSrg',
  authDomain: 'villa-lev-admin.firebaseapp.com',
  projectId: 'villa-lev-admin',
  storageBucket: 'villa-lev-admin.firebasestorage.app',
  messagingSenderId: '514605460254',
  appId: '1:514605460254:web:f90b0022a924bb76b0770f',
};

// Admin allow-list. Source of truth is the sibling ops app's EMAIL_ROLE_MAP
// (~/Desktop/Villa Lev Claude/villa-lev-admin/src/lib/auth-context.tsx) — keep
// these in sync. Both apps share Firebase project `villa-lev-admin`, so a
// Google sign-in here resolves to the same UID/email the ops rules grant
// admin to. Lower-cased on compare to match the ops app's `.toLowerCase()`.
const adminEmailsRaw = process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? '';
export const ADMIN_EMAILS: readonly string[] = adminEmailsRaw
  ? adminEmailsRaw.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean)
  : ((() => { if (typeof window === 'undefined') console.warn('[firebase] NEXT_PUBLIC_ADMIN_EMAIL not set — admin access disabled'); return []; })());

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return (ADMIN_EMAILS as readonly string[]).includes(email.toLowerCase());
}

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let authInstance: Auth | null = null;

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

// Lazy auth singleton. Mirrors `getDb()` so this stays SSR/static-export safe
// — Firebase Auth touches `window` during init, so we never call it server-
// side. Components should always go through `useAuth()` rather than this
// function directly; it's exported only so the hook module can grab it.
export function getAuthInstance(): Auth | null {
  if (typeof window === 'undefined') return null;
  if (!authInstance) {
    const a = getFirebaseApp();
    if (!a) return null;
    authInstance = getAuth(a);
  }
  return authInstance;
}

export const SCENARIOS_COLLECTION = 'scenarios';

// RBAC collection names. The schema and helpers live in
// `src/lib/data/userProfile.ts`; these constants are re-exported here so
// `firebase.ts` remains the single import surface for "where in Firestore
// does X live?". See ADR 0002 for the full data model.
export const USERS_COLLECTION = 'users';
export const INVITES_COLLECTION = 'invites';
