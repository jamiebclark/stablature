import { expect, test } from "@playwright/test";
import { persistCalls, recordMemo, seedSongM, withFakeMicrophone } from "./memo-helpers";

/** INV-029 (e2e half): persist() is asked once, after the first Stop; the notice shows once. */
withFakeMicrophone();

test("INV-029 persist count 0, 1, 1; notice once", async ({ page }) => {
  await page.addInitScript(() => {
    // The browser answers "not persisted", so the notice is owed. Calls are counted, never changed.
    const w = window as unknown as { __persistCalls: number };
    w.__persistCalls = 0;
    navigator.storage.persisted = async () => false;
    navigator.storage.persist = async () => {
      w.__persistCalls++;
      return false;
    };
  });
  await seedSongM(page);
  await page.waitForLoadState("networkidle");
  expect(await persistCalls(page)).toBe(0);

  const notice = () => page.getByTestId("memo-notice").filter({ hasText: "may clear memos" });
  await recordMemo(page, "A", 2000);
  expect(await persistCalls(page)).toBe(1);
  await expect(notice()).toHaveCount(1);

  await recordMemo(page, "A", 2000);
  expect(await persistCalls(page)).toBe(1);

  await notice().getByRole("button", { name: "Dismiss notice" }).click();
  await expect(notice()).toHaveCount(0);
  await page.waitForTimeout(500); // the Dexie write behind Dismiss commits before the reload
  await page.reload();
  await expect(page.getByTestId("memo")).toHaveCount(2);
  await expect(notice()).toHaveCount(0);

  await recordMemo(page, "B", 2000);
  await expect(notice()).toHaveCount(0);
});
