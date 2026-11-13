import { expect, test } from "@playwright/test";
import { partAction } from "./part-card-helpers";
import {
  caret,
  columns,
  exportText,
  fret,
  PHONE,
  space,
  startCapturing,
} from "./capture-surface-helpers";
import {
  addNotes,
  brackets,
  groupControl,
  selectColumns,
  selectionBar,
  tupletControl,
  ungroupControl,
} from "./grouping-helpers";

test.describe("tuplet control (US1)", () => {
  // 3 is where a "triplet" title would show; 16 is the largest. Every count's name and glyph is
  // walked by "presence tracks every extension step" in e2e/grouping-controls.spec.ts.
  for (const n of [3, 16]) {
    test(`a selection of ${n} reads ${n} on the control and the bracket`, async ({
      page,
    }) => {
      await startCapturing(page);
      await addNotes(page, n);
      await selectColumns(page, 0, n - 1);

      await expect(tupletControl(page)).toHaveAccessibleName(
        `Make a tuplet of ${n}`,
      );
      await expect(tupletControl(page)).not.toHaveAttribute(
        "title",
        /triplet/i,
      );
      await expect(tupletControl(page).locator("text")).toHaveText(String(n));

      await tupletControl(page).click();
      await expect(selectionBar(page)).toHaveCount(0);
      await expect(brackets(page)).toHaveCount(1);
      await expect(page.locator(".tab-bracket-label")).toHaveText(String(n));
    });
  }

  test("the selection ends and the caret does not move", async ({ page }) => {
    await startCapturing(page);
    await addNotes(page, 4);
    await columns(page).nth(1).click();
    const before = await caret(page).boundingBox();
    await selectColumns(page, 1, 3);
    await tupletControl(page).click();
    await expect(selectionBar(page)).toHaveCount(0);
    // The bracket row adds height above the staff, so only the horizontal place is the cursor.
    expect((await caret(page).boundingBox())!.x).toBe(before!.x);
  });

  test("existing locators still resolve to one element", async ({ page }) => {
    await startCapturing(page);
    await addNotes(page, 3);
    await selectColumns(page, 0, 2);
    for (const name of ["copy", "cut", "delete", "cancel"]) {
      await expect(
        selectionBar(page).getByRole("button", { name }),
      ).toHaveCount(1);
    }
    await expect(page.getByRole("button", { name: /select/i })).toHaveCount(1);
  });

  test("no accessible name or title says triplet", async ({ page }) => {
    await startCapturing(page);
    await addNotes(page, 3);
    await selectColumns(page, 0, 2);
    const bad = await selectionBar(page).evaluate((bar) =>
      [...bar.querySelectorAll("button")]
        .map(
          (b) =>
            `${b.getAttribute("aria-label") ?? ""} ${b.title} ${b.textContent}`,
        )
        .filter((t) => /triplet/i.test(t)),
    );
    expect(bad).toEqual([]);
  });
});

test.describe("plain group control (US2)", () => {
  test("17+ columns offer a plain group and no tuplet; the export is numberless", async ({
    page,
  }) => {
    await startCapturing(page);
    await addNotes(page, 17);
    await selectColumns(page, 0, 16);
    await expect(tupletControl(page)).toHaveCount(0);
    await expect(groupControl(page)).toHaveCount(1);
    await groupControl(page).click();
    await expect(brackets(page)).toHaveCount(1);
    await expect(page.locator(".tab-bracket-label")).toHaveCount(0);
  });

  test("four columns export as a numberless bracket", async ({ page }) => {
    const { songUrl } = await startCapturing(page);
    await addNotes(page, 4);
    await selectColumns(page, 0, 3);
    await groupControl(page).click();
    await expect(brackets(page)).toHaveCount(1);
    await expect(page.locator(".tab-bracket-label")).toHaveCount(0);
    expect(await exportText(page, songUrl)).toContain(",-----,");
  });

  test("a selection across a barline gets one bracket per bar", async ({
    page,
  }) => {
    await startCapturing(page);
    await addNotes(page, 2);
    await page.getByTitle("Barline").click();
    await fret(page, "E", 1).click();
    await fret(page, "E", 2).click();
    await expect(columns(page)).toHaveCount(5);
    await selectColumns(page, 0, 4);
    await expect(tupletControl(page)).toHaveCount(0);
    await groupControl(page).click();
    await expect(brackets(page)).toHaveCount(2);
  });

  // Regression guard: its pre-change failure is only the missing `toolbar-selection` row.
  test("a capturer who never groups sees the same toolbar and no brackets", async ({
    page,
  }) => {
    await startCapturing(page);
    await addNotes(page, 3);
    await expect(page.getByTestId("toolbar-stable")).toBeVisible();
    await expect(brackets(page)).toHaveCount(0);
    await expect(groupControl(page)).toHaveCount(0);
    await selectColumns(page, 0, 0);
    await expect(groupControl(page)).toHaveCount(0);
    await expect(tupletControl(page)).toHaveCount(0);
  });
});

