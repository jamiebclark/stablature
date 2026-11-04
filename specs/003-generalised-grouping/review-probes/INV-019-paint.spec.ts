/**
 * INV-019 / FR-029, "no digit touching the bracket", read off the pixels. `getBBox()` leaves out
 * the rail's 1.4 stroke and includes the digit's side bearings, so the plan's check can pass while
 * paint touches, or fail while it doesn't. This paints rails alone and numeral alone at the
 * device's real scale, and counts pixels that both cover (more than a third of full coverage, so
 * shared antialiasing fringe is not counted). Reports every numeral; asserts on all but 3, whose
 * pixels INV-019-glyph.spec.ts holds to main's exactly.
 */
import { expect, test } from "@playwright/test";
import { addNotes, cancelSelection, selectColumns, startCapturing, THEMES, tupletControl } from "./probe-helpers";

for (const theme of THEMES) {
  test(`numerals 2 to 16 and their rails share no paint (${theme})`, async ({ page }, info) => {
    test.skip(info.project.name !== "mobile", "one project is enough for a measurement");
    test.setTimeout(120_000);
    await page.emulateMedia({ colorScheme: theme });
    await startCapturing(page);
    await addNotes(page, 16);
    const report: Record<number, number> = {};
    for (let n = 2; n <= 16; n++) {
      await selectColumns(page, 0, n - 1);
      const svg = tupletControl(page).locator("svg");
      const show = (rails: boolean, text: boolean) =>
        svg.evaluate(
          (el, [r, t]) => {
            for (const p of el.querySelectorAll<SVGElement>("[data-rail]")) p.style.visibility = r ? "visible" : "hidden";
            el.querySelector<SVGElement>("text")!.style.visibility = t ? "visible" : "hidden";
          },
          [rails, text],
        );
      await show(false, false);
      const none = (await svg.screenshot()).toString("base64");
      await show(true, false);
      const rails = (await svg.screenshot()).toString("base64");
      await show(false, true);
      const digits = (await svg.screenshot()).toString("base64");
      await show(true, true);
      report[n] = await page.evaluate(async ([a, b, c]) => {
        const read = async (data: string) => {
          const img = new Image();
          img.src = `data:image/png;base64,${data}`;
          await img.decode();
          const canvas = document.createElement("canvas");
          canvas.width = img.width;
          canvas.height = img.height;
          const g = canvas.getContext("2d")!;
          g.drawImage(img, 0, 0);
          return g.getImageData(0, 0, img.width, img.height).data;
        };
        const [bg, r, d] = await Promise.all([read(a), read(b), read(c)]);
        const delta = (x: Uint8ClampedArray, i: number) =>
          Math.abs(x[i] - bg[i]) + Math.abs(x[i + 1] - bg[i + 1]) + Math.abs(x[i + 2] - bg[i + 2]);
        let full = 0;
        for (let i = 0; i < bg.length; i += 4) full = Math.max(full, delta(r, i), delta(d, i));
        let both = 0;
        for (let i = 0; i < bg.length; i += 4) {
          if (delta(r, i) > full / 3 && delta(d, i) > full / 3) both += 1;
        }
        return both;
      }, [none, rails, digits]);
      await cancelSelection(page);
    }
    console.log(JSON.stringify({ theme, sharedPixels: report }));
    for (let n = 2; n <= 16; n++) {
      if (n !== 3) expect(report[n], `numeral ${n}`).toBe(0);
    }
  });
}
