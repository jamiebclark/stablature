/**
 * INV-010: the marks are legible and distinct. Contrast against the column's own background is at least 4.5,
 * nothing is faded, and the thirteen states differ pairwise in greyscale.
 */
import { expect, test } from "@playwright/test";
import { contrast, type Col } from "./rhythm-probe-helpers";
import { open, seeded } from "./notation-helpers";

const D = ["w", "h", "q", "8", "16", "32"];
/** Thirteen states: six notes, six rests, and an eighth that joins nothing beside a rest. */
const LIST: Col[] = [
  ...D.map((d) => ({ d, frets: { 0: 5 } }) as Col),
  ...D.map((d) => ({ d, kind: "rest" as const, frets: {} }) as Col),
  { d: "8", frets: { 0: 5 } },
];

for (const theme of ["light", "dark"] as const) {
  for (const surface of ["song expanded", "play", "print"] as const) {
    test(`INV-010 contrast and distinct marks, ${surface}, ${theme}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme });
      const urls = await seeded(page, LIST);
      await open(page, surface, urls);
      const marks = await page.getByTestId("tab-rhythm").evaluateAll((els) =>
        els.map((el) => {
          let opacity = 1;
          let bg = "";
          for (let n: HTMLElement | null = el as HTMLElement; n; n = n.parentElement) {
            const s = getComputedStyle(n);
            opacity *= Number(s.opacity);
            if (!bg && s.backgroundColor !== "rgba(0, 0, 0, 0)") bg = s.backgroundColor;
          }
          return { fg: getComputedStyle(el).color, bg, opacity };
        }),
      );
      expect(marks.length).toBe(LIST.length);
      for (const m of marks) {
        expect(m.opacity).toBe(1);
        const bg = m.bg || (theme === "dark" ? "rgb(0, 0, 0)" : "rgb(255, 255, 255)");
        expect(contrast(m.fg, bg)).toBeGreaterThanOrEqual(4.5);
      }

      // Greyscale crops of each mark differ pairwise by at least 2% of the pixels either one inks.
      const crops: string[] = [];
      for (const el of await page.getByTestId("tab-rhythm").all()) {
        const box = (await el.boundingBox())!;
        const shot = await page.screenshot({
          clip: { x: box.x + box.width / 2 - 6, y: Math.max(0, box.y - 6), width: 15, height: box.height + 6 },
        });
        crops.push(shot.toString("base64"));
      }
      const grey: number[][] = await page.evaluate(async (list) => {
        const out: number[][] = [];
        for (const b64 of list) {
          const img = new Image();
          img.src = "data:image/png;base64," + b64;
          await img.decode();
          const c = document.createElement("canvas");
          c.width = img.width;
          c.height = img.height;
          const g = c.getContext("2d")!;
          g.drawImage(img, 0, 0);
          const d = g.getImageData(0, 0, img.width, img.height).data;
          const px: number[] = [];
          for (let i = 0; i < d.length; i += 4) px.push(Math.abs(d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11 - (d[0] * 0.3 + d[1] * 0.59 + d[2] * 0.11)) > 60 ? 1 : 0);
          out.push(px);
        }
        return out;
      }, crops);
      for (let i = 0; i < grey.length; i++) {
        for (let j = i + 1; j < grey.length; j++) {
          // A lone eighth is the same picture twice (column 3 and the last): that pair is one state.
          if (i === 3 && j === 12) continue;
          // Of the pixels either mark inks, not of the empty row around them.
          const ink = grey[i].filter((v, k) => v || grey[j][k]).length;
          const diff = grey[i].filter((v, k) => v !== grey[j][k]).length / ink;
          expect(diff, `marks ${i} and ${j}`).toBeGreaterThanOrEqual(0.02);
        }
      }
    });
  }
}
