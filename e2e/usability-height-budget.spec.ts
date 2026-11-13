import { addChord, columns, addRests, selectColumns, startWith, TUNINGS, selectionBar, stable, tupletControl } from "./probe-helpers";
import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { startCapturing } from "./capture-surface-helpers";
import { BEFORE_HEIGHTS } from "./usability-helpers";

test.setTimeout(120_000);

/**
 * INV-001 / INV-002: capture's rows hold to the height table (contracts/surfaces.md §6), the root has only the
 * named children, and the band keeps room for the staff. Touch only: the table is the touch column.
 */
const ROOT_CHILDREN = [
  "capture-title-row",
  "tab-band",
  "status-row",
  "toolbar-stable",
  "toolbar-contextual",
  "toolbar-reserved",
];

test("INV-001 rows hold to the height table at 375x667 and the band is at least 189px", async ({ page, isMobile }) => {
  test.skip(!isMobile, "touch projects only");
  await page.setViewportSize({ width: 375, height: 667 });
  await startCapturing(page);

  const h = (id: string) => page.getByTestId(id).evaluate((el) => el.getBoundingClientRect().height);
  expect(await h("capture-title-row")).toBeLessThanOrEqual(45);
  expect(await h("status-row")).toBeLessThanOrEqual(26);
  expect(await h("toolbar-stable")).toBeLessThanOrEqual(46);
  const second = (await page.getByTestId("toolbar-contextual").count()) ? "toolbar-contextual" : "toolbar-reserved";
  expect(await h(second)).toBeLessThanOrEqual(46);
  expect(await h("tab-band")).toBeGreaterThanOrEqual(189);
  expect(await h("fret-grid")).toBeCloseTo(BEFORE_HEIGHTS.neck, 0);
  expect(await h("latch-strip")).toBeCloseTo(BEFORE_HEIGHTS.latchStrip, 0);

  // Adding a row fails: every direct child of the root is named here or is the neck / latch strip / chord form.
  const kids = await page.getByTestId("capture-title-row").evaluate((el) =>
    Array.from(el.parentElement!.children).map((c) => c.getAttribute("data-testid") ?? c.tagName.toLowerCase()),
  );
  // The neck's wrapper is the one child without a test id.
  const named = [...ROOT_CHILDREN, "latch-strip", "fret-grid", "form", "dialog"];
  expect(kids.filter((k) => !named.includes(k)), "unnamed children").toEqual(["div"]);
  expect(kids.length).toBeLessThanOrEqual(8);

  const doc = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
  expect(doc, "page does not scroll").toBeLessThanOrEqual(0);
});

const band = (page: Page) => page.getByTestId("tab-band");

test("INV-001/002 selecting with seven controls keeps every string, 36x36 frets, no page scroll", async ({ page, isMobile }) => {
  test.skip(!isMobile, "touch projects only");
  await page.setViewportSize({ width: 375, height: 667 });
  for (const tuning of TUNINGS) {
    await startWith(page, tuning);
    await addRests(page, 4);
    await selectColumns(page, 0, 1);
    await tupletControl(page).click();
    await selectColumns(page, 0, 3);
    await expect(selectionBar(page).getByRole("button")).toHaveCount(7);
    const m = await page.evaluate(() => {
      // The cursor's line: its caret's run when the band wraps (the last run when none is drawn), the staff when it does not.
      const lineOf = (): Element => {
        const staff = document.querySelector('[data-testid="tab-staff"]')!;
        const runs = [...staff.querySelectorAll(".tab-wrapped-body .tab-bar-run")];
        if (!runs.length) return staff;
        return staff.querySelector('[data-testid="tab-caret"]')?.closest(".tab-bar-run") ?? runs[runs.length - 1];
      };
      const h = (id: string) => document.querySelector(`[data-testid="${id}"]`)!.getBoundingClientRect().height;
      const cell = document.querySelector('[data-testid="fret-grid"] button')!.getBoundingClientRect();
      return {
        sel: h("toolbar-selection"), band: h("tab-band"), cw: cell.width, ch: cell.height,
        over: document.documentElement.scrollHeight - window.innerHeight,
        cells: new Set([...lineOf().querySelectorAll(".tab-cell")].map((c) => Math.round(c.getBoundingClientRect().top))).size,
      };
    });
    expect(m.sel).toBeLessThanOrEqual(46);
    expect(m.band).toBeGreaterThanOrEqual(189);
    expect(m.cw).toBeGreaterThanOrEqual(36);
    expect(m.ch).toBeGreaterThanOrEqual(36);
    expect(m.over).toBeLessThanOrEqual(0);
    expect(m.cells, "no string lost").toBe(tuning.strings);
  }
});

