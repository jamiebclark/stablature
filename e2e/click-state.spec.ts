import { expect, test } from "@playwright/test";
import { dumpDb, installRecorder, recorded, seedPlayable } from "./click-helpers";
import { cols, patchEvent, recorder, seed } from "./rhythm-probe-helpers";

const LOST = "Stopped because the device took the audio. Start again when you are ready.";

test.describe("the click: endings, motion and data", () => {
  test("count-in clicks are spaced one beat apart at the recorded times", async ({ page }) => {
    await installRecorder(page);
    await seedPlayable(page);
    await page.getByTestId("click-start").click();
    await expect.poll(async () => (await recorded(page)).starts.length, { timeout: 8000 }).toBeGreaterThanOrEqual(4);
    const starts = (await recorded(page)).starts.slice(0, 4);
    for (let i = 1; i < 4; i++) expect(Math.abs(starts[i].when - starts[0].when - i * 0.5)).toBeLessThan(0.001);
    await expect(page.getByTestId("click-state")).toHaveText(/Counting in\.|Plain beat\./);
  });

  test("pagehide stops the click and does not restart it", async ({ page }) => {
    await installRecorder(page);
    await seedPlayable(page);
    await page.getByTestId("click-start").click();
    await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
    await expect(page.getByTestId("click-state")).toHaveText(/screen was hidden/);
    await expect(page.getByTestId("click-start")).toBeVisible();
    expect((await recorded(page)).contexts).toHaveLength(1);
  });

  for (const state of ["suspended", "closed"] as const) {
    test(`a context going ${state} stops with the audio-lost words`, async ({ page }) => {
      await installRecorder(page);
      await seedPlayable(page);
      await page.getByTestId("click-start").click();
      await expect(page.getByTestId("click-stop")).toBeVisible();
      await page.evaluate((s) => {
        const ctx = (window as unknown as { __ctxs: AudioContext[] }).__ctxs[0];
        return s === "suspended" ? ctx.suspend() : ctx.close();
      }, state);
      await expect(page.getByTestId("click-state")).toHaveText(LOST);
      await expect(page.getByTestId("click-start")).toBeVisible();
      expect((await recorded(page)).contexts).toHaveLength(1);
    });
  }

  // Read on each beat through an observer, not by a poll that has to land inside the transition window.
  for (const reduce of ["reduce", "no-preference"] as const) {
    test(`INV-028 no transition on any beat, reduced motion ${reduce}`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: reduce });
      await recorder(page);
      const { playUrl } = await seed(page, cols(null), { bpm: 240 });
      await page.goto(playUrl);
      await page.getByTestId("click-start").click();
      await expect(page.getByTestId("click-beat")).toBeAttached();
      await page.evaluate(() => {
        const w = window as unknown as { __seen: number[] };
        w.__seen = [];
        const beat = document.querySelector("[data-testid=click-beat]") as HTMLElement;
        new MutationObserver(() => {
          // Reading a computed style first makes the change take effect, so a transition is visible now.
          void getComputedStyle(beat.firstElementChild as HTMLElement).width;
          w.__seen.push(beat.getAnimations({ subtree: true }).length);
        }).observe(beat, { attributes: true, attributeFilter: ["data-level"] });
      });
      await expect
        .poll(() => page.evaluate(() => (window as unknown as { __seen: number[] }).__seen.length), { timeout: 8000 })
        .toBeGreaterThanOrEqual(8);
      const seen = await page.evaluate(() => (window as unknown as { __seen: number[] }).__seen);
      expect(Math.max(...seen)).toBe(0);
    });
  }

  test("a run leaves the database dump identical", async ({ page }) => {
    await installRecorder(page);
    await seedPlayable(page);
    const before = await dumpDb(page);
    await page.getByTestId("click-start").click();
    await page.waitForTimeout(1500);
    await page.getByTestId("click-stop").click();
    expect(await dumpDb(page)).toBe(before);
  });

  test("a mid-run database edit changes nothing in the running click", async ({ page }) => {
    await installRecorder(page);
    await seedPlayable(page);
    await page.getByTestId("click-start").click();
    await expect.poll(async () => (await recorded(page)).starts.length, { timeout: 8000 }).toBeGreaterThanOrEqual(5);
    // A duration and a barline, written where a live query sees them: the page draws both, the click ignores both.
    await patchEvent(page, 0, { durationHint: "h" });
    await patchEvent(page, 1, { kind: "barline", frets: {} });
    await expect(page.getByTestId("tab-rhythm").first()).toHaveText(/\S/);
    await page.waitForTimeout(1500);
    const starts = (await recorded(page)).starts;
    for (let i = 1; i < starts.length; i++) {
      expect(Math.abs(starts[i].when - starts[i - 1].when - 0.5)).toBeLessThan(0.001);
    }
  });

  test("role=status changes only on state changes during a run", async ({ page }) => {
    await installRecorder(page);
    await seedPlayable(page);
    await page.evaluate(() => {
      const w = window as unknown as { __mut: number };
      w.__mut = 0;
      new MutationObserver(() => w.__mut++).observe(document.querySelector("[data-testid=click-state]")!, {
        childList: true,
        characterData: true,
        subtree: true,
      });
    });
    await page.getByTestId("click-start").click();
    await page.waitForTimeout(4000);
    await page.getByTestId("click-stop").click();
    expect(await page.evaluate(() => (window as unknown as { __mut: number }).__mut)).toBeLessThanOrEqual(4);
  });

  for (const theme of ["light", "dark"] as const) {
    test(`phone width, ${theme}: controls reachable across a 40-pass song`, async ({ page, isMobile }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.emulateMedia({ colorScheme: theme });
      await installRecorder(page);
      await seedPlayable(page, { passes: 40 });
      for (const f of [0, 0.5, 1]) {
        await page.evaluate((x) => window.scrollTo(0, (document.body.scrollHeight - innerHeight) * x), f);
        for (const id of ["click-start", "tempo-control"]) {
          const box = (await page.getByTestId(id).boundingBox())!;
          // 44 on touch; a fine pointer reads the density floor of 32 for a toolbar control.
          expect(box.height).toBeGreaterThanOrEqual(isMobile ? 44 : 32);
          const hit = await page.evaluate(
            ([x, y, t]) => document.elementFromPoint(x as number, y as number)?.closest(`[data-testid=${t}]`) !== null,
            [box.x + box.width / 2, box.y + box.height / 2, id],
          );
          expect(hit).toBe(true);
        }
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    });
  }
});
