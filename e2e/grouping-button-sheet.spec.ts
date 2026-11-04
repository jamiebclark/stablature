/**
 * INV-016 / FR-022 to FR-024 on screen: place, name, title and presence, refusals by export and
 * status line, and a real burst of taps.
 * INV-018 / FR-026: the sheet by its three routes, tuplet and plain, each closing the sheet and
 * removing the bracket; a column inside a repeat; no row for an ungrouped column or a barline.
 */
import { expect, test, type Page } from "@playwright/test";
import {
  addNotes,
  backToBack,
  brackets,
  columns,
  details,
  exportText,
  fret,
  groupControl,
  inspector,
  mouseHold,
  openDialog,
  refusal,
  selectColumns,
  startCapturing,
  storedRows,
  triplet,
  tupletControl,
} from "./probe-helpers";

test.describe("INV-016", () => {
  test("same place, name and title on every playable column, possible or not", async ({ page }) => {
    await startCapturing(page);
    await addNotes(page, 3);
    const boxes = [];
    for (const i of [0, 1, 2]) {
      await columns(page).nth(i).click();
      await expect(triplet(page)).toHaveAttribute(
        "title",
        "Make this column and the two before it a triplet",
      );
      boxes.push(await triplet(page).boundingBox());
    }
    expect(boxes[1]).toEqual(boxes[0]);
    expect(boxes[2]).toEqual(boxes[0]);
    await columns(page).nth(0).click();
    await triplet(page).click();
    await expect(refusal(page)).toBeVisible();
    expect(await triplet(page).boundingBox()).toEqual(boxes[0]);
  });

  test("a refusal writes nothing, read from the store and the export", async ({ page }) => {
    const { songUrl } = await startCapturing(page);
    await addNotes(page, 2);
    const before = await storedRows(page);
    await triplet(page).click();
    await expect(refusal(page)).toBeVisible();
    expect(await storedRows(page)).toEqual(before);
    expect(await exportText(page, songUrl)).not.toMatch(/,/);
  });

  test("a barline among the three refuses at each position", async ({ page }) => {
    for (const shape of ["n|nn", "nn|n"]) {
      await startCapturing(page, `Band ${shape}`);
      for (const ch of shape) {
        if (ch === "n") await fret(page, "E", 3).click();
        else await page.getByTitle("Barline").click();
      }
      await expect(columns(page)).toHaveCount(4);
      await triplet(page).click();
      await expect(refusal(page)).toBeVisible();
      await expect(brackets(page)).toHaveCount(0);
    }
  });

  test("mid-part, the three end at the cursor, past a later barline", async ({ page }) => {
    await startCapturing(page);
    await addNotes(page, 4);
    await page.getByTitle("Barline").click();
    await fret(page, "E", 1).click();
    await columns(page).nth(2).click();
    await triplet(page).click();
    await expect(brackets(page)).toHaveCount(1);
    const rows = await storedRows(page);
    expect(
      rows.map((r) => (r as unknown as { tupletId: string | null }).tupletId !== null),
    ).toEqual([true, true, true, false, false, false]);
  });

  test("fret, fret, fret, triplet with no wait", async ({ page }) => {
    await startCapturing(page);
    await fret(page, "E", 1).click();
    await expect(triplet(page)).toBeVisible();
    await backToBack(page, [
      ["E", 2],
      ["E", 3],
    ]);
    await triplet(page).click();
    await expect(brackets(page)).toHaveCount(1);
    await expect(page.locator(".tab-bracket-label")).toHaveText("3");
    await expect(refusal(page)).toHaveCount(0);
  });
});

const hold = (page: Page) => mouseHold(page, columns(page).nth(1));
const shiftF10 = async (page: Page) => {
  await columns(page).nth(1).focus();
  await page.keyboard.press("Shift+F10");
};
const button = async (page: Page) => {
  await columns(page).nth(1).click();
  await details(page).click();
};

test.describe("INV-018", () => {
  const ROUTES: [string, (p: Page) => Promise<void>][] = [
    ["long press", hold],
    ["Shift+F10", shiftF10],
    ["the details button", button],
  ];
  for (const [route, open] of ROUTES) {
    for (const [kind, heading] of [
      ["tuplet", "tuplet of 5"],
      ["plain", "plain group"],
    ] as const) {
      test(`${kind} by ${route}`, async ({ page }) => {
        await startCapturing(page);
        await addNotes(page, 5);
        await selectColumns(page, 0, 4);
        await (kind === "tuplet" ? tupletControl(page) : groupControl(page)).click();
        await expect(brackets(page)).toHaveCount(1);
        await open(page);
        await expect(inspector(page)).toContainText(heading);
        await inspector(page).getByRole("button", { name: "ungroup", exact: true }).click();
        await expect(openDialog(page)).toHaveCount(0);
        await expect(brackets(page)).toHaveCount(0);
      });
    }
  }

  test("no row for an ungrouped column or a barline", async ({ page }) => {
    await startCapturing(page);
    await addNotes(page, 1);
    await page.getByTitle("Barline").click();
    await expect(columns(page)).toHaveCount(2);
    await mouseHold(page, columns(page).nth(0));
    await expect(inspector(page)).toBeVisible();
    await expect(inspector(page).getByRole("button", { name: "ungroup" })).toHaveCount(0);
    await inspector(page).getByRole("button", { name: "close" }).click();
    await mouseHold(page, columns(page).nth(1));
    await expect(inspector(page)).toBeVisible();
    await expect(inspector(page).getByRole("button", { name: "ungroup" })).toHaveCount(0);
  });

  test("a repetition of a repeated column opens the same row", async ({ page }) => {
    await startCapturing(page);
    await addNotes(page, 3);
    await columns(page).nth(1).click();
    await page.getByRole("button", { name: "Repeat one more time" }).click();
    await expect(columns(page)).toHaveCount(4);
    await selectColumns(page, 0, 3);
    await tupletControl(page).click();
    await mouseHold(page, columns(page).nth(2));
    await expect(inspector(page)).toContainText("tuplet of 3");
  });
});
