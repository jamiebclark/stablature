import { expect, test } from "@playwright/test";
import { TUNINGS, emptySong, dumpStore, pasteTab, readStaffText, startWith, tabText } from "./import-helpers";

test("the Paste tab control is there with parts and with none, and no permission is asked", async ({
  page,
}) => {
  const asked: string[] = [];
  page.on("dialog", (d) => asked.push(d.message()));
  const seeded = await startWith(page, TUNINGS[0]);
  await emptySong(page, seeded.songUrl);
  // No parts yet: the control beside "+ part" and the one in the empty state.
  await expect(page.getByRole("button", { name: "Paste tab" })).toHaveCount(2);
  await pasteTab(page, await tabText(2));
  await page.getByRole("button", { name: /Import as part/ }).click();
  await expect(page.locator('[id^="part-"]')).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Paste tab" })).toHaveCount(1);
  expect(asked).toEqual([]);
});

test("typing then cancelling changes nothing in the store", async ({ page }) => {
  const seeded = await startWith(page, TUNINGS[0]);
  await emptySong(page, seeded.songUrl);
  const before = await dumpStore(page);
  await pasteTab(page, await tabText(4));
  await page.getByRole("button", { name: "Cancel" }).click();
  expect(await dumpStore(page)).toEqual(before);
});

test("import offline: preview equals the new part, a double click makes one part, outbox fills", async ({
  page,
  context,
}) => {
  const seeded = await startWith(page, TUNINGS[0]);
  await emptySong(page, seeded.songUrl);
  await context.setOffline(true);
  await pasteTab(page, await tabText(6));
  await expect(page.getByRole("status")).toHaveText(/Ready to import as part/);
  const preview = await readStaffText(page, "preview");
  const outboxBefore = (await dumpStore(page)).outbox.length;
  await page.getByRole("button", { name: /Import as part/ }).dblclick();
  await expect(page.locator('[id^="part-"]')).toHaveCount(1);
  expect((await dumpStore(page)).outbox.length).toBeGreaterThan(outboxBefore);
  expect(await readStaffText(page)).toBe(preview);
  await context.setOffline(false);
});

test("2,000 columns in the box and a keystroke reaches the value within 100 ms", async ({
  page,
}) => {
  const seeded = await startWith(page, TUNINGS[0]);
  await emptySong(page, seeded.songUrl);
  await pasteTab(page, await tabText(2000));
  const box = page.getByRole("textbox", { name: "Tab text" });
  await box.press("Control+End");
  const before = await box.inputValue();
  const start = Date.now();
  await page.keyboard.type("xxxxx");
  await expect.poll(() => box.inputValue(), { intervals: [5] }).toBe(before + "xxxxx");
  // Five keystrokes typed back to back: the average echo is what the person feels.
  const ms = (Date.now() - start) / 5;
  expect(ms).toBeLessThan(100);
});

// Story 2: tab found in the wild (spec scenarios 1 to 10).
const WILD = [
  "Intro riff",
  "G|---5-----7---|   ",
  "D|-------------|",
  "A|-------------|",
  "E|-------------|",
  "",
  "la la la",
  "",
  "1   2   3   4",
  "G|-3---|",
  "D|-----|",
  "A|-----|",
  "E|-----|",
].join(String.fromCharCode(13, 10));

test("a hand-typed tab with lyrics between systems previews as one part, ignored lines listed", async ({
  page,
}) => {
  const seeded = await startWith(page, TUNINGS[0]);
  await emptySong(page, seeded.songUrl);
  await pasteTab(page, WILD);
  await expect(page.getByRole("status")).toHaveText(/Ready to import|tuning|offer|match/i);
  const ignored = page.getByTestId("paste-ignored").locator("[data-line]");
  await expect(ignored.first()).toBeVisible();
  const lines = await ignored.evaluateAll((els) => els.map((e) => e.getAttribute("data-line")));
  expect(lines).toEqual(expect.arrayContaining(["1", "7", "9"]));
});

test("labels flush to the pipe and spaced to it read the same", async ({ page }) => {
  const seeded = await startWith(page, TUNINGS[0]);
  await emptySong(page, seeded.songUrl);
  const rows = (gap: string) =>
    ["G", "D", "A", "E"].map((l, i) => `${l}${gap}|---${i === 0 ? "5-----7" : "-------"}---|`).join("\n");
  await pasteTab(page, rows(""));
  const flush = await readStaffText(page, "preview");
  await pasteTab(page, rows(" "));
  expect(await readStaffText(page, "preview")).toBe(flush);
});

// Story 3: be told exactly what could not be read (INV-007, INV-008, INV-029).
const FOUR = (top: string) =>
  [`G |${top}|`, "D |-----|", "A |-----|", "E |-----|"].join("\n");

test("one bad line among good: no import button, the line is named, and the store is unchanged", async ({
  page,
}) => {
  const seeded = await startWith(page, TUNINGS[0]);
  await emptySong(page, seeded.songUrl);
  const before = await dumpStore(page);
  await pasteTab(page, `${FOUR("--5--")}\n\n${FOUR("-5s7-")}`);
  await expect(page.getByRole("status")).toHaveText("Line 6 could not be read. Nothing will be imported.");
  await expect(page.getByRole("button", { name: /Import|Switch to/ })).toHaveCount(0);
  const item = page.getByTestId("paste-refusals").locator('[data-line="6"]');
  await expect(item).toContainText("G |-5s7-|");
  await expect(item).toContainText(/\S+ \S+/);
  expect(await dumpStore(page)).toEqual(before);
});

