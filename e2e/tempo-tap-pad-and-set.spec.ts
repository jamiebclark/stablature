/**
 * INV-014 and INV-015 through the real sheet: a held press, real keys, key repeat, a click with
 * detail 0, a right button, two pointers, twenty fast taps, no zoom; and what set writes, including
 * a double tap on set.
 */
import { expect, test, type Page } from "@playwright/test";
import { columns as columnsOf, startCapturing } from "./capture-surface-helpers";
import { outbox, patchSong, seed, songRows, tapAt, tapsFor } from "./rhythm-probe-helpers";

const open = async (page: Page) => {
  await page.getByTestId("tempo-control").click();
  await expect(page.getByTestId("tap-pad")).toBeFocused();
};
const words = (page: Page) => page.getByTestId("tempo-reading");
const songWrites = async (page: Page) => (await outbox(page)).filter((r) => r.table === "songs").length;

test("INV-014 a held press counts once, from the press", async ({ page }) => {
  await startCapturing(page);
  await open(page);
  await page.getByTestId("tap-pad").evaluate((pad) => {
    // Each press is held 400ms. Timed from release this would still read 120, so vary the holds.
    const at = (type: string, t: number) => {
      const e = new PointerEvent(type, { bubbles: true, cancelable: true, pointerType: "touch", isPrimary: true });
      Object.defineProperty(e, "timeStamp", { value: t });
      pad.dispatchEvent(e);
    };
    at("pointerdown", 1000);
    at("pointerup", 1400);
    at("pointerdown", 1500);
    at("pointerup", 1510);
    at("pointerdown", 2000);
    at("pointerup", 2300);
  });
  await expect(words(page)).toHaveText("120");
});

test("INV-014 real keys: Space and Enter once each, repeat ignored, one tap per press", async ({ page }) => {
  await startCapturing(page);
  await open(page);
  await page.keyboard.down(" ");
  for (let i = 0; i < 6; i++) await page.keyboard.down(" ");
  await page.keyboard.up(" ");
  await expect(words(page)).toHaveText("Keep tapping");
  await page.waitForTimeout(300);
  await page.keyboard.down("Enter");
  for (let i = 0; i < 6; i++) await page.keyboard.down("Enter");
  await page.keyboard.up("Enter");
  await expect(words(page)).toHaveText("Once more");
  await page.waitForTimeout(300);
  await page.keyboard.press(" ");
  await expect(words(page)).toHaveText(/^\d+$/);
  await expect(page.getByTestId("tap-pad")).toBeFocused();
});

test("INV-014 a click with detail 0 is one tap; a right button is none", async ({ page }) => {
  await startCapturing(page);
  await open(page);
  await page.getByTestId("tap-pad").evaluate((pad) => (pad as HTMLButtonElement).click());
  await expect(words(page)).toHaveText("Keep tapping");
  const box = (await page.getByTestId("tap-pad").boundingBox())!;
  await page.mouse.click(box.x + 20, box.y + 20, { button: "right" });
  await expect(words(page)).toHaveText("Keep tapping");
});

test("INV-014 overlapping pointers are two taps; 20 taps at 100ms lose none", async ({ page }) => {
  await startCapturing(page);
  await open(page);
  await page.getByTestId("tap-pad").evaluate((pad) => {
    const at = (type: string, t: number, id: number) => {
      const e = new PointerEvent(type, { bubbles: true, cancelable: true, pointerType: "touch", pointerId: id });
      Object.defineProperty(e, "timeStamp", { value: t });
      pad.dispatchEvent(e);
    };
    at("pointerdown", 1000, 1);
    at("pointerdown", 1200, 2);
    at("pointerup", 1250, 1);
    at("pointerup", 1300, 2);
  });
  await expect(words(page)).toHaveText("Once more");
  await page.keyboard.press("Escape");
  await open(page);
  await tapAt(page, Array.from({ length: 20 }, (_, i) => 1000 + i * 100));
  await expect(words(page)).toHaveText("600 is out of range. Tempo runs from 20 to 400.");
  await expect(page.getByTestId("tempo-set")).toHaveCount(0);
});

test("INV-014 quick real taps do not zoom, and the pad is at least 96px", async ({ page, hasTouch }) => {
  test.skip(!hasTouch, "touch only");
  await startCapturing(page);
  await open(page);
  const box = (await page.getByTestId("tap-pad").boundingBox())!;
  expect(box.height).toBeGreaterThanOrEqual(96);
  expect(await page.getByTestId("tap-pad").evaluate((el) => getComputedStyle(el).touchAction)).toBe("none");
  for (let i = 0; i < 8; i++) await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  expect(await page.evaluate(() => visualViewport?.scale)).toBe(1);
  await expect(words(page)).not.toHaveText("Tap in time");
});

