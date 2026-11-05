/**
 * INV-002's last member: the paste reader over each exported text reads back the stored frets.
 *
 * Earlier rounds compared the export with itself across the views and with the baseline, and neither says the
 * text still reads. This copies a marked variant's song from the page in every view and density, then gives what
 * was copied to the real reader. The expected frets are the ones seeded, not anything the reader or layout made.
 */
import { expect, test } from "@playwright/test";
import { parseTab } from "../../../src/lib/tab/parse";
import { bar, choose, n, seedSong, VIEWS, type Col, type PartSpec } from "./helpers";

const PARENT: Col[] = [n(5), n(7), n(8), bar(), n(5), n(7), n(8)];
/** `*` on the 9, `+` on the 10, `−1` on the 8 that went. */
const VARIANT: Col[] = [n(5), n(7), n(9), n(10), bar(), n(5), n(7)];
const PARTS: PartSpec[] = [
  { key: "a", label: "A", columns: PARENT },
  { key: "v", label: "A'", variantOf: "a", columns: VARIANT },
];

const played = (columns: Col[]) =>
  columns.filter((c) => c.kind !== "barline").map((c) => Object.values(c.frets ?? {})[0]);

test("the text copied in every view reads back as the stored frets, marks and all", async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __copied: string[] };
    w.__copied = [];
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: async (text: string) => void w.__copied.push(text) },
      configurable: true,
    });
  });
  await seedSong(page, PARTS, [{ part: "a" }, { part: "v" }]);
  await expect(page.getByTestId("tab-diff").first()).toBeVisible();

  for (const density of ["expanded", "compact"] as const) {
    await page.getByRole("button", { name: density, exact: true }).click();
    for (const view of VIEWS) {
      await choose(page, view);
      await page.getByRole("button", { name: /^(Copy text|Copied)$/ }).click();
      await expect
        .poll(() => page.evaluate(() => (window as unknown as { __copied: string[] }).__copied.length))
        .toBeGreaterThan(0);
      const text = await page.evaluate(() => (window as unknown as { __copied: string[] }).__copied.splice(0)[0]);

      // One part's staff at a time: that is what a person pastes into a part.
      const lines = text.split(/\r?\n/);
      const staves: string[][] = [];
      for (const line of lines) {
        if (!/\|/.test(line)) continue;
        const last = staves[staves.length - 1];
        if (!last || last.length === 5) staves.push([line]);
        else last.push(line);
      }
      const read = staves.map((rows) => {
        const parsed = parseTab(rows.join("\n"));
        expect(parsed.ok, `${density}, ${view}: ${rows.join(" / ")}`).toBe(true);
        if (!parsed.ok) return [];
        return parsed.clipboard.columns
          .filter((c) => c.kind === "notes")
          .map((c) => Object.values(c.frets)[0]);
      });
      expect(read, `${density}, ${view}`).toEqual([played(PARENT), played(VARIANT)]);
    }
  }
});
