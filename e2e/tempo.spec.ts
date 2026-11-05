import { expect, test, type Page } from "@playwright/test";
import { columns, fret, openDialog, stackLatch, startCapturing } from "./capture-surface-helpers";

/** Tap with synthetic pointer events carrying a chosen `timeStamp`, so timing is exact. */
async function tap(page: Page, times: number[]) {
  await page.getByTestId("tap-pad").evaluate((pad, ts) => {
    for (const t of ts) {
      const e = new PointerEvent("pointerdown", { bubbles: true, cancelable: true, pointerType: "touch", isPrimary: true });
      Object.defineProperty(e, "timeStamp", { value: t });
      pad.dispatchEvent(e);
    }
  }, times);
}

/** Outbox rows queued for songs, read straight from IndexedDB. */
const songWrites = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<number>((resolve, reject) => {
        const open = indexedDB.open("stablature");
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const all = db.transaction("outbox").objectStore("outbox").getAll();
          all.onsuccess = () => {
            db.close();
            resolve((all.result as { table: string }[]).filter((r) => r.table === "songs").length);
          };
        };
      }),
  );

test.describe("tap tempo", () => {
  test("closing the sheet writes nothing; set writes one row and shows everywhere", async ({ page }) => {
    await startCapturing(page);
    const control = page.getByTestId("tempo-control");
    await expect(control).toHaveText("no tempo");
    const before = await songWrites(page);

    for (const how of ["button", "escape", "backdrop"] as const) {
      await control.click();
      await expect(openDialog(page)).toHaveCount(1);
      await expect(page.getByTestId("tap-pad")).toBeFocused();
      await tap(page, [1000, 1500, 2000]);
      await expect(page.getByTestId("tempo-reading")).toHaveText("120");
      if (how === "button") await page.getByRole("button", { name: "close" }).click();
      else if (how === "escape") await page.keyboard.press("Escape");
      else await page.mouse.click(2, 2);
      await expect(openDialog(page)).toHaveCount(0);
    }
    expect(await songWrites(page)).toBe(before);
    await expect(control).toHaveText("no tempo");

    await control.click();
    const box = await page.getByTestId("tap-pad").boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(96);
    expect(await page.evaluate(() => window.visualViewport?.scale)).toBe(1);
    await tap(page, [1000, 1500, 2000]);
    await page.getByTestId("tempo-set").click();
    await expect(openDialog(page)).toHaveCount(0);
    await expect(control).toHaveText("120 bpm");
    expect(await songWrites(page)).toBe(before + 1);
  });

  test("leaves the cursor, latch and part alone", async ({ page }) => {
    await startCapturing(page);
    await fret(page, "E", 7).click();
    await fret(page, "A", 5).click();
    await stackLatch(page).click();
    await expect(stackLatch(page)).toHaveAttribute("aria-pressed", "true");
    const url = page.url();
    const count = await columns(page).count();
    await page.getByTestId("tempo-control").click();
    await tap(page, [1000, 1500, 2000]);
    await page.getByTestId("tempo-set").click();
    await expect(page.getByTestId("tempo-control")).toHaveText("120 bpm");
    await expect(stackLatch(page)).toHaveAttribute("aria-pressed", "true");
    await expect(columns(page)).toHaveCount(count);
    expect(page.url()).toBe(url);
  });

  test("shows a too-slow and an out-of-range tempo and offers no set", async ({ page }) => {
    await startCapturing(page);
    await page.getByTestId("tempo-control").click();
    await tap(page, [1, 3600]);
    await expect(page.getByTestId("tempo-reading")).toContainText("Too slow to read");
    await expect(page.getByTestId("tempo-set")).toHaveCount(0);
  });
});
