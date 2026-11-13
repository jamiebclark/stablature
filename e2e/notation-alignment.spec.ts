/**
 * INV-007, INV-009, INV-018: the marks sit on the notes, keep their sizes, and move nothing. Stems, rests and
 * ovals are centred on the note within 1px; beam, stub and stem rects keep their sizes; column rects equal
 * the same part with every duration cleared.
 */
import { expect, test } from "@playwright/test";
import { writeColumns, type Col } from "./rhythm-probe-helpers";
import { cells, noteCentres, open, seeded, SURFACES } from "./notation-helpers";

const LIST: Col[] = [
  { d: "w", frets: { 0: 5 } },
  { d: "h", frets: { 0: 12 } },
  { d: "q", frets: { 0: 7 } },
  { kind: "barline" },
  { d: "8", frets: { 0: 5 } },
  { d: "8", frets: { 0: 12 } },
  { d: "16", frets: { 0: 7 } },
  { d: "16", frets: { 0: 9 } },
  { d: "32", frets: { 0: 3 } },
  { d: "32", frets: { 0: 3 } },
  { kind: "barline" },
  { d: "q", kind: "rest", frets: {} },
  { d: "8", kind: "rest", frets: {} },
  { d: "16", kind: "rest", frets: {} },
  { d: "32", kind: "rest", frets: {} },
  { d: "8", frets: { 0: 7 }, repeat: 4 },
];

const SIZES = [
  { width: 375, height: 667 },
  { width: 1280, height: 800 },
];

for (const size of SIZES) {
  for (const surface of SURFACES) {
    test(`INV-007 INV-009 INV-018 marks on the notes, ${surface} at ${size.width}`, async ({ page }) => {
      await page.setViewportSize(size);
      const urls = await seeded(page, LIST);
      await open(page, surface, urls);
      const got = await cells(page);
      const centres = await noteCentres(page);
      const boxes = got.map((c) => [c.box.x, c.box.width]);

      got.forEach((c, i) => {
        if (c.rhythm === null) return;
        for (const p of c.parts) {
          if (p.part === "stem" || p.part === "rest" || p.part === "oval") {
            expect(Math.abs(p.x + p.width / 2 - centres[i]), `${p.part} of column ${i}`).toBeLessThanOrEqual(1);
          }
          if (p.part === "beam") expect(p.height, "beam thickness").toBeGreaterThanOrEqual(2 - 0.01);
          if (p.part === "stub") {
            expect(p.height, "stub thickness").toBeGreaterThanOrEqual(2 - 0.01);
            expect(p.width, "stub length").toBeGreaterThanOrEqual(2 - 0.01);
          }
          if (p.part === "stem") expect(p.width, "stem thickness").toBeGreaterThanOrEqual(1 - 0.01);
        }
        // Stacked levels keep a gap of at least one thickness.
        const beams = c.parts.filter((p) => p.part === "beam" && p.side === "right").sort((a, b) => a.level - b.level);
        for (let k = 1; k < beams.length; k++) {
          const gap = beams[k - 1].y - (beams[k].y + beams[k].height);
          expect(gap, "gap between beam levels").toBeGreaterThanOrEqual(beams[k].height - 0.01);
        }
      });

      const numbers = () => page.getByTestId("tab-bar-number").allTextContents();
      const withNumbers = await numbers();
      await writeColumns(page, urls.partId, LIST.map((c) => ({ ...c, d: null })));
      await open(page, surface, urls);
      const bare = await cells(page);
      expect(bare.map((c) => [c.box.x, c.box.width])).toEqual(boxes);
      expect(await numbers()).toEqual(withNumbers);
    });
  }
}
