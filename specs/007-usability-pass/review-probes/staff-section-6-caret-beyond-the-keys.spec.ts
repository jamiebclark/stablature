/**
 * contracts/staff.md section 6, round 2. T138 keeps the caret in view for the navigation keys. Two ways a keyboard still
 * walks what it is working on off the strip: typing mid-part, which moves the cursor by `advance` and bumps nothing, and
 * Left and Right extending a selection, which draws no caret to scroll to. Landscape is read at the end, FR-005's
 * "any screen height" and spec.md's "the neck stays reachable".
 */
import { expect, test } from "@playwright/test";
import { fret } from "../../../e2e/capture-surface-helpers";
import { cols, seed } from "../../../e2e/rhythm-probe-helpers";

test.setTimeout(120_000);

const LONG = cols(...Array.from({ length: 160 }, (_, i) => (i % 5 === 4 ? "|" : "q")));

test("staff.md 6: typing mid-part keeps the caret in view", async ({ page, isMobile }) => {
  test.skip(isMobile, "a keyboard probe");
  const { partUrl } = await seed(page, LONG, { bpm: 120 });
  await page.setViewportSize({ width: 800, height: 700 });
  await page.goto(partUrl);
  await expect(page.getByTestId("tab-column").first()).toBeAttached();
  await page.keyboard.press("Home");
  await page.waitForTimeout(200);
  for (let i = 0; i < 80; i++) {
    await page.keyboard.press("5");
    await page.waitForTimeout(60);
  }
  await page.waitForTimeout(300);
  const seen = await page.evaluate(() => {
    const caret = document.querySelector('[data-testid="tab-caret"]')!.getBoundingClientRect();
    const view = document.querySelector('[data-testid="tab-staff"] [role=group]')!.getBoundingClientRect();
    return { caret: Math.round(caret.right), left: Math.round(view.left), right: Math.round(view.right) };
  });
  console.log(`typing mid-part: ${JSON.stringify(seen)}`);
  expect(seen.caret, "caret inside the strip").toBeLessThanOrEqual(seen.right + 1);
});

test("staff.md 6: a selection's head walked by key stays in view", async ({ page, isMobile }) => {
  test.skip(isMobile, "a keyboard probe");
  const { partUrl } = await seed(page, LONG, { bpm: 120 });
  await page.setViewportSize({ width: 800, height: 700 });
  await page.goto(partUrl);
  await expect(page.getByTestId("tab-column").first()).toBeAttached();
  await page.keyboard.press("Home");
  await page.waitForTimeout(150);
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(120);
  await page.getByRole("button", { name: /^select$/ }).click();
  for (let i = 0; i < 70; i++) {
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(90);
  }
  await page.waitForTimeout(250);
  const seen = await page.evaluate(() => {
    const selected = [...document.querySelectorAll('[data-testid="tab-column"][data-selected="true"]')];
    const head = selected.at(-1)!.getBoundingClientRect();
    const view = document.querySelector('[data-testid="tab-staff"] [role=group]')!.getBoundingClientRect();
    return { selected: selected.length, head: Math.round(head.right), right: Math.round(view.right) };
  });
  console.log(`selection head: ${JSON.stringify(seen)}`);
  expect(seen.head, "head inside the strip").toBeLessThanOrEqual(seen.right + 1);
});

test("landscape: the neck stays reachable on a phone on its side", async ({ page, isMobile }) => {
  test.skip(!isMobile, "a phone on its side");
  const { partUrl } = await seed(page, LONG, { bpm: 120 });
  await page.setViewportSize({ width: 667, height: 375 });
  await page.goto(partUrl);
  await expect(page.getByTestId("tab-column").first()).toBeAttached();
  await page.waitForTimeout(200);
  // The lowest string's cell, the last the neck draws: scrolling must bring it fully on screen.
  const lowest = fret(page, "B", 7);
  await lowest.evaluate((el) => el.scrollIntoView({ block: "nearest" }));
  await page.waitForTimeout(100);
  const box = (await lowest.boundingBox())!;
  const seen = await page.evaluate(() => ({
    band: Math.round(document.querySelector('[data-testid="tab-band"]')!.getBoundingClientRect().height),
    docHeight: document.scrollingElement!.scrollHeight,
    inner: innerHeight,
  }));
  console.log(`landscape: ${JSON.stringify({ ...seen, top: box.y, bottom: box.y + box.height })}`);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(seen.inner + 0.5);
});
