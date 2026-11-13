import type { NextConfig } from "next";

/**
 * Next.js config.
 * - cacheComponents is OFF on purpose: every page in this app is per-user and
 *   reads the auth cookie, so classic dynamic rendering is simpler to reason about.
 * - Tailwind v4 is compiled through the Turbopack CSS loader.
 */
const nextConfig: NextConfig = {
  cacheComponents: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
