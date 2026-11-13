/**
 * Adopted from the round-1 review probe, spec 008 INV-006 member "caret after a ×4 column", which the every-column walk (seeded with repeat 1)
 * does not reach: make a ×4 column at the end of a line, at the head of a line and at the end of the part, on a wrapped
 * band, and check the caret stays on its column's run, at or after the column's right edge, within the run vertically,
 * and is never drawn at the head of the next line.
 */
import { expect, test, type Page } from "@playwright/test";
import { columns } from "./probe-helpers";
import { longPart } from "./polish-review-helpers";

test.setTimeout(120_000);

/** Column indexes at the end of a line, at the head of the next line, and the last column. */
const targets = (page: Page) =>
  columns(page).evaluateAll((els) => {
    const top = (e: Element) => Math.round(e.closest(".tab-bar-run")!.getBoundingClientRect().top);
    const lineEnd = els.findIndex((e, i) => i + 1 < els.length && top(els[i + 1]) !== top(e));
    return { lineEnd, lineHead: lineEnd + 1, last: els.length - 1 };
  });

const caretCheck = (page: Page) =>
  page.evaluate(() => {
    const bad: string[] = [];
    const caret = document.querySelector<HTMLElement>('[data-testid="tab-caret"]');
    const active = document.querySelector<HTMLElement>('[data-testid="tab-column"][aria-current="true"]');
    if (!caret || !active) return ["no caret or no active column"];
    const run = caret.closest(".tab-bar-run");
    if (run !== active.closest(".tab-bar-run")) bad.push("caret not on its column's run (drawn at the head of the next line?)");
    const c = caret.getBoundingClientRect();
    const a = active.getBoundingClientRect();
    if (c.left < a.right - 2) bad.push(`caret left of its column's edge (${c.left.toFixed(1)} < ${a.right.toFixed(1)})`);
    const rr = run?.getBoundingClientRect();
    const bar = caret.querySelector<HTMLElement>(".bg-accent")?.getBoundingClientRect() ?? c;
    if (rr && (bar.top < rr.top - 1 || bar.bottom > rr.bottom + 1)) bad.push("caret outside its run vertically");
    return bad;
  });

test("INV-006 the caret after a ×4 column stays on its column's line", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile", "touch");
  await longPart(page, { chord: true, bracket: true, bars: 16, size: { width: 412, height: 915 } });
  await expect(page.locator(".tab-staff-wrapped")).toHaveCount(1);
  const bad: string[] = [];
  for (const which of ["lineEnd", "lineHead", "last"] as const) {
    const t = await targets(page);
    // ×4 is offered on a note column only; a line may end or start at a barline, so step inward to the nearest note.
    const step = which === "lineHead" ? 1 : -1;
    let i = t[which];
    for (let tries = 0; ; tries++) {
      await columns(page).nth(i).scrollIntoViewIfNeeded({ timeout: 5000 });
      await columns(page).nth(i).click({ timeout: 5000 });
      await page.waitForTimeout(300);
      if ((await page.getByTitle("Four of these").count()) > 0 || tries === 3) break;
      i += step;
    }
    await page.getByTitle("Four of these").click({ timeout: 5000 });
    await page.waitForTimeout(600);
    for (const b of await caretCheck(page)) bad.push(`${which} (column ${i}): ${b}`);
  }
  expect(bad).toEqual([]);
});
