/**
 * INV-002: never does the bottom toolbar render a control that cannot act on
 * the cursor's target.
 *
 * Enumerated: 6 targets x 9 controls = 54 pairs. Targets: notes column, rest
 * column, barline, start-of-part (columns exist, cursor before the first), empty
 * part, no part at all. Controls: repeat stepper, x4, triplet, chord symbol
 * (contextual: present iff playable) and space, barline, select, paste, delete
 * (stable: always present). Presence is count(), never toBeDisabled().
 */
import { expect, test, type Page } from "@playwright/test";
import { columns, fret, space, startCapturing } from "./helpers";

const stable = (page: Page) => page.getByTestId("toolbar-stable");
const CONTROLS = {
  // contextual
  "repeat stepper": (p: Page) =>
    p.getByRole("button", { name: /^Repeat one (more|fewer) time$/ }),
  "×4": (p: Page) => p.getByRole("button", { name: /^×4$/ }),
  triplet: (p: Page) => p.getByRole("button", { name: "Triplet" }),
  "chord symbol": (p: Page) => p.getByRole("button", { name: "chord symbol" }),
  // stable
  space: (p: Page) => stable(p).getByRole("button", { name: /space/ }),
  barline: (p: Page) => stable(p).getByRole("button", { name: "Barline" }),
  select: (p: Page) => stable(p).getByRole("button", { name: /select/ }),
  paste: (p: Page) => stable(p).getByRole("button", { name: /paste/ }),
  delete: (p: Page) => stable(p).getByRole("button", { name: /^Delete the (last|marked) column$/ }),
} as const;
const CONTEXTUAL = ["repeat stepper", "×4", "triplet", "chord symbol"] as const;
const STABLE = ["space", "barline", "select", "paste", "delete"] as const;

async function expectPresence(page: Page, playable: boolean) {
  for (const id of CONTEXTUAL) {
    // the stepper is two buttons
    const want = playable ? (id === "repeat stepper" ? 2 : 1) : 0;
    await expect(CONTROLS[id](page), `${id} count`).toHaveCount(want);
  }
  if (!playable) await expect(page.getByLabel("Repeat count")).toHaveCount(0);
  for (const id of STABLE) await expect(CONTROLS[id](page), `${id} count`).toHaveCount(1);
}

test.describe("INV-002 the toolbar shows only what can act on the target", () => {
  test("target: notes column", async ({ page }) => {
    await startCapturing(page);
    await fret(page, "E", 7).click();
    await expectPresence(page, true);
  });

  test("target: rest column", async ({ page }) => {
    await startCapturing(page);
    await space(page);
    await expect(columns(page)).toHaveCount(1);
    await expectPresence(page, true);
  });

  test("target: barline", async ({ page }) => {
    await startCapturing(page);
    await fret(page, "E", 7).click();
    await page.getByTitle("Barline").click();
    await expectPresence(page, false);
  });

  test("target: start of part (columns exist)", async ({ page }) => {
    await startCapturing(page);
    await fret(page, "E", 7).click();
    await page.getByRole("button", { name: /start/ }).click();
    await expect(page.getByText("adding at the start")).toBeVisible();
    await expectPresence(page, false);
  });

  test("target: empty part", async ({ page }) => {
    await startCapturing(page);
    await expect(columns(page)).toHaveCount(0);
    await expectPresence(page, false);
  });

  test("target: no part at all", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Band name").fill("Hollow Crown");
    await page.getByRole("button", { name: "Add band" }).click();
    await expect(page).toHaveURL(/\/bands\/[0-9a-f-]+$/);
    await page.getByLabel("Song title").fill("Dirge");
    await page.getByRole("button", { name: "Add song" }).click();
    await expect(page).toHaveURL(/\/songs\/[0-9a-f-]+$/);
    await page.getByRole("link", { name: "Capture" }).click();
    await expect(page).toHaveURL(/\/capture$/);
    await expect(page.getByText("Add a part to start capturing.")).toBeVisible();
    await expectPresence(page, false);
  });
});
