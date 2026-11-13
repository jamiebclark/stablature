/**
 * Review probe, spec 008 INV-005 and INV-006 over the plan's sets.
 * INV-005: map every column to its line; move the cursor to EVERY column, to the start and the end, start and extend
 * a selection across lines, long press; the map never changes. On **Wr** and on the wide-bar **Shape**.
 * INV-006: after each of those moves, the caret's run is its column's run (the first run at the start), the caret sits
 * at its column's right edge, and every chord label, bracket and column sits inside its own run. Over every **Rows**
 * member that wraps at 412×915 (seven strings does not wrap there; see INV-002).
 * The implementation's spec samples four columns of one row shape.
 */
import { expect, test, type Page } from "@playwright/test";
import { columns, touchHold, TUNINGS } from "../../../e2e/probe-helpers";
import { longPart, seedBars, SIX, type Tuning } from "./helpers";

test.setTimeout(600_000);

const lineMap = (page: Page) =>
  page.evaluate(() => {
    const lines = document.querySelector(".tab-lines")!.getBoundingClientRect().top;
    return Object.fromEntries(
      [...document.querySelectorAll<HTMLElement>('[data-testid="tab-column"]')].map((c, i) => [i, Math.round(c.closest(".tab-bar-run")!.getBoundingClientRect().top - lines)]),
    );
  });

const alignment = (page: Page) =>
  page.evaluate(() => {
    const band = document.querySelector<HTMLElement>('[data-testid="tab-band"]')!;
    const bad: string[] = [];
    const runOf = (el: Element) => el.closest(".tab-bar-run");
    const caret = band.querySelector<HTMLElement>('[data-testid="tab-caret"]');
    const active = band.querySelector<HTMLElement>('[data-testid="tab-column"][aria-current="true"]');
    if (caret) {
      if (active) {
        if (runOf(caret) !== runOf(active)) bad.push("caret not in its column's run");
        const c = caret.getBoundingClientRect();
        const a = active.getBoundingClientRect();
        // The caret is drawn after the last of a repeated column's copies, so it is at or after the active column.
        if (c.left < a.right - 2) bad.push(`caret left of its column's edge (${c.left.toFixed(1)} < ${a.right.toFixed(1)})`);
      } else if (runOf(caret) !== band.querySelector(".tab-bar-run")) bad.push("start caret not in the first run");
      const run = runOf(caret)!.getBoundingClientRect();
      const bar = caret.querySelector<HTMLElement>(".bg-accent")?.getBoundingClientRect();
      if (bar && (bar.top < run.top - 1 || bar.bottom > run.bottom + 1)) bad.push("caret bar outside its run vertically");
    }
    for (const sel of ['[data-testid="tab-bracket"]', '[data-testid="tab-column"] > div.text-accent', '[data-testid="tab-column"]']) {
      for (const el of band.querySelectorAll<HTMLElement>(sel)) {
        const run = runOf(el);
        if (!run) {
          bad.push(`${sel} outside any run`);
          continue;
        }
        const r = el.getBoundingClientRect();
        const rr = run.getBoundingClientRect();
        if (r.top < rr.top - 1 || r.bottom > rr.bottom + 1) bad.push(`${sel} outside its run vertically`);
      }
    }
    return bad;
  });

async function walkEveryColumn(page: Page, label: string, bad: string[]) {
  const base = await lineMap(page);
  const total = Object.keys(base).length;
  const check = async (what: string) => {
    const now = await lineMap(page);
    if (JSON.stringify(now) !== JSON.stringify(base)) bad.push(`${label}: lines moved after ${what}`);
    for (const a of await alignment(page)) bad.push(`${label}: ${a} after ${what}`);
  };
  for (let i = 0; i < total; i++) {
    await columns(page).nth(i).click();
    await check(`a tap on column ${i}`);
  }
  await page.getByTestId("status-row").getByRole("button", { name: "⇤ start" }).click();
  await page.waitForTimeout(300);
  await check("the start jump");
  await page.getByTestId("status-row").getByRole("button", { name: "end ⇥" }).click();
  await page.waitForTimeout(300);
  await check("the end jump");
  await columns(page).nth(1).click();
  await page.getByRole("button", { name: /^select$/ }).click();
  await columns(page).nth(total - 2).click();
  await check("a selection extended across lines");
  await page.getByTestId("toolbar-selection").getByRole("button", { name: "cancel" }).click();
  await touchHold(page, columns(page).nth(Math.floor(total / 2))).catch(() => undefined);
  await check("a long press");
  await page.keyboard.press("Escape");
}

