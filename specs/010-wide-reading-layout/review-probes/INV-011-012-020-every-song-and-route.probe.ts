/**
 * Review round 3: invariant members no test or earlier probe ran.
 *
 *   - INV-012 holds over {rest, running} x Clu x Bw x {fit, 40 entries}. The suite's INV-012 test seeds 40 entries only, and
 *     the fit song is checked at rest with the cluster closed only (`wide-click-bar.spec.ts` "holds still").
 *   - INV-011 holds over BarSt x Bw x Ptr x Clu x {one pass, fit, 40 entries}. The stopped states were only ever written
 *     into the live slot by a test, never reached. Here two are reached by their real routes:
 *       fell behind: the main thread stalls 2.5s while running, so the scheduler finds a beat in the past;
 *       hidden: the window fires `pagehide`, which useClick.ts listens for (a synthetic event, the app's own handler).
 *     Audio lost needs the device to take the AudioContext, which headless Chromium cannot do: not reached.
 *   - INV-020 holds over {fit} x {768, 1280} x Pos. The suite walks "column on"/"column back" at 375 and 1280 only.
 *
 *   npx playwright test -c specs/010-wide-reading-layout/review-probes/probe.config.ts INV-011-012-020
 */
import { expect, test, type Page } from "@playwright/test";
import { cols, seed } from "../../../e2e/rhythm-probe-helpers";
import { seedFitSong } from "../../../e2e/wide-helpers";

test.setTimeout(240_000);

const BW = [375, 412, 768, 1024, 1280, 1440];
const IDS = ["click-start", "click-stop", "click-beat", "tempo-control", "panel-play-cluster"];
const WORDS = {
  hidden: "Stopped because the screen was hidden. Start again when you are ready.",
  fellBehind: "Stopped because the click could not keep time. Start again when you are ready.",
};

type Box = { x: number; y: number; w: number; h: number };
const measure = (page: Page) =>
  page.evaluate((ids) => {
    const out: Record<string, Box | null> = {};
    for (const id of ids) {
      const r = document.querySelector(`[data-testid="${id}"]`)?.getBoundingClientRect();
      out[id] = r ? { x: r.x, y: r.y, w: r.width, h: r.height } : null;
    }
    const bar = document.querySelector('[data-testid="click-bar"]')!.getBoundingClientRect();
    return { out, h: bar.height, top: bar.top, bottom: bar.bottom, inner: innerHeight };
  }, IDS);

const moved = (a: Awaited<ReturnType<typeof measure>>, b: Awaited<ReturnType<typeof measure>>, ids: string[], what: string) => {
  const bad: string[] = [];
  for (const id of ids) {
    const p = a.out[id];
    const q = b.out[id];
    if (!p || !q) continue;
    for (const k of ["x", "y", "w", "h"] as const)
      if (Math.abs(p[k] - q[k]) > 0.5) bad.push(`${what}: ${id}.${k} ${p[k].toFixed(1)} -> ${q[k].toFixed(1)}`);
  }
  return bad;
};

/**
 * Scrolled to the end, how far the last card's bottom sits above the bar's top. Classified, because while the click runs
 * its following scrolls the page (a smooth `scrollIntoView` on each beat) unless a reader scrolled in the last
 * FOLLOW_REST_MS (4 s). A programmatic `scrollTo` is not a reader's scroll, so the first version of this probe, and
 * `e2e/wide-click-bar.spec.ts`'s INV-012 test, which scroll that way, can read the page while the following is pulling it
 * back up (10 of 144 runs here, every one `atEnd: false`). So the scroll is a wheel, as a reader's would be, and `atEnd`
 * is returned beside the gap; the padding the bar wrote is returned beside the bar's own height.
 */
