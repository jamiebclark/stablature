/**
 * INV-021: chord on the arriving column and on the source; connector inside a tuplet, at its
 * first column, just after its last; caret before a connector; barline either side; selection
 * over both sides and the arrival only; the cursor rule across a repeat; a tap on a connector.
 *
 * INV-022: 3 surfaces x 2 themes. The suite's "selected" member taps a column, which moves the
 * cursor and selects nothing, so this one makes a real selection.
 *
 * INV-004's e2e half is here too: every cell in a widened column lines up.
 */
import { expect, test, type Page } from "@playwright/test";
import {
  addChord,
  caret,
  columns,
  connectors,
  fret,
  latch,
  PHONE,
  stable,
  startCapturing,
  storedRows,
  THEMES,
} from "./capture-surface-helpers";

/** 5 h7, three times over a triplet on the A string: 3, h5, h7, then h9 just after it. */
async function tupletPart(page: Page) {
  await startCapturing(page);
  await fret(page, "A", 1).click();
  await latch(page, "hammer-on").click();
  await fret(page, "A", 3).click();
  await latch(page, "hammer-on").click();
  await fret(page, "A", 5).click();
  await latch(page, "hammer-on").click();
  await fret(page, "A", 7).click();
  await expect(columns(page)).toHaveCount(4);
  await columns(page).nth(3).click();
  await page.getByTitle(/triplet/).click();
  await page.getByRole("button", { name: /end/ }).click();
  await latch(page, "hammer-on").click();
  await fret(page, "A", 9).click();
  await expect(columns(page)).toHaveCount(5);
  await expect(connectors(page)).toHaveCount(4);
}

/** The bracket's drawn line, per element in DOM order, or null where none is drawn. */
const brackets = (page: Page) =>
  page.getByTestId("tab-staff").evaluate((staff) =>
    [...staff.querySelectorAll('[data-testid="tab-column"], [data-testid="tab-connector"]')].map((el) => {
      const line = el.querySelector(".absolute.border-t") as HTMLElement | null;
      if (!line) return { kind: el.getAttribute("data-testid"), line: null };
      const r = line.getBoundingClientRect();
      return { kind: el.getAttribute("data-testid"), line: { left: r.left, right: r.right, top: r.top } };
    }),
  );

test("the bracket runs unbroken across a connector inside it, and not outside it", async ({ page }) => {
  await tupletPart(page);
  const parts = await brackets(page);
  // col0, gap, col1, gap, col2, gap, col3, gap, col4 with the triplet over cols 1, 2, 3.
  expect(parts.map((p) => p.kind)).toEqual([
    "tab-column",
    "tab-connector",
    "tab-column",
    "tab-connector",
    "tab-column",
    "tab-connector",
    "tab-column",
    "tab-connector",
    "tab-column",
  ]);
  expect(parts.map((p) => p.line !== null)).toEqual([
    false, // the column before the triplet
    false, // connector at the triplet's first column
    true,
    true, // inside
    true,
    true, // inside
    true,
    false, // connector just after its last column
    false,
  ]);
  const run = parts.slice(2, 7).map((p) => p.line!);
  for (let i = 1; i < run.length; i += 1) {
    expect(Math.abs(run[i].left - run[i - 1].right), `gap in the bracket at ${i}`).toBeLessThan(0.51);
    expect(run[i].top).toBeCloseTo(run[i - 1].top, 1);
  }
});

test("chord symbols stay over their columns, on the arrival and on the source", async ({ page }) => {
  await startCapturing(page);
  await fret(page, "A", 5).click();
  await latch(page, "hammer-on").click();
  await fret(page, "A", 7).click();
  await expect(connectors(page)).toHaveCount(1);
  await addChord(page, 0, "Am");
  await addChord(page, 1, "C");
  for (const [i, name] of [[0, "Am"], [1, "C"]] as const) {
    const col = (await columns(page).nth(i).boundingBox())!;
    const chord = (await page.getByTestId("tab-staff").getByText(name, { exact: true }).boundingBox())!;
    expect(chord.x).toBeCloseTo(col.x, 0);
    expect(chord.y).toBeLessThan((await connectors(page).first().locator(".tab-cell").first().boundingBox())!.y);
  }
  // The gap's own rows line up with the columns' rows, string by string, under a chord row.
  const rows = async (loc: ReturnType<Page["locator"]>) =>
    loc.locator(".tab-cell").evaluateAll((els) => els.map((e) => e.getBoundingClientRect().top));
  expect(await rows(connectors(page).first())).toEqual(await rows(columns(page).first()));
});

