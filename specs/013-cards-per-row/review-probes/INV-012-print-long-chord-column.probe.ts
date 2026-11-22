/**
 * Review probe, INV-012 / FR-017 / FR-018: in print a chord symbol no wider than its card's line prints on one line, and a
 * wider one breaks inside the card, with nothing (the symbol, its column, its bar run) past the card or the paper.
 * Also records whether the print rule `min-width: min(max-content, 100cqi)` on the column parses at all.
 * {long chord, many chords} × Prn {718, 1047} × Th × Pg.
 */
import { expect, test } from "@playwright/test";
import { seedLongChord, seedManyChord } from "../../../e2e/cards-helpers";

test.setTimeout(400_000);
type Urls = { songUrl: string; playUrl: string };

for (const [song, seed] of [["long chord", seedLongChord], ["many chords", seedManyChord]] as const) {
  test(`INV-012 print chord, column and run stay in the card: ${song}`, async ({ page }, info) => {
    test.skip(info.project.name === "probe-mobile", "viewport is set here; desktop and firefox only");
    const urls = (await seed(page)) as unknown as Urls;
    const parses = await page.evaluate(() => CSS.supports("min-width", "min(max-content, 100cqi)"));
    console.log(`${info.project.name}: CSS.supports("min-width", "min(max-content, 100cqi)") = ${parses}`);
    const bad: string[] = [];
    for (const theme of ["dark", "light"] as const) {
      for (const pg of ["songUrl", "playUrl"] as const) {
        for (const width of [718, 1047]) {
          await page.emulateMedia({ media: "screen", colorScheme: theme });
          await page.setViewportSize({ width, height: 900 });
          await page.goto(urls[pg]);
          await page.waitForLoadState("load");
          await page.evaluate(() => document.fonts.ready);
          await page.emulateMedia({ media: "print", colorScheme: theme });
          await page.waitForTimeout(400);
          const r = await page.evaluate(() => {
            const out = [...document.querySelectorAll<HTMLElement>('[data-testid="tab-column"] > div.text-accent')]
              .filter((e) => (e.textContent ?? "").trim() !== "")
              .map((e) => {
                const col = e.parentElement!;
                const run = col.closest<HTMLElement>(".tab-bar-run");
                const card = (e.closest("li") ?? e.closest(".reading-card"))!.getBoundingClientRect();
                const range = document.createRange();
                range.selectNodeContents(e);
                return {
                  text: (e.textContent ?? "").trim(),
                  lines: new Set([...range.getClientRects()].map((x) => Math.round(x.top))).size,
                  chordRight: e.getBoundingClientRect().right,
                  colRight: col.getBoundingClientRect().right,
                  colMin: getComputedStyle(col).minWidth,
                  runOverflow: run ? run.scrollWidth - run.clientWidth : 0,
                  cardRight: card.right,
                  // The narrow song page keeps a scrolling staff (spec 010, unchanged here): paper clips it there.
                  clip: e.closest<HTMLElement>(".overflow-x-auto")?.getBoundingClientRect().right ?? Infinity,
                  left: e.getBoundingClientRect().left,
                };
              });
            return { out, scroll: document.documentElement.scrollWidth, vw: innerWidth };
          });
          const where = `${song} ${pg === "playUrl" ? "play" : "song"} ${theme} @${width}`;
          console.log(`${where}: page ${r.scroll}/${r.vw}`, JSON.stringify(r.out.slice(0, 3)));
          if (r.scroll > r.vw) bad.push(`${where}: page scrollWidth ${r.scroll} > ${r.vw}`);
          for (const c of r.out) {
            if (c.left >= c.clip) {
              console.log(`out of scope (narrow song page clip, unchanged from main): ${where} "${c.text}" left ${c.left} past clip ${c.clip}`);
              continue;
            }
            const limit = Math.min(c.cardRight, r.vw) + 0.5;
            if (c.text.length <= 8 && c.lines > 1) bad.push(`${where}: "${c.text}" on ${c.lines} lines`);
            if (c.chordRight > limit) bad.push(`${where}: "${c.text}" right ${c.chordRight} > ${limit}`);
            if (c.colRight > limit) bad.push(`${where}: column of "${c.text}" right ${c.colRight} > ${limit} (min-width ${c.colMin})`);
            if (c.runOverflow > 1) bad.push(`${where}: run of "${c.text}" overflows by ${c.runOverflow}`);
          }
        }
      }
    }
    console.log(bad.join("\n"));
    expect(bad).toEqual([]);
  });
}
