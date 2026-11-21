import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import postgres from "postgres";
import { dump, recordMemo, sharePartA, twoMembers, withFakeMicrophone } from "./memo-helpers";

/** INV-004: deleting a memo erases its audio on the server and on every device. */
withFakeMicrophone();
const DB_URL = process.env.STABLATURE_DATABASE_URL;
const sql = postgres(DB_URL ?? "postgres://unset", { max: 2, onnotice: () => {} });
test.skip(!DB_URL, "STABLATURE_DATABASE_URL is not set");
test.afterAll(async () => {
  await sql.end();
});

const memoTables = ["memoAudio", "memoUploads", "memoFetches", "memoDrafts"] as const;
const holds = (dumped: string, id: string) => {
  const all = JSON.parse(dumped) as Record<string, unknown[]>;
  return memoTables.filter((t) => JSON.stringify(all[t] ?? []).includes(id));
};

test("delete erases the audio on the server and both devices", async ({ browser }) => {
  test.setTimeout(180_000);
  const trio = await twoMembers(browser, `Memo band ${randomUUID().slice(0, 8)}`);
  try {
    await sharePartA(trio);
    const { owner, guest } = trio;
    await recordMemo(owner.page, "A", 3000);
    const memoId = (await owner.page.getByTestId("memo").first().getAttribute("data-memo-id"))!;
    await expect.poll(async () => (await sql`select count(*)::int n from memo_audio where memo_id = ${memoId} and bytes is not null`)[0].n, { timeout: 30_000 }).toBe(1);

    await guest.page.reload();
    await expect(guest.page.getByTestId("memo")).toHaveCount(1, { timeout: 30_000 });
    await guest.page.getByTestId("memo-play").click().catch(() => {});

    await owner.page.getByRole("button", { name: /^Actions for memo/ }).click();
    await owner.page.getByRole("menuitem", { name: /^Delete memo/ }).click();
    await owner.page.getByRole("button", { name: "Delete memo", exact: true }).click();
    await expect(owner.page.getByTestId("memo")).toHaveCount(0);

    await expect
      .poll(async () => (await sql`select count(*)::int n from memo_audio where memo_id = ${memoId} and bytes is null and erased_at is not null`)[0].n, { timeout: 30_000 })
      .toBe(1);
    const res = await owner.page.request.get(`/api/memos/${memoId}/audio`);
    expect(res.status()).toBe(410);
    expect((await res.json()).code ?? (await res.json()).error).toBe("erased");

    await expect(guest.page.getByTestId("memo")).toHaveCount(0, { timeout: 30_000 });
    expect(holds(await dump(owner.page), memoId)).toEqual([]);
    expect(holds(await dump(guest.page), memoId)).toEqual([]);
  } finally {
    await trio.close();
  }
});
