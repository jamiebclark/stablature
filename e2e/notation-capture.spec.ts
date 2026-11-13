/** INV-011 / INV-013: capture draws the same rhythm row; clearing the last duration restores the old markup. */
import { expect, test, type Page } from "@playwright/test";
import { columns, details, fret, inspector, startCapturing } from "./capture-surface-helpers";
import { writeColumns, type Col } from "./rhythm-probe-helpers";

const WORDS: [string, string][] = [
  ["w", "whole note"],
  ["h", "half note"],
  ["q", "quarter note"],
  ["8", "eighth note"],
  ["16", "sixteenth note"],
  ["32", "thirty-second note"],
];

async function setDuration(page: Page, words: string) {
  await details(page).click();
  await expect(inspector(page)).toBeVisible();
  await page.getByTestId("duration-row").getByRole("button", { name: words, exact: true }).click();
  await page.keyboard.press("Escape");
}

test.beforeEach(({}, info) => {
  test.skip(info.project.name !== "mobile", "capture is a phone screen");
});

test("INV-011 the first duration shows the row and brackets move under; clearing restores the markup", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await startCapturing(page);
  await fret(page, "E", 7).click();
  await expect(columns(page)).toHaveCount(1);
  const staff = page.getByTestId("tab-staff");
  const before = await staff.evaluate((el) => el.outerHTML);
  await expect(page.getByTestId("tab-rhythm")).toHaveCount(0);

  await setDuration(page, "quarter note");
  await expect(page.getByTestId("tab-rhythm")).toHaveCount(1);
  await expect(staff).toHaveAttribute("data-rhythm", "");
  await expect(page.getByTestId("tab-band")).toHaveAttribute("data-rhythm", "");
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(true);
  await expect(page.getByTestId("cursor-duration")).toHaveText("quarter note");

  // Tapping the pressed value again clears it.
  await setDuration(page, "quarter note");
  await expect(page.getByTestId("tab-rhythm")).toHaveCount(0);
  expect(await staff.evaluate((el) => el.outerHTML)).toBe(before);
});

test("INV-013 each value shows its words; a selection keeps the row's colour", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  const { partUrl } = await startCapturing(page);
  await fret(page, "E", 7).click();
  const list: Col[] = WORDS.map(([d]) => ({ d }));
  await writeColumns(page, partUrl.split("/capture/")[1], list);
  await page.goto(partUrl);
  await expect(columns(page)).toHaveCount(list.length);
  for (const [i, [, words]] of WORDS.entries()) {
    await columns(page).nth(i).click();
    await expect(page.getByTestId("cursor-duration")).toHaveText(words);
  }
  await columns(page).nth(0).click();
  await page.getByRole("button", { name: /select/ }).click();
  await columns(page).nth(2).click();
  const [own, fill, want] = await columns(page)
    .nth(1)
    .locator("[data-testid=tab-rhythm] [data-part]")
    .first()
    .evaluate((el) => {
      const probe = document.createElement("span");
      probe.style.color = "var(--text)";
      document.body.append(probe);
      const text = getComputedStyle(probe).color;
      probe.remove();
      return [getComputedStyle(el).color, getComputedStyle(el).backgroundColor, text];
    });
  expect([own, fill]).toContain(want);
});
