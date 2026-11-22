/**
 * Spec 013 INV-006 / INV-017 / FR-006: a song-page part card that shows the recorder (and no memo yet) is never narrower
 * than 343px (or the row), and the rows stay greedy while it records. Own file because `withFakeMicrophone` is a `test.use`.
 */
import { expect, test } from "@playwright/test";
import { drawnRows, greedyRows, isRoundingTie, measureCards, ownWidths } from "./cards-helpers";
import { startRecording, withFakeMicrophone } from "./memo-helpers";
import { seedFitSong } from "./wide-helpers";

test.setTimeout(300_000);
withFakeMicrophone();

test("INV-006: the recorder's card keeps the 343px floor at 768-1920", async ({ page }) => {
  const { songUrl } = (await seedFitSong(page)) as unknown as { songUrl: string };
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(songUrl);
  await expect(page.locator(".reading-cards > li").first()).toBeVisible();
  const labels = await page.evaluate(() =>
    [...document.querySelectorAll(".reading-cards > li")].map((li) => (li.querySelector(".reading-card > :first-child a")?.textContent ?? "").trim()),
  );
  await startRecording(page, labels[labels.length - 1]);
  await expect(page.getByTestId("part-memos")).toHaveCount(1);
  for (const width of [768, 1024, 1280, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(async () => {
      await document.fonts.ready;
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    });
    await page.waitForTimeout(250);
    const m = await measureCards(page);
    const where = `recording @${width}`;
    const i = m.cards.findIndex((c) => c.memo);
    expect(i, `${where}: a card holds part-memos`).toBeGreaterThanOrEqual(0);
    expect(m.cards[i].width, `${where}: recorder card`).toBeGreaterThanOrEqual(Math.min(343, m.row) - 0.5);
    const own = ownWidths(m);
    if (!isRoundingTie(own, m.row, m.tokens.gap)) expect(drawnRows(m.cards), where).toEqual(greedyRows(own, m.row, m.tokens.gap));
    const clipped = await page.evaluate(() => {
      const sec = document.querySelector('[data-testid="part-memos"]')!;
      const card = sec.closest("li")!.getBoundingClientRect();
      return [...sec.querySelectorAll("button, [role=status], [data-testid]")].filter((e) => {
        const r = e.getBoundingClientRect();
        return r.width > 0 && (r.left < card.left - 0.5 || r.right > card.right + 0.5);
      }).length;
    });
    expect(clipped, `${where}: recorder controls outside the card`).toBe(0);
  }
  await page.getByTestId("record-stop").click();
});
