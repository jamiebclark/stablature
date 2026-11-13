/**
 * INV-006 / FR-008: six positions, in order, one line, >=44px, inside 375px, the same y across
 * columns, on every playable shape, absent on a barline, no page scroll. Both themes.
 */
import { expect, test, type Page } from "@playwright/test";
import { columns, details, inspector } from "./capture-surface-helpers";
import { seed, type Col } from "./rhythm-probe-helpers";

const SHAPES: { name: string; col: Col }[] = [
  { name: "note", col: { frets: { 0: 5 } } },
  { name: "chord of 5", col: { frets: { 0: 1, 1: 2, 2: 3, 3: 4, 4: 5 } } },
  { name: "repeated", col: { frets: { 0: 5 }, repeat: 8 } },
  { name: "grouped", col: { frets: { 0: 5 }, tupletId: "g", tupletCount: 3, groupKind: "tuplet" } },
  { name: "space", col: { kind: "rest", frets: {} } },
  {
    name: "every technique",
    col: { frets: { 0: 5 }, techniques: { 0: ["vibrato", "harmonic", "let_ring", "bend", "tap", "palm_mute"] } },
  },
];

async function open(page: Page, index: number) {
  await columns(page).nth(index).click();
  await details(page).click();
  await expect(inspector(page)).toBeVisible();
}

for (const theme of ["light", "dark"] as const) {
  test(`INV-006 the row holds its place on every playable shape (${theme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme });
    await page.setViewportSize({ width: 375, height: 667 });
    const { partUrl } = await seed(page, SHAPES.map((s) => s.col), { arrange: false });
    await page.goto(partUrl);
    await expect(columns(page).first()).toBeVisible();
    const count = await columns(page).count();
    expect(count).toBeGreaterThanOrEqual(SHAPES.length);

    // A repeat of 8 draws one column per hit on the capture staff or one in compact, so walk by
    // the shapes' own order: the repeated shape may take more than one drawn column.
    const drawn = await columns(page).evaluateAll((els) => els.map((el) => el.getAttribute("aria-label")));
    const indexOf: number[] = [];
    {
      let at = 0;
      for (const shape of SHAPES) {
        indexOf.push(at);
        at += shape.name === "repeated" && drawn.length > SHAPES.length ? 8 : 1;
      }
    }

    const seen: { name: string; y: number; sheet: number; rows: number }[] = [];
    for (const [i, shape] of SHAPES.entries()) {
      await open(page, indexOf[i]);
      const buttons = page.getByTestId("duration-row").getByRole("button");
      await expect(buttons).toHaveCount(6);
      const boxes = await buttons.evaluateAll((els) =>
        els.map((el) => {
          const r = el.getBoundingClientRect();
          return { x: r.x, y: r.y, w: r.width, h: r.height, t: el.getAttribute("data-duration"), text: el.textContent };
        }),
      );
      expect(boxes.map((b) => b.t), shape.name).toEqual(["w", "h", "q", "8", "16", "32"]);
      expect(boxes.map((b) => b.text), shape.name).toEqual(["", "", "", "", "", ""]);
      for (const b of boxes) {
        expect(b.y, shape.name).toBeCloseTo(boxes[0].y, 0);
        expect(b.h, shape.name).toBeGreaterThanOrEqual(44);
        expect(b.x + b.w, shape.name).toBeLessThanOrEqual(375);
      }
      expect(
        await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight),
        `${shape.name}: the page does not scroll`,
      ).toBe(true);
      seen.push({
        name: shape.name,
        y: Math.round(boxes[0].y),
        sheet: Math.round((await page.locator("dialog[open]").boundingBox())!.height),
        rows: await inspector(page).locator("[data-property-row]").count(),
      });
      await page.keyboard.press("Escape");
      await expect(page.locator("dialog[open]")).toHaveCount(0);
    }
    expect(new Set(seen.map((s) => s.y)).size, JSON.stringify(seen)).toBe(1);
  });
}
