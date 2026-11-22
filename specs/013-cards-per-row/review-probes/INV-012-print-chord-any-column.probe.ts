/**
 * Review probe (round 2), INV-012 / FR-017 / FR-018: the round-1 fix caps a printed chord symbol at `100cqi` of its
 * `.tab-lines` and gives it `width: max-content`. Every earlier probe and suite case puts the long symbol on a line's
 * FIRST column, where "as wide as the line" and "inside the line" coincide. This one puts symbols on later columns: the
 * middle and the end of a bar, the first column of a second bar, and a bar that shares its line with short bars.
 *
 * For every symbol outside a scrolling staff (the narrow song page's, FU6), at {375, 718, 820, 1047, 1280} on both
 * pages:
 *   - its right edge is inside its card and the paper (FR-018: "nothing is cut at the paper's right edge");
 *   - a symbol whose one-line width fits its line prints on one line (FR-017);
 *   - no bar run is cut (`scrollWidth > clientWidth + 1`), and the page does not scroll sideways.
 * Chromium desktop and Firefox (the viewport is set here, so mobile adds nothing).
 */
import { expect, test } from "@playwright/test";
import { bar, n, seedSong, type Col } from "../../../e2e/reading-helpers";

test.setTimeout(400_000);

const q = (fret: number, over: Col = {}): Col => n(fret, { d: "q", ...over });
const C80 = "Cmaj7".repeat(16);
const C30 = "Cmaj7#11b9/G#sus4add13omit5xx".slice(0, 30);
const C12 = "Cmaj7#11/G#b";

const SHAPES: Record<string, Col[]> = {
  "80 mid-bar": [q(3), q(5), q(3, { chord: C80 }), q(5), bar(), q(3), q(5), q(3), q(5)],
  "80 end of bar": [q(3), q(5), q(3), q(5, { chord: C80 }), bar(), q(3), q(5), q(3), q(5)],
  "80 first of bar 2": [q(3), q(5), q(3), q(5), bar(), q(3, { chord: C80 }), q(5), q(3), q(5)],
  "30 mid-bar": [q(3), q(5), q(3, { chord: C30 }), q(5), bar(), q(3), q(5), q(3), q(5)],
  "12 end of a line": [q(3), q(5), q(3), q(5, { chord: C12 })],
  "40 in bar 4 of short bars": [
    q(3), q(5), bar(), q(3), q(5), bar(), q(3), q(5), bar(), q(3, { chord: C80.slice(0, 40) }), q(5), bar(), q(3), q(5), bar(), q(3), q(5),
  ],
};

for (const [name, columns] of Object.entries(SHAPES)) {
  test(`INV-012 a printed chord stays in its line wherever it sits: ${name}`, async ({ page }, info) => {
    test.skip(info.project.name === "probe-mobile", "viewport is set here; desktop and firefox only");
    const { songUrl, playUrl } = await seedSong(page, [{ key: "a", label: "A", columns }], [{ part: "a" }]);
    const bad: string[] = [];
    for (const [pg, url] of [["song", songUrl], ["play", playUrl]] as const) {
      for (const width of [375, 718, 820, 1047, 1280]) {
        await page.emulateMedia({ media: "screen" });
        await page.setViewportSize({ width, height: 900 });
        await page.goto(url);
        await expect(page.getByTestId("tab-staff").first()).toBeVisible();
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(300);
        await page.emulateMedia({ media: "print" });
        await page.waitForTimeout(300);
        const r = await page.evaluate(() => {
          const out: string[] = [];
          for (const e of document.querySelectorAll<HTMLElement>('[data-testid="tab-column"] > div.text-accent')) {
            const text = (e.textContent ?? "").trim();
            if (!text || e.closest(".overflow-x-auto")) continue;
            const card = (e.closest("li") ?? e.closest(".reading-card") ?? document.body).getBoundingClientRect();
            const line = e.closest<HTMLElement>(".tab-lines");
            const lineW = line ? line.clientWidth : innerWidth;
            const clone = e.cloneNode(true) as HTMLElement;
            clone.style.cssText = "position:absolute;visibility:hidden;white-space:nowrap;width:max-content;max-width:none";
            e.parentElement!.appendChild(clone);
            const natural = clone.getBoundingClientRect().width;
            clone.remove();
            const range = document.createRange();
            range.selectNodeContents(e);
            const lines = new Set([...range.getClientRects()].map((x) => Math.round(x.top))).size;
            const b = e.getBoundingClientRect();
            const limit = Math.min(card.right, innerWidth);
            const tag = `${text.slice(0, 12)}${text.length > 12 ? "…" : ""} (${text.length})`;
            if (b.right > limit + 0.5) out.push(`${tag} right ${b.right.toFixed(1)} past card/paper ${limit.toFixed(1)} by ${(b.right - limit).toFixed(1)}`);
            if (natural <= lineW - 1 && lines > 1) out.push(`${tag} ${natural.toFixed(0)}px fits its ${lineW}px line but prints on ${lines} lines`);
          }
          const cut = [...document.querySelectorAll<HTMLElement>(".tab-bar-run")].filter((x) => !x.closest(".overflow-x-auto") && x.scrollWidth > x.clientWidth + 1);
          if (cut.length) out.push(`${cut.length} runs cut (${cut.map((x) => `${x.scrollWidth}/${x.clientWidth}`).join(", ")})`);
          if (document.documentElement.scrollWidth > innerWidth) out.push(`page ${document.documentElement.scrollWidth} > ${innerWidth}`);
          return out;
        });
        bad.push(...r.map((x) => `${pg} @${width}: ${x}`));
      }
    }
    console.log(`${name}\n${bad.join("\n")}`);
    expect(bad).toEqual([]);
  });
}
