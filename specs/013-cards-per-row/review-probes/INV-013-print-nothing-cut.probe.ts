/**
 * Review probe, INV-013 / FR-019 "nothing may be cut at the right edge", for the songs the suite's print specs do not
 * print: `long` and `wide-bar` (a single bar wider than any line), at Prn {718, 1047} × Pg. In print nothing scrolls, so
 * a bar run whose content overflows its box, or a column past its card, is cut on paper. The narrow song page (below
 * 768, spec 010's scrolling staff, unchanged here) is logged as out of scope, not failed.
 * Also guards the print column rule: `min-width: min(max-content, 100cqi) !important` (globals.css) does not parse, so the
 * column keeps its inline min-width in print, where `main` had `min-width: 0 !important`.
 */
import { expect, test } from "@playwright/test";
import { seedWideSong } from "../../../e2e/wide-helpers";

test.setTimeout(400_000);
type Urls = { songUrl: string; playUrl: string };

for (const name of ["long", "wide-bar"] as const) {
  test(`INV-013 print cuts nothing: ${name}`, async ({ page }, info) => {
    test.skip(info.project.name !== "probe-desktop", "viewport is set here");
    const urls = (await seedWideSong(page, name)) as unknown as Urls;
    const bad: string[] = [];
    for (const pg of ["songUrl", "playUrl"] as const) {
      for (const width of [718, 1047]) {
        await page.emulateMedia({ media: "screen" });
        await page.setViewportSize({ width, height: 900 });
        await page.goto(urls[pg]);
        await page.waitForLoadState("load");
        await page.evaluate(() => document.fonts.ready);
        await page.emulateMedia({ media: "print" });
        await page.waitForTimeout(400);
        const r = await page.evaluate(() => {
          const lis = [...document.querySelectorAll<HTMLElement>(".reading-cards > li")];
          return {
            scroll: document.documentElement.scrollWidth,
            vw: innerWidth,
            cards: lis.map((li) => {
              const card = li.getBoundingClientRect();
              const runs = [...li.querySelectorAll<HTMLElement>(".tab-bar-run, .overflow-x-auto")];
              const cols = [...li.querySelectorAll<HTMLElement>('[data-testid="tab-column"]')];
              return {
                right: card.right,
                overflow: Math.max(0, ...runs.map((e) => e.scrollWidth - e.clientWidth)),
                colPast: cols.filter((c) => c.getBoundingClientRect().right > card.right + 0.5).length,
                cols: cols.length,
              };
            }),
          };
        });
        const where = `${name} ${pg === "playUrl" ? "play" : "song"} @${width}`;
        console.log(`${where}: page ${r.scroll}/${r.vw}`, JSON.stringify(r.cards));
        if (r.scroll > r.vw) bad.push(`${where}: page ${r.scroll} > ${r.vw}`);
        if (pg === "songUrl" && width < 768) {
          // Out of scope: below 768 the song page keeps spec 010's scrolling staff, which paper clips (unchanged from main).
          console.log(`out of scope: ${where}`, JSON.stringify(r.cards.map((c) => c.overflow)));
          continue;
        }
        r.cards.forEach((c, i) => {
          if (c.right > r.vw + 0.5) bad.push(`${where}: card ${i + 1} right ${c.right}`);
          if (c.overflow > 1) bad.push(`${where}: card ${i + 1} staff content overflows its box by ${c.overflow}px (cut on paper)`);
          if (c.colPast > 0) bad.push(`${where}: card ${i + 1} ${c.colPast}/${c.cols} columns past the card`);
        });
      }
    }
    console.log(bad.join("\n"));
    expect(bad).toEqual([]);
  });
}
