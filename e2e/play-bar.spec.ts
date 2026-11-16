/** Spec 011 INV-013 (and the INV-001 mutation check, T034): the bar does not move or grow as Notes arrive. */
import { expect, test, type Page } from "@playwright/test";
import { openCluster } from "./usability-helpers";
import { installPlayRecorder, seedPlaybackSong } from "./play-helpers";

const IDS = ["click-start", "click-stop", "click-beat", "panel-play-cluster"];
const rects = (page: Page) =>
  page.evaluate((ids) => {
    const out: Record<string, number[]> = {};
    for (const id of ids) {
      const el = document.querySelector(`[data-testid=${id}]`);
      if (el) {
        const r = el.getBoundingClientRect();
        out[id] = [r.x, r.y, r.width, r.height];
      }
    }
    return { out, overflow: document.documentElement.scrollWidth - window.innerWidth };
  }, IDS);

const same = (a: number[] | undefined, b: number[] | undefined, what: string) => {
  expect(a, what).toBeDefined();
  expect(b, what).toBeDefined();
  a!.forEach((v, i) => expect(Math.abs(v - b![i]), `${what}[${i}]`).toBeLessThanOrEqual(0.5));
};

for (const width of [375, 1280]) {
  test(`bar is steady at ${width}`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width, height: 800 } });
    const page = await context.newPage();
    await installPlayRecorder(page);
    const seeded = await seedPlaybackSong(page);
    await page.goto(seeded.playUrl);
    await expect(page.getByTestId("click-start")).toBeEnabled();
    await openCluster(page);
    const rest = await rects(page);
    expect(rest.overflow).toBeLessThanOrEqual(0);

    await page.getByTestId("play-notes").click();
    const on = await rects(page);
    // Start and More stay where they were when Notes turned on.
    same(on.out["click-start"], rest.out["click-start"], "start");
    same(on.out["panel-play-cluster"], rest.out["panel-play-cluster"], "more");
    expect(on.overflow).toBeLessThanOrEqual(0);

    await page.getByTestId("play-slower").click();
    const slow = await rects(page);
    same(slow.out["click-start"], on.out["click-start"], "start after speed");
    same(slow.out["panel-play-cluster"], on.out["panel-play-cluster"], "more after speed");

    await page.getByTestId("click-start").click();
    await expect(page.getByTestId("click-stop")).toBeVisible();
    const run = await rects(page);
    same(run.out["click-beat"], slow.out["click-start"], "beat box takes Start's place");
    same(run.out["panel-play-cluster"], slow.out["panel-play-cluster"], "more while running");
    expect(run.overflow).toBeLessThanOrEqual(0);
    await page.getByTestId("click-stop").click();
    await expect(page.getByTestId("click-start")).toBeVisible();
    same((await rects(page)).out["click-start"], slow.out["click-start"], "start after stop");
    await context.close();
  });
}
