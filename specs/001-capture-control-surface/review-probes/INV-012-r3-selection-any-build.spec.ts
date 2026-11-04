/**
 * INV-012 / FR-003 / FR-028 (round 3): every fit measurement so far has the status row in
 * place. A selection swaps it for the selection row, which is `flex-wrap`, while this branch
 * keeps a blank row 2 under it. Does the staff still show its strings during a selection?
 * Runs on any build; compare the MEASURE lines. Fails only if the branch hides a string that
 * main shows (BASELINE_CLIPPED below is main's measured figure).
 */
import { expect, test, type Page } from "@playwright/test";
import { columns, fret, startCapturing } from "./helpers";

/** Measured on a build of main: the selection row wraps, and 1 of 5 strings is hidden, every shape. */
const BASELINE_CLIPPED = 1;

async function measure(page: Page) {
  return page.evaluate(() => {
    const staff = document.querySelector('[data-testid="tab-staff"]')!;
    let scroller: Element | null = staff.parentElement;
    while (scroller && !/(auto|scroll)/.test(getComputedStyle(scroller).overflowY)) {
      scroller = scroller.parentElement;
    }
    const band = scroller!.getBoundingClientRect();
    const rows = [...staff.querySelectorAll(".tab-cell")].map((c) => c.getBoundingClientRect());
    const tops = [...new Set(rows.map((r) => Math.round(r.top)))];
    const hidden = tops.filter((t) => {
      const r = rows.find((x) => Math.round(x.top) === t)!;
      return r.top < band.top - 1 || r.bottom > band.bottom + 1;
    });
    const root = document.scrollingElement!;
    return {
      band: Math.round(band.height),
      strings: tops.length,
      stringsClipped: hidden.length,
      pageOver: root.scrollHeight - root.clientHeight,
    };
  });
}

for (const shape of ["plain", "chords", "chords and tuplet"]) {
  test(`staff during a selection at 375x667 - ${shape}`, async ({ page }, info) => {
    test.skip(info.project.name !== "mobile", "one project is enough for a measurement");
    await page.setViewportSize({ width: 375, height: 667 });
    await startCapturing(page);
    await fret(page, "A", 5).click();
    await fret(page, "A", 7).click();
    await fret(page, "A", 9).click();
    await expect(columns(page)).toHaveCount(3);
    if (shape === "chords and tuplet") await page.getByTitle(/triplet/).click();
    if (shape !== "plain") {
      await page.getByRole("button", { name: "chord symbol" }).click();
      await page.getByRole("textbox", { name: "Chord" }).fill("Am");
      await page.getByRole("button", { name: "Set", exact: true }).click();
      await expect(page.getByRole("textbox", { name: "Chord" })).toHaveCount(0);
    }
    const before = await measure(page);
    await columns(page).nth(0).click();
    await page.getByRole("button", { name: "select" }).click();
    await expect(page.getByText(/^1 selected/)).toBeVisible();
    const during = await measure(page);
    console.log(`MEASURE ${shape} before ${JSON.stringify(before)} during ${JSON.stringify(during)}`);
    expect(during.pageOver).toBeLessThanOrEqual(0);
    expect(during.stringsClipped, "no worse than main").toBeLessThanOrEqual(BASELINE_CLIPPED);
  });
}
