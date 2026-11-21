/**
 * INV-029 with the waits the suite's spec lacks (review round 1, F6). `e2e/memo-persist.spec.ts` reloads straight after
 * clicking Dismiss (the Dexie write may not have committed) and then asserts "0 notices" before the memo area has
 * drawn, so its line 32 can pass on an empty page and line 35 then sees the undismissed notice come back.
 *
 * This probe waits for the Dismiss to take effect, reloads, waits for the memo list to draw, then checks: no notice
 * on part A, and none on part B after recording there. Holds when the product keeps "once per device".
 */
import { expect, test } from "@playwright/test";
import { persistCalls, recordMemo, seedSongM } from "../../../e2e/memo-helpers";

test("the may-clear-memos notice shows once, and not again after Dismiss, a reload, or a second part", async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __persistCalls: number };
    w.__persistCalls = 0;
    navigator.storage.persisted = async () => false;
    navigator.storage.persist = async () => {
      w.__persistCalls++;
      return false;
    };
  });
  await seedSongM(page);
  const notice = () => page.getByTestId("memo-notice").filter({ hasText: "may clear memos" });

  await recordMemo(page, "A", 2000);
  await expect(notice()).toHaveCount(1);
  await recordMemo(page, "A", 2000);
  expect(await persistCalls(page)).toBe(1);

  await notice().getByRole("button", { name: "Dismiss notice" }).click();
  await expect(notice()).toHaveCount(0);
  await page.reload();
  await expect(page.getByTestId("memo")).toHaveCount(2);
  await page.waitForTimeout(500);
  await expect(notice()).toHaveCount(0);

  // The counter lives on the page, so it starts again at 0 after the reload: no further persist() is asked for.
  await recordMemo(page, "B", 2000);
  await page.waitForTimeout(500);
  await expect(notice()).toHaveCount(0);
  expect(await persistCalls(page)).toBe(0);
});