test("the caret precedes the connector, and the next note goes in before it", async ({ page }) => {
  await startCapturing(page);
  await fret(page, "A", 5).click();
  await latch(page, "hammer-on").click();
  await fret(page, "A", 7).click();
  await columns(page).first().click();
  const order = await page.getByTestId("tab-staff").evaluate((staff) =>
    [...staff.querySelectorAll("[data-testid]")]
      .map((e) => e.getAttribute("data-testid"))
      .filter((id) => /tab-(column|connector|caret)/.test(id ?? "")),
  );
  expect(order).toEqual(["tab-column", "tab-caret", "tab-connector", "tab-column"]);
});

test("a barline either side of a connector is drawn as before", async ({ page }) => {
  await startCapturing(page);
  await fret(page, "A", 5).click();
  await page.getByTitle("Barline").click();
  await latch(page, "slide up").click();
  await fret(page, "A", 7).click();
  await latch(page, "hammer-on").click();
  await fret(page, "A", 9).click();
  await page.getByTitle("Barline").click();
  await expect(columns(page)).toHaveCount(5);
  await expect(connectors(page)).toHaveCount(2);
  const order = await page.getByTestId("tab-staff").evaluate((staff) =>
    [...staff.querySelectorAll('[data-testid="tab-column"], [data-testid="tab-connector"]')].map((e) =>
      e.getAttribute("data-barline") ? "bar" : e.getAttribute("data-testid") === "tab-connector" ? "gap" : "col",
    ),
  );
  expect(order).toEqual(["col", "bar", "gap", "col", "gap", "col", "bar"]);
  const bars = await page
    .locator('[data-barline="true"] .tab-barline')
    .evaluateAll((els) => els.map((e) => getComputedStyle(e, "::after").borderLeftWidth));
  expect(bars).toEqual(["1px", "1px"]);
});

test("selection: over both sides, and over the arrival only", async ({ page }) => {
  await startCapturing(page);
  await fret(page, "A", 5).click();
  await latch(page, "hammer-on").click();
  await fret(page, "A", 7).click();
  await fret(page, "A", 9).click();
  await expect(columns(page)).toHaveCount(3);
  const gap = connectors(page).first();
  const selected = () => gap.evaluate((e) => e.classList.contains("tab-column-selected"));

  await columns(page).nth(1).click();
  await stable(page).getByRole("button", { name: /select/ }).click();
  await expect(page.getByText("1 selected")).toBeVisible();
  expect(await selected(), "arrival only").toBe(true);
  await page.getByRole("button", { name: "cancel" }).click();

  await columns(page).nth(0).click();
  await stable(page).getByRole("button", { name: /select/ }).click();
  await expect(page.getByText("1 selected")).toBeVisible();
  expect(await selected(), "source only").toBe(false);
  await columns(page).nth(1).click();
  await expect(page.getByText("2 selected")).toBeVisible();
  expect(await selected(), "both sides").toBe(true);
});

test("the cursor rule spans a repeat, and stops at the gap before it", async ({ page }) => {
  await startCapturing(page);
  await fret(page, "A", 5).click();
  await latch(page, "hammer-on").click();
  await fret(page, "A", 7).click();
  await page.getByRole("button", { name: "Repeat one more time" }).click();
  await page.getByRole("button", { name: "Repeat one more time" }).click();
  await expect(columns(page)).toHaveCount(4);
  await expect(connectors(page)).toHaveCount(3);
  await columns(page).nth(1).click();
  const active = await connectors(page).evaluateAll((els) =>
    els.map((e) => e.classList.contains("tab-column-active")),
  );
  expect(active).toEqual([false, true, true]);
});

