// DOM test config — React component tests that need the jsdom environment.
//
// Does NOT use @vitejs/plugin-react because the installed version is
// incompatible with the Vite version bundled inside Next.js 16.
// Instead, esbuild's built-in JSX transform handles .tsx files.
//
// Run with: npm run test:dom

import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  esbuild: {
    // Use the React 17+ automatic JSX runtime so 'import React from "react"'
    // is not required in every test/component file.
    jsx: "automatic",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test-setup.dom.ts"],
    include: [
      "src/**/*.test.tsx",
      "src/**/__tests__/**/*.test.tsx",
    ],
    reporters: ["default"],
  },
});
