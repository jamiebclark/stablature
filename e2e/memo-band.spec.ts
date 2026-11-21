import { expect, test } from "@playwright/test";
import { recordMemo, sharePartA, stopToPlayable, twoMembers, withFakeMicrophone } from "./memo-helpers";

/** INV-018 / SC-003: a memo reaches another online member within 10 s of Stop. */
withFakeMicrophone();

test("A records 30 s; B has it ready and playable within 10 s of Stop", async ({ browser }) => {
  test.setTimeout(180_000);
  const trio = await twoMembers(browser);
  try {
    await sharePartA(trio);
    await recordMemo(trio.owner.page, "A", 30_000);
    const stoppedAt = Date.now();
    const memo = trio.guest.page.getByTestId("memo").first();
    await expect(memo).toHaveAttribute("data-state", "ready", { timeout: 10_000 });
    expect(Date.now() - stoppedAt).toBeLessThan(11_000);
    await expect(memo.getByTestId("memo-elapsed")).toBeVisible();
    await memo.getByTestId("memo-play").click();
    await expect(memo.getByTestId("memo-elapsed")).not.toHaveText(/^0:00/, { timeout: 5_000 });
  } finally {
    await trio.close();
  }
});

/** SC-001 signed in: Stop to playable within 1 s even with the push held. */
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
