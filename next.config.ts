import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /*
   * Standalone output only when building the container image, because
   * `next start` refuses to serve a standalone build -- it wants
   * `node .next/standalone/server.js`. Gating it keeps `npm start` and the
   * end-to-end tests working against an ordinary production build, while the
   * Dockerfile sets this and runs the standalone server directly.
   */
  output: process.env.STABLATURE_STANDALONE ? "standalone" : undefined,
  // typedRoutes is deliberately off. Its RouteImpl type can only be inferred
  // from literal-ish hrefs, and every route in this app is parameterised by a
  // database id -- `/songs/${songId}` interpolates a plain string, which never
  // satisfies it. Keeping it on would mean an `as Route` cast at every call
  // site to catch typos in seven routes.
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
