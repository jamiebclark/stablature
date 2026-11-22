/**
 * Spec 013 research R2-R4: what per-card sizing draws, before any code changes.
 *
 * Seeds the fit, short, long and names songs, opens both pages at the fit and wide sizes with a mouse, injects the
 * candidate CSS (research R1: a wrapping flex row, each card's basis at its own width, a list ::after filler) for
 * each candidate card minimum, writes each card's own ruler width onto its li, and records rows, fit and staff lines.
 * Records only; writes measure-rows.json.
 */
import { expect, test, type Page } from "@playwright/test";
import { writeFileSync } from "node:fs";
import { seedFitSong, seedWideSong } from "../../../e2e/wide-helpers";

test.setTimeout(900_000);

const OUT = "specs/013-cards-per-row/research-probes/measure-rows.json";
const MINIMA = ["8rem", "9rem", "10rem", "12rem"];
const SIZES = [
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
];

const css = (min: string) => `
@media (min-width: 768px) {
  .reading-cards { display: flex !important; flex-wrap: wrap; gap: var(--card-gap); align-items: flex-start; }
  .reading-cards::after { content: ""; flex: 9999 0 0; margin-left: calc(-1 * var(--card-gap)); }
  .reading-cards > li {
    --card-min: ${min};
    --card-own: max(var(--card-min), calc(var(--li-line, 0px) + 2 * var(--card-pad-x) + 2px));
    flex: 1 0 var(--card-own); max-width: 100%; min-width: 0;
  }
}`;

async function apply(page: Page, min: string) {
  await page.addStyleTag({ content: css(min) });
  await page.evaluate(() => {
    for (const li of document.querySelectorAll<HTMLElement>(".reading-cards > li")) {
      const ruler = li.querySelector<HTMLElement>('[data-testid="tab-ruler"]');
      if (ruler) li.style.setProperty("--li-line", `${Math.ceil(ruler.getBoundingClientRect().width)}px`);
    }
  });
  await page.waitForTimeout(150);
}

const measure = (page: Page) =>
  page.evaluate(() => {
    const list = document.querySelector<HTMLElement>(".reading-cards")!;
    const lr = list.getBoundingClientRect();
    const bar = document.querySelector('[data-testid="click-bar"]')?.getBoundingClientRect() ?? null;
    const cards = [...list.children].map((li) => {
      const r = li.getBoundingClientRect();
      const ruler = li.querySelector<HTMLElement>('[data-testid="tab-ruler"]');
      const runs = [...li.querySelectorAll(".tab-bar-run")].map((x) => Math.round(x.getBoundingClientRect().top));
      const head = li.querySelector(".reading-card > div")!;
      const hr = head.getBoundingClientRect();
      const clipped = [...head.children].some((c) => {
        const b = c.getBoundingClientRect();
        return b.right > r.right + 0.5 || b.left < r.left - 0.5;
      });
      return {
        left: Math.round(r.left * 10) / 10,
        top: Math.round(r.top),
        width: Math.round(r.width * 10) / 10,
        bottom: Math.round(r.bottom),
        ruler: ruler ? Math.round(ruler.getBoundingClientRect().width * 10) / 10 : null,
        lines: new Set(runs).size,
        head: Math.round(hr.height),
        clipped,
      };
    });
    const tops = [...new Set(cards.map((c) => c.top))];
    return {
      list: Math.round(lr.width * 10) / 10,
      perRow: tops.map((t) => cards.filter((c) => c.top === t).length),
      scroll: document.documentElement.scrollHeight,
      inner: innerHeight,
      sideways: document.documentElement.scrollWidth > innerWidth,
      barTop: bar ? Math.round(bar.top) : null,
      lastBottom: Math.max(...cards.map((c) => c.bottom)),
      cards,
    };
  });

test("per-card rows", async ({ page }) => {
  const record: Record<string, unknown> = {};
  for (const song of ["fit", "short", "long", "names"] as const) {
    const { songUrl, playUrl } = song === "fit" ? await seedFitSong(page) : await seedWideSong(page, song);
    for (const size of SIZES) {
      await page.setViewportSize(size);
      for (const [which, url] of [["song", songUrl], ["play", playUrl]] as const) {
        await page.goto(url);
        await expect(page.getByTestId("tab-ruler").first()).toBeAttached();
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(300);
        record[`${song} | ${which} | ${size.width}x${size.height} | today`] = await measure(page);
        for (const min of MINIMA) {
          await page.goto(url);
          await expect(page.getByTestId("tab-ruler").first()).toBeAttached();
          await page.evaluate(() => document.fonts.ready);
          await page.waitForTimeout(300);
          await apply(page, min);
          record[`${song} | ${which} | ${size.width}x${size.height} | ${min}`] = await measure(page);
        }
      }
    }
  }
  writeFileSync(OUT, JSON.stringify(record, null, 1) + "\n");
});
