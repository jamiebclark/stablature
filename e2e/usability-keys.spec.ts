import { expect, test, type Page } from "@playwright/test";
import { fret } from "./capture-surface-helpers";
import { cols, dump, seed } from "./rhythm-probe-helpers";

test.setTimeout(120_000);

const PART = cols("q", "q", "q", "q", "|", "q", "q", "q", "q");
const columns = (page: Page) => page.getByTestId("tab-column");
const strip = (json: string) =>
  json
    .replace(/"(id|rank|updatedAt|createdAt|clock|hlc)":("[^"]*"|\d+)/g, '"$1":0')
    .replace(/[0-9a-f]{8}-[0-9a-f-]{27}/g, "id");

async function onCapture(page: Page, list = PART) {
  const { partUrl, playUrl } = await seed(page, list, { bpm: 120 });
  await page.goto(partUrl);
  await expect(columns(page).first()).toBeVisible();
  return { partUrl, playUrl };
}

test("INV-039 the play keys act on the page, and type into inputs without acting", async ({ page }) => {
  const { playUrl } = await seed(page, PART, { bpm: 120 });
  await page.goto(playUrl);
  await expect(page.getByTestId("tab-staff").first()).toBeVisible();
  // Positive control: Space starts the click when focus is on the page, once the click is ready.
  await expect(page.getByTestId("click-start")).toBeEnabled();
  await page.keyboard.press("Space");
  await expect(page.getByTestId("click-stop")).toBeVisible();
  await page.keyboard.press("Space");
  await expect(page.getByTestId("click-start")).toBeVisible();

  await page.evaluate(() => {
    const input = document.createElement("input");
    input.id = "probe-input";
    document.body.appendChild(input);
    input.focus();
  });
  const before = { url: page.url(), db: strip(await dump(page)) };
  for (const key of [" ", "r", "[", "]", "?", "x", "5"]) await page.keyboard.type(key);
  expect(await page.locator("#probe-input").inputValue()).toBe(" r[]?x5");
  await expect(page.getByTestId("click-start")).toBeVisible();
  await expect(page.getByTestId("help-overlay")).toBeHidden();
  expect(page.url()).toBe(before.url);
  expect(strip(await dump(page))).toBe(before.db);
});

test("INV-039 modifiers, a sheet and a focused button leave the keys alone", async ({ page }) => {
  const { playUrl } = await seed(page, PART, { bpm: 120 });
  await page.goto(playUrl);
  await expect(page.getByTestId("tab-staff").first()).toBeVisible();
  for (const combo of ["Control+r", "Alt+r", "Meta+r", "Control+Shift+?"]) await page.keyboard.press(combo);
  await expect(page.getByTestId("click-start")).toBeVisible();
  await expect(page.getByTestId("help-overlay")).toBeHidden();
  // Space on a focused button is the button's own: it starts the click once, not twice.
  await page.getByTestId("click-start").focus();
  await page.keyboard.press("Space");
  await expect(page.getByTestId("click-stop")).toBeVisible();
  await page.getByTestId("click-stop").click();
  // With the help open, other keys rest and `?` closes it.
  await page.locator("body").click({ position: { x: 2, y: 2 } });
  await page.keyboard.press("Shift+?");
  await expect(page.getByTestId("help-overlay")).toBeVisible();
  await page.keyboard.press("r");
  await expect(page.getByTestId("click-start")).toBeVisible();
  await page.keyboard.press("Shift+?");
  await expect(page.getByTestId("help-overlay")).toBeHidden();
  await page.keyboard.press("Shift+?");
  await expect(page.getByTestId("help-overlay")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("help-overlay")).toBeHidden();
});

test("INV-039 a key on a screen it is not listed for does nothing", async ({ page }) => {
  await onCapture(page);
  const before = strip(await dump(page));
  await page.keyboard.press("Space");
  await page.keyboard.press("r");
  expect(strip(await dump(page))).toBe(before);
  await expect(page).toHaveURL(/\/capture\//);
});

test("INV-040 the play view keys move the reading position, and starting clears it", async ({ page }) => {
  const { playUrl } = await onCapture(page);
  await page.goto(playUrl);
  await expect(page.getByTestId("tab-staff").first()).toBeVisible();
  const before = strip(await dump(page));
  await page.keyboard.press("ArrowRight");
  await expect(page.locator(".tab-column-reading")).toHaveCount(1);
  const first = await page.locator(".tab-column-reading").getAttribute("data-column");
  await page.keyboard.press("ArrowRight");
  expect(await page.locator(".tab-column-reading").getAttribute("data-column")).not.toBe(first);
  await page.keyboard.press("ArrowLeft");
  expect(await page.locator(".tab-column-reading").getAttribute("data-column")).toBe(first);
  await page.keyboard.press("]");
  await expect(page.locator(".tab-column-reading")).toHaveCount(1);
  await page.keyboard.press("[");
  await page.keyboard.press("Space");
  await expect(page.getByTestId("click-stop")).toBeVisible();
  await page.keyboard.press("Space");
  await page.keyboard.press("r");
  await expect(page.getByTestId("click-stop")).toBeVisible();
  await page.keyboard.press("Space");
  expect(strip(await dump(page))).toBe(before);
});

test("INV-040 every row the help lists is a registered action", async ({ page }) => {
  await onCapture(page);
  await page.keyboard.press("Shift+?");
  const rows = page.getByTestId("help-row");
  await expect(rows).toHaveCount(13);
  expect(await rows.evaluateAll((els) => els.map((e) => e.getAttribute("data-action")))).toEqual(
    expect.arrayContaining(["column-back", "enter", "dead-note", "part-on", "string-up"]),
  );
  await page.keyboard.press("Shift+?");
});

test("INV-040 capture keys do what the taps do, and none deletes", async ({ page }) => {
  await onCapture(page);
  await page.keyboard.press("Home");
  await page.keyboard.press("ArrowRight");
  await expect(page.getByText("adding after the marked column")).toBeVisible();
  await page.keyboard.press("End");
  await expect(page.getByText("adding at the end")).toBeVisible();
  await page.keyboard.press("ArrowUp");
  await expect(page.locator("[data-keyboard-string]")).toHaveCount(1);
  await page.keyboard.press("ArrowDown");
  const n = await columns(page).count();
  await page.keyboard.press("5");
  await expect(columns(page)).toHaveCount(n + 1);
  await page.keyboard.press("x");
  await expect(columns(page)).toHaveCount(n + 2);
  for (const key of ["Delete", "Backspace"]) await page.keyboard.press(key);
  await expect(columns(page)).toHaveCount(n + 2);
});

test("INV-041 two digits make one fret, and a pair over the neck makes two", async ({ page }) => {
  await onCapture(page, cols("q"));
  const n = await columns(page).count();
  await page.keyboard.press("1");
  await expect(page.getByTestId("digit-waiting")).toHaveText(/fret 1/);
  await page.keyboard.press("2");
  await expect(columns(page)).toHaveCount(n + 1);
  await expect(page.getByTestId("digit-waiting")).toHaveCount(0);
  await page.keyboard.press("2");
  await page.keyboard.press("5");
  await expect(columns(page)).toHaveCount(n + 3);
  await page.keyboard.press("1");
  await page.keyboard.press("Enter");
  await expect(columns(page)).toHaveCount(n + 4);
  await page.keyboard.press("1");
  await expect(columns(page)).toHaveCount(n + 5, { timeout: 3000 });
  await page.keyboard.press("2");
  await page.keyboard.press("x");
  await expect(columns(page)).toHaveCount(n + 7);
});

test("INV-041 fast typing keeps every note in order", async ({ page }) => {
  await onCapture(page, cols("q"));
  const n = await columns(page).count();
  await page.keyboard.type("573803", { delay: 0 });
  await expect(columns(page)).toHaveCount(n + 6);
  // The order is the stored one: e2e/usability-typing-order.spec.ts reads it; here, the tab as drawn.
  const drawn = await columns(page).evaluateAll((els) => els.slice(-6).map((e) => e.textContent?.replace(/\D/g, "")));
  expect(drawn).toEqual(["5", "7", "3", "8", "0", "3"]);
});

test("a typed fret equals a tapped fret", async ({ page }) => {
  await onCapture(page, cols("q"));
  const n = await columns(page).count();
  await page.keyboard.press("7");
  await expect(columns(page)).toHaveCount(n + 1);
  await fret(page, "B", 7).click();
  await expect(columns(page)).toHaveCount(n + 2);
  const [a, b] = await columns(page).evaluateAll((els) => els.slice(-2).map((e) => e.textContent));
  expect(a).toBe(b);
});
