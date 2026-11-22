/**
 * Spec 013 research R4/R5: the plan's own-width rule, measured on the UNEDITED tree with its CSS injected.
 * own = max(--card-min, staff line + chrome, min(head line + chrome, --card-floor)); a memo card adds the floor.
 * The 16-bar ruler reads 0 on this tree (R3), so where a ruler reads 0 the staff line is measured from the staff drawn
 * on one line instead (INV-019's method), which is what the fixed ruler returns. Records only; writes measure-final.json.
 */
import { expect, test, type Page } from "@playwright/test";
import { writeFileSync } from "node:fs";
import { seedFitSong, seedWideSong } from "../../../e2e/wide-helpers";

test.setTimeout(900_000);

const CSS = `
@media (min-width: 768px) {
  .reading-cards { display: flex !important; flex-wrap: wrap; gap: var(--card-gap); align-items: flex-start; }
  .reading-cards::after { content: ""; flex: 9999 0 0; margin-left: calc(-1 * var(--card-gap)); }
  .reading-cards > li {
    --chrome: calc(2 * var(--card-pad-x) + 2px);
    --card-own: max(9rem, calc(var(--own-staff, 0px) + var(--chrome)), min(calc(var(--own-head, 0px) + var(--chrome)), var(--card-floor)));
    flex: 1 0 var(--card-own); max-width: 100%; min-width: 0;
  }
}`;

async function apply(page: Page) {
  await page.addStyleTag({ content: CSS });
  await page.evaluate(() => {
    for (const li of document.querySelectorAll<HTMLElement>(".reading-cards > li")) {
      const ruler = li.querySelector<HTMLElement>('[data-testid="tab-ruler"]');
      let staff = ruler ? ruler.getBoundingClientRect().width : 0;
      if (ruler && staff === 0) {
        const lines = li.querySelector<HTMLElement>(".tab-lines")!;
        const clone = lines.cloneNode(true) as HTMLElement;
        clone.style.cssText = "position:absolute;visibility:hidden;flex-wrap:nowrap;width:max-content";
        clone.querySelectorAll<HTMLElement>(".tab-bar-run").forEach((r) => (r.style.flex = "none"));
        lines.parentElement!.appendChild(clone);
        const gutter = parseFloat(getComputedStyle(lines.closest(".tab-staff-wrapped")!).getPropertyValue("--gutter")) * 16;
        staff = clone.getBoundingClientRect().width + gutter;
        clone.remove();
      }
      const head = li.querySelector<HTMLElement>(".reading-card > :first-child")!;
      const had = head.getAttribute("style");
      head.style.width = "max-content";
      head.style.flexWrap = "nowrap";
      const headLine = head.getBoundingClientRect().width;
      if (had === null) head.removeAttribute("style");
      else head.setAttribute("style", had);
      li.style.setProperty("--own-staff", `${Math.ceil(staff)}px`);
      li.style.setProperty("--own-head", `${Math.ceil(headLine)}px`);
    }
  });
  await page.waitForTimeout(150);
}

const measure = (page: Page) =>
  page.evaluate(() => {
    const list = document.querySelector<HTMLElement>(".reading-cards")!;
    const bar = document.querySelector('[data-testid="click-bar"]')?.getBoundingClientRect() ?? null;
    const cards = [...list.children].map((li) => {
      const r = li.getBoundingClientRect();
      const runs = [...li.querySelectorAll(".tab-bar-run")].map((x) => Math.round(x.getBoundingClientRect().top));
      const head = li.querySelector(".reading-card > :first-child")!.getBoundingClientRect();
      return { top: Math.round(r.top), width: Math.round(r.width), bottom: Math.round(r.bottom), lines: new Set(runs).size, head: Math.round(head.height) };
    });
    const tops = [...new Set(cards.map((c) => c.top))];
    return {
      list: Math.round(list.getBoundingClientRect().width),
      perRow: tops.map((t) => cards.filter((c) => c.top === t).length),
      scroll: document.documentElement.scrollHeight,
      inner: innerHeight,
      sideways: document.documentElement.scrollWidth > innerWidth,
      barTop: bar ? Math.round(bar.top) : null,
      lastBottom: Math.max(...cards.map((c) => c.bottom)),
      widths: cards.map((c) => c.width),
      lines: cards.map((c) => c.lines),
      heads: cards.map((c) => c.head),
    };
  });

test("the plan's rule", async ({ page }) => {
  const out: Record<string, unknown> = {};
  const sizes = [
    { width: 768, height: 1024 }, { width: 1024, height: 768 }, { width: 1280, height: 800 },
    { width: 1440, height: 900 }, { width: 1920, height: 1080 },
  ];
  for (const song of ["fit", "short", "long", "names", "wide-bar"] as const) {
    const { songUrl, playUrl } = song === "fit" ? await seedFitSong(page) : await seedWideSong(page, song);
    for (const size of sizes) {
      await page.setViewportSize(size);
      for (const [which, url] of [["song", songUrl], ["play", playUrl]] as const) {
        await page.goto(url);
        await expect(page.getByTestId("tab-ruler").first()).toBeAttached();
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(300);
        await apply(page);
        out[`${song} | ${which} | ${size.width}x${size.height}`] = await measure(page);
      }
    }
  }
  writeFileSync("specs/013-cards-per-row/research-probes/measure-final.json", JSON.stringify(out, null, 1) + "\n");
});
