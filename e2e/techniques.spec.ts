import { expect, test, type Page } from "@playwright/test";
import {
  addPart,
  columns,
  connectors,
  deleteButton,
  exportText,
  fret,
  space,
  stackLatch,
  startCapturing,
} from "./capture-surface-helpers";


const TRANSITIONS = [
  { name: "hammer-on", glyph: "h", fixture: "5h7" },
  { name: "pull-off", glyph: "p", fixture: "5p7" },
  { name: "slide up", glyph: "/", fixture: "5/7" },
  { name: "slide down", glyph: "\\", fixture: "5\\7" },
] as const;

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

  test("the transition chips are exclusive and toggle off", async ({ page }) => {
    await startCapturing(page);
    await fret(page, "A", 5).click();
    await expectPressed(page, null);
    await latch(page, "hammer-on").click();
    await expectPressed(page, "hammer-on");
    await latch(page, "pull-off").click();
    await expectPressed(page, "pull-off");
    await latch(page, "pull-off").click();
    await expectPressed(page, null);
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

  test.describe("disarm routes", () => {
    for (const t of TRANSITIONS) {
      for (const route of ["tapping a column", "a space", "a barline"] as const) {
        test(`${t.name} is unlit after ${route}`, async ({ page }) => {
          await startCapturing(page);
          await fret(page, "A", 5).click();
          await fret(page, "A", 7).click();
          await latch(page, t.name).click();
          await expectPressed(page, t.name);
          if (route === "tapping a column") await columns(page).first().click();
          else if (route === "a space") await space(page);
          else await page.getByTitle("Barline").click();
          await expectPressed(page, null);
        });
      }

      test(`${t.name} is unlit after history back`, async ({ page }) => {
        await startCapturing(page);
        await fret(page, "A", 5).click();
        await addPart(page);
        await fret(page, "A", 5).click();
        await latch(page, t.name).click();
        await page.goBack();
        await expectPressed(page, null);
      });

      test(`${t.name} is unlit after the target is deleted away`, async ({ page }) => {
        await startCapturing(page);
        await fret(page, "A", 5).click();
        await latch(page, t.name).click();
        await deleteButton(page).click();
        await expect(columns(page)).toHaveCount(0);
        await expectPressed(page, null);
      });
    }
  });
});

test.describe("US4: an armed latch survives a mid-part insert (INV-012, F14)", () => {
  const LATCHES = [STACK, ...TRANSITIONS.map((t) => t.name)];

  for (const name of LATCHES) {
    test(`${name} disarms when another tab deletes the cursor's column`, async ({ page }) => {
      const { partUrl } = await startCapturing(page);
      await fret(page, "E", 7).click();
      await fret(page, "A", 5).click();
      await expect(columns(page)).toHaveCount(2);
      await columns(page).nth(0).click();
      await latch(page, name).click();
      await expect(latch(page, name)).toHaveAttribute("aria-pressed", "true");
      const other = await page.context().newPage();
      await other.goto(partUrl);
      await expect(columns(other)).toHaveCount(2);
      await columns(other).nth(0).click();
      await deleteButton(other).click();
      await expect(columns(other)).toHaveCount(1);
      await expect(columns(page)).toHaveCount(1);
      await expect(latch(page, name)).toHaveAttribute("aria-pressed", "false");
      await other.close();
    });
  }
});
