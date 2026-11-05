/**
 * INV-034's named member: `--diff-tint` and `--diff-ink` resolve to the print values in dark.
 *
 * The other INV-034 probe measures contrast against white, which is what the tokens are for but not the tokens.
 * A marked cell's mask is painted with the tint, so a dark tint in print would be a dark block on paper where
 * backgrounds print. The screen value is the control: it proves the property is being read at all.
 */
import { expect, test } from "@playwright/test";
import { bar, n, seedSong } from "./helpers";

const tokens = (page: import("@playwright/test").Page) =>
  page.evaluate(() => {
    const root = getComputedStyle(document.documentElement);
    return {
      tint: root.getPropertyValue("--diff-tint").trim(),
      ink: root.getPropertyValue("--diff-ink").trim(),
    };
  });

test("the tokens are the print values in dark, and the screen values off paper", async ({ page }) => {
  const { playUrl } = await seedSong(
    page,
    [
      { key: "a", label: "A", columns: [n(5), n(7), bar(), n(8)] },
      { key: "v", label: "A'", variantOf: "a", columns: [n(5), n(9), bar(), n(8)] },
    ],
    [{ part: "v" }],
  );
  await page.goto(playUrl);
  await expect(page.getByTestId("variant-line")).toBeVisible();

  await page.emulateMedia({ media: "screen", colorScheme: "dark" });
  expect(await tokens(page)).toEqual({ tint: "#1b2f45", ink: "#8ecbff" });

  await page.emulateMedia({ media: "print", colorScheme: "dark" });
  expect(await tokens(page)).toEqual({ tint: "#fff", ink: "#000" });
  // What the tokens are for: the marked cell's mask and its mark, on paper, in dark.
  const painted = await page.evaluate(() => {
    const column = document.querySelector('[data-diff="changed"]')!;
    const mark = column.querySelector('[data-testid="tab-diff"]') ?? column;
    return { mark: getComputedStyle(mark).color };
  });
  expect(painted.mark).toBe("rgb(0, 0, 0)");
});
