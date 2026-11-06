/**
 * INV-005 over {tuplet control, plain group control, triplet button} x {far left, far right} x {7 strings at 667,
 * 6 at 553}, and the two routes that must move nothing. The suite runs one member.
 */
import { expect, test, type Page } from "@playwright/test";
import { columns } from "../../../e2e/capture-surface-helpers";
import { addRests, groupControl, selectColumns, startWith, tupletControl } from "../../../e2e/probe-helpers";
import { fromAnotherDevice } from "../../../e2e/rhythm-probe-helpers";

test.setTimeout(180_000);
test.skip(({ isMobile }) => !isMobile, "the height budget is the touch column");

const SHAPES = [
  { name: "7 strings at 667", tuning: { family: "Guitar 7", preset: "B Standard", strings: 7 }, height: 667 },
  { name: "6 strings at 553", tuning: { family: "Guitar 6", preset: "E Standard", strings: 6 }, height: 553 },
] as const;

const COUNT = 24;

/** Scrolls band and strip to the far corner from `where`, as a reader swiping away would. */
const scrollAway = (page: Page, where: "left" | "right") =>
  page.evaluate((w) => {
    const strip = document.querySelector('[data-testid="tab-staff"] [role="group"]')!;
    const band = document.querySelector('[data-testid="tab-band"]')!;
    strip.scrollLeft = w === "left" ? strip.scrollWidth : 0;
    band.scrollTop = 0;
  }, where);

const inView = (page: Page) =>
  page.evaluate(() => {
    const el = document.querySelector('[data-testid="tab-bracket"][data-start]');
    if (!el) return null;
    const b = el.getBoundingClientRect();
    const strip = document.querySelector('[data-testid="tab-staff"] [role="group"]')!.getBoundingClientRect();
    const band = document.querySelector('[data-testid="tab-band"]')!.getBoundingClientRect();
    return {
      strip: b.left >= strip.left - 1 && b.left <= strip.right + 1,
      band: b.top >= band.top - 1 && b.bottom <= band.bottom + 1,
    };
  });

for (const shape of SHAPES) {
  for (const where of ["left", "right"] as const) {
    const from = where === "left" ? 0 : COUNT - 3;
    const to = from + 2;

    for (const control of ["tuplet", "plain group"] as const) {
      test(`INV-005 ${control} control, far ${where}, ${shape.name}`, async ({ page }) => {
        await startWith(page, shape.tuning);
        await addRests(page, COUNT);
        await page.setViewportSize({ width: 375, height: shape.height });
        await selectColumns(page, from, to);
        await scrollAway(page, where);
        await (control === "tuplet" ? tupletControl(page) : groupControl(page)).click();
        await expect(page.getByTestId("tab-bracket").first()).toBeAttached();
        await page.waitForTimeout(250);
        expect(await inView(page)).toEqual({ strip: true, band: true });
      });
    }

    test(`INV-005 triplet button, far ${where}, ${shape.name}`, async ({ page }) => {
      await startWith(page, shape.tuning);
      await addRests(page, COUNT);
      await page.setViewportSize({ width: 375, height: shape.height });
      await columns(page).nth(to).click();
      await scrollAway(page, where);
      await page.getByRole("button", { name: "Triplet", exact: true }).click();
      await expect(page.getByTestId("tab-bracket").first()).toBeAttached();
      await page.waitForTimeout(250);
      expect(await inView(page)).toEqual({ strip: true, band: true });
    });
  }
}

const groupFromElsewhere = (page: Page) =>
  fromAnotherDevice(
    page,
    `const rows = (await all("events")).filter((r) => !r.deletedAt).sort((a, b) => (a.rank < b.rank ? -1 : 1));
     await write("events", (s) => {
       for (const r of rows.slice(0, 3)) s.put({ ...r, tupletId: arg.id, tupletCount: 3, groupKind: "tuplet" });
     });`,
    { id: "11111111-1111-4111-8111-111111111111" },
  );

