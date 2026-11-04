import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { groupKind } from "../domain";

const root = path.resolve(import.meta.dirname, "../../../..");

describe("INV-025: the group_kind migration only adds", () => {
  const dir = path.join(root, "drizzle");
  const file = readdirSync(dir)
    .filter((name) => /^0004_.*\.sql$/.test(name))
    .sort()
    .at(-1);

  it("exists", () => {
    expect(file).toBeDefined();
  });

  it("holds only CREATE TYPE and ADD COLUMN statements", () => {
    const sql = readFileSync(path.join(dir, file!), "utf8");
    const statements = sql
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean);
    expect(statements.length).toBeGreaterThan(0);
    for (const statement of statements) {
      expect(statement).toMatch(/^(CREATE TYPE|ALTER TABLE "\w+" ADD COLUMN)/);
    }
    expect(sql).not.toMatch(/\b(UPDATE|DELETE|DROP|INSERT)\b/i);
  });

  it("declares exactly tuplet and plain", () => {
    expect(groupKind.enumValues).toEqual(["tuplet", "plain"]);
  });
});
