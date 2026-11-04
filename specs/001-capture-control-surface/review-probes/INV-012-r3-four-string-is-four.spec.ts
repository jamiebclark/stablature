/**
 * INV-012 test integrity (round 3): e2e/capture-surface.spec.ts:634 `startFourString` waits
 * on the text "Default", which is on screen before "Make default" lands, then navigates.
 * The `four` shape's assertions (:736) never check the string count, so if the write is
 * lost the member measures a five-string part and passes. This replays the sequence
 * verbatim and REPORTS how many strings the part really has (grep STRINGS): round 3 saw
 * 7 x four and 1 x five over 8 runs under parallel load. It asserts only that the part is
 * one or the other, because the race is the finding and must not fail this run at random.
 */
import { expect, test } from "@playwright/test";
import { fret } from "./helpers";

for (let run = 0; run < 4; run++) {
  test(`startFourString's sequence yields a four-string part - run ${run}`, async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/");
    await page.getByLabel("Band name").fill("Hollow Crown");
    await page.getByRole("button", { name: "Add band" }).click();
    await expect(page).toHaveURL(/\/bands\/[0-9a-f-]+$/);
    const bandUrl = page.url();

    await page.goto(`${bandUrl}/tunings`);
    await page.getByRole("button", { name: "Bass 4", exact: true }).click();
    await page.getByRole("button", { name: "Add E Standard" }).click();
    await page.getByRole("button", { name: "Make default" }).first().click();
    await expect(page.getByText("Default").first()).toBeVisible();

    await page.goto(bandUrl);
    await page.getByLabel("Song title").fill("Dirge");
    await page.getByRole("button", { name: "Add song" }).click();
    await expect(page).toHaveURL(/\/songs\/[0-9a-f-]+$/);
    await page.getByRole("link", { name: "Capture" }).click();
    await page.getByRole("button", { name: "Add a part" }).click();
    await expect(page).toHaveURL(/\/capture\/[0-9a-f-]+$/);

    await fret(page, "A", 5).click();
    const rows = await page.evaluate(() => {
      const tops = [...document.querySelectorAll('[data-testid="tab-staff"] .tab-cell')].map((c) =>
        Math.round(c.getBoundingClientRect().top),
      );
      return new Set(tops).size;
    });
    console.log(`STRINGS ${rows}`);
    expect([4, 5]).toContain(rows);
  });
}
