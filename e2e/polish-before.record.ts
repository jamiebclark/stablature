/**
 * Spec 008 T001. Records, from the UNEDITED build, what capture looks like at 375x667 and what the song page's
 * part-card actions do to the database. Written once; never re-recorded to make a test pass.
 *   npm run build && npx playwright test -c e2e/polish-before.config.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { addChord, addRests, cancelSelection, selectColumns, startWith, tupletControl, TUNINGS } from "./probe-helpers";
import { dumpDatabase, seedReadable } from "./reading-helpers";

test.setTimeout(240_000);
mkdirSync("e2e/fixtures", { recursive: true });

const ROWS = ["capture-title-row", "tab-band", "status-row", "toolbar-stable", "toolbar-contextual", "toolbar-selection", "toolbar-reserved", "latch-strip", "fret-grid"];

async function snapshot(page: Page) {
  return page.evaluate((ids) => {
    const rect = (el: Element | null) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    };
    return {
      rows: Object.fromEntries(ids.map((id) => [id, rect(document.querySelector(`[data-testid="${id}"]`))])),
      staff: document.querySelector('[data-testid="tab-staff"]')?.outerHTML ?? null,
    };
  }, ROWS);
}

test("capture at 375x667", async ({ page }) => {
  const out: Record<string, unknown> = {};
  for (const tuning of TUNINGS) {
    for (const deco of ["plain", "chord", "chord+bracket"] as const) {
      await startWith(page, tuning, `Band ${tuning.strings} ${deco}`);
      await addRests(page, 4);
      if (deco !== "plain") await addChord(page, 0, "Am");
      if (deco === "chord+bracket") {
        await selectColumns(page, 0, 1);
        await tupletControl(page).click();
      }
      await page.waitForTimeout(200);
      for (const theme of ["dark", "light"] as const) {
        await page.emulateMedia({ colorScheme: theme });
        await page.waitForTimeout(150);
        const key = `${tuning.strings}|${deco}|${theme}`;
        out[`${key}|rest`] = await snapshot(page);
        await selectColumns(page, 0, 3);
        out[`${key}|selecting`] = await snapshot(page);
        await cancelSelection(page);
        await expect(page.getByTestId("toolbar-selection")).toHaveCount(0);
      }
    }
  }
  writeFileSync("e2e/fixtures/capture-375-before.json", JSON.stringify({ viewport: [375, 667], states: out }, null, 2));
});

/** Ids and times differ run to run; what the action did is the shape. Ids become their order of first appearance. */
function normalise(dump: string): unknown {
  const seen = new Map<string, string>();
  const text = dump
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, (id) => {
      if (!seen.has(id)) seen.set(id, `<id${seen.size + 1}>`);
      return seen.get(id)!;
    })
    .replace(/\d{4}-\d\d-\d\dT[\d:.]+Z/g, "<time>")
    .replace(/\d{15}:\d{4}:[0-9a-z]+/g, "<clock>");
  return JSON.parse(text);
}

const settle = (page: Page) => page.waitForTimeout(600);

test("card actions' database", async ({ browser }) => {
  const out: Record<string, unknown> = {};
  const fresh = async () => {
    const page = await (await browser.newContext({ viewport: { width: 375, height: 667 }, hasTouch: true, isMobile: true })).newPage();
    await seedReadable(page);
    return page;
  };

  let page = await fresh();
  await page.getByRole("button", { name: "+ variant" }).click();
  await settle(page);
  out["+ variant"] = normalise(await dumpDatabase(page));

  // Delete on a part used in the arrangement (seedReadable arranges part A).
  page = await fresh();
  await page.getByRole("button", { name: "Delete part A", exact: true }).click();
  await settle(page);
  out["delete a part used in the arrangement"] = normalise(await dumpDatabase(page));

  // Delete on a variant: the new part B.
  page = await fresh();
  await page.getByRole("button", { name: "+ variant" }).click();
  await settle(page);
  await page.getByRole("button", { name: /^Delete part (?!A$)/ }).click();
  await settle(page);
  out["delete a variant"] = normalise(await dumpDatabase(page));

  // Delete on a variant's base.
  page = await fresh();
  await page.getByRole("button", { name: "+ variant" }).click();
  await settle(page);
  await page.getByRole("button", { name: "Delete part A", exact: true }).click();
  await settle(page);
  out["delete a variant's base"] = normalise(await dumpDatabase(page));

  writeFileSync("e2e/fixtures/card-actions-before.json", JSON.stringify(out, null, 2));
});
