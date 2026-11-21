/**
 * Review probe (spec 012, round 5). INV-029: "persistent storage is requested ... never more than once per device";
 * the e2e half asks for "still 1 after a second recording".
 *
 * `e2e/memo-persist.spec.ts:27-28` reads the count straight after the second `recordMemo`. But `recordMemo`
 * (`e2e/memo-helpers.ts:317-322`) waits for `memo-play`.first() to be enabled, and with a memo already on the page that
 * is the OLD memo, enabled before Stop. So the helper returns at Stop, before the second save, and the count it reads
 * is the one from before that save. `stopToPlayable` (`:334-351`) finds the new memo by id and has no such gap.
 *
 * Test 1 checks the invariant after the second save has landed. Test 2 checks the helper: when `recordMemo` returns,
 * the new memo is saved. Run alone:
 *   npx playwright test -c specs/012-voice-memos/review-probes/playwright.review.config.ts --workers=1 INV-029-second
 */
import { expect, test, type Page } from "@playwright/test";
import { idb, persistCalls, recordMemo, seedSongM } from "../../../e2e/memo-helpers";

const liveMemos = (page: Page) => idb<number>(page, `return (await all("memos")).filter((m) => m.deletedAt === null).length;`);

test.beforeEach(async ({ page }) => {
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
  await recordMemo(page, "A", 2000);
  await expect.poll(() => liveMemos(page)).toBe(1);
  await expect.poll(() => persistCalls(page)).toBe(1);
});

test("INV-029: still one persist() call once the second save has landed", async ({ page }) => {
  await recordMemo(page, "A", 2000);
  await expect.poll(() => liveMemos(page), { timeout: 5_000 }).toBe(2);
  await page.waitForTimeout(500);
  const calls = await persistCalls(page);
  console.log("INV-029 second save:", JSON.stringify({ callsAfterSecondSave: calls }));
  expect(calls).toBe(1);
});

test("recordMemo returns only once the NEW memo is saved, so a count read after it covers that save", async ({ page }) => {
  await recordMemo(page, "A", 2000);
  const atReturn = await liveMemos(page);
  const callsAtReturn = await persistCalls(page);
  await expect.poll(() => liveMemos(page), { timeout: 5_000 }).toBe(2);
  console.log("INV-029 helper gap:", JSON.stringify({ liveMemosWhenRecordMemoReturned: atReturn, callsAtReturn }));
  expect(atReturn, "recordMemo returned before the second memo was saved").toBe(2);
});
