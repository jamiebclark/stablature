/**
 * SC-001 (review round 2): "A memo is playable within 1 s of Stop." Round 1's F4 fix (T113) cut `TIMESLICE_MS` from
 * 1 000 to 250, so the recorder now reads four chunks a second and the Stop path waits for every one of them
 * (`recorder.ts:390`). In round 2, `recordMemo`'s 1 s check (`e2e/memo-helpers.ts:293`) failed 2 of 4 times in
 * `memo-recorder.spec.ts`'s meta-line test, and `memo-endings.spec.ts` E1 failed once at 2 s.
 *
 * This probe measures Stop → `memo-play` enabled through the real menu, signed out (seeded song) and signed in
 * (two members, the push held as in the meta-line test). It prints every sample and holds when each is ≤ 1 000 ms.
 */
import { expect, test, type Page } from "@playwright/test";
import { seedSongM, sharePartA, startRecording, twoMembers } from "../../../e2e/memo-helpers";

const memoIds = (page: Page) =>
  page.getByTestId("memo").evaluateAll((els) => els.map((e) => e.getAttribute("data-memo-id") ?? ""));

/** The list draws only the newest 3, so a new memo is found by its id, not by counting. */
async function stopToPlayable(page: Page, recordMs: number): Promise<number> {
  const before = new Set(await memoIds(page));
  await startRecording(page, "A");
  await page.waitForTimeout(recordMs);
  const stoppedAt = Date.now();
  await page.getByTestId("record-stop").click();
  await expect
    .poll(
      async () => {
        const fresh = (await memoIds(page)).find((id) => !before.has(id));
        if (!fresh) return false;
        return page.locator(`[data-memo-id="${fresh}"]`).getByTestId("memo-play").isEnabled();
      },
      { intervals: [25], timeout: 15_000 },
    )
    .toBe(true);
  return Date.now() - stoppedAt;
}

test("signed out: Stop to playable, by recording length", async ({ page }) => {
  test.setTimeout(180_000);
  await seedSongM(page);
  const samples: { recordMs: number; ms: number }[] = [];
  for (const recordMs of [2_000, 4_000, 8_000, 2_000, 4_000, 8_000]) {
    samples.push({ recordMs, ms: await stopToPlayable(page, recordMs) });
  }
  console.log("SC-001 signed out:", JSON.stringify(samples));
  expect(samples.filter((s) => s.ms > 1_000), "Stop to playable over 1 s").toEqual([]);
});

test("signed in, push held: Stop to playable", async ({ browser }) => {
  test.setTimeout(240_000);
  const trio = await twoMembers(browser);
  try {
    await sharePartA(trio);
    const page = trio.owner.page;
    await page.route("**/api/sync/push", () => new Promise<void>(() => {}));
    const samples: number[] = [];
    for (let i = 0; i < 4; i++) samples.push(await stopToPlayable(page, 2_000));
    console.log("SC-001 signed in, push held:", JSON.stringify(samples));
    expect(samples.filter((ms) => ms > 1_000), "Stop to playable over 1 s").toEqual([]);
  } finally {
    await trio.close();
  }
});
