/**
 * Review probe, INV-013 + FR-019 (print applies FR-001..FR-009 at the printable width), checked member by member:
 * {fit, short, long, F5} × Prn {718, 1047} × Th {dark, light} × Pg {song, play}.
 *
 * Under print media, from this probe's own measurements (the print-time ruler and head row):
 *   - drawn rows equal FR-007's greedy rows of FR-003's own widths;
 *   - a card whose own width fits the row draws its staff on one line (FR-004; spec Decision 1).
 * Reports every member, then fails if any member broke either rule.
 */
import { expect, test, type Page } from "@playwright/test";
import { FOLD, seedFitSong, seedFold, seedWideSong } from "../../../e2e/wide-helpers";
import { drawn, greedy, measure, own } from "./measure";

test.setTimeout(400_000);
type Urls = { songUrl: string; playUrl: string };
const F5 = FOLD.find((r) => r.id === "F5")!;
const seeds: Record<string, (p: Page) => Promise<unknown>> = {
  fit: seedFitSong,
  short: (p) => seedWideSong(p, "short"),
  long: (p) => seedWideSong(p, "long"),
  F5: (p) => seedFold(p, F5),
};

for (const [song, seed] of Object.entries(seeds)) {
  test(`INV-013/FR-019 print greedy, one line where it fits: ${song}`, async ({ page }, info) => {
    test.skip(info.project.name !== "probe-desktop", "viewport is set here");
    const urls = (await seed(page)) as Urls;
    const bad: string[] = [];
    for (const theme of ["dark", "light"] as const) {
      for (const pg of ["songUrl", "playUrl"] as const) {
        for (const width of [718, 1047]) {
          await page.emulateMedia({ media: "screen", colorScheme: theme });
          await page.setViewportSize({ width, height: 900 });
          await page.goto(urls[pg]);
          await page.waitForLoadState("load");
          await page.evaluate(() => document.fonts.ready);
          await page.waitForTimeout(400);
          await page.emulateMedia({ media: "print", colorScheme: theme });
          await page.waitForTimeout(400);
          const m = await measure(page);
          if (m.cards.length === 0) continue;
          const w = own(m);
          const g = greedy(w, m.row, m.gap);
          const d = drawn(m.cards);
          const where = `${song} ${pg === "playUrl" ? "play" : "song"} ${theme} @${width}`;
          const line = `${where}: row ${m.row.toFixed(1)} display ${m.display} own [${w.map((x) => x.toFixed(0))}] drawn ${JSON.stringify(d)} greedy ${JSON.stringify(g.rows)} widths [${m.cards.map((c) => c.width.toFixed(0))}] lines [${m.cards.map((c) => c.lines)}] --own-staff [${m.cards.map((c) => c.ownStaffVar)}] --own-head [${m.cards.map((c) => c.ownHeadVar)}] head [${m.cards.map((c) => c.head.toFixed(0))}] rulers [${m.cards.map((c) => c.ruler.toFixed(0))}]`;
          console.log(line);
          if (m.display !== "flex") continue; // below 768 printable width the list is spec 010's grid, one a row
          if (!g.tie && JSON.stringify(d) !== JSON.stringify(g.rows)) bad.push(`rows: ${line}`);
          m.cards.forEach((c, i) => {
            if (w[i] <= m.row - 1 && c.runs > 0 && c.lines > 1) bad.push(`wrapped though own ${w[i].toFixed(0)} fits row ${m.row.toFixed(0)}: ${where} card ${i + 1} (${c.lines} lines, width ${c.width.toFixed(0)})`);
          });
        }
      }
    }
    console.log(bad.join("\n"));
    expect(bad).toEqual([]);
  });
}
