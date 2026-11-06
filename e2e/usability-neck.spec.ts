/**
 * INV-019's neck half: header at 11px, and an inlay's computed `font-weight` above a plain fret's with the same
 * colour. The suite's usability-marks test never reads the neck.
 */
import { expect, test, type Page } from "@playwright/test";
import { startCapturing } from "./capture-surface-helpers";
import { bar, n, seedSong, type Col } from "./reading-helpers";

const INLAYS = new Set([3, 5, 7, 9, 12, 15, 17, 19, 21, 24]);

/** The header row is the neck's first row of bare numbers. */
const header = (page: Page) =>
  page.evaluate(() => {
    const cells = [...document.querySelectorAll("div, span")].filter(
      (el) => el.children.length === 0 && /^\d{1,2}$/.test(el.textContent ?? "") && el.className.toString().includes("w-(--fret)"),
    );
    return cells.map((el) => {
      const s = getComputedStyle(el);
      return { fret: Number(el.textContent), size: s.fontSize, weight: Number(s.fontWeight), color: s.color };
    });
  });

for (const theme of ["dark", "light"] as const) {
  test(`INV-019 the neck header, ${theme}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme });
    await startCapturing(page);
    await page.waitForTimeout(200);
    const cells = await header(page);
    expect(cells.length, "the header row was found").toBeGreaterThan(5);
    for (const c of cells) expect(c.size, `fret ${c.fret}`).toBe("11px");
    const inlay = cells.filter((c) => INLAYS.has(c.fret));
    const plain = cells.filter((c) => !INLAYS.has(c.fret));
    expect(inlay.length).toBeGreaterThan(0);
    expect(plain.length).toBeGreaterThan(0);
    expect(new Set(cells.map((c) => c.color)).size, "one colour throughout").toBe(1);
    expect(Math.min(...inlay.map((c) => c.weight)), "an inlay fret keeps its mark by weight").toBeGreaterThan(
      Math.max(...plain.map((c) => c.weight)),
    );
  });
}

test.setTimeout(150_000);

const q = (fret: number, over: Col = {}) => n(fret, { d: "q", ...over });

const tupletOf = (id: string, count: number, d: string): Col[] =>
  Array.from({ length: count }, (_, i) =>
    n(3 + (i % 2), { d, tupletId: id, tupletCount: count, groupKind: "tuplet" }),
  );

/** 128 bars, so the numbers 1, 17 and 128 are all drawn; the first bars hold the numerals and the marks. */
const NUMERAL_COLUMNS: Col[] = [
  ...tupletOf("two", 2, "8"),
  bar(),
  ...tupletOf("three", 3, "8"),
  bar(),
  ...tupletOf("sixteen", 16, "32"),
  bar(),
  n(3, { d: "w" }),
  n(5, { d: "h" }),
  n(3, { d: "q" }),
  n(5, { d: "16" }),
  bar(),
  ...Array.from({ length: 124 }, () => [q(3), bar()]).flat(),
  q(5),
];

const readSizes = (page: Page) =>
  page.evaluate(() => {
    const px = (el: Element) => parseFloat(getComputedStyle(el).fontSize);
    const texts = (sel: string) => [...document.querySelectorAll(sel)].filter((e) => e.textContent);
    const labels = texts(".tab-bracket-label");
    const marks = texts('[data-testid="tab-rhythm"]');
    const bars = texts('[data-testid="tab-bar-number"]');
    const crossed = labels.filter((label) => {
      const row = label.parentElement!;
      const line = row.querySelector(".tab-bracket");
      // The numeral is centred on one column, and only a bracket on that column could cross it.
      return !!line && label.getBoundingClientRect().bottom > line.getBoundingClientRect().top + 0.5;
    });
    const overflowing = marks.filter((m) => {
      const r = document.createRange();
      r.selectNodeContents(m);
      const text = r.getBoundingClientRect();
      const column = m.closest('[data-testid="tab-column"]')!.getBoundingClientRect();
      return text.left < column.left - 0.5 || text.right > column.right + 0.5;
    });
    return {
      numerals: labels.map((e) => e.textContent),
      marks: [...new Set(marks.map((e) => e.textContent))],
      barNumbers: bars.map((e) => e.textContent),
      under12: [...labels, ...marks, ...bars].filter((e) => px(e) < 12).map((e) => `${e.textContent} ${px(e)}`),
      crossed: crossed.map((e) => e.textContent),
      overflowing: overflowing.map((e) => e.textContent),
    };
  });

for (const theme of ["dark", "light"] as const) {
  test(`INV-019 numerals, marks and bar numbers, ${theme}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme });
    const { playUrl } = await seedSong(page, [{ key: "a", label: "A", columns: NUMERAL_COLUMNS }], [{ part: "a" }]);
    await page.goto(playUrl);
    await expect(page.getByTestId("tab-staff").first()).toBeVisible();
    await page.waitForTimeout(250);
    const seen = await readSizes(page);
    for (const numeral of ["2", "3", "16"]) expect(seen.numerals, "numerals drawn").toContain(numeral);
    for (const number of ["1", "17", "128"]) expect(seen.barNumbers, "bar numbers drawn").toContain(number);
    console.log(`marks drawn: ${JSON.stringify(seen.marks)}`);
    expect([...seen.marks].sort(), "all six marks drawn").toEqual(["16", "32", "8", "h", "q", "w"]);
    expect({ under12: seen.under12, crossed: seen.crossed, overflowing: seen.overflowing }).toEqual({
      under12: [],
      crossed: [],
      overflowing: [],
    });
  });
}

test("INV-019 a mark fits the narrowest column without widening it", async ({ page }) => {
  const plain: Col[] = [n(3), n(5), bar(), n(3)];
  const marked: Col[] = [n(3, { d: "32" }), n(5, { d: "16" }), bar(), n(3, { d: "w" })];
  const { songUrl } = await seedSong(
    page,
    [
      { key: "a", label: "A", columns: plain },
      { key: "b", label: "B", columns: marked },
    ],
    [{ part: "a" }, { part: "b" }],
  );
  await page.goto(`${songUrl}/play`);
  await expect(page.getByTestId("tab-staff").nth(1)).toBeVisible();
  await page.waitForTimeout(200);
  const widths = await page.evaluate(() =>
    [...document.querySelectorAll('[data-testid="tab-staff"]')].map((staff) =>
      [...staff.querySelectorAll('[data-testid="tab-column"]')].map((c) => {
        const style = (c as HTMLElement).style.flex;
        return style.split(" ").slice(2).join(" ");
      }),
    ),
  );
  expect(widths[1], "the same basis with and without a mark").toEqual(widths[0]);
});