test.describe("ungroup (US3)", () => {
  test("present only when the selection overlaps a group; removes the whole bracket", async ({
    page,
  }) => {
    await startCapturing(page);
    await addNotes(page, 6);
    await selectColumns(page, 0, 5);
    await tupletControl(page).click();
    await expect(brackets(page)).toHaveCount(1);

    await selectColumns(page, 2, 3);
    await expect(ungroupControl(page)).toBeVisible();
    await ungroupControl(page).click();
    await expect(brackets(page)).toHaveCount(0);

    await selectColumns(page, 0, 1);
    await expect(ungroupControl(page)).toHaveCount(0);
  });

  test("a selection over two groups removes both", async ({ page }) => {
    await startCapturing(page);
    await addNotes(page, 6);
    await selectColumns(page, 0, 2);
    await tupletControl(page).click();
    await selectColumns(page, 3, 5);
    await tupletControl(page).click();
    await expect(brackets(page)).toHaveCount(2);
    await selectColumns(page, 2, 3);
    await ungroupControl(page).click();
    await expect(brackets(page)).toHaveCount(0);
  });

  test("the column sheet row ungroups and closes the sheet", async ({ page }) => {
    await startCapturing(page);
    await addNotes(page, 4);
    await selectColumns(page, 0, 3);
    await tupletControl(page).click();
    await columns(page).nth(1).click();
    await page.getByRole("button", { name: "Open column details" }).click();
    await expect(page.getByTestId("column-inspector")).toContainText("tuplet of 4");
    await page.getByTestId("column-inspector").getByRole("button", { name: "ungroup" }).click();
    await expect(page.getByTestId("column-inspector")).toHaveCount(0);
    await expect(brackets(page)).toHaveCount(0);
  });
});

