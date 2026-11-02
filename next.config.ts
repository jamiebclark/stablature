import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Required by the Docker image: bundles the server and its reachable deps so
  // the runtime stage does not need a full node_modules.
  output: "standalone",
  typedRoutes: true,
  turbopack: {
    // There is an unrelated yarn.lock one directory up, which otherwise makes
    // Turbopack infer the wrong workspace root and warn on every build.
    root: process.cwd(),
    rules: {
      // Tailwind v4 has no PostCSS step here -- it runs as a Turbopack loader.
      // Without this rule `@import "tailwindcss"` is passed through untouched
      // and no utilities are generated at all.
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
