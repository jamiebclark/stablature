import { expect, test } from "@playwright/test";
import { landed } from "./reading-helpers";
import { recordMemo, seedMemo, seedSongM, sharePartA, twoMembers, withFakeMicrophone } from "./memo-helpers";

withFakeMicrophone();

/** INV-023: the list is oldest first, the newest 3 are drawn, and expansion persists. */
const SIZES = [
  { width: 375, height: 667 },
  { width: 1280, height: 800 },
];

for (const count of [1, 3, 4, 5]) {
  for (const size of SIZES) {
    test(`INV-023 ${count} memos at ${size.width}`, async ({ page }) => {
      await page.setViewportSize(size);
      await seedSongM(page);
      const base = Date.now() - 100_000;
      for (let i = 0; i < count; i++) await seedMemo(page, { partLabel: "B", state: "local-signed-out", recordedAt: base + i * 1000 });
      await landed(page);
      await page.reload();

      const memos = page.getByTestId("memo-list").getByTestId("memo");
      await expect(memos).toHaveCount(Math.min(count, 3));
      const more = page.getByTestId("memo-more");
      if (count > 3) {
        const hidden = count - 3;
        await expect(more).toHaveText(`Show ${hidden} earlier memo${hidden === 1 ? "" : "s"}`);
        await expect(memos.first()).toContainText(`Memo ${count - 2}`);
        await more.click();
        await expect(memos).toHaveCount(count);
        await expect(memos.first()).toContainText("Memo 1");
        await page.reload();
        await expect(memos).toHaveCount(count);
        await expect(page.getByTestId("memo-more")).toHaveText("Show fewer");
      } else {
        await expect(more).toHaveCount(0);
        await expect(memos.first()).toContainText("Memo 1");
      }
      await expect(page.getByTestId("part-memos")).toHaveCount(1);
    });
  }
}

/** AS2: a label travels between members, and two offline renames converge. */
test.describe("labels sync", () => {
  test("rename on A reaches B; two offline renames converge", async ({ browser }) => {
    test.setTimeout(180_000);
    const trio = await twoMembers(browser);
    try {
      await sharePartA(trio);
      const { owner, guest } = trio;
      await recordMemo(owner.page, "A", 3000);
      await guest.page.reload();
      await expect(guest.page.getByTestId("memo")).toHaveCount(1, { timeout: 30_000 });

      const rename = async (page: typeof owner.page, to: string) => {
        await page.getByRole("button", { name: /^Actions for memo/ }).click();
        await page.getByRole("menuitem", { name: /^Rename memo/ }).click();
        await page.getByLabel("Memo name").fill(to);
        await page.getByRole("button", { name: "Save" }).click();
      };
      await rename(owner.page, "Verse idea");
      await expect(guest.page.getByTestId("memo")).toContainText("Verse idea", { timeout: 30_000 });

      await owner.context.setOffline(true);
      await guest.context.setOffline(true);
      await rename(owner.page, "From owner");
      await rename(guest.page, "From guest");
      await owner.context.setOffline(false);
      await guest.context.setOffline(false);
      await expect(async () => {
        const a = await owner.page.getByTestId("memo").first().innerText();
        const b = await guest.page.getByTestId("memo").first().innerText();
        const title = (t: string) => /From (owner|guest)/.exec(t)?.[0];
        expect(title(a)).toBeDefined();
        expect(title(a)).toBe(title(b));
      }).toPass({ timeout: 60_000 });
    } finally {
      await trio.close();
    }
  });
});
