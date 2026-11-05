/**
 * INV-007: the lit position against the stored value, for a change landing with the sheet open and
 * for two taps in one tick. INV-008: the four containers x target {no column, playable, barline,
 * selection} hold no duration control.
 */
import { expect, test, type Page } from "@playwright/test";
import { columns, details, inspector, mouseHold } from "../../../e2e/capture-surface-helpers";
import { eventRows, patchEvent, seed } from "./helpers";

const lit = (page: Page) =>
  page
    .getByTestId("duration-row")
    .getByRole("button")
    .evaluateAll((els) =>
      els.filter((el) => el.getAttribute("aria-pressed") === "true").map((el) => el.textContent),
    );

const stored = async (page: Page) =>
  (await eventRows(page)).sort((a, b) => ((a.rank as string) < (b.rank as string) ? -1 : 1))[0].durationHint;

test("INV-007 a change from another device with the sheet open moves the lit position", async ({ page }) => {
  const { partUrl } = await seed(page, [{ d: null }, { d: null }], { arrange: false });
  await page.goto(partUrl);
  await columns(page).first().click();
  await details(page).click();
  await expect(inspector(page)).toBeVisible();
  expect(await lit(page)).toEqual([]);

  await patchEvent(page, 0, { durationHint: "16" });
  await expect.poll(() => lit(page)).toEqual(["16"]);
  await patchEvent(page, 0, { durationHint: "w" });
  await expect.poll(() => lit(page)).toEqual(["w"]);
  await patchEvent(page, 0, { durationHint: null });
  await expect.poll(() => lit(page)).toEqual([]);
  await expect(inspector(page)).toBeVisible();
});

for (const pair of [
  ["q", "q"],
  ["q", "8"],
] as const) {
  test(`INV-007 two taps in one tick, ${pair.join(" then ")}: lit equals stored equals the last ask`, async ({
    page,
  }) => {
    const { partUrl } = await seed(page, [{ d: null }, { d: null }], { arrange: false });
    await page.goto(partUrl);
    await columns(page).first().click();
    await details(page).click();
    await expect(inspector(page)).toBeVisible();
    await page.getByTestId("duration-row").evaluate((row, p) => {
      const find = (t: string) =>
        [...row.querySelectorAll("button")].find((b) => b.textContent === t) as HTMLButtonElement;
      find(p[0]).click();
      find(p[1]).click();
    }, pair);
    await expect.poll(() => stored(page)).toBe(pair[1]);
    await expect.poll(() => lit(page)).toEqual([pair[1]]);
    await expect(inspector(page)).toBeVisible();
  });
}

const DURATION_WORDS = /duration|whole|half note|quarter|eighth|sixteenth|thirty/i;

async function assertNoneOutside(page: Page, target: string) {
  for (const id of ["toolbar-stable", "toolbar-contextual", "toolbar-selection", "latch-strip"]) {
    const names = await page.getByTestId(id).getByRole("button").evaluateAll((els) =>
      els.map((el) => `${el.getAttribute("aria-label") ?? ""} ${el.textContent ?? ""}`),
    );
    for (const n of names) expect(DURATION_WORDS.test(n), `${id} on ${target}: ${n}`).toBe(false);
  }
}

test("INV-008 four containers x four targets hold no duration control", async ({ page }) => {
  const { partUrl } = await seed(page, [{ d: "q" }, { kind: "barline" }, { d: "8" }], { arrange: false });
  await page.goto(partUrl);
  await expect(columns(page)).toHaveCount(3);
  await assertNoneOutside(page, "cursor at the end");
  await columns(page).first().click();
  await assertNoneOutside(page, "playable");
  await columns(page).nth(1).click();
  await assertNoneOutside(page, "barline");
  await page.getByRole("button", { name: /select/ }).click();
  await columns(page).nth(2).click();
  await assertNoneOutside(page, "selection");
});

test("INV-006 the inspector on a barline holds no row", async ({ page }) => {
  const { partUrl } = await seed(page, [{ d: "q" }, { kind: "barline" }], { arrange: false });
  await page.goto(partUrl);
  await mouseHold(page, columns(page).nth(1));
  await expect(page.locator("dialog[open]")).toHaveAttribute("aria-label", "Barline");
  await expect(page.getByTestId("duration-row")).toHaveCount(0);
});
