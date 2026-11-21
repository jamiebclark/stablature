import { expect, test } from "@playwright/test";
import { recordMemo, sharePartA, twoMembers, withFakeMicrophone } from "./memo-helpers";

/** SC-004: a memo recorded offline reaches another online member within 10 s of coming back. */
withFakeMicrophone();

test("A records offline for 5 s; B is ready within 10 s of A reconnecting", async ({ browser }) => {
  test.setTimeout(180_000);
  const trio = await twoMembers(browser);
  try {
    await sharePartA(trio);
    await trio.owner.context.setOffline(true);
    await recordMemo(trio.owner.page, "A", 5_000);
    await expect(trio.owner.page.getByTestId("memo-state").first()).toContainText("Will upload when online");
    await trio.owner.context.setOffline(false);
    const backAt = Date.now();
    await expect(trio.guest.page.getByTestId("memo").first()).toHaveAttribute("data-state", "ready", { timeout: 10_000 });
    expect(Date.now() - backAt).toBeLessThan(11_000);
  } finally {
    await trio.close();
  }
});
