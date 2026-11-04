/**
 * INV-015 / SC-007 / INV-012 (round 3), the follow-through on INV-015-r3-phone-width: what a
 * five-latch strip actually costs at 375x667, for the two label sets the project has written
 * down, on the plan's worst-case part (five strings + chord row + tuplet row).
 *
 *   spec FR-008:   hammer-on, pull-off, slide-up, slide-down
 *   the roadmap:   h, p, slide-up, slide-down   (.specify/roadmaps/capture-expression.json)
 *
 * The widest word that stays on one line is also reported, so a later entry can see its
 * budget. Measures and asserts the shape of the strip; nothing here touches the code.
 */
import { expect, test } from "@playwright/test";
import { columns, fret, startCapturing } from "./helpers";

const SETS = {
  "spec FR-008": ["hammer-on", "pull-off", "slide-up", "slide-down"],
  roadmap: ["h", "p", "slide-up", "slide-down"],
};

for (const [name, labels] of Object.entries(SETS)) {
  test(`five latches, ${name} labels, worst-case part`, async ({ page }, info) => {
    test.skip(info.project.name !== "mobile", "one project is enough for a layout");
    await page.setViewportSize({ width: 375, height: 667 });
    await startCapturing(page);
    await fret(page, "A", 5).click();
    await fret(page, "A", 7).click();
    await fret(page, "A", 9).click();
    await expect(columns(page)).toHaveCount(3);
    await page.getByTitle(/triplet/).click();
    await page.getByRole("button", { name: "chord symbol" }).click();
    await page.getByLabel("Chord", { exact: true }).fill("Am");
    await page.getByRole("button", { name: "Set", exact: true }).click();
    await expect(page.getByLabel("Chord", { exact: true })).toHaveCount(0);

    const measure = () =>
      page.evaluate(() => {
        const strip = document.querySelector('[data-testid="latch-strip"]')!;
        const staff = document.querySelector('[data-testid="tab-staff"]')!;
        let scroller: Element | null = staff.parentElement;
        while (scroller && !/(auto|scroll)/.test(getComputedStyle(scroller).overflowY)) {
          scroller = scroller.parentElement;
        }
        const band = scroller!.getBoundingClientRect();
        const rows = [...staff.querySelectorAll(".tab-cell")].map((c) => c.getBoundingClientRect());
        const tops = [...new Set(rows.map((r) => Math.round(r.top)))];
        const clipped = tops.filter((t) => {
          const r = rows.find((x) => Math.round(x.top) === t)!;
          return r.top < band.top - 1 || r.bottom > band.bottom + 1;
        });
        const lines = [...strip.querySelectorAll("button")].map((b) => {
          const range = document.createRange();
          range.selectNodeContents(b);
          return {
            text: b.textContent,
            lines: new Set([...range.getClientRects()].map((r) => Math.round(r.top))).size,
            textWidth: Math.max(...[...range.getClientRects()].map((r) => r.width)),
            room: b.clientWidth - 16,
          };
        });
        return {
          strip: strip.getBoundingClientRect().height,
          stableY: document.querySelector('[data-testid="toolbar-stable"]')!.getBoundingClientRect().y,
          band: Math.round(band.height),
          staffNeeds: Math.round(staff.getBoundingClientRect().height),
          stringsClipped: clipped.length,
          pageOver: document.scrollingElement!.scrollHeight - document.scrollingElement!.clientHeight,
          lines,
        };
      });

    const before = await measure();
    await page.getByTestId("latch-strip").evaluate((el, words) => {
      const chip = el.querySelector("button")!;
      for (const word of words) {
        const clone = chip.cloneNode(true) as HTMLButtonElement;
        clone.textContent = word;
        el.append(clone);
      }
    }, labels);
    const after = await measure();
    console.log(`BEFORE ${name} ${JSON.stringify({ ...before, lines: undefined })}`);
    console.log(`AFTER ${name} ${JSON.stringify(after)}`);
    await page.screenshot({ path: `${process.env.TEMP ?? "/tmp"}/spec001-r3-labels-${name.split(" ")[0]}.png` });

    expect(after.lines).toHaveLength(5);
    expect(after.lines.filter((l) => l.lines > 1).map((l) => l.text), "no label wraps").toEqual([]);
    expect(after.strip, "the strip keeps its height").toBe(before.strip);
  });
}
