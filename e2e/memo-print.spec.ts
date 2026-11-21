import { expect, test } from "@playwright/test";
import { landed } from "./reading-helpers";
import { seedMemo, seedSongM } from "./memo-helpers";

/** A printed page is the tab: the memo list, however many memos a part has, does not print. */
test("print: part-memos is not visible", async ({ page }) => {
  await seedSongM(page);
  await landed(page);
  await seedMemo(page, { partLabel: "B", state: "ready" });
  await page.reload();
  await expect(page.getByTestId("part-memos").first()).toBeVisible();
  await page.emulateMedia({ media: "print" });
  for (const el of await page.getByTestId("part-memos").all()) await expect(el).toBeHidden();
});
