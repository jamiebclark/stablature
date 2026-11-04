/**
 * Round 2 baseline: the same measurements against ANY build, so a "worse than main" claim
 * is a number and not an inference. Locators work on main (no strip, no testids) as well
 * as on this branch. Run with PROBE_PORT pointing at either server; compare the MEASURE
 * lines. Fails only if the portrait page itself scrolls.
 */
import { expect, test, type Page } from "@playwright/test";
import { columns, fret, startCapturing } from "./helpers";

const stack = (page: Page) => page.getByRole("button", { name: /^stack/ });
const stacking = (page: Page) => page.getByText("stacking onto the marked column");

async function measure(page: Page) {
  return page.evaluate(() => {
    const root = document.scrollingElement!;
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
    return {
      pageOver: root.scrollHeight - root.clientHeight,
      staffBand: Math.round(band.height),
      strings: tops.length,
      stringsClipped: hidden.length,
      neckGrid: document.querySelector(".w-max.min-w-full.px-1")?.getBoundingClientRect().height,
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
  if (shape === "tuplet") await page.getByTitle(/triplet/).click();
  if (shape !== "plain") {
    await page.getByRole("button", { name: "chord symbol" }).click();
    await page.getByRole("textbox", { name: "Chord" }).fill("Am");
    await page.getByRole("button", { name: "Set", exact: true }).click();
    await expect(page.getByRole("textbox", { name: "Chord" })).toHaveCount(0);
  }
}

test.describe.configure({ mode: "serial" });

for (const shape of ["plain", "chords", "tuplet"]) {
  test(`measure ${shape}`, async ({ page }, info) => {
    test.skip(info.project.name !== "mobile", "one project is enough for a measurement");
    await build(page, shape);
    const closed = await measure(page);
    await page.getByRole("button", { name: "chord symbol" }).click();
    await expect(page.getByRole("textbox", { name: "Chord" })).toBeVisible();
    const open = await measure(page);
    console.log(`MEASURE ${shape} form-closed ${JSON.stringify(closed)}`);
    console.log(`MEASURE ${shape} form-open   ${JSON.stringify(open)}`);
    expect(open.pageOver).toBeLessThanOrEqual(0);
  });
}

test("measure landscape", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile", "one project is enough for a measurement");
  await build(page, "plain");
  await page.setViewportSize({ width: 667, height: 375 });
  await page.waitForTimeout(100);
  console.log(`MEASURE landscape 667x375 ${JSON.stringify(await measure(page))}`);
});

for (const where of ["mid-part", "end"]) {
  test(`measure latch across paste, cursor ${where}`, async ({ page }, info) => {
    test.skip(info.project.name !== "mobile", "one project is enough for a measurement");
    await page.setViewportSize({ width: 375, height: 667 });
    await startCapturing(page);
    await fret(page, "E", 7).click();
    await fret(page, "A", 5).click();
    await expect(columns(page)).toHaveCount(2);
    await columns(page).nth(0).click();
    await page.getByRole("button", { name: /select/ }).click();
    await page.getByRole("button", { name: "copy", exact: true }).click();
    await expect(page.getByRole("button", { name: /paste/ })).toBeEnabled();
    if (where === "mid-part") await columns(page).nth(0).click();
    else await page.getByRole("button", { name: /end/ }).click();
    await stack(page).click();
    await expect(stacking(page)).toBeVisible();
    await page.getByRole("button", { name: /paste/ }).click();
    await expect(columns(page)).toHaveCount(3);
    await page.waitForTimeout(250);
    console.log(`MEASURE paste ${where}: still stacking = ${await stacking(page).count()}`);
  });
}
