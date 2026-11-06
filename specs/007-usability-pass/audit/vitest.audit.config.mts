import path from "node:path";
import { defineConfig } from "vitest/config";

const root = path.resolve(__dirname, "../../..");

export default defineConfig({
  root,
  resolve: { alias: { "@": path.join(root, "src") } },
  test: { include: ["specs/007-usability-pass/audit/*.test.ts"], environment: "node" },
});
