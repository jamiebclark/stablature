/**
 * Review probe (round 2), INV-013 / INV-009 / FR-019 / FR-010: round 1 F2's fix makes `useCardTrack` re-measure when
 * `matchMedia("print")` changes and on `beforeprint`/`afterprint`, so paper's own widths are the printed card's
 * (`.no-print` head items left out).
 *
 * 1. Round trip (Chromium and Firefox): screen → print → screen at 1280 on both pages of `short` and fit. Under print
 *    the drawn rows are greedy over print-measured own widths; back on screen every `--own-head` is its first screen
 *    value again, and the rows are greedy over screen-measured widths. A stale print value left on screen fails.
 * 2. Real print (Chromium `page.pdf()`, the print path `emulateMedia` stands in for): log what the hook wrote while
 *    printing, and whether print styles applied when it measured. Recorded, not asserted, except that the page is back
 *    to its screen values afterwards.
 */
import { expect, test, type Page } from "@playwright/test";
import { seedFitSong, seedWideSong } from "../../../e2e/wide-helpers";
import { drawn, greedy, measure, own, settle } from "./measure";

test.setTimeout(400_000);
type Urls = { songUrl: string; playUrl: string };

const ownHeads = (page: Page) =>
  page.evaluate(() => [...document.querySelectorAll<HTMLElement>(".reading-cards > li")].map((li) => li.style.getPropertyValue("--own-head")));

async function rowsGreedy(page: Page, where: string, bad: string[]) {
  const m = await measure(page);
  const g = greedy(own(m), m.row, m.gap);
  const d = drawn(m.cards);
  if (!g.tie && JSON.stringify(d) !== JSON.stringify(g.rows)) bad.push(`${where}: drawn ${JSON.stringify(d)} greedy ${JSON.stringify(g.rows)}`);
  return m;
}

for (const song of ["short", "fit"] as const) {
  test(`INV-013/INV-009 screen → print → screen keeps every card's own widths true: ${song}`, async ({ page }, info) => {
    test.skip(info.project.name === "probe-mobile", "viewport is set here; desktop and firefox only");
    const urls = (song === "fit" ? await seedFitSong(page) : await seedWideSong(page, "short")) as unknown as Urls;
    const bad: string[] = [];
    for (const [pg, url] of [["song", urls.songUrl], ["play", urls.playUrl]] as const) {
      await page.emulateMedia({ media: "screen" });
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto(url);
      await expect(page.locator(".reading-cards > li").first()).toBeVisible();
      await settle(page);
      const screen1 = await ownHeads(page);
      await rowsGreedy(page, `${song} ${pg} screen`, bad);
      await page.emulateMedia({ media: "print" });
      await settle(page);
      const printed = await ownHeads(page);
      await rowsGreedy(page, `${song} ${pg} print`, bad);
      await page.emulateMedia({ media: "screen" });
      await settle(page);
      const screen2 = await ownHeads(page);
      await rowsGreedy(page, `${song} ${pg} screen again`, bad);
      console.log(`${song} ${pg} --own-head screen ${screen1.join(",")} | print ${printed.join(",")} | screen ${screen2.join(",")}`);
      if (JSON.stringify(screen1) !== JSON.stringify(screen2)) bad.push(`${song} ${pg}: --own-head after print ${screen2.join(",")} vs before ${screen1.join(",")}`);
    }
    expect(bad).toEqual([]);
  });
}

