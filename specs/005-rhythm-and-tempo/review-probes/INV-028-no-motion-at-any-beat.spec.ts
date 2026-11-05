/**
 * INV-028 / FR-034, round 2. `getAnimations()` is empty on the beat box, read at the moment each beat
 * lands rather than whenever a poll happens to look.
 *
 * `globals.css` answers `prefers-reduced-motion: reduce` with `transition-duration: 0.01ms` on every
 * element. Nothing sets `transition-property` on the beat box, so it stays `all`, and a non-zero
 * duration turns each change of level into a real transition. `e2e/click-state.spec.ts:52` catches one
 * only if it reads inside that window, which is why it fails about one run in twelve.
 */
import { expect, test } from "@playwright/test";
import { cols, recorder, seed } from "./helpers";

for (const reduce of ["reduce", "no-preference"] as const) {
  test(`INV-028 no transition on any beat, reduced motion ${reduce}`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: reduce });
    await recorder(page);
    const { playUrl } = await seed(page, cols(null), { bpm: 240 });
    await page.goto(playUrl);
    // `CANDIDATE=none` tries the fix in the browser, with no change to the source.
    if (process.env.CANDIDATE === "none") {
      await page.addStyleTag({ content: "[data-testid=click-beat],[data-testid=click-beat] *{transition-property:none}" });
    }
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
    console.log(`MOTION ${reduce}: ${JSON.stringify(seen.slice(0, 12))}`);
    expect(Math.max(...seen)).toBe(0);
  });
}
