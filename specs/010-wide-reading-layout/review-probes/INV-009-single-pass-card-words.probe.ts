/**
 * INV-009 / FR-013 / FR-015 (review round 1). A single pass of a repeated entry keeps today's `pass k of n`
 * (FR-015), and every head-row item stays (FR-013). While the reading position is on such a card, its pass words
 * must still name the pass, not vanish. Walks the keys over the fit song (card 2 is `A′`, `pass 4 of 4`) and over
 * F3 (`A ×2` with `A′` last: two single cards, `pass 1 of 2` and `pass 2 of 2`).
 */
import { expect, test, type Page } from "@playwright/test";
import { FOLD, seedFitSong, seedFold } from "../../../e2e/wide-helpers";

test.setTimeout(180_000);

/** What a reader sees of the pass words on every card holding `card-passes`, after each "column on". */
const walk = (page: Page, count: number) =>
  page.evaluate((count) => {
    const out: { card: string | null; seen: string; rest: string; live: string }[] = [];
    for (let i = 0; i < count; i++) {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, cancelable: true }));
      const li = document.querySelector(".tab-column-reading")?.closest("li[data-card]") ?? null;
      const slot = li?.querySelector('[data-testid="card-passes"]');
      if (!li || !slot) continue;
      const rest = slot.querySelector<HTMLElement>('[data-testid="card-passes-rest"]')!;
      const live = slot.querySelector<HTMLElement>('[data-testid="card-passes-live"]')!;
      const visible = (el: HTMLElement) => getComputedStyle(el).visibility !== "hidden" && getComputedStyle(el).display !== "none";
      const seen = [rest, live].filter(visible).map((el) => el.textContent ?? "").join("").trim();
      out.push({ card: li.getAttribute("data-card"), seen, rest: rest.textContent ?? "", live: live.textContent ?? "" });
    }
    return out;
  }, count);

const settle = (page: Page) =>
  page.waitForFunction(() => {
    const cards = [...document.querySelectorAll("ol.reading-cards > li")];
    return cards.length > 0 && cards.every((li) => li.querySelectorAll("[data-column]").length > 0);
  });

for (const id of ["fit", "F3"]) {
  for (const width of [375, 1280]) {
    test(`pass words stay readable on every card while it is read: ${id} at ${width}`, async ({ page }, info) => {
      test.skip(info.project.name !== "desktop", "keys; the viewport is set here");
      await page.setViewportSize({ width, height: 800 });
      const row = FOLD.find((r) => r.id === id);
      const seeded = row ? await seedFold(page, row) : await seedFitSong(page);
      await page.goto(seeded.playUrl);
      await settle(page);
      const columns = await page.evaluate(() => document.querySelectorAll("ol.reading-cards [data-column]").length);
      const steps = await walk(page, columns * 4);
      expect(steps.length).toBeGreaterThan(0);
      const blank = steps.filter((s) => s.seen === "");
      // Every card that carries pass words must show some while the reading position is on it.
      expect(blank.map((s) => `card ${s.card}: rest "${s.rest}" hidden, live "${s.live}"`).slice(0, 3)).toEqual([]);
    });
  }
}
