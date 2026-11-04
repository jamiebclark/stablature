/**
 * INV-003 (round 2): never does a stable toolbar control change screen coordinates as
 * the cursor moves between a playable column and a barline.
 *
 * Round 1 measured this with the latch unarmed. The armed chip carries no border and the
 * unarmed chip does, and the strip has no fixed height, so this measures the stable row
 * with the latch ARMED as the cursor leaves the column (leaving disarms it), and with the
 * latch armed in place.
 */
import { expect, test, type Page } from "@playwright/test";
import { columns, fret, stackLatch, startCapturing } from "./helpers";

const stable = (page: Page) => page.getByTestId("toolbar-stable");
const STABLE = {
  space: (p: Page) => stable(p).getByRole("button", { name: /space/ }),
  barline: (p: Page) => stable(p).getByRole("button", { name: "Barline" }),
  select: (p: Page) => stable(p).getByRole("button", { name: /select/ }),
  paste: (p: Page) => stable(p).getByRole("button", { name: /paste/ }),
  delete: (p: Page) => stable(p).getByRole("button", { name: /^Delete the (last|marked) column$/ }),
};

async function coords(page: Page) {
  const out: Record<string, { x: number; y: number }> = {};
  for (const [id, loc] of Object.entries(STABLE)) {
    const b = await loc(page).boundingBox();
    if (!b) throw new Error(`${id} has no box`);
    out[id] = { x: b.x, y: b.y };
  }
  return out;
}

async function build(page: Page) {
  await page.setViewportSize({ width: 375, height: 667 });
  await startCapturing(page);
  await fret(page, "E", 7).click();
  await page.getByTitle("Barline").click();
  await fret(page, "A", 5).click();
  await expect(columns(page)).toHaveCount(3);
  await columns(page).nth(0).click();
}

test.describe("INV-003 r2 the stable row holds across the latch's states", () => {
  test("notes (latch armed) -> barline", async ({ page }) => {
    await build(page);
    await stackLatch(page).click();
    await expect(stackLatch(page)).toHaveAttribute("aria-pressed", "true");
    const armed = await coords(page);
    await columns(page).nth(1).click();
    await expect(stackLatch(page)).toBeDisabled();
    expect(await coords(page)).toEqual(armed);
  });

  test("barline -> notes, then arm in place", async ({ page }) => {
    await build(page);
    await columns(page).nth(1).click();
    await expect(stackLatch(page)).toBeDisabled();
    const onBarline = await coords(page);
    await columns(page).nth(0).click();
    await stackLatch(page).click();
    await expect(stackLatch(page)).toHaveAttribute("aria-pressed", "true");
    expect(await coords(page)).toEqual(onBarline);
  });

  test("the strip's height does not depend on the chip's state", async ({ page }) => {
    await build(page);
    const strip = page.getByTestId("latch-strip");
    const unarmed = (await strip.boundingBox())!.height;
    await stackLatch(page).click();
    await expect(stackLatch(page)).toHaveAttribute("aria-pressed", "true");
    expect((await strip.boundingBox())!.height).toBe(unarmed);
  });
});
