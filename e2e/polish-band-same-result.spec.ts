/**
 * Adopted from the round-1 review probe, spec 008 INV-007: one scripted sequence gives the same stored result, inspector titles and selection
 * counts on a one-line staff (375×667) and a wrapped one (412×915). Unlike the implementation's spec, no step may
 * fail silently: every control is awaited without a catch, so a step that did not run fails the probe.
 * The sequence covers tap-select, extend across a line, a tuplet and a plain group (bracket in view after), ungroup,
 * long-press on the first and the last line, and each key of **Trig**.
 */
import { expect, test, type Browser, type Page } from "@playwright/test";
import { columns, touchHold } from "./probe-helpers";
import { idb } from "./reading-helpers";
import { blur, longPart } from "./polish-review-helpers";

test.setTimeout(400_000);

const sel = (p: Page) => p.getByTestId("toolbar-selection");
const key = async (p: Page, k: string) => {
  await blur(p);
  await p.keyboard.press(k);
  await p.waitForTimeout(150);
};

async function script(page: Page, partId: string) {
  const out: Record<string, unknown> = {};
  // A tuplet over a run that crosses a line when wrapped: columns 2..8 hold a barline, so pick within one bar first.
  await columns(page).nth(5).click();
  await page.getByRole("button", { name: /^select$/ }).click();
  await columns(page).nth(7).click();
  out.selectedOneBar = await page.locator('[data-testid="tab-column"][data-selected="true"]').count();
  await sel(page).getByRole("button", { name: /^Make a tuplet of \d+$/ }).click();
  await page.waitForTimeout(400);
  out.bracketInView = await page.evaluate(() => {
    const band = document.querySelector('[data-testid="tab-band"]')!.getBoundingClientRect();
    const b = [...document.querySelectorAll('[data-testid="tab-bracket"][data-start]')].map((x) => x.getBoundingClientRect());
    return b.some((r) => r.top >= band.top - 1 && r.bottom <= band.bottom + 1);
  });
  // Extend across lines (in the wrapped run), then ungroup what the range holds.
  await columns(page).nth(5).click();
  await page.getByRole("button", { name: /^select$/ }).click();
  const total = await columns(page).count();
  await columns(page).nth(total - 3).click();
  out.selectedAcross = await page.locator('[data-testid="tab-column"][data-selected="true"]').count();
  await sel(page).getByRole("button", { name: "Ungroup", exact: true }).click();
  await page.waitForTimeout(300);
  // A plain group of three in one bar.
  await columns(page).nth(9).click();
  await page.getByRole("button", { name: /^select$/ }).click();
  await columns(page).nth(11).click();
  await sel(page).getByRole("button", { name: "Group with no number", exact: true }).click();
  await page.waitForTimeout(300);
  // Long press on the first and the last line.
  await columns(page).first().scrollIntoViewIfNeeded();
  await touchHold(page, columns(page).first());
  out.inspectFirst = await page.getByTestId("column-inspector").getAttribute("aria-label", { timeout: 5000 });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  await columns(page).last().scrollIntoViewIfNeeded();
  await touchHold(page, columns(page).last());
  out.inspectLast = await page.getByTestId("column-inspector").getAttribute("aria-label", { timeout: 5000 });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  // Each key, from the middle of the part.
  await columns(page).nth(13).click();
  for (const k of ["ArrowLeft", "ArrowLeft", "ArrowRight", "[", "]", "Home", "End", "5", "Enter", "x", "ArrowLeft", "3", "Enter"]) await key(page, k);
  await page.waitForTimeout(500);
  out.status = await page.getByTestId("status-position").textContent();
  out.events = await idb(
    page,
    `const rows = (await all("events")).filter((r) => r.partId === arg && !r.deletedAt).sort((a, b) => (a.rank < b.rank ? -1 : 1));
     const ids = new Map();
     const id = (x) => (x == null ? null : (ids.has(x) || ids.set(x, "g" + ids.size), ids.get(x)));
     return rows.map((r) => [r.kind, JSON.stringify(r.frets), JSON.stringify(r.techniques), r.repeat, id(r.tupletId), r.tupletCount, r.groupKind]);`,
    partId,
  );
  return out;
}

async function run(browser: Browser, size: { width: number; height: number }) {
  const context = await browser.newContext({ viewport: size, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  const { partId } = await longPart(page, { chord: true, bracket: true, bars: 8, size });
  const wrapped = (await page.locator(".tab-staff-wrapped").count()) === 1;
  const result = await script(page, partId);
  await context.close();
  return { wrapped, result };
}

test("INV-007 the same sequence gives the same result on one line and wrapped", async ({ browser }, info) => {
  test.skip(info.project.name !== "mobile", "touch");
  const one = await run(browser, { width: 375, height: 667 });
  const wide = await run(browser, { width: 412, height: 915 });
  expect(one.wrapped, "375x667 is one line").toBe(false);
  expect(wide.wrapped, "412x915 wraps").toBe(true);
  expect(wide.result.bracketInView, "the new bracket is in view, wrapped").toBe(true);
  expect(wide.result).toEqual(one.result);
});
