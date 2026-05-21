<!-- BEGIN:nextjs-agent-rules -->
# Stack notes for villa-lev-platform

This app runs **Next 16 + React 19 + Tailwind 4** as a static export
(`output: "export"`, no SSR, no server actions at runtime). Some APIs
and conventions differ from older Next.js versions in your training data
— specifically the App Router conventions, the `next/config` shape, and
the React 19 hooks surface (`useSyncExternalStore`, `use`, server
components markers).

When you're about to write route-handler, config, or React 19-hook code
and you're not sure of the current shape, check
`node_modules/next/dist/docs/` (bundled with this Next version) for the
authoritative reference rather than guessing.

Static-export implication: there is no server-side runtime. Anything
relying on `cookies()`, `headers()`, server actions, route handlers
with mutating verbs, or middleware will not execute in production.
Firestore writes go directly from the client SDK; the project's
`firestore.rules` (deployed from the sibling admin repo at
`~/Desktop/Villa Lev Claude/villa-lev-admin/firestore.rules`) is the
only enforcement layer. This app no longer ships its own rules file.
<!-- END:nextjs-agent-rules -->
