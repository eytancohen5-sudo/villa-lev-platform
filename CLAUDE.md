@AGENTS.md

## Bug Fixing

After fixing any bug, verify the fix works end-to-end before reporting it as complete. Use the browser preview tool or run the app to confirm the fix addresses the root cause, not just the surface symptom.

## React / TypeScript Conventions

When building React components, avoid patterns that cause infinite re-render loops (e.g., object/array literals in useMemo/useEffect dependencies, state updates inside effects that trigger themselves). Always audit useEffect dependency arrays before committing.

## Financial / Data Accuracy

When implementing financial calculations or numeric logic, always validate outputs against known expected values before presenting results. If source data (e.g., Excel) exists, cross-check totals row by row.

## Deployment

After deploying to Firebase or any hosting platform, always hard-refresh and test in an incognito/private browser window to bypass caching. Mention this to the user when asking them to verify.
