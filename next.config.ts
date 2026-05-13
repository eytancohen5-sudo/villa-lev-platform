import type { NextConfig } from "next";

// Static export — deploys to Firebase Hosting. Shared scenario persistence
// is handled by Firestore client SDK (see src/lib/firebase.ts), so no
// server-side runtime is needed.
const nextConfig: NextConfig = {
  output: "export",
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
