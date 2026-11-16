/**
 * INV-010 (review round 1): folding never changes what is counted or sounded. wide-click-plays-all.spec.ts asserts
 * `accents >= bars`, which cannot see an extra pass. This waits for the following to end (the bar says
 * "Plain beat.") and holds the accents to exactly the bar starts of every pass: the fit song's 38, and each Fold
 * row's passes × bars.
 */
import { expect, test } from "@playwright/test";
import { FOLD, openFourString, seedFitSong, seedFold } from "../../../e2e/wide-helpers";
import { level, rec, recorder, setStoredTempo } from "../../../e2e/rhythm-probe-helpers";

test.setTimeout(240_000);

const BARS: Record<string, number> = { fit: 38, F2: 16, F5: 16, F8: 6 };

for (const id of Object.keys(BARS)) {
  test(`exactly one accent per bar of every pass: ${id}`, async ({ page }, info) => {
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
