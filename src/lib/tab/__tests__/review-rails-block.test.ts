/**
 * Round 3. INV-030: never does a long paste freeze typing or the screen.
 *
 * S5 grows a block to a fixed point and each pass walks every line, so a block growing upward costs
 * a pass per row. No real tab is this tall, which is why this is a follow-up and why the bound is
 * generous: it records today's cost (about 1 s here at 5,000 rows, 6 s at 10,000) and stops it growing.
 */
import { describe, expect, it } from "vitest";
import { parseTab } from "@/lib/tab/parse";

describe("INV-030 a tall block of rails", () => {
  it("5,000 rails-only rows over a staff read inside the bound", () => {
    const text = [...Array.from({ length: 5000 }, () => "----------"), "---5---", "---5---"].join("\n");
    const started = performance.now();
    parseTab(text);
    expect(performance.now() - started).toBeLessThan(5000);
  });
});