test("a tap on a connector moves nothing, and it is no control", async ({ page }) => {
  await startCapturing(page);
  await fret(page, "A", 5).click();
  await latch(page, "hammer-on").click();
  await fret(page, "A", 7).click();
  await columns(page).first().click();
  const gap = connectors(page).first();
  const b = (await gap.boundingBox())!;
  const caretBefore = await caret(page).boundingBox();
  const rows = await storedRows(page);
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
  expect(await caret(page).boundingBox()).toEqual(caretBefore);
  expect(await storedRows(page)).toEqual(rows);
  expect(await gap.evaluate((e) => (e as HTMLElement).tabIndex)).toBe(-1);
  await expect(page.getByTestId("tab-column")).toHaveCount(2);
});

test("INV-004 every cell in a widened column lines up, and rows stay aligned", async ({ page }) => {
  await startCapturing(page);
  await fret(page, "A", 12).click();
  await latch(page, "stack notes onto the marked column").click();
  await fret(page, "E", 5).click();
  await latch(page, "stack notes onto the marked column").click();
  await latch(page, "hammer-on").click();
  await fret(page, "E", 7).click();
  await expect(connectors(page)).toHaveCount(1);
  const col = columns(page).first();
  const cells = await col.locator(".tab-cell").evaluateAll((els) =>
    els.map((e) => {
      const r = e.getBoundingClientRect();
      return { left: r.left, width: r.width };
    }),
  );
  expect(new Set(cells.map((c) => c.left)).size).toBe(1);
  expect(new Set(cells.map((c) => c.width)).size).toBe(1);
  const gapCells = await connectors(page).first().locator(".tab-cell").count();
  expect(gapCells).toBe(cells.length);
});

for (const theme of THEMES) {
  test(`INV-022 base, raised and selected, ${theme}`, async ({ page }) => {
    await page.setViewportSize(PHONE);
    await page.emulateMedia({ colorScheme: theme });
    const { songUrl } = await startCapturing(page);
    await fret(page, "A", 5).click();
    await latch(page, "slide down").click();
    await fret(page, "A", 7).click();
    await expect(connectors(page)).toHaveCount(1);

    const read = () =>
      page.getByTestId("tab-staff").evaluate((staff) => {
        const bg = (el: Element) => getComputedStyle(el).backgroundColor;
        const glyph = staff.querySelector('[data-testid="tab-connector"] .tab-cell > span')!;
        const columnsEls = [...staff.querySelectorAll('[data-testid="tab-column"]')];
        const arrival = columnsEls[1].querySelector(".tab-cell > span")!;
        return { glyph: bg(glyph), fret: bg(arrival), font: getComputedStyle(glyph).fontWeight };
      });
    const opaque = (c: string) => !/transparent/.test(c) && !/, 0\)$/.test(c) && !/\/ 0\)$/.test(c);

    const base = await read();
    expect(base.glyph).toBe(base.fret);
    expect(opaque(base.glyph), base.glyph).toBe(true);

    await columns(page).nth(1).click();
    await stable(page).getByRole("button", { name: /select/ }).click();
    await expect(page.getByText("1 selected")).toBeVisible();
    const selected = await read();
    expect(selected.glyph).toBe(selected.fret);
    expect(selected.glyph, "the selection repaints the mask").not.toBe(base.glyph);
    expect(opaque(selected.glyph), selected.glyph).toBe(true);
    await page.getByRole("button", { name: "cancel" }).click();

    await page.goto(songUrl);
    await expect(connectors(page)).toHaveCount(1);
    const raised = await read();
    expect(raised.glyph).toBe(raised.fret);
    expect(opaque(raised.glyph), raised.glyph).toBe(true);
    console.log(`MEASURE ${theme} ${JSON.stringify({ base, selected, raised })}`);
  });
}
