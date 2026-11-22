/**
 * Spec 013 research R5: why the song page stops fitting under per-card sizing. For the fit and short songs at 1280x800
 * with a mouse, under the candidate CSS (measure-rows.probe.ts), records each part card's head row: its one-line
 * (max-content) width, its drawn height and items, and the page's vertical budget. Records only.
 */
import { expect, test, type Page } from "@playwright/test";
import { writeFileSync } from "node:fs";
import { seedFitSong, seedWideSong } from "../../../e2e/wide-helpers";

test.setTimeout(300_000);

const CSS = `
@media (min-width: 768px) {
  .reading-cards { display: flex !important; flex-wrap: wrap; gap: var(--card-gap); align-items: flex-start; }
  .reading-cards::after { content: ""; flex: 9999 0 0; margin-left: calc(-1 * var(--card-gap)); }
  .reading-cards > li {
    --card-own: max(9rem, calc(var(--li-line, 0px) + 2 * var(--card-pad-x) + 2px));
    flex: 1 0 var(--card-own); max-width: 100%; min-width: 0;
  }
}`;

const record = (page: Page) =>
  page.evaluate(() => {
    for (const li of document.querySelectorAll<HTMLElement>(".reading-cards > li")) {
      const ruler = li.querySelector<HTMLElement>('[data-testid="tab-ruler"]');
      if (ruler) li.style.setProperty("--li-line", `${Math.ceil(ruler.getBoundingClientRect().width)}px`);
    }
    const r1 = (x: number) => Math.round(x * 10) / 10;
    return [...document.querySelectorAll<HTMLElement>(".reading-cards > li")].map((li) => {
      const head = li.querySelector<HTMLElement>(".reading-card > div")!;
      const clone = head.cloneNode(true) as HTMLElement;
      clone.style.cssText = "position:absolute;visibility:hidden;width:max-content;flex-wrap:nowrap";
      li.appendChild(clone);
      const natural = clone.getBoundingClientRect().width;
      const items = [...clone.children].map((c) => `${(c.textContent ?? "").trim() || c.getAttribute("aria-label") || c.tagName}:${r1(c.getBoundingClientRect().width)}`);
      clone.remove();
      const card = li.getBoundingClientRect();
      const staff = li.querySelector(".tab-staff")?.getBoundingClientRect();
      return {
        width: r1(card.width), height: r1(card.height), top: r1(card.top),
        headNatural: r1(natural), headHeight: r1(head.getBoundingClientRect().height),
        staffHeight: staff ? r1(staff.height) : null, items,
      };
    });
  });

test("song page head rows", async ({ page }) => {
  const out: Record<string, unknown> = {};
  await page.setViewportSize({ width: 1280, height: 800 });
  for (const song of ["fit", "short"] as const) {
    const { songUrl } = song === "fit" ? await seedFitSong(page) : await seedWideSong(page, song);
    for (const mode of ["today", "per-card"] as const) {
      await page.goto(songUrl);
      await expect(page.getByTestId("tab-ruler").first()).toBeAttached();
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(300);
      if (mode === "per-card") await page.addStyleTag({ content: CSS });
      const cards = await record(page);
      await page.waitForTimeout(200);
      const again = mode === "per-card" ? await record(page) : cards;
      out[`${song} | ${mode}`] = {
        scroll: await page.evaluate(() => document.documentElement.scrollHeight),
        listTop: await page.evaluate(() => Math.round(document.querySelector(".reading-cards")!.getBoundingClientRect().top)),
        cards: again,
      };
    }
  }
  writeFileSync("specs/013-cards-per-row/research-probes/song-head.json", JSON.stringify(out, null, 1) + "\n");
});
