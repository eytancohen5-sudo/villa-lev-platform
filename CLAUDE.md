@AGENTS.md

App-local config for villa-lev-platform. Inherits the team config in `../CLAUDE.md` — read that first for the agent roster, skills, and security posture.

## Bug Fixing

After fixing any bug, verify the fix works end-to-end before reporting it as complete. Use the browser preview tool or run the app to confirm the fix addresses the root cause, not just the surface symptom.

## React / TypeScript Conventions

When building React components, avoid patterns that cause infinite re-render loops (e.g., object/array literals in useMemo/useEffect dependencies, state updates inside effects that trigger themselves). Always audit useEffect dependency arrays before committing.

## Financial / Data Accuracy

When implementing financial calculations or numeric logic, always validate outputs against known expected values before presenting results. If source data (e.g., Excel) exists, cross-check totals row by row.

## Deployment

After deploying to Firebase or any hosting platform, always hard-refresh and test in an incognito/private browser window to bypass caching. Mention this to the user when asking them to verify.

## Stack

- **Framework:** Next 16 + React 19, App Router, **static export** (`output: "export"` in `next.config.ts`). No SSR, no server actions at runtime — every page is HTML+JS shipped to Firebase Hosting. See `AGENTS.md` for the Next 16 / React 19 gotchas.
- **Data:** Firestore (project `villa-lev-admin`); rules are deployed from the sibling ops repo at `~/Desktop/Villa Lev Claude/villa-lev-admin/firestore.rules` (single source of truth — this app no longer ships its own rules file). Writes traverse the client SDK directly (there is no server to mediate).
- **Hosting:** Firebase (`firebase.json`)
- **Package manager:** npm (`package-lock.json` present)
- **Styling:** Tailwind 4 (PostCSS plugin in `postcss.config.mjs`)
- **State:** Zustand store at `src/lib/store/modelStore.ts`

## Server actions

This app has no server runtime — `output: "export"` strips SSR and disables server actions. Do not introduce `'use server'` files; they will silently no-op at build time. Mutations are client-side Firestore writes (`setDoc` etc.), and the project's `firestore.rules` (in the sibling admin repo, see Stack > Data above) is the only enforcement layer between the public client and the database.

## Firestore access

Client-side reads and writes both go through the Firebase Web SDK. Use the shared singleton from `src/lib/firebase.ts` (`getDb()`) — do not call `getFirestore()` ad-hoc in components. The seasonSnapshot subscription is centralised in `src/lib/data/useSeasonSnapshot.ts` (one `onSnapshot` listener for the whole app); scenarios persistence lives in `src/lib/store/modelStore.ts`. New collections should follow the same pattern: one module owns the read/write surface, components consume via hooks.

## Forbidden in this directory

- Adding a dependency from `villa-lev-tepix` (separate app, separate `package.json`)
- Hardcoded Firestore document paths in components (use typed helpers in `src/lib/`)
- `'use client'` on components that don't actually need browser APIs
- Editing the project's `firestore.rules` (at `~/Desktop/Villa Lev Claude/villa-lev-admin/firestore.rules`) without `security-auditor` review
- Reintroducing a `firestore.rules` file in this repo or a `"firestore"` key in `firebase.json` — the platform must not deploy rules; the admin repo is the sole rules-deployer (see `docs/db-and-export-audit-2026-05-21.md` item #2)

## Tests

- **Vitest** unit/integration: `*.test.ts` co-located with source. Jest is forbidden (conflicts with Next 16 module resolution).
- Golden snapshots for the financial engine live at `src/lib/engine/__tests__/`.
- Playwright E2E: `e2e/*.spec.ts` (if/when the directory exists).
- Mock the global `sync-skroutz` / `sync-eurobank` skills — never live-call them in tests.

## Pointers

- Team config: `../CLAUDE.md`
- Sibling app: `../villa-lev-tepix/CLAUDE.md`
- Ops dashboard repo: `~/Desktop/Villa Lev Claude/villa-lev-admin/`
