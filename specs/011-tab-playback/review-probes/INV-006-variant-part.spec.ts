/**
 * Round 2. INV-006 / INV-010 over Sc = "part of a variant", which round 1 did not run: part playback of the variant
 * A' (`a2`, variantOf `a`) of the playback song plays exactly the columns its one card draws, in order, once per round.
 *
 * 600 bpm, Loop off (part playback opens with Loop on). The expected list is read from the page: every non-barline
 * `[data-column]` of the one `li[data-card]`, in document order. The outline log must equal it, and the run must end by
 * itself with nothing outlined.
 */
import { expect, test } from "@playwright/test";
import { setStoredTempo } from "../../../e2e/rhythm-probe-helpers";
import { openCluster } from "../../../e2e/usability-helpers";
import { installPlayRecorder, noteStarts, playRecord, seedPlaybackSong } from "../../../e2e/play-helpers";

test("variant part playback: the outline walks exactly the variant's drawn columns", async ({ page }) => {
  test.setTimeout(90_000);
  await installPlayRecorder(page);
  const s = await seedPlaybackSong(page);
  await setStoredTempo(page, 600);
  await page.goto(`${s.songUrl}/play/${s.parts.a2}`);
  await expect(page.getByTestId("part-playback")).toContainText("Part A'");
  await expect(page.getByTestId("click-start")).toHaveText("Play");
  await openCluster(page);
  if ((await page.getByTestId("play-loop").getAttribute("aria-pressed")) === "true") await page.getByTestId("play-loop").click();
  await expect(page.getByTestId("play-loop")).toHaveAttribute("aria-pressed", "false");
  await page.getByTestId("panel-play-cluster").click();

  const expected = await page.evaluate(() => {
    const cards = [...document.querySelectorAll("li[data-card]")];
    return {
      cards: cards.length,
      keys: cards.flatMap((li) =>
        [...li.querySelectorAll('[data-column]:not([data-barline="true"])')].map((c) => c.getAttribute("data-column")!),
      ),
    };
  });
  await page.evaluate(() => {
    const w = window as unknown as { __keys: string[] };
    w.__keys = [];
    let last = "";
    new MutationObserver(() => {
      const key = document.querySelector(".tab-column-reading")?.getAttribute("data-column") ?? "";
      if (key && key !== last) w.__keys.push(key);
      last = key;
    }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ["class"] });
  });
  await page.getByTestId("click-start").click();
  await expect(page.getByTestId("click-stop")).toBeVisible();
  await expect(page.getByTestId("click-start")).toBeVisible({ timeout: 60_000 });
  const keys = await page.evaluate(() => (window as unknown as { __keys: string[] }).__keys);
  const notes = noteStarts(await playRecord(page)).length;
  expect(expected.cards).toBe(1);
  expect(expected.keys.length).toBeGreaterThan(4);
  expect(keys).toEqual(expected.keys);
  expect(notes, "a note sounded for each column").toBeGreaterThanOrEqual(expected.keys.length);
  await expect(page.locator(".tab-column-reading")).toHaveCount(0);
});
