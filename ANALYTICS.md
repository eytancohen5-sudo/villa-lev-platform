# Feature-Usage Analytics

The Villa Lev platform tracks which features are used via a Firestore collection called featureUsage.

## Dashboard

Navigate to /admin/analytics to see:
- Total opens per feature over a selected date range (7d / 30d / 90d)
- Unique sessions per feature
- Last-used date
- Admin-vs-bank breakdown
- Table sorted by least-used first (surface dead weight)

## How to add tracking to a new feature

In any page component, add one line:

const { track } = useTrackFeature()
useEffect(() => { track('my-feature-id') }, [track])

Import from: src/lib/hooks/useTrackFeature.ts

## featureId naming convention

Use kebab-case: audience-screen, e.g. admin-dashboard, bank-sensitivity, bank-optima.
For action events: action-verb, e.g. excel-export, scenario-save.

## Feature flag

Set NEXT_PUBLIC_ANALYTICS_ENABLED=true in your .env.local to enable tracking.
In production, this variable is set at build time.

## Firestore collection

Collection: featureUsage
Fields: featureId (string), audience (admin|bank|unknown), sessionId (string, opaque), path (string), ts (Firestore Timestamp)
No PII is collected. sessionId is a crypto.randomUUID() value stored in sessionStorage.
