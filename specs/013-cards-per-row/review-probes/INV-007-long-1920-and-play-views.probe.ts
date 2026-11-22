/**
 * Review probe, INV-007 (long half) and INV-004 (play view, every view).
 *  - SC-003 / US2 AS1 is stated AT 1920×1080: A ≥ min(own, row) and B, C share one row. The suite's assertion now runs
 *    below 1920 only (DECISIONS "013 T031"); this re-asserts it at {1024, 1280, 1440, 1920} on both pages and logs the
 *    greedy rows, so a platform where greedy puts B beside A is visible as such.
 *  - INV-004 over the play view in notes and intervals (the suite runs the play view in frets only): one line when the
 *    card's own width fits the row; no run overflows unless it is a single bar.
 */
import { expect, test } from "@playwright/test";
import { choose } from "../../../e2e/reading-helpers";
import { seedFitSong, seedWideSong } from "../../../e2e/wide-helpers";
import { greedy, measure, own, settle } from "./measure";

test.setTimeout(400_000);
type Urls = { songUrl: string; playUrl: string };

test("INV-007 long: A takes its width, B and C share a row, at every listed size", async ({ page }, info) => {
  test.skip(info.project.name === "probe-firefox", "Chromium projects");
  const urls = (await seedWideSong(page, "long")) as unknown as Urls;
  const bad: string[] = [];
  for (const [w, h] of [[1024, 800], [1280, 800], [1440, 900], [1920, 1080]]) {
    for (const pg of ["songUrl", "playUrl"] as const) {
      await page.setViewportSize({ width: w, height: h });
      await page.goto(urls[pg]);
      await expect(page.locator(".reading-cards > li").first()).toBeVisible();
      await settle(page);
      const m = await measure(page);
      const o = own(m);
      const where = `long ${pg === "playUrl" ? "play" : "song"} @${w}`;
      console.log(`${where}: row ${m.row.toFixed(0)} own [${o.map((x) => x.toFixed(0))}] widths [${m.cards.map((c) => c.width.toFixed(0))}] greedy ${JSON.stringify(greedy(o, m.row, m.gap).rows)}`);
      if (m.cards[0].width < Math.min(o[0], m.row) - 1.5) bad.push(`${where}: A ${m.cards[0].width} < ${Math.min(o[0], m.row)}`);
      if (Math.abs(m.cards[1].top - m.cards[2].top) > 0.5) {
        // Round 2: plan.md Deviation 7 records that where FR-007's greedy rows put B beside A (Linux Chrome at 1920, play
        // view), SC-003's shared B/C row is not owed. Accept exactly that case, and only if the drawn rows are the greedy ones.
        const g = greedy(o, m.row, m.gap);
        const besideA = g.rows[0].includes(1);
        const tops = m.cards.map((c) => Math.round(c.top));
        const drawnRows = [...new Set(tops)].map((t) => tops.flatMap((x, i) => (x === t ? [i] : [])));
        if (besideA && JSON.stringify(drawnRows) === JSON.stringify(g.rows)) console.log(`${where}: Deviation 7 (recorded): greedy puts B beside A`);
        else bad.push(`${where}: B and C on different rows`);
      }
    }
  }
  console.log(bad.join("\n"));
  expect(bad).toEqual([]);
});

for (const name of ["fit", "long", "wide-bar"] as const) {
  test(`INV-004 play view in notes and intervals: ${name}`, async ({ page }, info) => {
    test.skip(info.project.name === "probe-firefox", "Chromium projects");
    const urls = (name === "fit" ? await seedFitSong(page) : await seedWideSong(page, name)) as unknown as Urls;
    const bad: string[] = [];
    for (const view of ["notes", "intervals"] as const) {
      for (const width of [768, 1024, 1280, 1440, 1920, 2560]) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(urls.playUrl);
        await expect(page.locator(".reading-cards > li").first()).toBeVisible();
        await choose(page, view);
        await settle(page);
        const m = await measure(page);
        const o = own(m);
        const runs = await page.evaluate(() =>
          [...document.querySelectorAll(".reading-cards > li")].map((li) => {
            const els = [...li.querySelectorAll<HTMLElement>(".tab-bar-run")];
            return { single: els.length === 1, overflow: Math.max(0, ...els.map((e) => e.scrollWidth - e.clientWidth)) };
          }),
        );
        m.cards.forEach((c, i) => {
          const where = `${name} play ${view} @${width} card ${i + 1}`;
          if (c.runs > 0 && o[i] <= m.row - 1.5 && c.lines !== 1) bad.push(`${where}: ${c.lines} lines though own ${o[i].toFixed(0)} fits row ${m.row.toFixed(0)}`);
          if (!runs[i].single && runs[i].overflow > 1) bad.push(`${where}: run overflows ${runs[i].overflow}`);
        });
        const sideways = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
        if (sideways > 0) bad.push(`${name} play ${view} @${width}: page scrolls sideways ${sideways}`);
      }
    }
    console.log(bad.join("\n"));
    expect(bad).toEqual([]);
  });
}