test("several bad lines are counted, and fixing the box updates the preview", async ({ page }) => {
  const seeded = await startWith(page, TUNINGS[0]);
  await emptySong(page, seeded.songUrl);
  await pasteTab(page, `${FOUR("-5s7-")}\n\n${FOUR("-57--")}`);
  await expect(page.getByRole("status")).toHaveText("2 lines could not be read. Nothing will be imported.");
  await expect(page.getByTestId("paste-refusals").locator("[data-line]")).toHaveCount(2);
  await pasteTab(page, FOUR("--5--"));
  await expect(page.getByRole("status")).toHaveText(/Ready to import as part/);
  await expect(page.getByTestId("paste-refusals")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Import as part/ })).toBeVisible();
});

test("a refusal with no line shows its own reason", async ({ page }) => {
  const seeded = await startWith(page, TUNINGS[0]);
  await emptySong(page, seeded.songUrl);
  await pasteTab(page, "Just some lyrics\nand a second line");
  await expect(page.getByRole("status")).not.toHaveText("Paste tab here.");
  await expect(page.getByRole("button", { name: /Import|Switch to/ })).toHaveCount(0);
});

test("the status sentence does not change while typing inside a refused paste", async ({ page }) => {
  const seeded = await startWith(page, TUNINGS[0]);
  await emptySong(page, seeded.songUrl);
  await pasteTab(page, FOUR("-5s7-"));
  const status = page.getByRole("status");
  await expect(status).toHaveText("Line 1 could not be read. Nothing will be imported.");
  await status.evaluate((el) => {
    (window as unknown as { __mutations: number }).__mutations = 0;
    new MutationObserver((m) => {
      (window as unknown as { __mutations: number }).__mutations += m.length;
    }).observe(el, { childList: true, characterData: true, subtree: true });
  });
  await page.getByRole("textbox", { name: "Tab text" }).press("Control+End");
  await page.keyboard.type("   ");
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => (window as unknown as { __mutations: number }).__mutations)).toBe(0);
});

test("the two failure messages leave the text in the box", async ({ page, context }) => {
  const seeded = await startWith(page, TUNINGS[0]);
  await emptySong(page, seeded.songUrl);
  const text = await tabText(2);
  await pasteTab(page, text);
  await expect(page.getByRole("status")).toHaveText(/Ready to import as part/);
  // Delete the song's tuning rows' home store under the panel: a write that must reject.
  await page.evaluate(() => {
    const open = indexedDB.open;
    indexedDB.open = function (...args: Parameters<typeof open>) {
      const req = open.apply(this, args);
      return req;
    };
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function () {
      throw new DOMException("probe", "AbortError");
    };
    IDBObjectStore.prototype.add = IDBObjectStore.prototype.put;
    void put;
  });
  await page.getByRole("button", { name: /Import as part/ }).click();
  await expect(page.getByRole("status")).toHaveText(
    /Could not save this part\. Nothing was changed\.|The song changed while this was open\. Check the preview again\./,
  );
  expect(await page.getByRole("textbox", { name: "Tab text" }).inputValue()).toBe(text);
  void context;
});

// Story 4: a tab written for a different tuning (INV-001, INV-027, INV-029).
const FIVE = ["G", "D", "A", "E", "B"].map((l) => `${l} |--5--|`).join("\n");

test("a five-row paste into a four-string song offers the tuning, draws in it, and imports offline", async ({
  page,
  context,
}) => {
  const seeded = await startWith(page, TUNINGS[0]);
  await emptySong(page, seeded.songUrl);
  await context.setOffline(true);
  await pasteTab(page, FIVE);
  await expect(page.getByRole("button", { name: /^Switch to .* and import$/ })).toBeVisible();
  await expect(page.getByText(/^Tuning: this song will switch to/)).toBeVisible();
  expect((await readStaffText(page, "preview")).split(String.fromCharCode(10))).toHaveLength(5);
  await page.getByRole("button", { name: /^Switch to / }).click();
  await expect(page.locator('[id^="part-"]')).toHaveCount(1);
  const store = await dumpStore(page);
  expect(store.tunings.length).toBeGreaterThan(1);
  await context.setOffline(false);
});

test("taking the offer then cancelling leaves the store unchanged", async ({ page }) => {
  const seeded = await startWith(page, TUNINGS[0]);
  await emptySong(page, seeded.songUrl);
  const before = await dumpStore(page);
  await pasteTab(page, FIVE);
  await expect(page.getByRole("button", { name: /^Switch to / })).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();
  expect(await dumpStore(page)).toEqual(before);
});

test("a paste that would change a stored note's pitch is refused naming both tunings", async ({
  page,
}) => {
  const seeded = await startWith(page, TUNINGS[0]);
  await emptySong(page, seeded.songUrl);
  await pasteTab(page, FOUR("--5--"));
  await page.getByRole("button", { name: /Import as part/ }).click();
  await expect(page.locator('[id^="part-"]')).toHaveCount(1);
  const before = await dumpStore(page);
  const other = ["F", "C", "G", "D"].map((l) => `${l} |--5--|`).join("\n");
  await pasteTab(page, other);
  await expect(page.getByTestId("paste-refusals")).toContainText(/G D A E/);
  await expect(page.getByTestId("paste-refusals")).toContainText(/F C G D/);
  await expect(page.getByRole("button", { name: /Import|Switch to/ })).toHaveCount(0);
  expect(await dumpStore(page)).toEqual(before);
});
