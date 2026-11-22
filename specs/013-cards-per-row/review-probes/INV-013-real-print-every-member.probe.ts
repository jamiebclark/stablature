/**
 * Review probe (round 3), INV-013 / FR-019 over its whole enumeration, through the real-print state. Round 2 F1's fix
 * (T043) writes `--own-head-print` on screen, so paper should need nothing measured under print media.
 *
 * In Chromium's `page.pdf()` from a wide screen, no media change fires and no observer runs (review round 2). So each
 * card prints with the inline `--own-*` the screen measured. Load at the screen width, keep each `li`'s style attribute,
 * then go to the paper's width under print media. Put the kept styles back and read every card's top synchronously,
 * before any observer can re-measure. Compare the rows with FR-007's greedy rows over the printed cards' own widths
 * (measure.ts, never read from `--own-*`).
 *
 * Members: {fit, short, long, F5} × paper {718, 1047} × screen {1047, 1280, 1920} × {dark, light} × {song page, play view}
 * × {Chromium mouse, Chromium touch, Firefox}. At 718 the list is spec 010's one-a-row grid.
 */
import { expect, test, type Page } from "@playwright/test";
import { FOLD, seedFitSong, seedFold, seedWideSong } from "../../../e2e/wide-helpers";
import { drawn, greedy, measure, own, settle } from "./measure";

test.setTimeout(600_000);
type Urls = { songUrl: string; playUrl: string };
const F5 = FOLD.find((r) => r.id === "F5")!;
const seeds: Record<string, (p: Page) => Promise<unknown>> = {
  fit: seedFitSong,
  short: (p) => seedWideSong(p, "short"),
  long: (p) => seedWideSong(p, "long"),
  F5: (p) => seedFold(p, F5),
};

for (const [song, seed] of Object.entries(seeds)) {
  for (const theme of ["dark", "light"] as const) {
    test(`INV-013 real-print rows, every member: ${song} ${theme}`, async ({ page }) => {
      const urls = (await seed(page)) as Urls;
      const bad: string[] = [];
      let checked = 0;
      for (const [pg, url] of [["song", urls.songUrl], ["play", urls.playUrl]] as const) {
        for (const screen of [1047, 1280, 1920]) {
          for (const paper of [718, 1047]) {
            await page.emulateMedia({ media: "screen", colorScheme: theme });
            await page.setViewportSize({ width: screen, height: 900 });
            await page.goto(url);
            await expect(page.locator(".reading-cards > li").first()).toBeVisible();
            await settle(page);
            const kept = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>(".reading-cards > li")].map((li) => li.getAttribute("style") ?? ""));
            await page.setViewportSize({ width: paper, height: 900 });
            await page.emulateMedia({ media: "print", colorScheme: theme });
            await settle(page);
            const m = await measure(page);
            const where = `${song} ${pg} ${theme} screen ${screen} → paper ${paper}`;
            if (m.display !== "flex") {
              if (paper >= 768) bad.push(`${where}: list display ${m.display}`);
              const tops = drawn(m.cards);
              if (tops.some((r) => r.length > 1)) bad.push(`${where}: narrow paper has a row of ${Math.max(...tops.map((r) => r.length))}`);
              checked++;
              continue;
            }
            const g = greedy(own(m), m.row, m.gap);
            const tops = await page.evaluate((styles) => {
              const lis = [...document.querySelectorAll<HTMLElement>(".reading-cards > li")];
              const now = lis.map((li) => li.getAttribute("style") ?? "");
              lis.forEach((li, i) => li.setAttribute("style", styles[i]));
              const t = lis.map((li) => li.getBoundingClientRect().top);
              const lines = lis.map((li) => new Set([...li.querySelectorAll(".tab-bar-run")].map((e) => Math.round(e.getBoundingClientRect().top))).size);
              lis.forEach((li, i) => li.setAttribute("style", now[i]));
              return { t, lines };
            }, kept);
            const d = drawn(tops.t.map((top) => ({ top })));
            checked++;
            if (!g.tie && JSON.stringify(d) !== JSON.stringify(g.rows)) bad.push(`${where}: real-print rows ${JSON.stringify(d)} vs greedy ${JSON.stringify(g.rows)}`);
            own(m).forEach((w, i) => {
              if (w <= m.row - 1 && tops.lines[i] > 1) bad.push(`${where}: card ${i + 1} prints on ${tops.lines[i]} lines though its own ${w.toFixed(0)} fits ${m.row.toFixed(0)}`);
            });
          }
        }
      }
      console.log(`${song} ${theme}: ${checked} members checked; ${bad.length} bad`);
      expect(bad).toEqual([]);
    });
  }
}