const ROWS: { label: string; tuning: Tuning; chord: boolean; bracket: boolean }[] = [
  { label: "6 plain", tuning: SIX, chord: false, bracket: false },
  { label: "6 + chord", tuning: SIX, chord: true, bracket: false },
  { label: "6 + chord + bracket", tuning: SIX, chord: true, bracket: true },
  { label: "4 + chord + bracket", tuning: TUNINGS[0], chord: true, bracket: true },
  { label: "5 + chord + bracket", tuning: TUNINGS[1], chord: true, bracket: true },
];

for (const row of ROWS) {
  test(`INV-005/006 every column, ${row.label}, 412x915`, async ({ page }, info) => {
    test.skip(info.project.name !== "mobile", "touch");
    await longPart(page, { tuning: row.tuning, chord: row.chord, bracket: row.bracket, bars: 16, size: { width: 412, height: 915 } });
    await expect(page.locator(".tab-staff-wrapped")).toHaveCount(1);
    const bad: string[] = [];
    await walkEveryColumn(page, row.label, bad);
    expect(bad).toEqual([]);
  });
}

test("INV-005/006 every column, 6 + chord + bracket, 1280x800", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "fine");
  await longPart(page, { chord: true, bracket: true, bars: 40, size: { width: 1280, height: 800 } });
  await expect(page.locator(".tab-staff-wrapped")).toHaveCount(1);
  const bad: string[] = [];
  await walkEveryColumn(page, "1280", bad);
  expect(bad).toEqual([]);
});

test("INV-005/006 a bar wider than the band takes its own line and scrolls alone", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile", "touch");
  // Three bars: short, one of 60 notes (wider than 412), short.
  await longPart(page, { chord: true, bracket: true, bars: 2, perBar: 3, size: { width: 412, height: 915 } });
  const partId = page.url().split("/").pop()!;
  await seedBars(page, partId, SIX.strings, 1, 60);
  await seedBars(page, partId, SIX.strings, 3, 3);
  await page.reload();
  await page.waitForTimeout(700);
  await expect(page.locator(".tab-staff-wrapped")).toHaveCount(1);
  const wide = await page.evaluate(() => {
    const runs = [...document.querySelectorAll<HTMLElement>(".tab-bar-run")];
    const r = runs.find((x) => x.scrollWidth > x.clientWidth + 2);
    if (!r) return null;
    const top = Math.round(r.getBoundingClientRect().top);
    return { alone: runs.filter((x) => Math.round(x.getBoundingClientRect().top) === top).length === 1 };
  });
  expect(wide, "a run that scrolls sideways").not.toBeNull();
  expect(wide!.alone, "the wide bar has its line to itself").toBe(true);
  const bad: string[] = [];
  await walkEveryColumn(page, "wide bar", bad);
  // followTail and keepCaretInView keep the cursor's column in view on the wide line.
  const caretSeen = async () =>
    page.evaluate(() => {
      const c = document.querySelector('[data-testid="tab-caret"]')!.getBoundingClientRect();
      const run = document.querySelector('[data-testid="tab-caret"]')!.closest(".tab-bar-run")!.getBoundingClientRect();
      return c.left >= run.left - 2 && c.right <= run.right + 2;
    });
  const wideIndex = await columns(page).evaluateAll((els) => els.findIndex((e) => { const r = e.closest(".tab-bar-run") as HTMLElement; return r.scrollWidth > r.clientWidth + 2; }));
  await columns(page).nth(wideIndex + 2).click();
  for (let i = 0; i < 40; i++) {
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.keyboard.press("ArrowRight");
  }
  await page.waitForTimeout(400);
  if (!(await caretSeen())) bad.push("keepCaretInView: after 40 ArrowRight on the wide bar the caret is out of its run's view");
  expect(bad).toEqual([]);
});
