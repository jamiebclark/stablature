import { configDefaults, defineConfig } from "vitest/config";
import unit, { TIMED } from "./vitest.config.mjs";

// The wall-clock budgets, one file at a time so no other test shares the machine (see TIMED).
export default defineConfig({
  ...unit,
  test: { ...unit.test, include: TIMED, exclude: configDefaults.exclude, fileParallelism: false },
});