test("INV-013 real print (page.pdf): what the hook measures while printing", async ({ page, browserName }, info) => {
  test.skip(browserName !== "chromium" || info.project.name !== "probe-desktop", "page.pdf is Chromium headless");
  const urls = (await seedWideSong(page, "short")) as unknown as Urls;
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(urls.songUrl);
  await expect(page.locator(".reading-cards > li").first()).toBeVisible();
  await settle(page);
  const before = await ownHeads(page);
  await page.emulateMedia({ media: "print" });
  await settle(page);
  const emulated = await ownHeads(page);
  await page.emulateMedia({ media: "screen" });
  await settle(page);
  await page.evaluate(() => {
    const w = window as unknown as { __log: string[] };
    w.__log = [];
    const snap = (why: string) => {
      const heads = [...document.querySelectorAll<HTMLElement>(".reading-cards > li")].map((li) => li.style.getPropertyValue("--own-head"));
      const noPrint = document.querySelector(".no-print");
      w.__log.push(`${why}: print=${matchMedia("print").matches} noPrint=${noPrint ? getComputedStyle(noPrint).display : "-"} heads=${heads.join(",")}`);
    };
    matchMedia("print").addEventListener("change", () => snap("mql change"));
    addEventListener("beforeprint", () => snap("beforeprint"));
    addEventListener("afterprint", () => snap("afterprint"));
  });
  await page.pdf({ width: "1047px", height: "1400px", margin: { top: "0", right: "0", bottom: "0", left: "0" } });
  await settle(page);
  const log = await page.evaluate(() => (window as unknown as { __log: string[] }).__log);
  const after = await ownHeads(page);
  console.log(`screen ${before.join(",")}\nemulated print ${emulated.join(",")}\n${log.join("\n")}\nafter ${after.join(",")}`);
  expect(after).toEqual(before);
});

/**
 * 3. Real print's layout, simulated. The pdf log above shows the hook measures only at `beforeprint`, under screen
 * styles, so a real print lays out with the screen's `--own-head` (it includes `.no-print` head items) and no
 * ResizeObserver runs while printing. Under print media at 1047, put each card's screen `--own-head` back, lay out
 * synchronously (before any observer callback), and compare the drawn rows with FR-007's greedy rows over the
 * printed cards' own widths. Song page and play view of `short`, fit and long.
 */
for (const song of ["short", "fit", "long"] as const) {
  test(`INV-013 real-print layout: rows are greedy over the printed cards' own widths: ${song}`, async ({ page }, info) => {
    test.skip(info.project.name === "probe-mobile", "viewport is set here; desktop and firefox only");
    const urls = (song === "fit" ? await seedFitSong(page) : await seedWideSong(page, song)) as unknown as Urls;
    const bad: string[] = [];
    for (const [pg, url] of [["song", urls.songUrl], ["play", urls.playUrl]] as const) {
      await page.emulateMedia({ media: "screen" });
      await page.setViewportSize({ width: 1047, height: 900 });
      await page.goto(url);
      await expect(page.locator(".reading-cards > li").first()).toBeVisible();
      await settle(page);
      const screenHeads = await ownHeads(page);
      await page.emulateMedia({ media: "print" });
      await settle(page);
      const m = await measure(page);
      const g = greedy(own(m), m.row, m.gap);
      const keptTops = await page.evaluate((heads) => {
        const lis = [...document.querySelectorAll<HTMLElement>(".reading-cards > li")];
        const printHeads = lis.map((li) => li.style.getPropertyValue("--own-head"));
        lis.forEach((li, i) => li.style.setProperty("--own-head", heads[i]));
        const tops = lis.map((li) => li.getBoundingClientRect().top);
        lis.forEach((li, i) => li.style.setProperty("--own-head", printHeads[i]));
        return tops;
      }, screenHeads);
      const d = drawn(keptTops.map((top) => ({ top })));
      const where = `${song} ${pg} @1047`;
      console.log(`${where}: screen --own-head ${screenHeads.join(",")}; printed own ${own(m).map((x) => x.toFixed(0)).join(",")}; real-print rows ${JSON.stringify(d)}; greedy ${JSON.stringify(g.rows)}`);
      if (!g.tie && JSON.stringify(d) !== JSON.stringify(g.rows)) bad.push(`${where}: real-print rows ${JSON.stringify(d)} vs greedy ${JSON.stringify(g.rows)}`);
    }
    expect(bad).toEqual([]);
  });
}
