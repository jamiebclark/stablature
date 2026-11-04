/**
 * INV-015 / SC-007 / SC-008 (round 3): "shown by the strip reading correctly with five
 * latches at the smallest supported phone width", and the same for the sheet. Rounds 1 and
 * 2 showed this in jsdom only, which has no layout, because declaring a latch needs a code
 * change this phase may not make. It does not need one: appending clones of the rendered
 * chip and row to the live DOM exercises the real CSS at the real width.
 *
 * The labels are the longest the roadmap names. Screenshots go to the temp dir.
 */
import os from "node:os";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { columns, fret, inspector, mouseHold, openDialog, startCapturing } from "./helpers";

const PHONE = { width: 375, height: 667 };
const STABLE = ["space", "Barline", "select", "paste"];

test("SC-007 five latches read at 375x667 and nothing moves", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile", "one project is enough for a layout");
  await page.setViewportSize(PHONE);
  await startCapturing(page);
  await fret(page, "E", 7).click();
  await expect(columns(page)).toHaveCount(1);

  const strip = page.getByTestId("latch-strip");
  const grid = page.getByTestId("fret-grid");
  const stable = page.getByTestId("toolbar-stable");
  const before = {
    strip: (await strip.boundingBox())!,
    grid: (await grid.boundingBox())!,
    row: (await stable.boundingBox())!,
  };

  await strip.evaluate((el) => {
    const chip = el.querySelector("button")!;
    for (const label of ["hammer-on", "pull-off", "slide-up", "slide-down"]) {
      const clone = chip.cloneNode(true) as HTMLButtonElement;
      clone.textContent = label;
      el.append(clone);
    }
  });

  const chips = await strip.locator("button").evaluateAll((els) =>
    els.map((e) => {
      const b = e.getBoundingClientRect();
      const range = document.createRange();
      range.selectNodeContents(e);
      return {
        text: e.textContent,
        left: b.left,
        right: b.right,
        width: b.width,
        height: b.height,
        lines: new Set([...range.getClientRects()].map((r) => Math.round(r.top))).size,
        overflows: e.scrollWidth > e.clientWidth,
      };
    }),
  );
  console.log(`CHIPS ${JSON.stringify(chips)}`);
  await page.screenshot({ path: path.join(os.tmpdir(), "spec001-r3-five-latches.png") });

  expect(chips).toHaveLength(5);
  for (const chip of chips) {
    expect(chip.lines, `${chip.text} stays on one line`).toBe(1);
    expect(chip.overflows, `${chip.text} fits its chip`).toBe(false);
    expect(chip.height).toBe(chips[0].height);
    expect(Math.abs(chip.width - chips[0].width)).toBeLessThan(0.5);
    expect(chip.left).toBeGreaterThanOrEqual(0);
    expect(chip.right).toBeLessThanOrEqual(PHONE.width);
  }
  expect((await strip.boundingBox())!.height, "the strip keeps its height").toBe(before.strip.height);
  expect((await grid.boundingBox())!.height, "the neck keeps its height").toBe(before.grid.height);
  expect((await stable.boundingBox())!.y, "the toolbar does not move").toBe(before.row.y);
  for (const name of STABLE) {
    await expect(stable.getByRole("button", { name }).first()).toBeInViewport();
  }
});

for (const shape of ["plain", "chords and tuplet"] as const) {
  test(`SC-008 six properties read at 375x667 - ${shape}`, async ({ page }, info) => {
    test.skip(info.project.name !== "mobile", "one project is enough for a layout");
    await page.setViewportSize(PHONE);
    await startCapturing(page);
    await fret(page, "A", 5).click();
    await fret(page, "A", 7).click();
    await fret(page, "A", 9).click();
    await expect(columns(page)).toHaveCount(3);
    if (shape !== "plain") {
      await page.getByTitle(/triplet/).click();
      await page.getByRole("button", { name: "chord symbol" }).click();
      await page.getByLabel("Chord", { exact: true }).fill("Am");
      await page.getByRole("button", { name: "Set", exact: true }).click();
      await expect(page.getByLabel("Chord", { exact: true })).toHaveCount(0);
    }
    const pressed = (await columns(page).nth(1).boundingBox())!;
    await mouseHold(page, columns(page).nth(1));
    await expect(openDialog(page)).toHaveCount(1);

    // The text row is the tallest and widest, so three more of it is the worst case.
    await inspector(page).evaluate((el) => {
      const rows = el.querySelectorAll("[data-property-row]");
      const tallest = rows[1];
      for (const label of ["vibrato", "harmonic", "note duration"]) {
        const clone = tallest.cloneNode(true) as HTMLElement;
        clone.querySelector("span")!.textContent = label;
        el.append(clone);
      }
    });

    const sheet = await openDialog(page).evaluate((el) => {
      const b = el.getBoundingClientRect();
      return {
        top: b.top,
        bottom: b.bottom,
        scrolls: el.scrollHeight > el.clientHeight,
        rows: el.querySelectorAll("[data-property-row]").length,
        overflowsX: el.scrollWidth > el.clientWidth,
      };
    });
    console.log(`SHEET ${shape} ${JSON.stringify(sheet)} pressed bottom ${pressed.y + pressed.height}`);
    await page.screenshot({ path: path.join(os.tmpdir(), `spec001-r3-six-rows-${shape.split(" ")[0]}.png`) });

    expect(sheet.rows).toBe(6);
    expect(sheet.overflowsX, "no row is wider than the phone").toBe(false);
    expect(sheet.top).toBeGreaterThanOrEqual(0);
    expect(sheet.bottom).toBeLessThanOrEqual(PHONE.height + 1);
    expect(sheet.scrolls, "six rows need no scrolling").toBe(false);
    // Reported, not asserted: FU7's clearance is a warning for later entries, not an SC-008
    // obligation. Three more TEXT rows is the worst case; other controls are shorter.
    console.log(`CLEARANCE ${shape} ${sheet.top - (pressed.y + pressed.height)} px`);
  });
}
