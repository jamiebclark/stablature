/**
 * INV-006 / FR-008 / T090, round 3. The pinned footer holds the row still, but it takes height from
 * the rows that scroll, and round 2 could not say they all stay reachable. The sheet's own reach spec
 * tries only the toggles, at one height, with no group row and no chord symbol.
 *
 * Over {4, 5, 6 strings} x {the plainest sheet, the tallest sheet} x three heights, for every control
 * in the sheet, by pointer and by keyboard: is it what a tap on it would hit? The walk reads the
 * controls off the DOM, so a control nobody listed is still walked.
 *
 * 553 is a 667 px phone with its browser bars showing, and 375 is the same phone on its side. The
 * capture screen itself is only supported from 375x667, so the sheet is opened there and the screen
 * then changes under it, and only 375x667 is held to "the page does not scroll".
 */
import { expect, test, type Page } from "@playwright/test";
import { addChord, columns, details, inspector, startWith } from "../../../e2e/capture-surface-helpers";
import { writeColumns, type Col } from "./helpers";

const TUNINGS = [
  { family: "Bass 4", preset: "E Standard", strings: 4 },
  { family: "Bass 5", preset: "B Standard", strings: 5 },
  { family: "Guitar 6", preset: "E Standard", strings: 6 },
] as const;

const SCREENS = [
  { width: 375, height: 667 },
  { width: 375, height: 553 },
  { width: 667, height: 375 },
] as const;

const chord = (n: number) => Object.fromEntries(Array.from({ length: n }, (_, i) => [String(i), 5]));

/** The column under test is the second: the first exists only so the raw write has a row to copy. */
async function seedTallest(page: Page, family: string, preset: string, strings: number) {
  const { partUrl } = await startWith(page, family, preset, strings);
  const partId = /\/capture\/([0-9a-f-]+)/.exec(partUrl)![1];
  await page.goto(partUrl);
  await page.getByRole("button", { name: /string, fret 5,/ }).first().click();
  await expect(columns(page)).toHaveCount(1);
  const list: Col[] = [
    { frets: { 0: 5 } },
    { frets: chord(strings), tupletId: "h", tupletCount: 3, groupKind: "tuplet" },
  ];
  await writeColumns(page, partId, list);
  await page.goto(partUrl);
  await expect(columns(page)).toHaveCount(list.length);
  await addChord(page, 1, "Dm7");
}

async function open(page: Page, index: number) {
  await columns(page).nth(index).click();
  await details(page).click();
  await expect(inspector(page)).toBeVisible();
  await expect(page.getByTestId("duration-row").getByRole("button")).toHaveCount(6);
}

/** True when a tap at the middle of `el` lands on it, or on something inside it. */
const hitsItself = (el: Element) => {
  const r = el.getBoundingClientRect();
  const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
  return hit !== null && (hit === el || el.contains(hit));
};

async function walkByPointer(page: Page, screen: { width: number; height: number }) {
  const controls = inspector(page).locator("button, input");
  const count = await controls.count();
  const missed: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const control = controls.nth(i);
    await control.scrollIntoViewIfNeeded();
    const name = (await control.getAttribute("aria-label")) ?? (await control.textContent()) ?? `#${i}`;
    const box = (await control.boundingBox())!;
    const inView = box.y >= 0 && box.y + box.height <= screen.height && box.x + box.width <= screen.width;
    const hit = await control.evaluate(hitsItself);
    if (!inView || !hit) missed.push(`${name}: y ${Math.round(box.y)}, hit ${hit}`);
  }
  return { count, missed };
}

async function walkByKeyboard(page: Page, count: number) {
  const missed: string[] = [];
  const reached = new Set<string>();
  for (let i = 0; i < count + 2; i += 1) {
    await page.keyboard.press("Tab");
    const seen = await page.evaluate((src) => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || !el.closest("[data-testid=column-inspector]")) return null;
      const hits = new Function(`return (${src})`)() as (e: Element) => boolean;
      return { name: el.getAttribute("aria-label") ?? el.textContent ?? "", hit: hits(el) };
    }, hitsItself.toString());
    if (seen === null) continue;
    reached.add(seen.name);
    if (!seen.hit) missed.push(seen.name);
  }
  return { reached: reached.size, missed };
}

