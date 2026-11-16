/**
 * INV-016, with the window made exact. `e2e/play-offline.spec.ts` counts requests from the tap until AFTER
 * `setOffline(false)`, so a request the app makes because the network came back can land in its count. This logs
 * every fetch / XHR / Request with `navigator.onLine` and the time, and asserts on the calls made between the tap
 * and the stop, while offline. Repeated per scope so a race shows as a rate.
 */
import { expect, test } from "@playwright/test";
import { openCluster } from "../../../e2e/usability-helpers";
import { installPlayRecorder, noteStarts, playRecord, seedPlaybackSong } from "../../../e2e/play-helpers";

interface Call {
  what: string;
  online: boolean;
  at: number;
}

for (const scope of ["part", "song"] as const) {
  for (const round of [1, 2, 3]) {
    test(`INV-016 ${scope} #${round}: no request between the tap and the stop`, async ({ page, context }) => {
      await installPlayRecorder(page);
      await page.addInitScript(() => {
        const w = window as unknown as { __calls: Call[] };
        w.__calls = [];
        const log = (what: string) => w.__calls.push({ what, online: navigator.onLine, at: performance.now() });
        const f = window.fetch;
        window.fetch = function (...a: Parameters<typeof fetch>) {
          log(`fetch ${String(a[0] instanceof Request ? a[0].url : a[0])}`);
          return f.apply(this, a);
        };
        const open = XMLHttpRequest.prototype.open;
        XMLHttpRequest.prototype.open = function (this: XMLHttpRequest, ...a: unknown[]) {
          log(`xhr ${String(a[1])}`);
          return (open as (...x: unknown[]) => void).apply(this, a);
        };
      });
      const s = await seedPlaybackSong(page);
      await page.goto(scope === "part" ? `${s.songUrl}/play/${s.parts.t}` : s.playUrl);
      await expect(page.getByTestId("click-start")).toBeEnabled();
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(1500);
      if (scope === "song") {
        await openCluster(page);
        await page.getByTestId("play-notes").click();
        await page.getByTestId("panel-play-cluster").click();
      }
      await context.setOffline(true);
      const tap = await page.evaluate(() => performance.now());
      await page.getByTestId("click-start").click();
      await expect(page.getByTestId("click-stop")).toBeVisible();
      await page.waitForTimeout(4000);
      await page.getByTestId("click-stop").click();
      const stopped = await page.evaluate(() => performance.now());
      await context.setOffline(false);
      await page.waitForTimeout(500);
      const calls = await page.evaluate(() => (window as unknown as { __calls: Call[] }).__calls);
      const during = calls.filter((c) => c.at >= tap && c.at <= stopped).map((c) => `${c.what} online=${c.online}`);
      const afterOnline = calls.filter((c) => c.at > stopped).map((c) => c.what);
      test.info().annotations.push({ type: "after-online", description: JSON.stringify(afterOnline) });
      expect(during).toEqual([]);
      expect(noteStarts(await playRecord(page)).length).toBeGreaterThan(0);
    });
  }
}
