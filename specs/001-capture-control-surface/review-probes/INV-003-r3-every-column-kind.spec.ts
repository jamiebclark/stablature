/**
 * INV-003 / SC-005 / plan Deviation 1 (round 3): rounds 1 and 2 started from a plain notes
 * column. The stable row must hold from every kind of playable column, armed or not, and
 * `triplet` (absent on a barline) must come back to the same coordinates, which is what
 * Deviation 1 promises in exchange for moving it to row 2.
 * Enumerated: 4 column kinds x {unarmed, armed} = 8, each column -> barline -> column,
 * x, y, width and height of 5 stable controls plus triplet's return.
 */
import { expect, test, type Page } from "@playwright/test";
import { columns, fret, space, stackLatch, startCapturing } from "./helpers";

const STABLE = ["space", "Barline", "select", "paste", /^Delete the (last|marked) column$/];

const boxes = async (page: Page) => {
  const row = page.getByTestId("toolbar-stable");
  const out = [];
  for (const name of STABLE) out.push(await row.getByRole("button", { name }).boundingBox());
  return out;
};

const KINDS: Record<string, (page: Page) => Promise<number>> = {
  notes: async (page) => {
    await fret(page, "E", 7).click();
    await expect(columns(page)).toHaveCount(1);
    return 0;
  },
  rest: async (page) => {
    await space(page);
    await expect(columns(page)).toHaveCount(1);
    return 0;
  },
  "chord-bearing": async (page) => {
    await fret(page, "E", 7).click();
    await page.getByRole("button", { name: "chord symbol" }).click();
    await page.getByLabel("Chord", { exact: true }).fill("Am");
    await page.getByRole("button", { name: "Set", exact: true }).click();
    await expect(page.getByLabel("Chord", { exact: true })).toHaveCount(0);
    return 0;
  },
  "tuplet member": async (page) => {
    await fret(page, "A", 5).click();
    await fret(page, "A", 7).click();
    await fret(page, "A", 9).click();
    await expect(columns(page)).toHaveCount(3);
    await page.getByTitle(/triplet/).click();
    await expect(page.getByTestId("tab-staff")).toContainText("3");
    return 2;
  },
};

for (const [kind, make] of Object.entries(KINDS)) {
  for (const armed of [false, true]) {
    test(`${kind}, ${armed ? "armed" : "unarmed"} -> barline -> back`, async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await startCapturing(page);
      const index = await make(page);
      const barlineAt = await columns(page).count();
      await page.getByRole("button", { name: "Barline" }).click();
      await expect(columns(page)).toHaveCount(barlineAt + 1);
      await columns(page).nth(index).click();
      if (armed) {
        await stackLatch(page).click();
        await expect(stackLatch(page)).toHaveAttribute("aria-pressed", "true");
      }

      const onColumn = await boxes(page);
      const triplet = await page.getByRole("button", { name: "Triplet" }).boundingBox();
      await columns(page).nth(barlineAt).click();
      await expect(stackLatch(page)).toBeDisabled();
      await expect(page.getByTestId("toolbar-contextual")).toHaveCount(0);
      expect(await boxes(page), "column -> barline").toEqual(onColumn);

      await columns(page).nth(index).click();
      await expect(stackLatch(page)).toBeEnabled();
      expect(await boxes(page), "barline -> column").toEqual(onColumn);
      expect(await page.getByRole("button", { name: "Triplet" }).boundingBox()).toEqual(triplet);
    });
  }
}