test("INV-015 set the stored value: no write, the sheet closes", async ({ page }) => {
  await startCapturing(page);
  await open(page);
  await tapAt(page, tapsFor(120));
  await page.getByTestId("tempo-set").click();
  await expect(page.getByTestId("tempo-control")).toHaveText("120 bpm");
  const before = await songWrites(page);
  await open(page);
  await tapAt(page, tapsFor(120));
  await page.getByTestId("tempo-set").click();
  await expect(page.locator("dialog[open]")).toHaveCount(0);
  expect(await songWrites(page)).toBe(before);
});

for (const how of ["one tick", "20ms apart", "real double click"] as const) {
  test(`INV-015 a double tap on set writes once (${how})`, async ({ page }) => {
    // Round 1, MINOR: under about 20ms both presses read the row before either writes. No person
    // reaches that (see the slowed-CPU probe below), and the second row holds the same value.
    test.fail(how !== "20ms apart", "known MINOR: two rows at a gap no finger can make");
    await startCapturing(page);
    await open(page);
    await tapAt(page, tapsFor(120));
    const before = await songWrites(page);
    const set = page.getByTestId("tempo-set");
    if (how === "one tick") {
      await set.evaluate((b) => {
        (b as HTMLButtonElement).click();
        (b as HTMLButtonElement).click();
      });
    } else if (how === "20ms apart") {
      await set.evaluate(async (b) => {
        (b as HTMLButtonElement).click();
        await new Promise((r) => setTimeout(r, 20));
        (b as HTMLButtonElement).click();
      });
    } else {
      await set.dblclick();
    }
    await expect(page.locator("dialog[open]")).toHaveCount(0);
    await page.waitForTimeout(200);
    expect(await songWrites(page)).toBe(before + 1);
  });
}

test("INV-015 a song tempo landing with the sheet open: focus stays where the person put it", async ({ page }) => {
  // Round 1, MINOR: the pad's inline ref runs on every render, and takes focus back each time.
  test.fail(true, "known MINOR: any re-render of the sheet moves focus to the pad");
  await startCapturing(page);
  await open(page);
  await tapAt(page, tapsFor(120));
  await page.getByTestId("tempo-set").focus();
  await expect(page.getByTestId("tempo-set")).toBeFocused();
  await patchSong(page, { bpm: 96 });
  await expect(page.getByTestId("tempo-stored")).toHaveText("This song: 96 bpm");
  await page.waitForTimeout(100);
  await expect(page.getByTestId("tempo-set")).toBeFocused();
  expect((await songRows(page))[0].bpm).toBe(96);
});

/**
 * Can a person reach it? Real pointer events at a human double-tap gap, with the CPU slowed to phone
 * speed. Reports the gaps at which a second row appears, and whether the second tap lands on the
 * screen behind the sheet.
 */
for (const rate of [1, 4, 6]) {
  test(`INV-015 INV-016 a human double tap on set, CPU slowed ${rate}x`, async ({ page }) => {
    test.setTimeout(120_000);
    const { partUrl } = await seed(page, [{ d: null }], { arrange: false });
    await page.goto(partUrl);
    await expect(columnsOf(page)).toHaveCount(1);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate });
    const report: string[] = [];
    for (const gap of [40, 60, 80, 100, 120, 160]) {
      await open(page);
      await tapAt(page, tapsFor(100 + gap));
      const before = await songWrites(page);
      const columnsBefore = await columnsOf(page).count();
      const box = (await page.getByTestId("tempo-set").boundingBox())!;
      const x = box.x + box.width / 2;
      const y = box.y + box.height / 2;
      await page.mouse.click(x, y);
      await page.waitForTimeout(gap);
      await page.mouse.click(x, y);
      await page.waitForTimeout(400);
      await expect(page.locator("dialog[open]")).toHaveCount(0);
      const rows = (await songWrites(page)) - before;
      const added = (await columnsOf(page).count()) - columnsBefore;
      if (rows !== 1 || added !== 0) report.push(`gap ${gap}ms: ${rows} rows, ${added} columns added behind the sheet`);
    }
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
    expect(report).toEqual([]);
  });
}
