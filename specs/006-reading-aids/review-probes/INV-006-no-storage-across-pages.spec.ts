/**
 * INV-006 round 2, on the page. Edge case: "The control works for the visit and is forgotten afterwards." FR-003: one
 * choice shared by the song page and the play view. Each **St** member, carried over the in-app link both ways.
 */
import { expect, test } from "@playwright/test";
import { bar, choose, n, seedSong, type EntrySpec, type PartSpec } from "./helpers";

const PARTS: PartSpec[] = [{ key: "a", label: "A", columns: [n(5), n(7), bar(), n(8)] }];
const ENTRIES: EntrySpec[] = [{ part: "a" }];

const STORAGE: Record<string, () => void> = {
  "localStorage undefined": () => {
    Object.defineProperty(window, "localStorage", { value: undefined, configurable: true });
  },
  "localStorage getter throws": () => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new DOMException("blocked", "SecurityError");
      },
    });
  },
  "getItem throws": () => {
    const real = Storage.prototype.getItem;
    Storage.prototype.getItem = function getItem(key: string) {
      if (key === "stablature.staffView") throw new DOMException("blocked", "SecurityError");
      return real.call(this, key);
    };
  },
  "setItem throws": () => {
    const real = Storage.prototype.setItem;
    Storage.prototype.setItem = function setItem(key: string, value: string) {
      if (key === "stablature.staffView") throw new DOMException("full", "QuotaExceededError");
      real.call(this, key, value);
    };
  },
};

for (const [name, install] of Object.entries(STORAGE)) {
  test(`INV-006 ${name}: the choice crosses the link to the play view and back`, async ({ page }) => {
    const { songUrl } = await seedSong(page, PARTS, ENTRIES);
    await page.addInitScript(install);
    await page.goto(songUrl);
    await choose(page, "notes");
    await page.getByRole("link", { name: "Play view" }).click();
    await expect(page).toHaveURL(/\/play$/);
    await expect(page.getByTestId("staff-view-notes")).toHaveAttribute("aria-pressed", "true");
    await choose(page, "intervals");
    await page.goBack();
    await expect(page).toHaveURL(songUrl);
    await expect(page.getByTestId("staff-view-intervals")).toHaveAttribute("aria-pressed", "true");
  });
}
