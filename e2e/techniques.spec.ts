import { expect, test, type Page } from "@playwright/test";
import {
  columns,
  connectors,
  deleteButton,
  exportText,
  fret,
  stackLatch,
  startCapturing,
} from "./capture-surface-helpers";

const strip = (page: Page) => page.getByTestId("latch-strip");
const latch = (page: Page, name: string) =>
  strip(page).getByRole("button", { name, exact: true });
const STACK = "stack notes onto the marked column";
const ALL_NAMES = [STACK, "hammer-on", "pull-off", "slide up", "slide down"];

async function pressed(page: Page): Promise<string[]> {
  return Promise.all(
    ALL_NAMES.map(async (n) => (await latch(page, n).getAttribute("aria-pressed")) ?? "?"),
  );
}

async function expectPressed(page: Page, lit: string | null) {
  await expect
    .poll(() => pressed(page))
    .toEqual(ALL_NAMES.map((n) => (n === lit ? "true" : "false")));
}


test.describe("transitions: capture (US1)", () => {
  test("a capturer who never touches a chip adds no connector and no extra tap", async ({
    page,
  }) => {
    const { songUrl } = await startCapturing(page);
    await fret(page, "A", 5).click();
    await fret(page, "A", 7).click();
    await fret(page, "A", 7).click();
    await expect(columns(page)).toHaveCount(3);
    await expect(connectors(page)).toHaveCount(0);
    expect(await exportText(page, songUrl)).toContain("5-7-7");
  });

  test("chips are enabled on a note or barline, disabled with no column", async ({ page }) => {
    await startCapturing(page);
    for (const n of ALL_NAMES) await expect(latch(page, n)).toBeDisabled();
    await fret(page, "A", 5).click();
    for (const n of ALL_NAMES) await expect(latch(page, n)).toBeEnabled();
    await page.getByTitle("Barline").click();
    await expect(latch(page, "hammer-on")).toBeEnabled();
    await expect(stackLatch(page)).toBeDisabled();
  });

  // Tap, space, barline and history back are covered per route by INV-011 in
  // techniques-targets-routes; only a delete that leaves no column at all is tested here.
  test("hammer-on is unlit after the target is deleted away", async ({ page }) => {
    await startCapturing(page);
    await fret(page, "A", 5).click();
    await latch(page, "hammer-on").click();
    await deleteButton(page).click();
    await expect(columns(page)).toHaveCount(0);
    await expectPressed(page, null);
  });
});

test.describe("US4: an armed latch survives a mid-part insert (INV-012, F14)", () => {
  // A chip on the same route is covered by INV-011 "delete it from a second tab".
  test(`${STACK} disarms when another tab deletes the cursor's column`, async ({ page }) => {
    const { partUrl } = await startCapturing(page);
    await fret(page, "E", 7).click();
    await fret(page, "A", 5).click();
    await expect(columns(page)).toHaveCount(2);
    await columns(page).nth(0).click();
    await latch(page, STACK).click();
    await expect(latch(page, STACK)).toHaveAttribute("aria-pressed", "true");
    const other = await page.context().newPage();
    await other.goto(partUrl);
    await expect(columns(other)).toHaveCount(2);
    await columns(other).nth(0).click();
    await deleteButton(other).click();
    await expect(columns(other)).toHaveCount(1);
    await expect(columns(page)).toHaveCount(1);
    await expect(latch(page, STACK)).toHaveAttribute("aria-pressed", "false");
    await other.close();
  });
});
