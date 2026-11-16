/**
 * INV-019 (review round 1): the fit song in frets, both pages, at 1280. e2e/wide-ruler.spec.ts fails on this row
 * intermittently (lines vs ruler off by 50 to 58px). This waits for the staves to settle (every card has its
 * columns, `--staff-line` written, fonts ready) and reports each card's lines, ruler and difference, so a failure
 * says which card and page.
 */
import { expect, test } from "@playwright/test";
import { remember } from "../../../e2e/reading-helpers";
import { seedFitSong } from "../../../e2e/wide-helpers";

test.setTimeout(180_000);

test("ruler equals the one-line staff on every card of the fit song, frets", async ({ page }) => {
  const { songUrl, playUrl } = await seedFitSong(page);
  await remember(page, "frets");
  await page.setViewportSize({ width: 1280, height: 900 });
  const bad: string[] = [];
  for (const url of [songUrl, playUrl]) {
    await page.goto(url);
    await expect(page.getByTestId("tab-ruler").first()).toBeAttached();
    await page.waitForFunction(() => {
      const lis = [...document.querySelectorAll(".reading-cards > li")];
      return lis.length > 0 && lis.every((li) => li.querySelector("[data-column]")) && document.querySelector<HTMLElement>(".reading-cards")!.style.getPropertyValue("--staff-line") !== "";
    });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(300);
    const rows = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>(".tab-wrapped-body")].map((body) => {
        const lines = body.querySelector<HTMLElement>(".tab-lines")!;
        const ruler = body.parentElement!.querySelector<HTMLElement>('[data-testid="tab-ruler"]')!;
        const before = { lines: lines.getBoundingClientRect().width, runs: lines.querySelectorAll(".tab-bar-run").length };
        lines.style.flexWrap = "nowrap";
        lines.style.width = "max-content";
        lines.querySelectorAll<HTMLElement>(".tab-bar-run").forEach((r) => (r.style.flex = "none"));
        const gutter = parseFloat(getComputedStyle(body).paddingLeft);
        return { before, lines: lines.getBoundingClientRect().width + gutter, ruler: ruler.getBoundingClientRect().width, columns: body.querySelectorAll("[data-column]").length };
      }),
    );
    rows.forEach((r, i) => {
      if (Math.abs(r.lines - r.ruler) > 1) bad.push(`${url.endsWith("/play") ? "play" : "song"} card ${i}: ${JSON.stringify(r)}`);
    });
  }
  expect(bad).toEqual([]);
});
