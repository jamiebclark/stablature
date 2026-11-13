/**
 * Review probe, spec 008 INV-004: nothing in plan.md **Still** moves the band, on a wrapped band.
 *
 * Part 1 (timing): useCaptureBand treats any cursor or content change within DELIVERY_MS (400ms) of a bump as the
 * bump's delivery. So a tap on a column that comes soon after a write, a key or a jump is anchored, and the band moves
 * under the finger. Each case taps a column on the top line in view ~200ms after a trigger, and again ~900ms after
 * (the control), and reports how far the tapped column moved.
 *
 * Part 2 (members the implementation's spec does not cover): group from a selection, ungroup, copy, a latch toggle,
 * the help overlay, an inspector write; each with the top line and the bottom line in view.
 */
import { expect, test, type Page } from "@playwright/test";
import { columns, touchHold } from "../../../e2e/probe-helpers";
import { blur, longPart } from "./helpers";

test.setTimeout(600_000);

const SIZE = { width: 412, height: 915 };
const fretButton = (page: Page) => page.locator('button[aria-label*=" string, fret 3,"]').first();
const jump = (page: Page, which: "start" | "end") =>
  page.getByTestId("status-row").getByRole("button", { name: which === "start" ? "⇤ start" : "end ⇥" });

/** The index and centre of a column on the top (or bottom) line wholly in view. */
const pickColumn = (page: Page, where: "top" | "bottom") =>
  columns(page).evaluateAll((els, where) => {
    const band = document.querySelector('[data-testid="tab-band"]')!.getBoundingClientRect();
    const seen = els
      .map((e, i) => ({ i, r: e.getBoundingClientRect() }))
      .filter(({ r }) => r.top >= band.top - 0.5 && r.bottom <= band.bottom + 0.5 && r.left >= band.left && r.right <= band.right);
    const tops = [...new Set(seen.map((s) => Math.round(s.r.top)))].sort((a, b) => a - b);
    const top = where === "top" ? tops[0] : tops[tops.length - 1];
    const pick = seen.filter((s) => Math.round(s.r.top) === top)[1] ?? seen.find((s) => Math.round(s.r.top) === top)!;
    return { i: pick.i, x: pick.r.left + pick.r.width / 2, y: pick.r.top + pick.r.height / 2, top: pick.r.top };
  }, where);

const columnTop = (page: Page, i: number) => columns(page).nth(i).evaluate((e) => e.getBoundingClientRect().top);
const scrollTop = (page: Page) => page.evaluate(() => document.querySelector<HTMLElement>('[data-testid="tab-band"]')!.scrollTop);

const TRIGGERS: [string, (p: Page) => Promise<void>][] = [
  ["a fret tap", (p) => fretButton(p).click()],
  ["the end jump", (p) => jump(p, "end").click()],
  ["ArrowLeft", async (p) => { await blur(p); await p.keyboard.press("ArrowLeft"); }],
];

test("INV-004 a tap soon after a trigger does not move the band under the finger", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile", "touch");
  await longPart(page, { chord: true, bracket: true, bars: 16, size: SIZE });
  const moved: string[] = [];
  const report: string[] = [];
  for (const [name, trigger] of TRIGGERS) {
    for (const delay of [150, 900]) {
      await jump(page, "end").click();
      await page.waitForTimeout(800);
      await trigger(page);
      await page.waitForTimeout(delay);
      const target = await pickColumn(page, "top");
      const before = { top: target.top, scroll: await scrollTop(page) };
      const t0 = Date.now();
      await page.touchscreen.tap(target.x, target.y);
      const gap = Date.now() - t0;
      await page.waitForTimeout(700);
      const after = { top: await columnTop(page, target.i), scroll: await scrollTop(page) };
      const line = `${name}, then a tap on the top line ${delay}ms later (tap took ${gap}ms): column moved ${(after.top - before.top).toFixed(1)}px, scrollTop ${before.scroll} -> ${after.scroll}`;
      report.push(line);
      if (Math.abs(after.top - before.top) > 1) moved.push(line);
    }
  }
  for (const r of report) console.log(`  ${r}`);
  expect(moved).toEqual([]);
});

test("INV-004 stills the implementation's spec does not cover", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile", "touch");
  // A bracket already in the part, so grouping or ungrouping a run adds or removes no row (that would reflow every line).
  await longPart(page, { chord: true, bracket: true, bars: 16, size: SIZE });
  const moved: string[] = [];
  const state = () =>
    page.evaluate(() => {
      const band = document.querySelector<HTMLElement>('[data-testid="tab-band"]')!;
      return { scroll: band.scrollTop, tops: [...band.querySelectorAll(".tab-bar-run")].map((r) => r.getBoundingClientRect().top) };
    });
  const same = (a: { scroll: number; tops: number[] }, b: { scroll: number; tops: number[] }) =>
    Math.abs(a.scroll - b.scroll) <= 1 && a.tops.length === b.tops.length && a.tops.every((t, i) => Math.abs(t - b.tops[i]) <= 1);
  const STILLS: [string, (p: Page, i: number) => Promise<void>][] = [
    ["copy", async (p, i) => { await columns(p).nth(i).click(); await p.getByRole("button", { name: /^select$/ }).click(); await columns(p).nth(i + 1).click(); await p.getByTestId("toolbar-selection").getByTitle("Copy").click(); }],
    ["group from a selection", async (p, i) => { await columns(p).nth(i).click(); await p.getByRole("button", { name: /^select$/ }).click(); await columns(p).nth(i + 1).click(); await p.getByTestId("toolbar-selection").getByRole("button", { name: "Group with no number", exact: true }).click(); }],
    ["ungroup", async (p, i) => { await columns(p).nth(i).click(); await p.getByRole("button", { name: /^select$/ }).click(); await columns(p).nth(i + 1).click(); await p.getByTestId("toolbar-selection").getByRole("button", { name: "Ungroup", exact: true }).click(); }],
    ["a latch toggle", async (p) => { await p.getByTestId("latch-strip").getByRole("button").first().click(); }],
    ["the help overlay", async (p) => { await blur(p); await p.keyboard.press("?"); await p.waitForTimeout(300); await p.keyboard.press("Escape"); }],
    ["an inspector write", async (p, i) => { await touchHold(p, columns(p).nth(i)); await p.getByTestId("column-inspector").getByRole("button", { name: /dead|ghost|x/i }).first().click(); await p.keyboard.press("Escape"); }],
  ];
  for (const [name, still] of STILLS) {
    for (const where of ["top", "bottom"] as const) {
      await page.getByTestId("toolbar-selection").getByRole("button", { name: "cancel" }).click({ timeout: 300 }).catch(() => undefined);
      await page.waitForTimeout(800);
      const target = await pickColumn(page, where);
      // Settle any tap used to reach the column, then measure across the still alone.
      await columns(page).nth(target.i).click();
      await page.waitForTimeout(800);
      const before = await state();
      try {
        await still(page, target.i);
      } catch (error) {
        moved.push(`${name} (${where}): could not run: ${String(error).split("\n")[0].slice(0, 120)}`);
        continue;
      }
      await page.waitForTimeout(800);
      const after = await state();
      if (!same(before, after)) moved.push(`${name} (${where} line): scrollTop ${before.scroll} -> ${after.scroll}`);
    }
  }
  for (const m of moved) console.log(`  MOVED ${m}`);
  expect(moved).toEqual([]);
});
