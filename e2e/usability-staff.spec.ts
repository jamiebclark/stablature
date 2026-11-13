import { addRests, selectColumns, startWith, TUNINGS, tupletControl } from "./probe-helpers";
import { expect, test } from "@playwright/test";
import { bar, choose, n, seedSong, VIEWS, type PartSpec } from "./reading-helpers";

test.setTimeout(120_000);

/**
 * INV-015: Copy text with a wide chord over a narrow column equals the text from before the usability pass.
 * Widening a column is screen-side only; the export never sees it. EXPECTED was read from the unedited tree
 * (T001) and written out by hand here, so a change to the export or the layout fails it.
 */
const PART: PartSpec[] = [
  { key: "a", label: "A", columns: [n(3, { chord: "Cmaj7add9/B" }), n(5), bar(), n(7, { chord: "Em" })] },
];

test("INV-015 Copy text is the same fixture on every view and density, however wide the chord", async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __copied: string[] };
    w.__copied = [];
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: async (text: string) => void w.__copied.push(text) },
      configurable: true,
    });
  });
  await seedSong(page, PART, [{ part: "a" }]);
  for (const density of ["expanded", "compact"] as const) {
    await page.getByRole("button", { name: density, exact: true }).click();
    for (const view of VIEWS) {
      await choose(page, view);
      await page.evaluate(() => ((window as unknown as { __copied: string[] }).__copied.length = 0));
      await page.getByRole("button", { name: /^(Copy text|Copied)$/ }).click();
      await expect
        .poll(() => page.evaluate(() => (window as unknown as { __copied: string[] }).__copied.length))
        .toBe(1);
      const text = await page.evaluate(() => (window as unknown as { __copied: string[] }).__copied[0]);
      expect(text, `${density} ${view}`).toBe(EXPECTED[density]);
    }
  }
});

const HEAD = "Dirge\nB Standard (Bass 5) (G2 D2 A1 E1 B0)\n";
const STAFF = "    Cmaj7aEm\nG |-----|---|\nD |-----|---|\nA |-3-5-|-7-|\nE |-----|---|\nB |-----|---|\n";
const EXPECTED: Record<"expanded" | "compact", string> = {
  expanded: HEAD + "\nArrangement\n  A\n\nA\n" + STAFF,
  compact: HEAD + "\nArrangement\n  A\n\nA\n" + STAFF,
};

test("INV-005 a new bracket is scrolled into the band and strip", async ({ page, isMobile }) => {
  test.skip(!isMobile, "touch projects only");
  await page.setViewportSize({ width: 375, height: 553 });
  await startWith(page, TUNINGS[2]);
  await addRests(page, 12);
  await selectColumns(page, 0, 1);
  await tupletControl(page).click();
  const inside = await page.getByTestId("tab-bracket").first().evaluate((el) => {
    const b = el.getBoundingClientRect();
    const view = (s: Element | null) => {
      while (s && !/(auto|scroll)/.test(getComputedStyle(s).overflowX + getComputedStyle(s).overflowY)) s = s.parentElement;
      return s ? s.getBoundingClientRect() : null;
    };
    const v = view(el.parentElement)!;
    return b.left >= v.left - 1 && b.right <= v.right + 1 && b.top >= v.top - 1 && b.bottom <= v.bottom + 1;
  });
  expect(inside).toBe(true);
});

test("INV-022 the status row fits at 375 with both jump buttons", async ({ page, isMobile }) => {
  test.skip(!isMobile, "touch projects only");
  await page.setViewportSize({ width: 375, height: 667 });
  await startWith(page, TUNINGS[0]);
  await addRests(page, 3);
  const r = await page.getByTestId("status-row").evaluate((el) => ({
    fit: el.scrollWidth <= el.clientWidth,
    buttons: [...el.querySelectorAll("button")].map((b) => { const x = b as HTMLElement; return [x.offsetWidth, x.offsetHeight, b.textContent + " rect " + b.getBoundingClientRect().width]; }),
  }));
  expect(r.fit).toBe(true);
  for (const [w, h, t] of r.buttons) { expect(w, String(t)).toBeGreaterThanOrEqual(44); expect(h).toBeGreaterThanOrEqual(24); }
});

/**
 * INV-016: a chord symbol is drawn whole. Its glyph box is not ellipsised, ends at least 2px before the next
 * symbol, and stays inside the staff's scrolled width. Measured on the glyph range, not the column.
 */