const shape = (page: Page) =>
  page.evaluate(() => {
    const dialog = document.querySelector("dialog[open]") as HTMLElement;
    const row = document.querySelector("[data-testid=duration-row]") as HTMLElement;
    const page = document.scrollingElement!;
    const scroller = dialog.querySelector("[data-testid=column-inspector] > div:nth-child(2)") as HTMLElement;
    const remove = dialog.querySelector("[data-testid=column-inspector] > div:nth-child(3) > div:last-child button") as HTMLElement;
    const removeBox = remove.getBoundingClientRect();
    return {
      // For the person pass: delete is one tap with no prompt, and now always sits under the row.
      gapToDelete: Math.round(removeBox.y - row.getBoundingClientRect().bottom),
      deleteHeight: Math.round(removeBox.height),
      y: Math.round(row.getBoundingClientRect().y),
      bottom: Math.round(row.getBoundingClientRect().bottom),
      rowsHeight: Math.round(scroller.clientHeight),
      sheetScrolls: dialog.scrollHeight > dialog.clientHeight,
      rowsSideways: scroller.scrollWidth > scroller.clientWidth,
      pageScrolls: page.scrollHeight > page.clientHeight,
    };
  });

for (const screen of SCREENS) {
  for (const t of TUNINGS) {
    test(`INV-006 every control in reach, ${t.strings} strings at ${screen.width}x${screen.height}`, async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await seedTallest(page, t.family, t.preset, t.strings);

      const seen: Record<string, unknown>[] = [];
      for (const [name, index] of [
        ["plain", 0],
        ["tallest", 1],
      ] as const) {
        await page.setViewportSize({ width: 375, height: 667 });
        await open(page, index);
        await page.setViewportSize(screen);
        const at = await shape(page);
        const pointer = await walkByPointer(page, screen);
        expect(pointer.missed, `${name}: out of reach by pointer`).toEqual([]);
        const keys = await walkByKeyboard(page, pointer.count);
        expect(keys.missed, `${name}: out of reach by keyboard`).toEqual([]);
        expect(keys.reached, `${name}: every control takes focus`).toBeGreaterThan(pointer.count / 2);
        expect(at.sheetScrolls, `${name}: the sheet itself scrolls`).toBe(false);
        expect(at.rowsSideways, `${name}: the rows scroll sideways`).toBe(false);
        if (screen.height === 667) expect(at.pageScrolls, `${name}: the page scrolls`).toBe(false);
        expect(at.bottom, `${name}: the row is on screen`).toBeLessThanOrEqual(screen.height);
        seen.push({ name, controls: pointer.count, ...at });
        await page.keyboard.press("Escape");
        await expect(page.locator("dialog[open]")).toHaveCount(0);
      }
      console.log(`REACH ${t.strings} strings ${screen.width}x${screen.height}: ${JSON.stringify(seen)}`);
      expect(new Set(seen.map((s) => s.y)).size, "one y across columns").toBe(1);
    });
  }
}

test("INV-006 a tap in the rows or on the row leaves the rows where they were", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await seedTallest(page, "Guitar 6", "E Standard", 6);
  await open(page, 1);

  const rows = page.locator("[data-testid=column-inspector] > div:nth-child(2)");
  const scrollTop = () => rows.evaluate((el) => el.scrollTop);
  await rows.evaluate((el) => {
    el.scrollTop = el.scrollHeight;
  });
  const before = await scrollTop();
  expect(before, "the tallest sheet's rows have somewhere to scroll").toBeGreaterThan(0);

  const toggle = page.getByTestId("decoration-group").last().getByRole("button").last();
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  expect(await scrollTop(), "after a toggle").toBe(before);

  const eighth = page.getByTestId("duration-row").getByRole("button").nth(3);
  await eighth.click();
  await expect(eighth).toHaveAttribute("aria-pressed", "true");
  expect(await scrollTop(), "after a duration").toBe(before);
});
