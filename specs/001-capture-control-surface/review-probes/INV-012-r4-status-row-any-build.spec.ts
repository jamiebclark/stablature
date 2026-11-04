/**
 * INV-012 / FR-028 (round 4): round 3's budget left the chord label about 2 px of room on the
 * worst-case part, and every fit probe so far uses one chord symbol ("Am") and the short status
 * text. The status row is the one row above the toolbar whose height depends on its text: it
 * holds the status words, the chord in force with its tones, and start/end, on one flex line
 * that nothing stops from wrapping. So enumerate what it can say.
 *
 *   3 cursor states (end, after, stacking) x 5 chord symbols x 2 chord-bearing shapes = 30.
 *
 * Runs on any build; compare the MEASURE lines:
 *   BASELINE_DIR=<built main> PROBE_PORT=3301 npx playwright test \
 *     --config specs/001-capture-control-surface/review-probes/playwright.baseline.config.ts INV-012-r4
 *
 * The bar is `main`, measured with this probe, because FR-028 says "continue to" show the row:
 * the wrap happens in the same states on both builds and hides the label on the tuplet part on
 * both. That shortfall is review.md F23, not gating. This fails if the branch ever clips more
 * than `main` does in the same state, so it passes on both builds.
 */
import { expect, test, type Page } from "@playwright/test";
import { columns, fret, startCapturing } from "./helpers";

const SYMBOLS = ["Am", "Am7", "Cmaj7", "F#m7b5", "Xyz"];
const STATES = ["end", "after", "stacking"] as const;
const SHAPES = ["chords", "chords and tuplet"] as const;

/** The chord label px above the clipping box on `main`, by shape and whether the row wrapped. */
const MAIN_CLIP = {
  chords: { oneLine: 0, wrapped: 6.6 },
  "chords and tuplet": { oneLine: 7.4, wrapped: 24.2 },
};

async function measure(page: Page, symbol: string) {
  return page.evaluate((symbol) => {
    const staff = document.querySelector('[data-testid="tab-staff"]')!;
    let scroller: Element | null = staff.parentElement;
    while (scroller && !/(auto|scroll)/.test(getComputedStyle(scroller).overflowY)) {
      scroller = scroller.parentElement;
    }
    const band = scroller!.getBoundingClientRect();
    const walker = document.createTreeWalker(staff, NodeFilter.SHOW_TEXT);
    let chord: DOMRect | null = null;
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (n.textContent?.trim() === symbol) {
        const range = document.createRange();
        range.selectNodeContents(n);
        chord = range.getBoundingClientRect();
      }
    }
    const status = [...document.querySelectorAll("span")].find((s) =>
      /^(adding|stacking)/.test(s.textContent ?? ""),
    )!;
    const range = document.createRange();
    range.selectNodeContents(status);
    const row = status.parentElement!;
    return {
      statusText: status.textContent,
      statusLines: new Set([...range.getClientRects()].map((r) => Math.round(r.top))).size,
      rowHeight: Math.round(row.getBoundingClientRect().height * 10) / 10,
      band: Math.round(band.height),
      chordClippedPx: chord ? Math.max(0, Math.round((band.top - chord.top) * 10) / 10) : null,
      labelHeight: chord ? Math.round(chord.height * 10) / 10 : null,
      pageOver: document.scrollingElement!.scrollHeight - document.scrollingElement!.clientHeight,
    };
  }, symbol);
}

for (const shape of SHAPES) {
  for (const state of STATES) {
    for (const symbol of SYMBOLS) {
      test(`status row - ${shape}, ${state}, ${symbol}`, async ({ page }, info) => {
        test.skip(info.project.name !== "mobile", "one project is enough for a measurement");
        await page.setViewportSize({ width: 375, height: 667 });
        await startCapturing(page);
        await fret(page, "A", 5).click();
        await fret(page, "A", 7).click();
        await fret(page, "A", 9).click();
        await expect(columns(page)).toHaveCount(3);
        if (shape === "chords and tuplet") await page.getByTitle(/triplet/).click();
        await page.getByRole("button", { name: "chord symbol" }).click();
        await page.getByRole("textbox", { name: "Chord" }).fill(symbol);
        await page.getByRole("button", { name: "Set", exact: true }).click();
        await expect(page.getByRole("textbox", { name: "Chord" })).toHaveCount(0);
        if (state !== "end") await columns(page).last().click();
        if (state === "stacking") {
          await page.getByRole("button", { name: /^stack/ }).click();
          await expect(page.getByText("stacking onto the marked column")).toBeVisible();
        }
        await page.mouse.move(0, 0);
        await page.waitForTimeout(200);
        const m = await measure(page, symbol);
        console.log(`MEASURE ${shape}/${state}/${symbol} ${JSON.stringify(m)}`);
        expect(m.pageOver).toBeLessThanOrEqual(0);
        expect(m.chordClippedPx, "the chord label is on the staff").not.toBeNull();
        const bar = MAIN_CLIP[shape][m.rowHeight > 40 ? "wrapped" : "oneLine"];
        expect(m.chordClippedPx!, "no more clipped than on main").toBeLessThanOrEqual(bar);
      });
    }
  }
}
