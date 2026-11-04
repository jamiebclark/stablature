/**
 * INV-012 / FR-028 / SC-006 (round 3): FR-028 is "every string of a five-string tuning, PLUS
 * THE CHORD ROW when chords are present". Every fit probe so far counts `.tab-cell` rows,
 * which are strings only, and `scrollHeight` cannot see this overflow: the scroller is
 * `justify-end`, so what overflows goes off the top, where it adds no scrollable height.
 * So: read the rendered chord label and tuplet bracket themselves against the box that
 * clips them. Runs on any build; compare the MEASURE lines.
 *
 *   BASELINE_DIR=<built main> PROBE_PORT=3301 npx playwright test \
 *     --config specs/001-capture-control-surface/review-probes/playwright.baseline.config.ts \
 *     INV-012-r3-chord
 *
 * Fails if the chord label's box is more than 1 px outside the clipping box (the suite's own
 * tolerance; the label's line box has that much air above the glyph). Enumerated: 2 themes x
 * 2 chord-bearing shapes x 2 cursor targets = 8. Screenshots go to the temp dir.
 */
import os from "node:os";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { columns, fret, startCapturing } from "./helpers";

async function measure(page: Page) {
  return page.evaluate(() => {
    const staff = document.querySelector('[data-testid="tab-staff"]')!;
    let scroller: Element | null = staff.parentElement;
    while (scroller && !/(auto|scroll)/.test(getComputedStyle(scroller).overflowY)) {
      scroller = scroller.parentElement;
    }
    const band = scroller!.getBoundingClientRect();
    const walker = document.createTreeWalker(staff, NodeFilter.SHOW_TEXT);
    let chordRect: DOMRect | null = null;
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (n.textContent?.trim() === "Am") {
        const range = document.createRange();
        range.selectNodeContents(n);
        chordRect = range.getBoundingClientRect();
      }
    }
    const strings = [...staff.querySelectorAll(".tab-cell")].map((c) => c.getBoundingClientRect());
    return {
      bandTop: Math.round(band.top * 10) / 10,
      bandHeight: Math.round(band.height),
      staffTop: Math.round(staff.getBoundingClientRect().top * 10) / 10,
      staffHeight: Math.round(staff.getBoundingClientRect().height),
      chordTop: chordRect ? Math.round(chordRect.top * 10) / 10 : null,
      chordBottom: chordRect ? Math.round(chordRect.bottom * 10) / 10 : null,
      /** How much of the chord label is above the box that clips it. */
      chordClippedPx: chordRect ? Math.max(0, Math.round((band.top - chordRect.top) * 10) / 10) : null,
      chordVisible: chordRect ? chordRect.top >= band.top - 0.5 : null,
      firstStringTop: Math.round(Math.min(...strings.map((r) => r.top)) * 10) / 10,
      scrollTop: scroller!.scrollTop,
      canScrollTo: scroller!.scrollHeight > scroller!.clientHeight,
    };
  });
}

async function build(page: Page, shape: string) {
  await page.setViewportSize({ width: 375, height: 667 });
  await startCapturing(page);
  await fret(page, "A", 5).click();
  await fret(page, "A", 7).click();
  await fret(page, "A", 9).click();
  await expect(columns(page)).toHaveCount(3);
  if (shape === "chords and tuplet") await page.getByTitle(/triplet/).click();
  await page.getByRole("button", { name: "chord symbol" }).click();
  await page.getByRole("textbox", { name: "Chord" }).fill("Am");
  await page.getByRole("button", { name: "Set", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Chord" })).toHaveCount(0);
  await page.mouse.move(0, 0);
  await page.waitForTimeout(250);
}

for (const theme of ["light", "dark"] as const) {
  for (const shape of ["chords", "chords and tuplet"]) {
    for (const target of ["column", "barline"] as const) {
      test(`chord row at 375x667 - ${theme}, ${shape}, ${target}`, async ({ page }, info) => {
        test.skip(info.project.name !== "mobile", "one project is enough for a measurement");
        await page.emulateMedia({ colorScheme: theme });
        await build(page, shape);
        if (target === "barline") {
          await page.getByRole("button", { name: "Barline" }).click();
          await expect(columns(page)).toHaveCount(4);
        }
        const m = await measure(page);
        console.log(`MEASURE ${theme}/${shape}/${target} ${JSON.stringify(m)}`);
        const build_ = process.env.BASELINE_DIR ? "main" : "branch";
        await page.screenshot({
          path: path.join(
            os.tmpdir(),
            `spec001-r3-chordrow-${build_}-${theme}-${shape.split(" ").length}-${target}.png`,
          ),
        });
        expect(m.chordTop, "the chord label is on the staff").not.toBeNull();
        expect(m.chordClippedPx, "the chord row is on screen").toBeLessThanOrEqual(1);
      });
    }
  }
}
