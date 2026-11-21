import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { fillDevice, idb, recordMemo, seedSongM, setDeviceFull, sharePartA, startRecording, twoMembers, withFakeMicrophone } from "./memo-helpers";

/** INV-028 (save half): a full device holds the clip, lets it be downloaded, and saves it on retry. */
withFakeMicrophone();

test("INV-028 quota full: held, download yields bytes, retry saves the same length", async ({ page }) => {
  await fillDevice(page);
  await seedSongM(page);
  await startRecording(page, "A");
  await setDeviceFull(page, true);
  await page.waitForTimeout(4000);
  await page.getByTestId("record-stop").click();

  await expect(page.getByTestId("memo-notice").filter({ hasNotText: "may clear memos" })).toContainText(
    "This device is out of room, so the recording isn't saved yet. Try again, or download the clip.",
  );
  await expect(page.getByTestId("record-retry")).toBeVisible();
  await expect(page.getByTestId("record-download-held")).toBeVisible();

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByTestId("record-download-held").click(),
  ]);
  const path = await download.path();
  expect(readFileSync(path).byteLength).toBeGreaterThan(0);

  await setDeviceFull(page, false);
  await page.getByTestId("record-retry").click();
  await expect(page.getByTestId("memo-play")).toHaveCount(1, { timeout: 5_000 });
  const durationMs = await idb<number>(page, `return (await all("memos"))[0].durationMs;`);
  expect(Math.abs(durationMs - 4000)).toBeLessThan(1500);
});

test("INV-028 fetch half: the newest memo is full, and the older one is not asked for until Try again", async ({ browser }) => {
  test.setTimeout(240_000);
  const trio = await twoMembers(browser);
  try {
    const { owner, guest } = trio;
    await fillDevice(guest.page);
    await sharePartA(trio); // guest reloads with the quota wrapper installed
    await setDeviceFull(guest.page, true);
    const gets: string[] = [];
    await guest.page.route("**/api/memos/*/audio", (route) => {
      if (route.request().method() === "GET") gets.push(route.request().url());
      return route.continue();
    });
    await recordMemo(owner.page, "A", 2_000);
    await owner.page.waitForTimeout(1_500);
    await recordMemo(owner.page, "A", 2_000);

    const newest = guest.page.getByTestId("memo").first();
    await expect(newest.getByTestId("memo-state")).toContainText("Out of room on this device.", { timeout: 20_000 });
    await guest.page.waitForTimeout(3_000);
    // Only the newest memo is ever asked for while it is held (the older one waits).
    expect(new Set(gets).size).toBe(1);

    await setDeviceFull(guest.page, false);
    await newest.getByTestId("memo-retry").click();
    await expect.poll(() => new Set(gets).size, { timeout: 20_000 }).toBe(2);
  } finally {
    await trio.close();
  }
});

// FR-071 (review F23): Try again resumes the fetch at once, not on the 60 s poll. Run alone: another test's server
// write wakes every client through the SSE stream and lets this pass by luck.
test("FR-071 Try again on an out-of-room memo fetches it within 5 s", async ({ browser }) => {
  test.setTimeout(240_000);
  const trio = await twoMembers(browser);
  try {
    const { owner, guest } = trio;
    await fillDevice(guest.page);
    await sharePartA(trio);
    await setDeviceFull(guest.page, true);
    const gets: { url: string; at: number }[] = [];
    await guest.page.route("**/api/memos/*/audio", (route) => {
      if (route.request().method() === "GET") gets.push({ url: route.request().url(), at: Date.now() });
      return route.continue();
    });
    await recordMemo(owner.page, "A", 2_000);
    await owner.page.waitForTimeout(1_500);
    await recordMemo(owner.page, "A", 2_000);

    const newest = guest.page.getByTestId("memo").first();
    await expect(newest.getByTestId("memo-state")).toContainText("Out of room on this device.", { timeout: 20_000 });
    await guest.page.waitForTimeout(3_000);
    const before = gets.length;

    await setDeviceFull(guest.page, false);
    const tappedAt = Date.now();
    await newest.getByTestId("memo-retry").click();
    await expect.poll(() => gets.length, { timeout: 5_000, intervals: [250] }).toBeGreaterThan(before);
    expect(gets[before].at - tappedAt).toBeLessThanOrEqual(5_000);
  } finally {
    await trio.close();
  }
});
