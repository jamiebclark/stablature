/**
 * INV-012 / FR-026 / FR-028 (round 3): the plan enumerates 4- and 5-string parts, but the
 * app ships 6- and 7-string tunings too (src/lib/tunings.ts:62), and FR-026's "continue to
 * fit" is not limited to five strings. Same measurement on ANY build, so "worse than main"
 * is a number. Locators work on main (no strip, no testids) as well as on this branch.
 *
 *   BASELINE_DIR=<built main> PROBE_PORT=3301 npx playwright test \
 *     --config specs/001-capture-control-surface/review-probes/playwright.baseline.config.ts \
 *     INV-012-r3
 *
 * With THIS_BUILD_BOUND set, it also fails if the branch clips more strings than main did.
 */
import { expect, test, type Page } from "@playwright/test";
import { columns, fret } from "./helpers";

const TUNINGS = [
  { family: "Bass 4", preset: "E Standard", strings: 4 },
  { family: "Bass 5", preset: "Drop A", strings: 5 },
  { family: "Bass 6", preset: "Drop A", strings: 6 },
  { family: "Guitar 6", preset: "E Standard", strings: 6 },
  { family: "Guitar 7", preset: "B Standard", strings: 7 },
];

async function startWith(page: Page, family: string, preset: string, strings: number) {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto("/");
  await page.getByLabel("Band name").fill("Hollow Crown");
  await page.getByRole("button", { name: "Add band" }).click();
  await expect(page).toHaveURL(/\/bands\/[0-9a-f-]+$/);
  const bandUrl = page.url();
  await page.goto(`${bandUrl}/tunings`);
  await page.getByRole("button", { name: family, exact: true }).click();
  await page.getByRole("button", { name: `Add ${preset}` }).first().click();
  await page.getByRole("button", { name: "Make default" }).first().click();
  // The default sorts first. Waiting on the word "default" proves nothing: it is on screen
  // before the click lands, and leaving early loses the write (see INV-012-r3-four-string).
  const first = page.getByRole("listitem").first();
  await expect(first).toContainText(`${strings}-string`);
  await expect(first).toContainText(preset);
  await page.goto(bandUrl);
  await page.getByLabel("Song title").fill("Dirge");
  await page.getByRole("button", { name: "Add song" }).click();
  await expect(page).toHaveURL(/\/songs\/[0-9a-f-]+$/);
  await page.getByRole("link", { name: "Capture" }).click();
  await page.getByRole("button", { name: "Add a part" }).click();
  await expect(page).toHaveURL(/\/capture\/[0-9a-f-]+$/);
}

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
    const neck = document.querySelector(".w-max.min-w-full.px-1")!.getBoundingClientRect();
    return {
      pageOver: root.scrollHeight - root.clientHeight,
      scrollerOver: scroller!.scrollHeight - scroller!.clientHeight,
      staffBand: Math.round(band.height),
      strings: tops.length,
      stringsClipped: hidden.length,
      neck: Math.round(neck.height),
      neckBottom: Math.round(neck.bottom),
      viewport: window.innerHeight,
    };
  });
}

test.describe.configure({ mode: "serial" });

for (const t of TUNINGS) {
  for (const shape of ["plain", "chords", "tuplet"] as const) {
    test(`tuning ${t.family} ${t.preset}, ${shape}`, async ({ page }, info) => {
      test.skip(info.project.name !== "mobile", "one project is enough for a measurement");
      await startWith(page, t.family, t.preset, t.strings);
      await fret(page, "D", 5).click();
      await fret(page, "D", 7).click();
      await fret(page, "D", 9).click();
      await expect(columns(page)).toHaveCount(3);
      if (shape === "tuplet") await page.getByTitle(/triplet/).click();
      if (shape !== "plain") {
        await page.getByRole("button", { name: "chord symbol" }).click();
        await page.getByRole("textbox", { name: "Chord" }).fill("Am");
        await page.getByRole("button", { name: "Set", exact: true }).click();
        await expect(page.getByRole("textbox", { name: "Chord" })).toHaveCount(0);
      }
      const m = await measure(page);
      console.log(`MEASURE ${t.family}/${t.strings} ${shape} ${JSON.stringify(m)}`);
      expect(m.strings).toBe(t.strings);
    });
  }
}
