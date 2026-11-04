/**
 * INV-003: never does a stable toolbar control change screen coordinates as the
 * cursor moves between a playable column and a barline.
 *
 * Enumerated at 375x667: 5 controls x 2 directions (notes->barline,
 * barline->notes) = 10 measurements, each direction reached by a tap (not by
 * inserting, which changes the staff too). Also asserts every stable and
 * contextual control lies wholly inside the 375px viewport -- a nowrap row that
 * overflows would keep its coordinates by clipping its last control off-screen.
 */
import { expect, test, type Page } from "@playwright/test";
import { columns, fret, startCapturing } from "./helpers";

const stable = (page: Page) => page.getByTestId("toolbar-stable");
const STABLE = {
  space: (p: Page) => stable(p).getByRole("button", { name: /space/ }),
  barline: (p: Page) => stable(p).getByRole("button", { name: "Barline" }),
  select: (p: Page) => stable(p).getByRole("button", { name: /select/ }),
  paste: (p: Page) => stable(p).getByRole("button", { name: /paste/ }),
  delete: (p: Page) => stable(p).getByRole("button", { name: /^Delete the (last|marked) column$/ }),
};

async function measure(page: Page) {
  const out: Record<string, { x: number; y: number; w: number; h: number }> = {};
  for (const [id, loc] of Object.entries(STABLE)) {
    const b = await loc(page).boundingBox();
    if (!b) throw new Error(`${id} has no box`);
    out[id] = { x: b.x, y: b.y, w: b.width, h: b.height };
  }
  return out;
}

test.describe("INV-003 stable controls never move", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
  });

  for (const direction of ["notes->barline", "barline->notes"] as const) {
    test(direction, async ({ page }) => {
      await startCapturing(page);
      await fret(page, "E", 7).click();
      await page.getByTitle("Barline").click();
      await fret(page, "A", 5).click();
      await expect(columns(page)).toHaveCount(3);

      const notes = columns(page).nth(0);
      const bar = columns(page).nth(1);
      const [from, to] = direction === "notes->barline" ? [notes, bar] : [bar, notes];

      await from.click();
      await expect(from).toHaveAttribute("aria-current", "true");
      const before = await measure(page);
      await to.click();
      await expect(to).toHaveAttribute("aria-current", "true");
      const after = await measure(page);
      expect(after).toEqual(before);
    });
  }

  test("every toolbar control is inside the 375px viewport", async ({ page }) => {
    await startCapturing(page);
    await fret(page, "E", 7).click();
    await expect(page.getByTestId("toolbar-contextual")).toBeVisible();
    const buttons = page.locator('[data-testid="toolbar-stable"] button, [data-testid="toolbar-contextual"] button');
    const n = await buttons.count();
    expect(n).toBeGreaterThanOrEqual(9);
    for (let i = 0; i < n; i++) {
      const b = await buttons.nth(i).boundingBox();
      expect(b, `button ${i}`).not.toBeNull();
      expect(b!.x).toBeGreaterThanOrEqual(0);
      expect(b!.x + b!.width).toBeLessThanOrEqual(375 + 0.5);
    }
    const overflow = await page.evaluate(() => ({
      stable: (() => {
        const e = document.querySelector('[data-testid="toolbar-stable"]')!;
        return e.scrollWidth - e.clientWidth;
      })(),
      contextual: (() => {
        const e = document.querySelector('[data-testid="toolbar-contextual"]')!;
        return e.scrollWidth - e.clientWidth;
      })(),
      page: document.scrollingElement!.scrollWidth - document.scrollingElement!.clientWidth,
    }));
    expect(overflow).toEqual({ stable: 0, contextual: 0, page: 0 });
  });
});