const SYMBOLS = ["Em7", "Cmaj7", "F#m7b5", "Cmaj7add9/B", "Cmaj7add9/B(#11)(b13)Cmaj7add9/B"];
const SHAPES: { name: string; columns: PartSpec["columns"] }[] = [
  { name: "one-digit", columns: [n(3, { chord: "@" }), n(5), bar(), n(7)] },
  { name: "two-digit", columns: [n(12, { chord: "@" }), n(14), bar(), n(7)] },
  { name: "adjacent", columns: [n(3, { chord: "@" }), n(5, { chord: "Em" }), n(7, { chord: "@" }), bar()] },
  { name: "last column", columns: [n(3), n(5), bar(), n(7, { chord: "@" })] },
  { name: "before a barline", columns: [n(3), n(5, { chord: "@" }), bar(), n(7, { chord: "Em" })] },
  { name: "on a repeat", columns: [n(3, { chord: "@", repeat: 3 }), n(5, { chord: "Em" })] },
  { name: "carried", columns: [n(3, { chord: "@" }), n(5), n(7), bar(), n(2)] },
];

const MEASURE_LABELS = () => {
  const staff = document.querySelector('[data-testid="tab-staff"]')!;
  const scroller = staff.querySelector('[role="group"]') as HTMLElement;
  const origin = scroller.getBoundingClientRect().left - scroller.scrollLeft;
  const labels = [...staff.querySelectorAll('[data-testid="tab-column"] > div.text-accent')].filter(
    (d) => d.textContent,
  );
  return {
    contentWidth: scroller.scrollWidth,
    labels: labels.map((d) => {
      const range = document.createRange();
      range.selectNodeContents(d);
      const r = range.getBoundingClientRect();
      return {
        text: d.textContent!,
        left: r.left - origin,
        right: r.right - origin,
        ellipsis: getComputedStyle(d).textOverflow === "ellipsis",
        clipped: getComputedStyle(d).overflow !== "visible",
      };
    }),
  };
};

for (const symbol of SYMBOLS) {
  test(`INV-016 ${symbol.slice(0, 12)} is drawn whole on every shape`, async ({ page }) => {
    for (const shape of SHAPES) {
      const columns = shape.columns.map((c) => (c.chord === "@" ? { ...c, chord: symbol } : c));
      await seedSong(page, [{ key: "a", label: "A", columns }], [{ part: "a" }]);
      const { contentWidth, labels } = await page.evaluate(MEASURE_LABELS);
      expect(labels.length, shape.name).toBeGreaterThan(0);
      labels.forEach((label, i) => {
        expect(label.ellipsis || label.clipped, `${shape.name}: ${label.text} clipped`).toBe(false);
        expect(label.right, `${shape.name}: ${label.text} past the staff`).toBeLessThanOrEqual(contentWidth + 0.5);
        const next = labels[i + 1];
        if (next) expect(next.left - label.right, `${shape.name}: ${label.text} against ${next.text}`).toBeGreaterThanOrEqual(2);
      });
    }
  });
}

/**
 * INV-017: every row's item sits on its own column's x. Rows are blocks the column's width, and a rhythm mark
 * or a bracket numeral is centred on that.
 */
test("INV-017 rows and marks sit on their column's centre", async ({ page }) => {
  const columns: PartSpec["columns"] = [
    n(3, { d: "32", chord: "Em7" }),
    n(12, { d: "16" }),
    n(5, { d: "q", tupletId: "t", tupletCount: 3, groupKind: "tuplet" }),
    n(7, { d: "8", tupletId: "t", tupletCount: 3, groupKind: "tuplet" }),
    n(9, { d: "8", tupletId: "t", tupletCount: 3, groupKind: "tuplet" }),
    bar(),
    n(2, { d: "h" }),
  ];
  await seedSong(page, [{ key: "a", label: "A", columns }], [{ part: "a" }]);
  const off = await page.evaluate(() => {
    const out: string[] = [];
    const centre = (el: Element) => {
      const range = document.createRange();
      range.selectNodeContents(el);
      const r = range.getBoundingClientRect();
      return (r.left + r.right) / 2;
    };
    for (const column of document.querySelectorAll('[data-testid="tab-staff"] [data-testid="tab-column"]')) {
      const box = column.getBoundingClientRect();
      for (const row of column.children) {
        const r = row.getBoundingClientRect();
        if (Math.abs(r.left - box.left) > 1 || Math.abs(r.width - box.width) > 1) out.push(`row ${row.className}`);
      }
      const mid = (box.left + box.right) / 2;
      for (const sel of ['[data-testid="tab-rhythm"]', ".tab-bracket-label"]) {
        const el = column.querySelector(sel);
        if (el?.textContent && Math.abs(centre(el) - mid) > 1) out.push(`${sel} off by ${centre(el) - mid}`);
      }
      // The mark is drawn, not typed: its stem, rest or oval is the thing that sits on the column's middle.
      const body = column.querySelector('[data-testid="tab-rhythm"] [data-part="stem"], [data-testid="tab-rhythm"] [data-part="rest"], [data-testid="tab-rhythm"] [data-part="oval"]');
      if (body) {
        const q = body.getBoundingClientRect();
        if (Math.abs((q.left + q.right) / 2 - mid) > 1) out.push(`${body.getAttribute("data-part")} off by ${(q.left + q.right) / 2 - mid}`);
      }
    }
    return out;
  });
  expect(off).toEqual([]);
});