const stripLeft = (page: Page) =>
  page.evaluate(() => document.querySelector('[data-testid="tab-staff"] [role="group"]')!.scrollLeft);

test("INV-005 a group arriving by sync moves nothing", async ({ page }) => {
  await startWith(page, SHAPES[1].tuning);
  await addRests(page, COUNT);
  await page.setViewportSize({ width: 375, height: 553 });
  await page.waitForTimeout(200);
  const before = await stripLeft(page);
  expect(before).toBeGreaterThan(0);
  await groupFromElsewhere(page);
  await expect(page.getByTestId("tab-bracket").first()).toBeAttached();
  await page.waitForTimeout(250);
  expect(await stripLeft(page)).toBe(before);
});

test("INV-005 a refused triplet does not leave a reveal armed for the next arrival", async ({ page }) => {
  await startWith(page, SHAPES[1].tuning);
  await addRests(page, COUNT);
  await page.setViewportSize({ width: 375, height: 553 });
  await page.getByTitle("Barline").click();
  await page.getByRole("button", { name: /space/ }).click();
  await page.getByRole("button", { name: "Triplet", exact: true }).click();
  await expect(page.getByText("a triplet needs three columns in one bar")).toBeVisible();
  await page.waitForTimeout(200);
  const before = await stripLeft(page);
  expect(before).toBeGreaterThan(0);
  await groupFromElsewhere(page);
  await expect(page.getByTestId("tab-bracket").first()).toBeAttached();
  await page.waitForTimeout(250);
  expect(await stripLeft(page), "arrival by sync after a refusal").toBe(before);
});

test("INV-005 changing part moves nothing", async ({ page }) => {
  await startWith(page, SHAPES[1].tuning);
  await addRests(page, COUNT);
  await selectColumns(page, 0, 2);
  await tupletControl(page).click();
  await expect(page.getByTestId("tab-bracket").first()).toBeAttached();
  const url = page.url();
  await page.getByRole("button", { name: "Add a part" }).click();
  await expect(page).not.toHaveURL(url);
  await page.waitForTimeout(150);
  const y = await page.getByTestId("tab-band").evaluate((el) => el.scrollTop);
  await page.goto(url);
  await expect(columns(page).first()).toBeAttached();
  await page.waitForTimeout(150);
  expect(await page.getByTestId("tab-band").evaluate((el) => el.scrollTop)).toBe(y);
});

for (const refuse of [false, true]) {
  test(`INV-005 changing part moves nothing, ${refuse ? "after a refused triplet" : "the control"}`, async ({ page }) => {
    await startWith(page, SHAPES[1].tuning);
    await addRests(page, COUNT);
    await selectColumns(page, 0, 2);
    await tupletControl(page).click();
    await expect(page.getByTestId("tab-bracket").first()).toBeAttached();
    const grouped = page.url();
    await page.getByRole("button", { name: "Add a part" }).click();
    await expect(page).not.toHaveURL(grouped);
    await addRests(page, 2);
    await page.getByTitle("Barline").click();
    await page.getByRole("button", { name: /space/ }).click();
    if (refuse) {
      await page.getByRole("button", { name: "Triplet", exact: true }).click();
      await expect(page.getByText("a triplet needs three columns in one bar")).toBeVisible();
    }
    await page.getByTestId("capture-title-row").getByRole("link", { name: "A", exact: true }).click();
    await expect(page).toHaveURL(grouped);
    await expect(columns(page)).toHaveCount(COUNT);
    await page.waitForTimeout(350);
    const r = await page.evaluate(() => {
      const strip = document.querySelector('[data-testid="tab-staff"] [role="group"]')!;
      return { left: strip.scrollLeft, end: strip.scrollWidth - strip.clientWidth };
    });
    expect(r.end).toBeGreaterThan(100);
    expect(Math.abs(r.left - r.end), "a part opens on its tail: " + JSON.stringify(r)).toBeLessThanOrEqual(1);
  });
}
