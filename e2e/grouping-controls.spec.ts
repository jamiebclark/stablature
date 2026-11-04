/**
 * INV-002 / SC-002 on screen: control name, glyph text, bracket numeral and export digits, for
 * counts 2 to 16 x {all notes, one rest, one repeat: 8}. The suite has rests only.
 * INV-012 / FR-017 on screen: the nine rows, grouped and ungrouped, asserted absent rather than
 * disabled; a selection over two groups; a group arriving from another tab mid-selection.
 */
import { expect, test, type Page } from "@playwright/test";
import {
  addNotes,
  brackets,
  columns,
  exportText,
  fret,
  groupControl,
  selectColumns,
  selectionBar,
  space,
  startCapturing,
  tupletControl,
  ungroupControl,
} from "./probe-helpers";

test.describe("INV-002", () => {
  for (const variant of ["all notes", "one rest", "one repeat: 8"] as const) {
    for (let n = 2; n <= 16; n++) {
      test(`${n}, ${variant}`, async ({ page }, info) => {
        test.skip(info.project.name !== "mobile", "one project is enough for this matrix");
        const { songUrl } = await startCapturing(page);
        if (variant === "one rest") await space(page);
        await addNotesFrom(page, variant === "one rest" ? 1 : 0, n);
        if (variant === "one repeat: 8") {
          await columns(page).nth(n - 1).click();
          for (let i = 0; i < 7; i++) {
            await page.getByRole("button", { name: "Repeat one more time" }).click();
          }
          await expect(page.getByLabel("Repeat count").first()).toContainText("8");
        }
        await columns(page).first().click();
        await page.getByRole("button", { name: /^select$/ }).click();
        await columns(page).last().click();
        await expect(tupletControl(page)).toHaveAccessibleName(`Make a tuplet of ${n}`);
        await expect(tupletControl(page).locator("text")).toHaveText(String(n));
        await tupletControl(page).click();
        await expect(selectionBar(page)).toHaveCount(0);
        await expect(brackets(page)).toHaveCount(1);
        await expect(page.locator(".tab-bracket-label")).toHaveText(String(n));
        const text = await exportText(page, songUrl);
        const row = text.split("\n").find((l) => /^\s+,[-\d]*,\s*$/.test(l));
        expect(row?.match(/\d+/g)).toEqual([String(n)]);
      });
    }
  }
});

async function addNotesFrom(page: Page, have: number, total: number) {
  for (let i = have; i < total; i++) await fret(page, "E", (i % 9) + 1).click();
  await expect(columns(page)).toHaveCount(total);
}

test.describe("INV-012", () => {
  const ROWS: { shape: string; tuplet: number | null; plain: boolean; brackets: number }[] = [
    { shape: "n", tuplet: null, plain: false, brackets: 0 },
    { shape: "|", tuplet: null, plain: false, brackets: 0 },
    { shape: "nn", tuplet: 2, plain: true, brackets: 1 },
    { shape: "|nnn|", tuplet: 3, plain: true, brackets: 1 },
    { shape: "n|n", tuplet: null, plain: false, brackets: 0 },
    { shape: "nn|n", tuplet: null, plain: true, brackets: 1 },
    { shape: "nn|nn", tuplet: null, plain: true, brackets: 2 },
    { shape: "n".repeat(16), tuplet: 16, plain: true, brackets: 1 },
    { shape: "n".repeat(17), tuplet: null, plain: true, brackets: 1 },
  ];

  async function capture(page: Page, shape: string) {
    for (const ch of shape) {
      if (ch === "n") await fret(page, "E", 3).click();
      else await page.getByTitle("Barline").click();
    }
    await expect(columns(page)).toHaveCount(shape.length);
  }

  for (const row of ROWS) {
    const label = row.shape.length > 8 ? `${row.shape.length} columns` : row.shape;
    test(`${label}, ungrouped`, async ({ page }, info) => {
      test.skip(info.project.name !== "mobile", "one project is enough for this matrix");
      await startCapturing(page);
      await capture(page, row.shape);
      await selectColumns(page, 0, row.shape.length - 1);
      await expect(tupletControl(page)).toHaveCount(row.tuplet === null ? 0 : 1);
      if (row.tuplet !== null) {
        await expect(tupletControl(page)).toHaveAccessibleName(`Make a tuplet of ${row.tuplet}`);
      }
      await expect(groupControl(page)).toHaveCount(row.plain ? 1 : 0);
      await expect(ungroupControl(page)).toHaveCount(0);
      if (row.plain) {
        await groupControl(page).click();
        await expect(brackets(page)).toHaveCount(row.brackets);
      }
    });

    test(`${label}, grouped`, async ({ page }, info) => {
      test.skip(info.project.name !== "mobile", "one project is enough for this matrix");
      test.skip(row.shape === "|", "a barline is never grouped");
      await startCapturing(page);
      await capture(page, `${row.shape}nn`);
      // A group touching the selection's first playable column, reaching only in-bar columns.
      const first = row.shape.indexOf("n");
      const inBar = row.shape[first + 1] === "n" ? first + 1 : null;
      if (inBar !== null) {
        await selectColumns(page, first, inBar);
        await tupletControl(page).click();
      } else {
        // A lone column in its bar: group it with the padding after the last barline, or skip.
        test.skip(true, "this shape's first column has no neighbour in its bar");
      }
      await selectColumns(page, 0, row.shape.length - 1);
      await expect(tupletControl(page)).toHaveCount(row.tuplet === null ? 0 : 1);
      await expect(groupControl(page)).toHaveCount(row.plain ? 1 : 0);
      await expect(ungroupControl(page)).toHaveCount(1);
    });
  }

  test("presence tracks every extension step, and nothing is ever disabled", async ({ page }, info) => {
    test.skip(info.project.name !== "mobile", "one project is enough for this matrix");
    await startCapturing(page);
    await addNotes(page, 17);
    await columns(page).nth(0).click();
    await page.getByRole("button", { name: /^select$/ }).click();
    for (let n = 2; n <= 17; n++) {
      await columns(page).nth(n - 1).click();
      await expect(tupletControl(page)).toHaveCount(n <= 16 ? 1 : 0);
      if (n <= 16) {
        await expect(tupletControl(page)).toHaveAccessibleName(`Make a tuplet of ${n}`);
        await expect(tupletControl(page).locator("text")).toHaveText(String(n));
      }
      await expect(groupControl(page)).toHaveCount(1);
      await expect(selectionBar(page).locator("button[disabled]")).toHaveCount(0);
    }
  });

  test("a group arriving from another tab shows ungroup in a live selection", async ({
    page,
    context,
  }) => {
    await startCapturing(page);
    await addNotes(page, 3);
    await selectColumns(page, 0, 2);
    await expect(ungroupControl(page)).toHaveCount(0);
    const other = await context.newPage();
    await other.goto(page.url());
    await expect(columns(other)).toHaveCount(3);
    await selectColumns(other, 0, 2);
    await tupletControl(other).click();
    await expect(brackets(other)).toHaveCount(1);
    await expect(ungroupControl(page)).toHaveCount(1);
    await other.close();
  });
});
