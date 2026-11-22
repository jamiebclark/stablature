/**
 * Review probe, INV-006 / INV-017 / FR-006: a song-page part card that shows the recorder (and no memo yet) is never
 * narrower than 343px (or the row), and the rows stay greedy while it records. The plan's memo song has the recorder open
 * on part C; the suite's memo song (seedMemoSong) has one ready memo and no recorder. {768, 1024, 1280, 1920}, mouse.
 */
import { expect, test } from "@playwright/test";
import { startRecording, withFakeMicrophone } from "../../../e2e/memo-helpers";
import { seedFitSong } from "../../../e2e/wide-helpers";
import { drawn, greedy, measure, own, settle } from "./measure";

test.setTimeout(400_000);
withFakeMicrophone();
// Round 2: Firefox cannot grant the microphone permission, and the context is made before an in-test skip runs.
test.skip(({ browserName }) => browserName !== "chromium", "fake microphone, Chromium only");

test("INV-006 the recorder's card keeps the 343px floor", async ({ page }, info) => {
  test.skip(info.project.name !== "probe-desktop", "fake microphone, Chromium desktop");
  const { songUrl } = (await seedFitSong(page)) as unknown as { songUrl: string };
  const bad: string[] = [];
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(songUrl);
  await expect(page.locator(".reading-cards > li").first()).toBeVisible();
  const labels = await page.evaluate(() =>
    [...document.querySelectorAll(".reading-cards > li")].map((li) => (li.querySelector(".reading-card > :first-child a")?.textContent ?? "").trim()),
  );
  const target = labels[labels.length - 1];
  await startRecording(page, target);
  await expect(page.getByTestId("part-memos")).toHaveCount(1);
  for (const width of [768, 1024, 1280, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await settle(page);
    const m = await measure(page);
    const w = own(m);
    const g = greedy(w, m.row, m.gap);
    const d = drawn(m.cards);
    const where = `recording on ${target} @${width}`;
    console.log(`${where}: widths [${m.cards.map((c) => c.width.toFixed(0))}] memo [${m.cards.map((c) => (c.memo ? 1 : 0))}] drawn ${JSON.stringify(d)} greedy ${JSON.stringify(g.rows)}`);
    const i = m.cards.findIndex((c) => c.memo);
    if (i < 0) bad.push(`${where}: no card holds part-memos`);
    else if (m.cards[i].width < Math.min(343, m.row) - 0.5) bad.push(`${where}: recorder card ${m.cards[i].width}`);
    if (!g.tie && JSON.stringify(d) !== JSON.stringify(g.rows)) bad.push(`${where}: rows ${JSON.stringify(d)} vs ${JSON.stringify(g.rows)}`);
    const clipped = await page.evaluate(() => {
      const sec = document.querySelector('[data-testid="part-memos"]')!;
      const card = sec.closest("li")!.getBoundingClientRect();
      return [...sec.querySelectorAll("button, [role=status], [data-testid]")].filter((e) => {
        const r = e.getBoundingClientRect();
        return r.width > 0 && (r.left < card.left - 0.5 || r.right > card.right + 0.5);
      }).length;
    });
    if (clipped) bad.push(`${where}: ${clipped} recorder controls outside the card`);
  }
  await page.getByTestId("record-stop").click();
  console.log(bad.join("\n"));
  expect(bad).toEqual([]);
});
