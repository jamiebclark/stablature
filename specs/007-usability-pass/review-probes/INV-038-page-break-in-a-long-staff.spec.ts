/**
 * INV-038, FR-055, round 3. Every print probe so far uses print emulation, which has no pages. The string labels sit in an
 * absolutely placed gutter beside the lines, so a real page break can treat the two differently. This prints real PDFs
 * through Chromium for a staff taller than one page, and writes them to PRINT_OUT for reading by eye. A second pass
 * reads each page's own text positions in `pdf-lines.mjs`.
 */
import { mkdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { bar, n, seedSong, type Col } from "../../../e2e/reading-helpers";

test.setTimeout(120_000);
test.skip(({ isMobile }) => isMobile, "paper has no pointer");

const out = process.env.PRINT_OUT ?? path.join(os.tmpdir(), "spec007-print");
const q = (fret: number) => n(fret, { d: "q" });

const barred = (bars: number): Col[] =>
  Array.from({ length: bars }, (_, b) => [q(3), q(5), q(7), q(b % 12), bar()]).flat();
const open = (length: number): Col[] => Array.from({ length }, (_, i) => q(i % 2 ? 12 : 3));

const SHAPES: { name: string; columns: Col[] }[] = [
  { name: "barred-40", columns: barred(40) },
  { name: "barred-60", columns: barred(60) },
  { name: "barred-120", columns: barred(120) },
  { name: "barred-240", columns: barred(240) },
  { name: "no-barlines-200", columns: open(200) },
  { name: "no-barlines-400", columns: open(400) },
  { name: "no-barlines-900", columns: open(900) },
];

for (const shape of SHAPES) {
  test(`INV-038 a real PDF of ${shape.name}`, async ({ page }) => {
    mkdirSync(out, { recursive: true });
    const { playUrl } = await seedSong(page, [{ key: "a", label: "A", columns: shape.columns }], [{ part: "a" }]);
    await page.goto(playUrl);
    await expect(page.getByTestId("tab-staff").first()).toBeVisible();
    await page.waitForTimeout(300);
    await page.pdf({ path: path.join(out, `${shape.name}.pdf`), format: "A4", printBackground: true });
  });
}
