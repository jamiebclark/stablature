/**
 * INV-040, round 3: "The help's rows are read and each is run, so a row cannot be listed and dead", and "The help on each
 * screen". `usability-keys.spec.ts` reads capture's rows and checks five ids, and runs none of them from the list. Here the
 * rows the overlay shows drive the test: each must have a check below, and each check asserts a visible effect of its key,
 * so a row added without an action fails, and so does a listed row whose key does nothing.
 */
import { expect, test, type Page } from "@playwright/test";
import { n, seedSong } from "../../../e2e/reading-helpers";
import { cols, seed } from "../../../e2e/rhythm-probe-helpers";

test.setTimeout(120_000);
test.skip(({ isMobile }) => isMobile, "a keyboard probe: the desktop project is the mouse-and-keyboard device");

const PART = cols("q", "q", "q", "q", "|", "q", "q", "q", "q");
const columns = (page: Page) => page.getByTestId("tab-column");
const caretX = async (page: Page) => (await page.getByTestId("tab-caret").boundingBox())!.x;

async function helpRows(page: Page) {
  await page.keyboard.press("Shift+?");
  const rows = page.getByTestId("help-row");
  await expect(rows.first()).toBeAttached();
  const ids = await rows.evaluateAll((els) => els.map((e) => e.getAttribute("data-action")!));
  await page.keyboard.press("Shift+?");
  await expect(page.getByTestId("help-overlay")).toBeHidden();
  return ids;
}

const moved = async (page: Page, key: string) => {
  const before = await caretX(page);
  await page.keyboard.press(key);
  await expect.poll(() => caretX(page), { message: `${key} moves the caret` }).not.toBe(before);
};

const reading = (page: Page) =>
  page.evaluate(() => {
    const el = document.querySelector(".tab-column-reading");
    return el ? [...document.querySelectorAll('[data-testid="tab-column"]')].indexOf(el) : -1;
  });

const readingMoves = async (page: Page, key: string) => {
  const before = await reading(page);
  await page.keyboard.press(key);
  await expect.poll(() => reading(page), { message: `${key} moves the reading position` }).not.toBe(before);
};

test("INV-040 capture: every help row runs", async ({ page }) => {
  const { songUrl, parts } = await seedSong(
    page,
    [
      { key: "a", label: "A", columns: [n(3, { d: "q" }), n(5, { d: "q" }), { kind: "barline" }, n(7, { d: "q" }), n(8, { d: "q" })] },
      { key: "b", label: "B", columns: [n(3, { d: "q" })] },
      { key: "c", label: "C", columns: [n(5, { d: "q" })] },
    ],
    [{ part: "a" }],
  );
  await page.goto(`${songUrl}/capture/${parts.b}`);
  await expect(columns(page)).toHaveCount(1);
  const ids = await helpRows(page);
  const urlChanges = async (key: string) => {
    const before = page.url();
    await page.keyboard.press(key);
    await expect(page, `${key} changes part`).not.toHaveURL(before);
  };
  const keyed = () => page.locator("[data-keyboard-string]").textContent();
  const checks: Record<string, () => Promise<void>> = {
    "part-on": () => urlChanges("."),
    "part-back": () => urlChanges(","),
    "string-up": async () => {
      await page.keyboard.press("ArrowUp");
      await expect(page.locator("[data-keyboard-string]")).toHaveCount(1);
    },
    "string-down": async () => {
      const before = await keyed();
      await page.keyboard.press("ArrowDown");
      await expect.poll(keyed, { message: "Down moves the string" }).not.toBe(before);
    },
    "dead-note": async () => {
      const count = await columns(page).count();
      await page.keyboard.press("x");
      await expect(columns(page)).toHaveCount(count + 1);
    },
    enter: async () => {
      const count = await columns(page).count();
      await page.keyboard.press("7");
      await expect(columns(page)).toHaveCount(count + 1);
      await page.keyboard.press("1");
      await page.keyboard.press("Enter");
      await expect(columns(page)).toHaveCount(count + 2);
    },
    "column-back": () => moved(page, "ArrowLeft"),
    "column-on": () => moved(page, "ArrowRight"),
    "bar-back": () => moved(page, "["),
    "bar-on": () => moved(page, "]"),
    start: async () => {
      await page.keyboard.press("Home");
      await expect(page.getByText("adding at the start")).toBeVisible();
    },
    end: async () => {
      await page.keyboard.press("End");
      await expect(page.getByText("adding at the end")).toBeVisible();
    },
    help: async () => {
      await page.keyboard.press("Shift+?");
      await expect(page.getByTestId("help-overlay")).toBeVisible();
      await page.keyboard.press("Shift+?");
      await expect(page.getByTestId("help-overlay")).toBeHidden();
    },
  };
  console.log(`capture rows: ${ids.join(" ")}`);
  expect(ids.length).toBe(13);
  // The part keys run first and on a part with a neighbour each side, then the rest on part A with its barline.
  for (const id of ["part-on", "part-back"]) await checks[id]();
  await page.goto(`${songUrl}/capture/${parts.a}`);
  await expect(columns(page)).toHaveCount(5);
  const order = ["string-up", "string-down", "dead-note", "enter", "column-back", "column-on", "bar-back", "bar-on", "start", "end", "help"];
  expect([...order, "part-on", "part-back"].sort()).toEqual([...ids].sort());
  for (const id of order) await checks[id]();
});

test("INV-040 play: every help row runs", async ({ page }) => {
  const { playUrl } = await seed(page, PART, { bpm: 120 });
  await page.goto(playUrl);
  await expect(page.getByTestId("click-start")).toBeEnabled();
  await page.waitForTimeout(150);
  const ids = await helpRows(page);
  console.log(`play rows: ${ids.join(" ")}`);
  const checks: Record<string, () => Promise<void>> = {
    "column-on": () => readingMoves(page, "ArrowRight"),
    "column-back": async () => {
      await page.keyboard.press("ArrowRight");
      await readingMoves(page, "ArrowLeft");
    },
    "bar-on": () => readingMoves(page, "]"),
    "bar-back": () => readingMoves(page, "["),
    "toggle-click": async () => {
      await page.keyboard.press("Space");
      await expect(page.getByTestId("click-stop")).toBeVisible();
      await page.locator("body").click({ position: { x: 2, y: 2 } });
      await page.keyboard.press("Space");
      await expect(page.getByTestId("click-start")).toBeVisible();
    },
    restart: async () => {
      await page.keyboard.press("r");
      await expect(page.getByTestId("click-stop")).toBeVisible();
      await expect(page.getByTestId("click-state")).toHaveText("Counting in.");
      await page.getByTestId("click-stop").click();
    },
    help: async () => {
      await page.keyboard.press("Shift+?");
      await expect(page.getByTestId("help-overlay")).toBeVisible();
      await page.keyboard.press("Shift+?");
      await expect(page.getByTestId("help-overlay")).toBeHidden();
    },
  };
  const order = ["column-on", "column-back", "bar-on", "bar-back", "toggle-click", "restart", "help"];
  expect([...order].sort()).toEqual([...ids].sort());
  for (const id of order) await checks[id]();
});

test("INV-040 any other screen: the help lists only itself", async ({ page }) => {
  const { songUrl } = await seed(page, PART, { bpm: 120 });
  await page.goto(songUrl);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.waitForTimeout(150);
  expect(await helpRows(page)).toEqual(["help"]);
});
