/**
 * INV-026 on screen: what a capturer who never groups can see, and how many taps it takes.
 * Run this against this branch and against a build of main (PROBE_ROOT) and diff the `{...}` lines.
 * The one expected difference is where a selection's controls live (Deviation 1); `shape` for a
 * selection names the buttons alone, so a new control that crept in shows up there.
 */
import { expect, test, type Locator, type Page } from "@playwright/test";
import { addNotes, columns, fret, stable, startCapturing, status, triplet } from "./probe-helpers";

const names = (bar: Locator) =>
  bar
    .getByRole("button")
    .evaluateAll((els) =>
      els.map((e) => e.getAttribute("aria-label") ?? e.textContent?.trim() ?? ""),
    );

const contextual = (page: Page) => page.getByTestId("toolbar-contextual");

test("the toolbars with nothing selected", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile", "one project is enough for a reading");
  await startCapturing(page);
  const empty = { stable: await names(stable(page)), contextual: await names(contextual(page)) };
  await addNotes(page, 2);
  await expect(triplet(page)).toHaveCount(1);
  const atEnd = { stable: await names(stable(page)), contextual: await names(contextual(page)) };
  await columns(page).nth(0).click();
  await expect(status(page)).toHaveText("adding after the marked column");
  const mid = { stable: await names(stable(page)), contextual: await names(contextual(page)) };
  console.log(JSON.stringify({ reading: "toolbars", empty, atEnd, mid }));
});

test("a one-column selection offers nothing new", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile", "one project is enough for a reading");
  await startCapturing(page);
  await addNotes(page, 1);
  await columns(page).nth(0).click();
  await page.getByRole("button", { name: /^select$/ }).click();
  await expect(page.getByRole("button", { name: "cancel" })).toBeVisible();
  const all = await page.getByRole("button").evaluateAll((els) =>
    els
      .map((e) => e.getAttribute("aria-label") ?? e.textContent?.trim() ?? "")
      .filter((n) => /^(copy|cut|delete|cancel|paste|Make a tuplet.*|Group.*|Ungroup)$/.test(n)),
  );
  console.log(JSON.stringify({ reading: "selection of one", all }));
});

test("taps for three notes and a barline are three and one", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile", "one project is enough for a reading");
  await startCapturing(page);
  let taps = 0;
  for (const n of [1, 2, 3]) {
    await fret(page, "E", n).click();
    taps += 1;
  }
  await page.getByTitle("Barline").click();
  taps += 1;
  await expect(columns(page)).toHaveCount(4);
  console.log(JSON.stringify({ reading: "taps", taps }));
});
