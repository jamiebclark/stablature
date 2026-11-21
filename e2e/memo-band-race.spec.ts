/**
 * INV-018 when the upload's "changed" arrives while the bandmate's sync pass is still running (review round 1, F2).
 *
 * B asks for the memo's audio before A's upload lands and gets `404 not_uploaded`, so B's fetch entry waits
 * `WAITING_RECHECK_MS`. A's upload then lands and its `notifyChanged` reaches B while B's pass is still in flight.
 * `run(true)` only records `queued = true`; the follow-up is `run()` with `changed = false`, so `clearWaiting()` never
 * runs, the fetch is skipped (nextAt > now), and nothing wakes B again until the 60 s poll.
 *
 * The probe orders the race and nothing else: A's PUT is held until B's first GET has its real answer from the
 * server, and that answer is handed to B's page 3 s later (a slow phone link). Both requests reach the real server.
 *
 * Holds when: B's memo is `ready` within 10 s of A's upload being let through. A poll that happens to fire inside
 * the window can let it pass by luck (about 1 run in 6); run with --repeat-each=3 for a decisive answer.
 */
import { expect, test } from "@playwright/test";
import { recordMemo, sharePartA, twoMembers, withFakeMicrophone } from "./memo-helpers";

withFakeMicrophone();

test("B fetches A's memo within 10 s even when A's upload lands during B's pass", async ({ browser }) => {
  test.setTimeout(180_000);
  const trio = await twoMembers(browser);
  try {
    await sharePartA(trio);
    const { owner: A, guest: B } = trio;

    let releasePut!: () => void;
    const putGate = new Promise<void>((resolve) => (releasePut = resolve));
    let releasedAt = 0;
    let putStatus = 0;
    await A.page.route("**/api/memos/*/audio", async (route) => {
      if (route.request().method() !== "PUT") return route.continue();
      await putGate;
      const res = await route.fetch();
      putStatus = res.status();
      await route.fulfill({ response: res });
    });

    let firstGet: number | null = null;
    const gets: number[] = [];
    await B.page.route("**/api/memos/*/audio", async (route) => {
      if (route.request().method() !== "GET") return route.continue();
      const res = await route.fetch();
      gets.push(res.status());
      if (firstGet !== null) return route.fulfill({ response: res });
      firstGet = res.status();
      releasedAt = Date.now();
      releasePut();
      await new Promise((r) => setTimeout(r, 3_000));
      await route.fulfill({ response: res });
    });

    await recordMemo(A.page, "A", 3_000);
    await expect.poll(() => firstGet, { timeout: 15_000 }).toBe(404);
    await expect.poll(() => putStatus, { timeout: 10_000 }).toBe(201);

    const memo = B.page.getByTestId("memo").first();
    let readyAfter: number | null = null;
    try {
      await expect(memo).toHaveAttribute("data-state", "ready", { timeout: 10_000 });
      readyAfter = Date.now() - releasedAt;
    } finally {
      console.log("INV-018 changed-during-run:", JSON.stringify({ gets, readyAfterMs: readyAfter, state: await memo.getAttribute("data-state", { timeout: 2_000 }).catch(() => "absent") }));
    }
    expect(readyAfter).not.toBeNull();
  } finally {
    await trio.close();
  }
});
