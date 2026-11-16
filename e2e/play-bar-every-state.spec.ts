/**
 * INV-013 over the members `e2e/play-bar.spec.ts` does not measure: the bar's HEIGHT in each reachable BarN state,
 * against the Notes-off rest height, at every size of W (375x667, 412x915, 1280x800), and the tempo control and Stop
 * as well as Start and More. Cluster closed for heights (the cluster opens upward inside the bar, as on main).
 *
 * States: Notes off at rest; Notes on at rest (rule `none`); speed 70%; counting in; playing; stopped `hidden`;
 * no tempo. Controls compared rest -> running and closed -> open.
 */
import { expect, test, type Page } from "@playwright/test";
import { setStoredTempo } from "./rhythm-probe-helpers";
import { openCluster } from "./usability-helpers";
import { installPlayRecorder, seedPlaybackSong } from "./play-helpers";

const SIZES = [
  { width: 375, height: 667 },
  { width: 412, height: 915 },
  { width: 1280, height: 800 },
];
const IDS = ["click-start", "click-stop", "click-beat", "tempo-control", "panel-play-cluster"] as const;

const measure = (page: Page) =>
  page.evaluate((ids) => {
    const bar = document.querySelector('[data-testid="click-bar"]')!.getBoundingClientRect();
    const row = document.querySelector(".click-bar-row")!.getBoundingClientRect();
    const out: Record<string, [number, number, number, number]> = {};
    for (const id of ids) {
      const el = document.querySelector(`[data-testid="${id}"]`);
      if (el) {
        const r = el.getBoundingClientRect();
        out[id] = [r.x, r.y, r.width, r.height];
      }
    }
    return { barHeight: bar.height, rowTop: row.top, out, overflow: document.documentElement.scrollWidth - window.innerWidth };
  }, IDS as unknown as string[]);

const closeCluster = async (page: Page) => {
  const more = page.getByTestId("panel-play-cluster");
  if ((await more.getAttribute("aria-expanded")) === "true") await more.click();
};

for (const size of SIZES) {
  test(`bar height and controls in each state at ${size.width}x${size.height}`, async ({ browser }) => {
    test.setTimeout(120_000);
    const context = await browser.newContext({ viewport: size });
    const page = await context.newPage();
    await installPlayRecorder(page);
    const s = await seedPlaybackSong(page);
    await setStoredTempo(page, 60);
    await page.goto(s.playUrl);
    await expect(page.getByTestId("click-start")).toBeEnabled();
    const heights: Record<string, number> = {};
    const moves: string[] = [];
    const compare = (name: string, a: Record<string, number[]>, b: Record<string, number[]>, ids: string[]) => {
      for (const id of ids) {
        if (!a[id] || !b[id]) continue;
        a[id].forEach((v, i) => {
          if (Math.abs(v - b[id][i]) > 0.5) moves.push(`${name}: ${id}[${i}] ${b[id][i].toFixed(1)} -> ${v.toFixed(1)}`);
        });
      }
    };

    const offRest = await measure(page);
    heights["notes off, rest"] = offRest.barHeight;

    await openCluster(page);
    const offOpen = await measure(page);
    compare("off: cluster opens", offOpen.out, offRest.out, ["click-start", "tempo-control", "panel-play-cluster"]);
    await page.getByTestId("play-notes").click();
    const onOpen = await measure(page);
    compare("Notes toggled on (cluster open)", onOpen.out, offOpen.out, ["click-start", "tempo-control", "panel-play-cluster"]);
    await closeCluster(page);
    const onRest = await measure(page);
    heights["notes on, rest (none)"] = onRest.barHeight;
    compare("on: cluster closes", onRest.out, onOpen.out, ["click-start", "tempo-control", "panel-play-cluster"]);

    await openCluster(page);
    for (let i = 0; i < 6; i++) await page.getByTestId("play-slower").click();
    await closeCluster(page);
    const slow = await measure(page);
    heights["notes on, speed 70"] = slow.barHeight;
    compare("speed 70", slow.out, onRest.out, ["click-start", "tempo-control", "panel-play-cluster"]);

    await page.getByTestId("click-start").click();
    await expect(page.getByTestId("click-state")).toHaveText("Counting in.");
    const counting = await measure(page);
    heights["counting in"] = counting.barHeight;
    await expect(page.getByTestId("click-state")).toHaveText("Playing.", { timeout: 10_000 });
    const playing = await measure(page);
    heights["playing"] = playing.barHeight;
    compare("run starts (More, tempo)", playing.out, slow.out, ["tempo-control", "panel-play-cluster"]);
    if (playing.out["click-beat"] && slow.out["click-start"]) {
      const a = playing.out["click-beat"];
      const b = slow.out["click-start"];
      a.forEach((v, i) => {
        if (Math.abs(v - b[i]) > 0.5) moves.push(`beat box vs Start[${i}] ${b[i].toFixed(1)} -> ${v.toFixed(1)}`);
      });
    }
    await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
    await expect(page.getByTestId("click-state")).toContainText("Stopped because");
    const hidden = await measure(page);
    heights["stopped hidden"] = hidden.barHeight;
    compare("run stops", hidden.out, slow.out, ["click-start", "tempo-control", "panel-play-cluster"]);

    await setStoredTempo(page, null);
    await page.goto(s.playUrl);
    await expect(page.getByTestId("click-start")).toBeDisabled();
    const noTempo = await measure(page);
    heights["notes on, no tempo"] = noTempo.barHeight;

    const off = heights["notes off, rest"];
    const wrong = Object.entries(heights)
      .filter(([, h]) => Math.abs(h - off) > 0.5)
      .map(([k, h]) => `${k}: ${h.toFixed(1)} vs ${off.toFixed(1)}`);
    expect({ wrong, moves, overflow: Math.max(offRest.overflow, playing.overflow, onOpen.overflow) > 0 }).toEqual({
      wrong: [],
      moves: [],
      overflow: false,
    });
    await context.close();
  });
}
