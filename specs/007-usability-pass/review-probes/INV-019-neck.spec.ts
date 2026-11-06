/**
 * INV-019's neck half: header at 11px, and an inlay's computed `font-weight` above a plain fret's with the same
 * colour. The suite's usability-marks test never reads the neck.
 */
import { expect, test, type Page } from "@playwright/test";
import { startCapturing } from "../../../e2e/capture-surface-helpers";

const INLAYS = new Set([3, 5, 7, 9, 12, 15, 17, 19, 21, 24]);

/** The header row is the neck's first row of bare numbers. */
const header = (page: Page) =>
  page.evaluate(() => {
    const cells = [...document.querySelectorAll("div, span")].filter(
      (el) => el.children.length === 0 && /^\d{1,2}$/.test(el.textContent ?? "") && el.className.toString().includes("w-(--fret)"),
    );
    return cells.map((el) => {
      const s = getComputedStyle(el);
      return { fret: Number(el.textContent), size: s.fontSize, weight: Number(s.fontWeight), color: s.color };
    });
  });

for (const theme of ["dark", "light"] as const) {
  test(`INV-019 the neck header, ${theme}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme });
    await startCapturing(page);
    await page.waitForTimeout(200);
    const cells = await header(page);
    expect(cells.length, "the header row was found").toBeGreaterThan(5);
    for (const c of cells) expect(c.size, `fret ${c.fret}`).toBe("11px");
    const inlay = cells.filter((c) => INLAYS.has(c.fret));
    const plain = cells.filter((c) => !INLAYS.has(c.fret));
    expect(inlay.length).toBeGreaterThan(0);
    expect(plain.length).toBeGreaterThan(0);
    expect(new Set(cells.map((c) => c.color)).size, "one colour throughout").toBe(1);
    expect(Math.min(...inlay.map((c) => c.weight)), "an inlay fret keeps its mark by weight").toBeGreaterThan(
      Math.max(...plain.map((c) => c.weight)),
    );
  });
}
