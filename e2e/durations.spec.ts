import { expect, test } from "@playwright/test";
import { columns, details, fret, inspector, startCapturing } from "./capture-surface-helpers";

const rhythm = (page: import("@playwright/test").Page) => page.getByTestId("tab-rhythm");

test.describe("duration marks", () => {
  test("no tab-rhythm without durations; marks appear on song page and play view; never on capture", async ({ page }) => {
    const { songUrl, partUrl } = await startCapturing(page);
    await fret(page, "E", 7).click();
    await fret(page, "A", 5).click();
    await expect(rhythm(page)).toHaveCount(0);

    await page.goto(songUrl);
    await expect(columns(page).first()).toBeVisible();
    await expect(rhythm(page)).toHaveCount(0);

    // Set an eighth on the first column.
    await page.goto(partUrl);
    await columns(page).first().click();
    await details(page).click();
    await expect(inspector(page)).toBeVisible();
    const widthBefore = await columns(page).first().evaluate((el) => el.getBoundingClientRect().width);
    const eighth = page.getByTestId("duration-row").getByRole("button").nth(3);
    await eighth.click();
    await expect(eighth).toHaveAttribute("aria-pressed", "true"); // the write landed before the page is left
    await page.keyboard.press("Escape");
    await expect(rhythm(page)).toHaveCount(0); // capture staff unchanged
    const widthAfter = await columns(page).first().evaluate((el) => el.getBoundingClientRect().width);
    expect(widthAfter).toBe(widthBefore);

    await page.goto(songUrl);
    await expect(rhythm(page).first()).toHaveText("8");
    const marks = await rhythm(page).allTextContents();
    expect(marks).toEqual(["8", ""]);
  });
});
