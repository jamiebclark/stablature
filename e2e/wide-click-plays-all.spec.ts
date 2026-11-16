/**
 * INV-010: folding cards does not change what the click plays. A regression fence: it passes on the
 * pre-change tree by design, and `notationColumns` is untouched by this feature.
 */
import { expect, test } from "@playwright/test";
import { FOLD, openFourString, seedFitSong, seedFold } from "./wide-helpers";
import { level, rec, recorder, setStoredTempo } from "./rhythm-probe-helpers";

test.setTimeout(180_000);

/** Bars across every pass: the fit song's 38, and each Fold row's passes times the bars of its part. */
const BARS: Record<string, number> = { fit: 38, F2: 16, F5: 16, F8: 6 };

for (const id of Object.keys(BARS)) {
  test(`INV-010 the click plays every bar of every pass: ${id}`, async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "the engine does not differ by device");
    await recorder(page);
    const row = FOLD.find((r) => r.id === id);
    const seeded = row ? await seedFold(page, row) : await seedFitSong(page);
    if (row) await openFourString(page, seeded.songUrl);
    await setStoredTempo(page, 600);
    await page.goto(seeded.playUrl);
    await expect(page.locator("ol.reading-cards > li").first()).toBeVisible();
    await page.getByTestId("click-start").click();
    await expect(page.getByTestId("click-state")).toHaveText("Plain beat.", { timeout: 120_000 });
    await page.getByTestId("click-stop").click();
    const accents = (await rec(page)).starts.filter((s) => level(s.hz) === "accent");
    expect(accents.length).toBe(BARS[id]);
  });
}
