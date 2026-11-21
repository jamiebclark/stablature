import { expect, test } from "@playwright/test";
import { landed } from "./reading-helpers";
import { dump, seedMemo, seedSongM } from "./memo-helpers";

/** INV-016: deleting a part with memos asks first, and removes the memos with it. */
const menu = (page: import("@playwright/test").Page) => page.getByRole("button", { name: /^Actions for part B(,|$)/ });
const ids = async (page: import("@playwright/test").Page, store: string) =>
  (JSON.parse(await dump(page)) as Record<string, Array<Record<string, unknown>>>)[store] ?? [];

test("no memos: one tap deletes the part, as before", async ({ page }) => {
  await seedSongM(page);
  await landed(page);
  await menu(page).click();
  await page.getByRole("menuitem", { name: "Delete part B" }).click();
  await expect(menu(page)).toHaveCount(0);
  const parts = await ids(page, "parts");
  expect(parts.filter((p) => p.label === "B")[0]?.deletedAt).not.toBeNull();
});

for (const count of [1, 2, 4]) {
  test(`${count} memos: asks, Cancel changes nothing, Confirm removes all`, async ({ page }) => {
    await seedSongM(page);
    for (let i = 0; i < count; i++) await seedMemo(page, { partLabel: "B", state: "local-signed-out", recordedAt: Date.now() - 10_000 + i });
    await landed(page);
    await page.reload();
    const before = await dump(page);

    await menu(page).click();
    await page.getByRole("menuitem", { name: "Delete part B" }).click();
    const sheet = page.getByRole("dialog");
    await expect(sheet).toContainText(`${count} voice memo${count === 1 ? "" : "s"}`);
    await sheet.getByRole("button", { name: "Cancel" }).click();
    await expect(sheet).toBeHidden();
    expect(await dump(page)).toEqual(before);

    await menu(page).click();
    await page.getByRole("menuitem", { name: "Delete part B" }).click();
    await page.getByRole("button", { name: "Delete part and memos" }).click();
    await expect(page.getByTestId("memo")).toHaveCount(0);
    expect((await ids(page, "memoAudio")).length).toBe(0);
    const memos = await ids(page, "memos");
    expect(memos.length).toBe(count);
    expect(memos.every((m) => m.deletedAt !== null)).toBe(true);
  });
}
