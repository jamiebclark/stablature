/**
 * INV-019, the rest of the matrix. The plan crosses the 8 new status texts with the existing
 * matrix, whose states are end, after and stacking. Round 1 measured the cursor at the end, and
 * the stacked texts stand for stacking. This is the `after` state: the cursor on a column.
 */
import { expect, test, type Page } from "@playwright/test";
import {
  CHIPS,
  columns,
  expectLit,
  fret,
  latch,
  PHONE,
  stackLatch,
  STACK,
  startCapturing,
} from "./probe-helpers";

const SYMBOLS = ["Am", "Am7", "Cmaj7", "F#m7b5", "Xyz"];
const SHAPES = ["chords", "chords and tuplet"] as const;
const TEXTS = [
  ...CHIPS.map((c) => ({ text: `next note: ${c.name}`, arm: [c.name] })),
  ...CHIPS.map((c) => ({ text: `stack + ${c.name}`, arm: [STACK, c.name] })),
];

async function statusBox(page: Page, symbol: string) {
  return page.evaluate((symbol) => {
    const staff = document.querySelector('[data-testid="tab-staff"]')!;
    let scroller: Element | null = staff.parentElement;
    while (scroller && !/(auto|scroll)/.test(getComputedStyle(scroller).overflowY)) {
      scroller = scroller.parentElement;
    }
    const band = scroller!.getBoundingClientRect();
    const walker = document.createTreeWalker(staff, NodeFilter.SHOW_TEXT);
    let chord: DOMRect | null = null;
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (n.textContent?.trim() === symbol) {
        const range = document.createRange();
        range.selectNodeContents(n);
        chord = range.getBoundingClientRect();
      }
    }
    const status = [...document.querySelectorAll("span")].find((s) =>
      /^(adding|stacking|next note|stack \+)/.test(s.textContent ?? ""),
    )!;
    return {
      text: status.textContent,
      rowHeight: Math.round(status.parentElement!.getBoundingClientRect().height * 10) / 10,
      chordClippedPx: chord ? Math.max(0, Math.round((band.top - chord.top) * 10) / 10) : null,
      pageOver: document.scrollingElement!.scrollHeight - document.scrollingElement!.clientHeight,
    };
  }, symbol);
}

for (const shape of SHAPES) {
  for (const symbol of SYMBOLS) {
    test(`INV-019 status row, cursor on a column, ${shape}, ${symbol}`, async ({ page }, info) => {
      test.skip(info.project.name !== "mobile", "one project is enough for a measurement");
      await page.setViewportSize(PHONE);
      await startCapturing(page);
      await fret(page, "A", 5).click();
      await fret(page, "A", 7).click();
      await fret(page, "A", 9).click();
      await expect(columns(page)).toHaveCount(3);
      if (shape === "chords and tuplet") await page.getByTitle(/triplet/).click();
      await page.getByRole("button", { name: "chord symbol" }).click();
      await page.getByRole("textbox", { name: "Chord" }).fill(symbol);
      await page.getByRole("button", { name: "Set", exact: true }).click();
      await expect(page.getByTestId("tab-staff").getByText(symbol, { exact: true })).toBeVisible();
      await columns(page).last().click();

      await stackLatch(page).click();
      await expectLit(page, [STACK]);
      const bound = await statusBox(page, symbol);
      expect(bound.text).toBe("stacking onto the marked column");
      await stackLatch(page).click();

      for (const { text, arm } of TEXTS) {
        for (const name of arm) await latch(page, name).click();
        await expectLit(page, arm);
        const m = await statusBox(page, symbol);
        expect(m.text).toBe(text);
        expect(m.rowHeight, `${text} row`).toBeLessThanOrEqual(bound.rowHeight);
        expect(m.chordClippedPx ?? 0, `${text} chord`).toBeLessThanOrEqual(bound.chordClippedPx ?? 0);
        expect(m.pageOver, `${text} page`).toBeLessThanOrEqual(0);
        for (const name of arm) await latch(page, name).click();
      }
    });
  }
}
