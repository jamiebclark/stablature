/**
 * INV-019: strip, neck, 5 stable controls x 8 states x 2 themes; a chip holds its place while
 * unavailable; row 2 still fits with the widest repeat the wire allows; 8 status texts over the
 * chord and tuplet matrix. The status bound is the stack text in the same state, as today.
 *
 * INV-020: 5 chips x {unlit, lit, unavailable} x 2 themes, and the mutation the plan requires
 * and the suite's comment admits was never done: a long label must make the check fail.
 */
import { expect, test, type Page } from "@playwright/test";
import {
  CHIPS,
  columns,
  expectLit,
  fret,
  latch,
  patchStored,
  PHONE,
  stackLatch,
  STACK,
  startCapturing,
  storedRows,
  strip,
  THEMES,
} from "./capture-surface-helpers";

async function measure(page: Page) {
  return page.evaluate(() => {
    const rect = (el: Element) => {
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height, right: r.right };
    };
    const strip = document.querySelector('[data-testid="latch-strip"]')!;
    const stableRow = document.querySelector('[data-testid="toolbar-stable"]')!;
    return {
      strip: rect(strip),
      neck: rect(document.querySelector('[data-testid="fret-grid"]')!),
      stable: [...stableRow.querySelectorAll("button")].map(rect),
      chips: [...strip.querySelectorAll("button")].map((e) => {
        const range = document.createRange();
        range.selectNodeContents(e);
        return {
          ...rect(e),
          overflows: e.scrollWidth > e.clientWidth,
          lines: new Set([...range.getClientRects()].map((r) => Math.round(r.top))).size,
          textWithin:
            range.getBoundingClientRect().left >= e.getBoundingClientRect().left &&
            range.getBoundingClientRect().right <= e.getBoundingClientRect().right,
        };
      }),
      pageScrollY: document.scrollingElement!.scrollHeight - document.scrollingElement!.clientHeight,
      pageScrollX: document.scrollingElement!.scrollWidth - document.scrollingElement!.clientWidth,
    };
  });
}

for (const theme of THEMES) {
  test(`INV-019/020 8 states, ${theme}`, async ({ page }, info) => {
    test.skip(info.project.name !== "mobile", "one project is enough for a measurement");
    await page.setViewportSize(PHONE);
    await page.emulateMedia({ colorScheme: theme });
    await startCapturing(page);
    await fret(page, "A", 5).click();
    await fret(page, "A", 7).click();
    await expect(columns(page)).toHaveCount(2);
    const base = await measure(page);
    console.log(`MEASURE ${theme} base ${JSON.stringify({ strip: base.strip, neck: base.neck, stableY: base.stable[0].y, chip: base.chips[0].h })}`);
    expect(base.strip.h).toBeCloseTo(39, 1);
    expect(base.chips[0].h).toBeCloseTo(31, 1);

    const check = async (state: string) => {
      const m = await measure(page);
      expect(m.strip, state).toEqual(base.strip);
      expect(m.neck, state).toEqual(base.neck);
      expect(m.stable, state).toEqual(base.stable);
      expect(m.pageScrollY, state).toBe(0);
      expect(m.pageScrollX, state).toBe(0);
      m.chips.forEach((chip, i) => {
        expect({ x: chip.x, w: chip.w, h: chip.h }, `${state} chip ${i} place`).toEqual({
          x: base.chips[i].x,
          w: base.chips[i].w,
          h: base.chips[i].h,
        });
        expect(chip.lines, `${state} chip ${i} lines`).toBe(1);
        expect(chip.overflows, `${state} chip ${i} overflow`).toBe(false);
        expect(chip.textWithin, `${state} chip ${i} label inside`).toBe(true);
      });
    };

    await check("nothing armed");
    await stackLatch(page).click();
    await expectLit(page, [STACK]);
    await check("stack");
    await stackLatch(page).click();
    for (const c of CHIPS) {
      await latch(page, c.name).click();
      await expectLit(page, [c.name]);
      await check(c.name);
      await latch(page, c.name).click();
    }
    await stackLatch(page).click();
    await latch(page, "slide down").click();
    await expectLit(page, [STACK, "slide down"]);
    await check("stack with a chip");
    await page.getByRole("button", { name: /start/ }).click();
    await expectLit(page, []);
    for (const n of [STACK, ...CHIPS.map((c) => c.name)]) await expect(latch(page, n)).toBeDisabled();
    await check("at the start, all unavailable");
  });
}

test("INV-019 row 2 fits at 375 with every repeat width", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile", "one project is enough for a measurement");
  await page.setViewportSize(PHONE);
  await startCapturing(page);
  await fret(page, "A", 5).click();
  await expect(columns(page)).toHaveCount(1);
  const id = (await storedRows(page))[0].id;
  for (const repeat of [1, 8, 64, 99, 100, 512]) {
    await patchStored(page, id, { repeat });
    await page.reload();
    await expect(columns(page).first()).toBeVisible();
    const row = page.getByTestId("toolbar-contextual");
    const m = await row.evaluate((el) => {
      const buttons = [...el.querySelectorAll("button")];
      const last = buttons.at(-1)!.getBoundingClientRect();
      const plus = el.querySelector('[aria-label="Repeat one more time"]')!;
      const stepper = plus.parentElement!;
      return {
        stepperClippedPx: Math.round((plus.getBoundingClientRect().right - stepper.getBoundingClientRect().right) * 10) / 10,
        stepperOver: stepper.scrollWidth - stepper.clientWidth,
        plusWidth: plus.getBoundingClientRect().width,
        over: el.scrollWidth - el.clientWidth,
        right: last.right,
        width: last.width,
        height: last.height,
        minWidth: getComputedStyle(buttons.at(-1)!).minWidth,
        label: buttons.at(-1)!.getAttribute("aria-label"),
      };
    });
    console.log(`MEASURE row2 repeat=${repeat} ${JSON.stringify(m)}`);
    expect(m.label).toBe("Open column details");
    expect(m.over).toBe(0);
    expect(m.right).toBeLessThanOrEqual(365);
    expect(m.width).toBeGreaterThanOrEqual(42);
    expect(m.height).toBeGreaterThanOrEqual(44);
  }
});

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
    test(`INV-019 status row, 8 texts, ${shape}, ${symbol}`, async ({ page }, info) => {
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
      await page.getByRole("button", { name: "Set" }).click();
      await expect(page.getByTestId("tab-staff").getByText(symbol, { exact: true })).toBeVisible();

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

test("INV-020 the overflow check can fail: a long label is caught", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile", "one project is enough for a measurement");
  await page.setViewportSize(PHONE);
  await startCapturing(page);
  await fret(page, "A", 5).click();
  await expect(columns(page)).toHaveCount(1);
  const results = await strip(page).locator("button").evaluateAll((els) =>
    els.map((e) => {
      const before = e.scrollWidth > e.clientWidth;
      const original = e.textContent;
      e.textContent = "a-label-far-too-long-for-its-chip";
      const after = e.scrollWidth > e.clientWidth;
      e.textContent = original;
      return { before, after };
    }),
  );
  console.log(`MEASURE mutation ${JSON.stringify(results)}`);
  for (const r of results) expect(r).toEqual({ before: false, after: true });
});
