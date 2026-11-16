/**
 * INV-019 (review round 1), the members wide-ruler.spec.ts does not seed: a part with connector gaps (hammer-on,
 * slide) and a variant with removal gaps, plus a chord-widened column, in frets, notes and intervals, on both pages.
 * Measured with fractional widths (getBoundingClientRect), held to the plan's ±1px.
 */
import { expect, test } from "@playwright/test";
import { bar, n, seedSong, remember, VIEWS, type Col } from "../../../e2e/reading-helpers";

test.setTimeout(240_000);

const q = (fret: number, over: Col = {}) => n(fret, { d: "q", ...over });
const PARENT: Col[] = [q(3, { chord: "F#m7b5" }), q(5), q(7), q(5), bar(), q(3), q(5, { techniques: { 2: ["hammer_on"] } }), q(7), q(5), bar(), q(3), q(5, { techniques: { 2: ["slide_up"] } }), q(7), q(9)];
/** The variant drops a note in bar 1 and two at the end, so it draws removal gaps, mid-staff and at its end. */
const VARIANT: Col[] = [q(3, { chord: "F#m7b5" }), q(5), q(5), bar(), q(3), q(5, { techniques: { 2: ["hammer_on"] } }), q(7), q(5), bar(), q(3), q(5)];

for (const v of VIEWS) {
  test(`ruler equals the one-line staff with connectors and removal gaps, ${v}`, async ({ page }) => {
    const { songUrl, playUrl } = await seedSong(
      page,
      [
        { key: "a", label: "A", columns: PARENT },
        { key: "b", label: "A'", variantOf: "a", columns: VARIANT },
      ],
      [{ part: "a" }, { part: "b" }],
    );
    await remember(page, v);
    await page.setViewportSize({ width: 1280, height: 900 });
    const bad: string[] = [];
    for (const url of [songUrl, playUrl]) {
      await page.goto(url);
      await expect(page.getByTestId("tab-ruler").first()).toBeAttached();
      await page.evaluate(() => document.fonts.ready);
      const rows = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>(".tab-wrapped-body")].map((body) => {
          const lines = body.querySelector<HTMLElement>(".tab-lines")!;
          const ruler = body.parentElement!.querySelector<HTMLElement>('[data-testid="tab-ruler"]')!;
          lines.style.flexWrap = "nowrap";
          lines.style.width = "max-content";
          lines.querySelectorAll<HTMLElement>(".tab-bar-run").forEach((r) => (r.style.flex = "none"));
          const gutter = parseFloat(getComputedStyle(body).paddingLeft);
          return {
            lines: lines.getBoundingClientRect().width + gutter,
            ruler: ruler.getBoundingClientRect().width,
            removals: body.querySelectorAll('[data-testid="tab-removal"]').length,
            connectors: body.querySelectorAll("[data-connector], .tab-connector").length,
          };
        }),
      );
      expect(rows.length).toBe(2);
      expect(rows[1].removals, "the variant draws removal gaps").toBeGreaterThan(0);
      rows.forEach((r, i) => {
        if (Math.abs(r.lines - r.ruler) > 1) bad.push(`${url.endsWith("/play") ? "play" : "song"} card ${i}: lines ${r.lines.toFixed(2)} vs ruler ${r.ruler.toFixed(2)}`);
      });
    }
    expect(bad).toEqual([]);
  });
}
