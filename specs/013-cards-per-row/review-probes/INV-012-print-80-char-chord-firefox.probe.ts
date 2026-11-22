/**
 * Review probe, INV-012 / FR-018 (a chord symbol wider than its printed line breaks inside the line; nothing is cut).
 * Spec 007's usability-staves.spec.ts "a chord longer than a line" (an 80-character symbol, `Cmaj7` × 16) fails in the
 * firefox project on this branch: "print … @375/@820: 2 lines cut". This probe isolates the cause: it prints the same
 * song's play view, counts runs whose content overflows (cut on paper), then re-counts with `main`'s print column rule
 * (`min-width: 0 !important`) injected, and then with `main`'s chord rule (no `width: max-content`) injected.
 * {375, 820, 1280} × {probe-desktop, probe-firefox}.
 */
import { expect, test } from "@playwright/test";
import { bar, n, seedSong, type Col } from "../../../e2e/reading-helpers";

test.setTimeout(300_000);
const q = (fret: number, over: Col = {}) => n(fret, { d: "q", ...over });
const LONG = "Cmaj7".repeat(16);

const MAIN_COLUMN = `@media print { .tab-bar-run [data-testid="tab-column"] { min-width: 0 !important; } }`;
const MAIN_CHORD = `@media print { .tab-bar-run [data-testid="tab-column"] > div.text-accent { width: auto !important; max-width: calc(100vw - 8rem) !important; } }`;

test("INV-012 an 80-character chord prints without cutting its line", async ({ page }, info) => {
  test.skip(info.project.name === "probe-mobile", "desktop and firefox");
  const { playUrl } = await seedSong(page, [{ key: "a", label: "A", columns: [q(3, { chord: LONG }), q(5), q(3), q(5), bar(), q(3), q(5), q(3), q(5)] }], [{ part: "a" }]);
  const bad: string[] = [];
  for (const width of [375, 820, 1280]) {
    const counts: Record<string, number> = {};
    for (const [name, css] of [["branch", ""], ["main column rule", MAIN_COLUMN], ["main chord rule", MAIN_CHORD]] as const) {
      await page.emulateMedia({ media: "screen" });
      await page.setViewportSize({ width, height: 900 });
      await page.goto(playUrl);
      await expect(page.getByTestId("tab-staff").first()).toBeVisible();
      if (css) await page.addStyleTag({ content: css });
      await page.emulateMedia({ media: "print" });
      await page.waitForTimeout(200);
      const r = await page.evaluate(() => {
        const runs = [...document.querySelectorAll<HTMLElement>(".tab-bar-run")];
        const col = document.querySelector<HTMLElement>('[data-testid="tab-column"]')!;
        const chord = col.querySelector<HTMLElement>("div.text-accent")!;
        return {
          cut: runs.filter((x) => x.scrollWidth > x.clientWidth + 1).length,
          colMin: getComputedStyle(col).minWidth,
          colW: col.getBoundingClientRect().width,
          chordW: chord.getBoundingClientRect().width,
          runW: runs[0]?.clientWidth ?? 0,
        };
      });
      counts[name] = r.cut;
      console.log(`${info.project.name} @${width} ${name}: ${JSON.stringify(r)}`);
    }
    if (counts.branch > 0) bad.push(`@${width}: ${counts.branch} runs cut on this branch (main column rule: ${counts["main column rule"]}, main chord rule: ${counts["main chord rule"]})`);
  }
  console.log(bad.join("\n"));
  expect(bad).toEqual([]);
});
