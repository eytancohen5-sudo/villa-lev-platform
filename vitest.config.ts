// Vitest config for villa-lev-platform.
//
// Scope: financial-engine golden tests (`src/lib/engine/__tests__/*`) and
// any future pure-TS test under `src/`. No DOM tests, no component tests —
// those, when needed, will graduate to a separate `vitest.dom.config.ts`
// with environment 'jsdom'.

import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      // Mirror tsconfig.json's `paths: { "@/*": ["./src/*"] }`.
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/__tests__/**/*.test.ts"],
    // Vitest 3 default reporter prints summary + dot — keep it terse for CI.
    reporters: ["default"],
    // Engine snapshots live next to source; pin the snapshot dir explicitly
    // so future restructures don't silently relocate them.
    resolveSnapshotPath: (testPath, snapExt) =>
      testPath.replace(/\.test\.ts$/, `.test${snapExt}`),
  },
});
