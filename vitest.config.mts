import path from "node:path";
import react from "@vitejs/plugin-react";
import { configDefaults, defineConfig } from "vitest/config";

// Files that assert wall-clock budgets (20 ms, 500 ms, 2,000 ms). They cannot share a machine with the parallel
// run: under load the same parse measured 4,390 ms against its 2,000 ms bound, and a different file failed each
// time. They run alone, one file at a time, in `npm run test:timing` (vitest.timing.mts), which CI runs too.
export const TIMED = [
  "src/lib/reading/__tests__/budget.test.ts",
  "src/lib/reading/__tests__/compare-oracle.test.ts",
  "src/lib/tab/__tests__/reading.test.ts",
  "src/lib/tab/__tests__/review-at-size.test.ts",
  "src/lib/tab/__tests__/review-growth-of-a-tall-block.test.ts",
  "src/lib/tab/__tests__/review-lines-above-a-staff.test.ts",
  "src/lib/tab/__tests__/review-lines-only-s6-claims.test.ts",
  "src/lib/tab/__tests__/review-rails-block.test.ts",
];

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    // Node by default; component tests opt in with a
    // `// @vitest-environment jsdom` docblock at the top of the file.
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
    exclude: [...configDefaults.exclude, ...TIMED],
    setupFiles: ["./vitest.setup.ts"],
    // Time is not what these tests check. The heavy ones (every stored system, every character) took 5-40 s
    // under a full parallel run on a busy machine and failed vitest's 5 s default without anything being wrong.
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
});
