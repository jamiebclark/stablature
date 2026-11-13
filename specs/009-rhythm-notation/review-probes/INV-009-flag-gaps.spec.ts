/**
 * Review probe, INV-009 member "flag × levels 2 and 3" (FR-027: "a gap between stacked beams or flags MUST be at
 * least as wide as one beam"). The landed `notation-alignment.spec.ts` measures beam gaps only, never flags.
 *
 * On the song page, for a lone sixteenth and a lone thirty-second, each flag's path is sampled in screen space
 * (`getPointAtLength` through `getScreenCTM`), and the gap between adjacent levels is the least distance between
 * their centrelines, less one stroke width. Points within 1.5px of the stem's x are left out: there the flags run
 * down the stem and overlay it by design.
 */
import { expect, test } from "@playwright/test";
import { seed, type Col } from "../../../e2e/rhythm-probe-helpers";

const LIST: Col[] = [
  { d: "16", frets: { 0: 5 } },
  { d: "q", frets: { 0: 5 } },
  { d: "32", frets: { 0: 7 } },
  { d: "q", frets: { 0: 5 } },
];

test("INV-009 stacked flags keep a gap of at least one beam", async ({ page }) => {
  const urls = await seed(page, LIST, { bpm: 120 });
  await page.goto(urls.songUrl);
  await expect(page.getByTestId("tab-rhythm").first()).toBeVisible();
  const got = await page.getByTestId("tab-staff").first().evaluate((staff) => {
    const out: { duration: string; levels: number; minGap: number; beam: number }[] = [];
    for (const cell of Array.from(staff.querySelectorAll("[data-testid=tab-rhythm][data-flags]"))) {
      const flags = Array.from(cell.querySelectorAll("svg[data-part=flag]")) as SVGSVGElement[];
      if (flags.length < 2) continue;
      const stem = cell.querySelector("[data-part=stem]")!.getBoundingClientRect();
      const stemX = stem.left + stem.width / 2;
      const beam = parseFloat(getComputedStyle(cell).getPropertyValue("--rhythm-beam")) || 2;
      const lines = flags.map((svg) => {
        const path = svg.querySelector("path") as SVGPathElement;
        const m = path.getScreenCTM()!;
        const len = path.getTotalLength();
        const width = parseFloat(getComputedStyle(path).strokeWidth) * Math.hypot(m.a, m.b);
        const pts = Array.from({ length: 241 }, (_, i) => {
          const p = path.getPointAtLength((len * i) / 240);
          return { x: m.a * p.x + m.c * p.y + m.e, y: m.b * p.x + m.d * p.y + m.f };
        });
        return { pts, width };
      });
      let minGap = Infinity;
      for (let k = 0; k + 1 < lines.length; k++)
        for (const a of lines[k].pts) {
          if (Math.abs(a.x - stemX) < 1.5) continue;
          for (const b of lines[k + 1].pts) {
            if (Math.abs(b.x - stemX) < 1.5) continue;
            minGap = Math.min(minGap, Math.hypot(a.x - b.x, a.y - b.y) - (lines[k].width + lines[k + 1].width) / 2);
          }
        }
      out.push({ duration: cell.getAttribute("data-duration")!, levels: flags.length, minGap: Math.round(minGap * 100) / 100, beam });
    }
    return out;
  });
  console.log(JSON.stringify(got));
  expect(got.map((g) => g.duration).sort()).toEqual(["16", "32"]);
  for (const g of got) expect(g.minGap, `${g.duration}: least gap between stacked flags`).toBeGreaterThanOrEqual(g.beam - 0.01);
});