test("INV-003 the band scrolls to both ends and its overflow is reachable", async ({ page, isMobile }) => {
  test.skip(!isMobile, "touch projects only");
  await page.setViewportSize({ width: 375, height: 553 });
  await startWith(page, TUNINGS[1]);
  await addRests(page, 2);
  const r = await band(page).evaluate((el) => {
    const rows = () => new Set([...el.querySelectorAll(".tab-cell")].map((c) => c.getBoundingClientRect())).size;
    const inView = (n: number) => [...el.querySelectorAll(".tab-cell")].filter((c) => {
      const b = c.getBoundingClientRect(), v = el.getBoundingClientRect();
      return b.top >= v.top - 1 && b.bottom <= v.bottom + 1;
    }).length >= n;
    const over = el.scrollHeight - el.clientHeight;
    const seen: boolean[] = [];
    for (const top of [-over, 0]) { el.scrollTop = top; seen.push(inView(1)); }
    const first = el.scrollTop;
    return { over, seen, first, rows: rows() };
  });
  expect(r.seen.every(Boolean)).toBe(true);
  expect(r.over).toBeGreaterThanOrEqual(0);
});

test("INV-004 selecting moves neither the stable row nor the band", async ({ page, isMobile }) => {
  test.skip(!isMobile, "touch projects only");
  await page.setViewportSize({ width: 375, height: 667 });
  await startWith(page, TUNINGS[1]);
  await addRests(page, 3);
  const top = async () => ({ stable: (await stable(page).boundingBox())!.y, band: (await band(page).boundingBox())! });
  const before = await top();
  await selectColumns(page, 0, 2);
  const after = await top();
  expect(after.stable).toBe(before.stable);
  expect(after.band.y).toBe(before.band.y);
  expect(after.band.height).toBe(before.band.height);
});

test("INV-031 the title row carries the back target, parts and sync state", async ({ page, isMobile }) => {
  test.skip(!isMobile, "touch projects only");
  await page.setViewportSize({ width: 375, height: 667 });
  await startWith(page, TUNINGS[0]);
  const row = page.getByTestId("capture-title-row");
  await expect(row.getByRole("button", { name: /^Back to/ })).toBeVisible();
  await expect(row.getByRole("button", { name: "Add a part" })).toBeVisible();
  await expect(row.getByText("all synced")).toHaveCount(0);
});

/** INV-001/002 across cursor positions and a chord + bracket on one column, at every string count. */
for (const tuning of TUNINGS) {
  test(`INV-001/002 ${tuning.family}: start, barline, chord and bracket keep every string and the budget`, async ({ page, isMobile }) => {
    test.skip(!isMobile, "touch projects only");
    await startWith(page, tuning);
    await addRests(page, 4);
    const measure = () =>
      page.evaluate(() => {
        // The cursor's line: its caret's run when the band wraps (the last run when none is drawn), the staff when it does not.
        const lineOf = (): Element => {
          const staff = document.querySelector('[data-testid="tab-staff"]')!;
          const runs = [...staff.querySelectorAll(".tab-wrapped-body .tab-bar-run")];
          if (!runs.length) return staff;
          return staff.querySelector('[data-testid="tab-caret"]')?.closest(".tab-bar-run") ?? runs[runs.length - 1];
        };
        const h = (id: string) => document.querySelector(`[data-testid="${id}"]`)?.getBoundingClientRect().height ?? 0;
        return {
          title: h("capture-title-row"), status: h("status-row"), stable: h("toolbar-stable"), band: h("tab-band"),
          over: document.documentElement.scrollHeight - window.innerHeight,
          cells: new Set([...lineOf().querySelectorAll(".tab-cell")].map((c) => Math.round(c.getBoundingClientRect().top))).size,
        };
      });
    const hold = async (where: string) => {
      const m = await measure();
      expect(m.title, where).toBeLessThanOrEqual(45);
      expect(m.status, where).toBeLessThanOrEqual(26);
      expect(m.stable, where).toBeLessThanOrEqual(46);
      expect(m.band, where).toBeGreaterThanOrEqual(189);
      expect(m.over, `${where}: page does not scroll`).toBeLessThanOrEqual(0);
      expect(m.cells, `${where}: no string lost`).toBe(tuning.strings);
    };

    await hold("mid-part");
    await page.getByTitle("Barline").click();
    await hold("on a barline");
    await columns(page).nth(0).click();
    await page.keyboard.press("Home");
    await hold("at the start");

    await addChord(page, 0, "Am");
    await selectColumns(page, 0, 1);
    await tupletControl(page).click();
    await hold("chord and bracket on one column");
    await selectColumns(page, 0, 3);
    await hold("selecting after chord and bracket");
  });
}