const clearance = async (page: Page) => {
  await page.waitForTimeout(400);
  const vw = page.viewportSize()!.width;
  await page.mouse.move(Math.floor(vw / 2), 200);
  await page.mouse.wheel(0, 100_000);
  await page
    .waitForFunction(() => scrollY + innerHeight >= document.documentElement.scrollHeight - 1, null, { timeout: 3000 })
    .catch(() => undefined);
  await page.waitForTimeout(200);
  return page.evaluate(() => {
    const barEl = document.querySelector<HTMLElement>('[data-testid="click-bar"]')!;
    const bar = barEl.getBoundingClientRect();
    const lowest = Math.max(...[...document.querySelectorAll("ol.reading-cards > li")].map((li) => li.getBoundingClientRect().bottom));
    const root = document.documentElement;
    return {
      gap: bar.top - lowest,
      atEnd: scrollY + innerHeight >= root.scrollHeight - 1,
      scrollY,
      scrollHeight: root.scrollHeight,
      barH: bar.height,
      offsetH: barEl.offsetHeight,
      written: root.style.getPropertyValue("--click-bar-h"),
      padding: getComputedStyle(document.querySelector("main")!).paddingBottom,
      lowest,
      barTop: bar.top,
    };
  });
};

const seedSongNamed = async (page: Page, song: "fit" | "40 entries") =>
  song === "fit" ? seedFitSong(page) : seed(page, cols("q", "q", "|", "q", "q"), { bpm: 120, entries: 40 });

const ready = async (page: Page, song: "fit" | "40 entries") => {
  await expect(page.locator("ol.reading-cards > li")).toHaveCount(song === "fit" ? 6 : 40);
  await page.waitForFunction(() => [...document.querySelectorAll("ol.reading-cards > li")].every((li) => li.querySelector("[data-column]")));
  await page.waitForTimeout(300);
};

for (const song of ["fit", "40 entries"] as const) {
  for (const width of BW) {
    test(`INV-011/012 ${song} at ${width}: one height, still controls, last card clear, rest and running x cluster`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      const { playUrl } = await seedSongNamed(page, song);
      await page.goto(playUrl);
      await ready(page, song);
      const bad: string[] = [];
      const rest = await measure(page);
      if (rest.inner - rest.bottom > 1) bad.push(`bar ${rest.inner - rest.bottom}px off the foot`);
      const clear = async (what: string) => {
        const m = await clearance(page);
        if (!m.atEnd) bad.push(`${what}: PROBE could not reach the end ${JSON.stringify(m)}`);
        else if (m.gap < 7.5) bad.push(`${what}: last card ${m.gap.toFixed(1)}px from the bar ${JSON.stringify(m)}`);
      };
      await clear("rest, closed");
      await page.getByTestId("panel-play-cluster").click();
      const restOpen = await measure(page);
      bad.push(...moved(rest, restOpen, ["click-start", "tempo-control", "panel-play-cluster"], "cluster open at rest"));
      if (Math.abs(restOpen.bottom - rest.bottom) > 0.5) bad.push("cluster moved the bar's foot");
      await clear("rest, open");
      await page.getByTestId("panel-play-cluster").click();
      await page.getByTestId("click-start").click();
      await expect(page.getByTestId("click-stop")).toBeVisible();
      await page.waitForTimeout(300);
      const running = await measure(page);
      if (Math.abs(running.h - rest.h) > 0.5) bad.push(`running height ${running.h} vs rest ${rest.h}`);
      bad.push(...moved(rest, running, ["tempo-control", "panel-play-cluster"], "start"));
      await clear("running, closed");
      await page.getByTestId("panel-play-cluster").click();
      await clear("running, open");
      await page.getByTestId("panel-play-cluster").click();
      await page.getByTestId("click-stop").click();
      await expect(page.getByTestId("click-start")).toBeVisible();
      const stopped = await measure(page);
      if (Math.abs(stopped.h - rest.h) > 0.5) bad.push(`stopped height ${stopped.h} vs rest ${rest.h}`);
      bad.push(...moved(rest, stopped, ["click-start", "tempo-control", "panel-play-cluster"], "stop"));
      expect(bad).toEqual([]);
    });
  }
}