test.describe("ungroup reach and scope (US3)", () => {
  async function grouped(page: import("@playwright/test").Page) {
    await startCapturing(page);
    await addNotes(page, 4);
    await selectColumns(page, 0, 3);
    await tupletControl(page).click();
    await expect(brackets(page)).toHaveCount(1);
  }
  const inspector = (page: import("@playwright/test").Page) =>
    page.getByTestId("column-inspector");

  test("alone with a single selected grouped column; absent outside the group", async ({
    page,
  }) => {
    await grouped(page);
    await addNotes(page, 0).catch(() => undefined);
    await selectColumns(page, 1, 1);
    await expect(ungroupControl(page)).toHaveCount(1);
  });

  test("the sheet row opens by Shift+F10", async ({ page }) => {
    await grouped(page);
    await columns(page).nth(1).focus();
    await page.keyboard.press("Shift+F10");
    await expect(inspector(page)).toContainText("tuplet of 4");
    await inspector(page).getByRole("button", { name: "ungroup" }).click();
    await expect(inspector(page)).toHaveCount(0);
    await expect(brackets(page)).toHaveCount(0);
  });

  test("the sheet row opens by long press", async ({ page }) => {
    await grouped(page);
    const box = (await columns(page).nth(1).boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(900);
    await page.mouse.up();
    await expect(inspector(page)).toContainText("tuplet of 4");
    await inspector(page).getByRole("button", { name: "ungroup" }).click();
    await expect(brackets(page)).toHaveCount(0);
  });

  test("ungrouping in a variant leaves the parent's bracket", async ({ page }) => {
    await grouped(page);
    const partUrl = page.url();
    await page.goto(partUrl.replace(/\/capture\/.*$/, ""));
    await partAction(page, "A", "+ variant");
    await expect(page.getByText("variant of")).toBeVisible();
    await page.getByRole("link", { name: "Capture" }).click();
    await expect(page).toHaveURL(/\/capture$/);
    const variantLink = page.locator('a[href*="/capture/"]').filter({ hasText: /'/ }).first();
    await variantLink.click();
    await expect(brackets(page)).toHaveCount(1);
    await selectColumns(page, 1, 2);
    await ungroupControl(page).click();
    await expect(brackets(page)).toHaveCount(0);
    await page.goto(partUrl);
    await expect(brackets(page)).toHaveCount(1);
  });
});

test.describe("the triplet button (US4)", () => {
  const triplet = (page: import("@playwright/test").Page) =>
    page.getByRole("button", { name: "Triplet", exact: true });
  const REFUSAL = "a triplet needs three columns in one bar";

  test("fret, fret, fret, triplet with no wait gives one bracket reading 3 and the button stays put", async ({
    page,
  }) => {
    const { songUrl } = await startCapturing(page);
    for (let i = 1; i <= 3; i++) await fret(page, "E", i).click();
    const before = await triplet(page).boundingBox();
    await triplet(page).click();
    await expect(brackets(page)).toHaveCount(1);
    await expect(page.locator(".tab-bracket-label")).toHaveText("3");
    expect(await triplet(page).boundingBox()).toEqual(before);
    await expect(triplet(page)).toHaveText("3");
    expect(await exportText(page, songUrl)).toMatch(/3/);
  });

  test("two columns write nothing and the status line says why", async ({ page }) => {
    const { songUrl } = await startCapturing(page);
    await addNotes(page, 2);
    await triplet(page).click();
    await expect(page.getByText(REFUSAL)).toBeVisible();
    await expect(brackets(page)).toHaveCount(0);
    expect(await exportText(page, songUrl)).not.toMatch(/3/);
  });

  const routes: [string, (page: import("@playwright/test").Page) => Promise<void>][] = [
    // A move that writes nothing.
    ["tap a column", async (p) => void (await columns(p).nth(0).click())],
    // An edit (space, barline and delete take the same path).
    ["a fret", async (p) => void (await fret(p, "E", 4).click())],
    // Leaving for another part.
    [
      "add a part",
      async (p) => void (await p.getByRole("button", { name: "Add a part" }).click()),
    ],
  ];
  for (const [name, route] of routes) {
    test(`the refusal clears on ${name}`, async ({ page }) => {
      await startCapturing(page);
      await addNotes(page, 2);
      await triplet(page).click();
      await expect(page.getByText(REFUSAL)).toBeVisible();
      await route(page);
      await expect(page.getByText(REFUSAL)).toHaveCount(0);
    });
  }

  test("a refusal at 375x667 does not scroll the page", async ({ page }) => {
    await page.setViewportSize(PHONE);
    await startCapturing(page);
    await addNotes(page, 2);
    await triplet(page).click();
    await expect(page.getByText(REFUSAL)).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollHeight - window.innerHeight,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    await expect(fret(page, "E", 1)).toBeVisible();
  });
});

test.describe("counts, cursor and export agree (US1 remainder)", () => {
  // All rests: a typical triplet and the two-digit worst case (notes, a rest and a repeat are in
  // e2e/grouping-controls.spec.ts INV-002).
  for (const n of [3, 16]) {
    test(`export digits agree with the bracket numeral for ${n}`, async ({
      page,
    }) => {
      const { songUrl } = await startCapturing(page);
      for (let i = 0; i < n; i++) await space(page);
      await expect(columns(page)).toHaveCount(n);
      await selectColumns(page, 0, n - 1);
      await expect(tupletControl(page)).toHaveAccessibleName(
        `Make a tuplet of ${n}`,
      );
      await tupletControl(page).click();
      await expect(page.locator(".tab-bracket-label")).toHaveText(String(n));
      const lines = (await exportText(page, songUrl))
        .split("\n")
        .filter((l) => /^\s*,/.test(l));
      expect(lines.join("\n")).toContain(String(n));
    });
  }

  const activeIndex = (page: import("@playwright/test").Page) =>
    columns(page).evaluateAll((els) =>
      els.findIndex((e) => e.getAttribute("aria-current") === "true"),
    );

  // The tuplet control is covered by "the selection ends and the caret does not move".
  for (const action of ["group", "ungroup"] as const) {
    test(`${action} ends the selection and leaves the cursor`, async ({
      page,
    }) => {
      await startCapturing(page);
      await addNotes(page, 2);
      await page.getByTitle("Barline").click();
      await fret(page, "E", 1).click();
      await fret(page, "E", 2).click();
      await expect(columns(page)).toHaveCount(5);
      if (action === "ungroup") {
        await selectColumns(page, 3, 4);
        await groupControl(page).click();
      }
      await selectColumns(page, 3, 4);
      const before = await activeIndex(page);
      const control =
        action === "group" ? groupControl(page) : ungroupControl(page);
      await control.click();
      await expect(selectionBar(page)).toHaveCount(0);
      expect(await activeIndex(page)).toBe(before);
      await expect(
        page.locator('[data-testid="tab-column"][data-selected="true"]'),
      ).toHaveCount(0);
    });
  }
});
