/**
 * Round 2. INV-013 and INV-014 over the Notes-off members review F1's fix made reachable: the speed controls are now
 * offered with Notes off, and the speed mark shows on the Notes-off bar (FR-039).
 *
 * For W x Ptr (375x667 touch, 412x915 touch, 1280x800 mouse), whole song, Notes off:
 *   - INV-014: `play-slower` and `play-faster` meet the floor (44 touch, 32 mouse), sit inside the viewport, and are
 *     disabled at 50 and 100; `play-click` and `play-loop` stay absent;
 *   - INV-013: at speed 70 with the cluster closed the bar's height equals the Notes-off rest height at 100%, and
 *     Start, the tempo control and More have not moved; the speed mark is visible; running at 70%, Stop, the beat
 *     box, the tempo control and More sit where Start, the tempo control and More sat; no sideways scroll.
 */
import { expect, test, type Page } from "@playwright/test";
import { setStoredTempo } from "./rhythm-probe-helpers";
import { openCluster } from "./usability-helpers";
import { installPlayRecorder, seedPlaybackSong } from "./play-helpers";

const SIZES = [
  { width: 375, height: 667, touch: true },
  { width: 412, height: 915, touch: true },
  { width: 1280, height: 800, touch: false },
];
const IDS = ["click-start", "click-stop", "click-beat", "tempo-control", "panel-play-cluster", "speed-mark"];

const measure = (page: Page) =>
  page.evaluate((ids) => {
    const bar = document.querySelector('[data-testid="click-bar"]')!.getBoundingClientRect();
    const out: Record<string, [number, number, number, number]> = {};
    for (const id of ids) {
      const el = document.querySelector(`[data-testid="${id}"]`);
      if (el) {
        const r = el.getBoundingClientRect();
        out[id] = [r.x, r.y, r.width, r.height];
      }
    }
    return { barHeight: bar.height, out, overflow: document.documentElement.scrollWidth - window.innerWidth };
  }, IDS);

const closeCluster = async (page: Page) => {
  const more = page.getByTestId("panel-play-cluster");
  if ((await more.getAttribute("aria-expanded")) === "true") await more.click();
};

for (const size of SIZES) {
  test(`Notes off with speed at ${size.width}x${size.height}`, async ({ browser }) => {
    test.setTimeout(120_000);
    const context = await browser.newContext({ viewport: size, hasTouch: size.touch, isMobile: size.touch });
    const page = await context.newPage();
    await installPlayRecorder(page);
    const s = await seedPlaybackSong(page);
    await setStoredTempo(page, 60);
    await page.goto(s.playUrl);
    await expect(page.getByTestId("click-start")).toHaveText("Start click");
    const rest = await measure(page);
    const floor = size.touch ? 44 : 32;
    const problems: string[] = [];
    const moved = (name: string, a: Record<string, number[]>, b: Record<string, number[]>, pairs: [string, string][]) => {
      for (const [x, y] of pairs) {
        if (!a[x] || !b[y]) {
          problems.push(`${name}: ${x} or ${y} missing`);
          continue;
        }
        a[x].forEach((v, i) => {
          if (Math.abs(v - b[y][i]) > 0.5) problems.push(`${name}: ${x}[${i}] ${b[y][i].toFixed(1)} -> ${v.toFixed(1)}`);
        });
      }
    };

    await openCluster(page);
    await expect(page.getByTestId("play-notes")).toHaveAttribute("aria-pressed", "false");
    if ((await page.getByTestId("play-click").count()) + (await page.getByTestId("play-loop").count()) > 0)
      problems.push("Click or Loop offered with Notes off");
    if (!(await page.getByTestId("play-faster").isDisabled())) problems.push("Faster enabled at 100");
    for (const id of ["play-slower", "play-faster"]) {
      const b = (await page.getByTestId(id).boundingBox())!;
      if (b.width < floor - 0.5 || b.height < floor - 0.5) problems.push(`${id} ${b.width.toFixed(1)}x${b.height.toFixed(1)} under ${floor}`);
      if (b.x < 0 || b.x + b.width > size.width) problems.push(`${id} outside the viewport`);
    }
    for (let i = 0; i < 6; i++) await page.getByTestId("play-slower").click();
    await expect(page.getByTestId("play-speed")).toHaveText("70% · 42 bpm");
    for (let i = 0; i < 4; i++) await page.getByTestId("play-slower").click();
    if (!(await page.getByTestId("play-slower").isDisabled())) problems.push("Slower enabled at 50");
    for (let i = 0; i < 4; i++) await page.getByTestId("play-faster").click();
    await expect(page.getByTestId("play-speed")).toHaveText("70% · 42 bpm");
    const open = await measure(page);
    await closeCluster(page);

    const slow = await measure(page);
    if (!slow.out["speed-mark"]) problems.push("no speed mark with the cluster closed");
    if (Math.abs(slow.barHeight - rest.barHeight) > 0.5) problems.push(`bar at 70%: ${slow.barHeight} vs ${rest.barHeight}`);
    moved("speed 70, at rest", slow.out, rest.out, [
      ["click-start", "click-start"],
      ["tempo-control", "tempo-control"],
      ["panel-play-cluster", "panel-play-cluster"],
    ]);

    await page.getByTestId("click-start").click();
    await expect(page.getByTestId("click-stop")).toBeVisible();
    await page.waitForTimeout(400);
    const running = await measure(page);
    if (Math.abs(running.barHeight - rest.barHeight) > 0.5) problems.push(`bar running at 70%: ${running.barHeight} vs ${rest.barHeight}`);
    moved("running at 70%", running.out, rest.out, [
      ["click-beat", "click-start"],
      ["tempo-control", "tempo-control"],
      ["panel-play-cluster", "panel-play-cluster"],
    ]);
    await page.getByTestId("click-stop").click();
    const overflow = Math.max(rest.overflow, open.overflow, slow.overflow, running.overflow);
    console.log(`NOTESOFF ${size.width}: rest ${rest.barHeight}, open ${open.barHeight}, 70% ${slow.barHeight}, running ${running.barHeight}`);
    expect({ problems, overflow: overflow > 0 }).toEqual({ problems: [], overflow: false });
    await context.close();
  });
}