for (const route of ["fell behind", "hidden"] as const) {
  for (const width of BW) {
    test(`INV-011 stopped by its real route (${route}) at ${width}: same height, controls still`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      const { playUrl } = await seedFitSong(page);
      await page.goto(playUrl);
      await ready(page, "fit");
      const rest = await measure(page);
      await page.getByTestId("click-start").click();
      await expect(page.getByTestId("click-stop")).toBeVisible();
      await page.waitForTimeout(800);
      if (route === "fell behind") {
        await page.evaluate(() => {
          const t = performance.now();
          while (performance.now() - t < 2500) {
            /* the main thread is busy, so the scheduler misses its beats */
          }
        });
      } else {
        await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
      }
      await expect(page.getByTestId("click-state")).toHaveText(route === "hidden" ? WORDS.hidden : WORDS.fellBehind);
      await page.waitForTimeout(300);
      const after = await measure(page);
      const bad = moved(rest, after, ["click-start", "tempo-control", "panel-play-cluster"], route);
      if (Math.abs(after.h - rest.h) > 0.5) bad.push(`${route} height ${after.h} vs rest ${rest.h}`);
      if (Math.abs(after.bottom - rest.bottom) > 0.5) bad.push(`${route} moved the bar's foot`);
      expect(bad).toEqual([]);
    });
  }
}

for (const width of [768, 1280]) {
  test(`INV-020 column on and column back over the fit song at ${width}: no card moves, no staff re-renders`, async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "keys; the viewport is set here");
    await page.setViewportSize({ width, height: 800 });
    const { playUrl } = await seedFitSong(page);
    await page.goto(playUrl);
    await ready(page, "fit");
    const result = await page.evaluate(() => {
      const lis = [...document.querySelectorAll<HTMLElement>("ol.reading-cards > li")];
      const rect = () => lis.map((li) => li.getBoundingClientRect()).map((r) => [r.left, r.top + scrollY, r.width, r.height]);
      const before = rect();
      // Records arrive at the next microtask checkpoint, after this script returns, so the count is read later.
      const w = window as unknown as { __child20: number };
      w.__child20 = 0;
      for (const s of document.querySelectorAll(".tab-staff"))
        new MutationObserver((m) => (w.__child20 += m.length)).observe(s, { childList: true, subtree: true });
      const total = lis.reduce(
        (n, li) =>
          n +
          (Number(li.dataset.lastPass) - Number(li.dataset.firstPass) + 1) *
            [...li.querySelectorAll('[data-testid="tab-column"]')].filter((c) => c.getAttribute("data-barline") !== "true").length,
        0,
      );
      const seq: string[] = [];
      let worst = 0;
      const press = (key: string) => {
        window.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
        const lit = document.querySelector(".tab-column-reading");
        seq.push(`${lit?.closest("li[data-card]")?.getAttribute("data-card")}:${lit?.getAttribute("data-column")}`);
        rect().forEach((r, i) => r.forEach((v, j) => (worst = Math.max(worst, Math.abs(v - before[i][j])))));
      };
      for (let i = 0; i < total; i++) press("ArrowRight");
      const forward = [...seq];
      seq.length = 0;
      for (let i = 0; i < total - 1; i++) press("ArrowLeft");
      return { total, worst, lit: forward.length, backEnd: seq.at(-1), first: forward[0], unlit: forward.filter((s) => s.startsWith("undefined")).length };
    });
    await page.waitForTimeout(100);
    const child = await page.evaluate(() => (window as unknown as { __child20: number }).__child20);
    console.log(`INV-020 ${width}: ${result.total} stops, worst card shift ${result.worst}, childList records ${child}`);
    expect(result.total).toBeGreaterThan(100);
    expect(result.unlit, "a step lit nothing").toBe(0);
    expect(result.worst, "a card moved").toBeLessThanOrEqual(0.5);
    expect(child, "a staff's children changed").toBe(0);
    expect(result.backEnd).toBe(result.first);
  });
}
