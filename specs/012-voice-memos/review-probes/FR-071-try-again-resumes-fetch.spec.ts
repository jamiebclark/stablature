/**
 * FR-071 / INV-028 fetch half (review round 3, F23). FR-071: a full device "resume[s] when the user chooses Try again or
 * the next sync cycle runs". `retryMemo` deletes the `full` fetch entry, but nothing starts a pass: `MEMO_RETRY_EVENT`
 * (`src/lib/local/memos.ts:204`) is never dispatched and `src/lib/sync/runner.ts:25` only imports it. So after Try again
 * the memo reads `waiting` ("Waiting for the recording device to upload it") and no GET is sent until something else
 * wakes the runner: the 60 s poll, an SSE "changed" from ANY band's write, an outbox write, `online` or visibility.
 *
 * Same flow as `e2e/memo-full.spec.ts`'s fetch half, which fails 3 of 3 when run alone for this reason, and passes in
 * a full-suite run only when another test's server write wakes the guest. This probe records what Try again does:
 * the state shown 1 s after the tap, and how long until each memo is asked for (up to 75 s, past one poll).
 *
 * Holds when a GET follows the tap within 5 s. Run it ALONE (`--workers=1`): another test's traffic lets it pass by luck.
 */
import { expect, test } from "@playwright/test";
import { fillDevice, recordMemo, setDeviceFull, sharePartA, twoMembers } from "../../../e2e/memo-helpers";

test("Try again on an out-of-room memo fetches it at once", async ({ browser }) => {
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
    const distinctBefore = new Set(gets.map((g) => g.url)).size;

    await setDeviceFull(guest.page, false);
    const tappedAt = Date.now();
    await newest.getByTestId("memo-retry").click();
    await guest.page.waitForTimeout(1_000);
    const stateAfterTap = {
      kind: await newest.getAttribute("data-state"),
      // A `ready` memo draws no `memo-state`, so bound the read (round 4: unbounded, it waited out the test timeout).
      words: (await newest.getByTestId("memo-state").textContent({ timeout: 1_000 }).catch(() => null)) ?? null,
    };

    // Measure, past one 60 s poll, when the fetch actually resumed.
    await expect
      .poll(() => new Set(gets.map((g) => g.url)).size, { timeout: 75_000, intervals: [250] })
      .toBe(2)
      .catch(() => undefined);
    const firstGetAfterTapMs = gets.length > before ? gets[before].at - tappedAt : null;
    console.log(
      "FR-071 try-again-fetch:",
      JSON.stringify({ getsBefore: before, distinctBefore, stateAfterTap, firstGetAfterTapMs, getsAfter: gets.length - before }),
    );

    // FR-071: choosing Try again resumes the fetch.
    expect(firstGetAfterTapMs, "a GET within 5 s of Try again").not.toBeNull();
    expect(firstGetAfterTapMs!).toBeLessThanOrEqual(5_000);
  } finally {
    await trio.close();
  }
});
