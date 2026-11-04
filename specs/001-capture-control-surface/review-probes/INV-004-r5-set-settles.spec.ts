/**
 * INV-004 / FR-018 (round 5): T081 holds the sheet's draft until `current` changes. So what
 * happens to every kind of `set`, including one that stores nothing new?
 *
 * Members 1 to 3 change the stored value: the field must settle on what is stored, with `set`
 * disabled. Members 4 and 5 do not: `setChord` trims, so `current` never changes, and nothing
 * drops the draft. Member 6 sends a second value before the first has landed, and member 7
 * closes the sheet with a write in flight.
 *
 * Members 4 and 5 are `test.fail`: MINOR F26 in review.md. Remove the marks once it is fixed.
 */
import { expect, test, type Page } from "@playwright/test";
import { columns, fret, inspector, mouseHold, openDialog, startCapturing } from "./helpers";

const field = (p: Page) => inspector(p).getByLabel("chord symbol");
const setButton = (p: Page) => inspector(p).getByRole("button", { name: "set" });

async function openSheet(page: Page) {
  await startCapturing(page);
  await fret(page, "E", 7).click();
  await expect(columns(page)).toHaveCount(1);
  await mouseHold(page, columns(page).first());
  await expect(openDialog(page)).toHaveCount(1);
}

async function set(page: Page, value: string) {
  await field(page).fill(value);
  await setButton(page).click();
}

/** The live chord rows, and how many writes are waiting to sync. */
async function stored(page: Page) {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const open = indexedDB.open("stablature");
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => reject(open.error);
    });
    const all = (table: string) =>
      new Promise<Record<string, unknown>[]>((resolve) => {
        const req = db.transaction(table).objectStore(table).getAll();
        req.onsuccess = () => resolve(req.result);
      });
    const annotations = await all("annotations");
    const outbox = await all("outbox");
    db.close();
    return {
      chords: annotations.filter((a) => a.kind === "chord" && !a.deletedAt).map((a) => a.value),
      outbox: outbox.length,
    };
  });
}

async function settled(page: Page, value: string) {
  await expect(field(page)).toHaveValue(value);
  await expect(setButton(page)).toBeDisabled();
}

test("a new chord settles", async ({ page }) => {
  await openSheet(page);
  await set(page, "Am");
  await settled(page, "Am");
  expect((await stored(page)).chords).toEqual(["Am"]);
});

test("a padded new chord settles on the stored text", async ({ page }) => {
  await openSheet(page);
  await set(page, " Am ");
  await settled(page, "Am");
  expect((await stored(page)).chords).toEqual(["Am"]);
});

test("a clear settles", async ({ page }) => {
  await openSheet(page);
  await set(page, "Am");
  await settled(page, "Am");
  await set(page, "");
  await settled(page, "");
  expect((await stored(page)).chords).toEqual([]);
});

test("re-setting the stored chord with padding settles", async ({ page }) => {
  test.fail(true, "MINOR F26 in review.md: `current` never changes, so the draft is never dropped.");
  test.setTimeout(10_000);
  await openSheet(page);
  await set(page, "Am");
  await settled(page, "Am");
  await set(page, "Am ");
  await page.waitForTimeout(300);
  const before = (await stored(page)).outbox;
  const r = {
    field: await field(page).inputValue(),
    setEnabled: await setButton(page).isEnabled(),
    ...(await stored(page)),
  };
  if (r.setEnabled) {
    await setButton(page).click();
    await setButton(page).click();
    await page.waitForTimeout(200);
  }
  console.log(`MEASURE padded re-set ${JSON.stringify(r)} outboxAfterTwoMorePresses=${(await stored(page)).outbox - before}`);
  await expect(field(page)).toHaveValue("Am", { timeout: 1000 });
});

test("spaces over no chord settle", async ({ page }) => {
  test.fail(true, "MINOR F26 in review.md: `current` never changes, so the draft is never dropped.");
  test.setTimeout(10_000);
  await openSheet(page);
  await set(page, "   ");
  await page.waitForTimeout(300);
  const r = {
    field: await field(page).inputValue(),
    setEnabled: await setButton(page).isEnabled(),
    ...(await stored(page)),
  };
  console.log(`MEASURE spaces ${JSON.stringify(r)}`);
  await expect(field(page)).toHaveValue("", { timeout: 1000 });
});

test("a second value sent before the first lands wins, and the field settles on it", async ({ page }) => {
  await openSheet(page);
  await field(page).fill("Am");
  const seen = await page.evaluate(async () => {
    const root = document.querySelector('[data-testid="column-inspector"]')!;
    const input = root.querySelector<HTMLInputElement>('input[aria-label="chord symbol"]')!;
    const button = [...root.querySelectorAll("button")].find((b) => b.textContent?.trim() === "set")!;
    const write = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    const values = [input.value];
    button.click();
    // A macrotask later, so React has flushed the first submit.
    await new Promise((resolve) => setTimeout(resolve));
    write.call(input, "Dm");
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve));
    button.click();
    const start = performance.now();
    while (performance.now() - start < 300) {
      if (input.value !== values.at(-1)) values.push(input.value);
      await new Promise((resolve) => setTimeout(resolve));
    }
    return values;
  });
  console.log(`MEASURE second value ${JSON.stringify(seen)}`);
  await settled(page, "Dm");
  expect((await stored(page)).chords).toEqual(["Dm"]);
});

test("closing with a write in flight loses nothing and reopens on the stored chord", async ({ page }) => {
  await openSheet(page);
  await field(page).fill("Am");
  await page.evaluate(() => {
    const root = document.querySelector('[data-testid="column-inspector"]')!;
    const buttons = [...root.querySelectorAll("button")];
    buttons.find((b) => b.textContent?.trim() === "set")!.click();
    buttons.find((b) => b.textContent?.trim() === "close")!.click();
  });
  await expect(openDialog(page)).toHaveCount(0);
  await mouseHold(page, columns(page).first());
  await expect(openDialog(page)).toHaveCount(1);
  await settled(page, "Am");
  expect((await stored(page)).chords).toEqual(["Am"]);
});
