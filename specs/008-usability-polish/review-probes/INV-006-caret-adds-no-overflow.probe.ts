/**
 * Review probe, spec 008 (test integrity of the usability-staves re-pin): does the wrapped caret alone make the
 * cursor's run scroll sideways? `measureSurface` exempts chords on a run whose scrollWidth exceeds its clientWidth,
 * so a caret that adds overflow would switch the chord-edge check off on exactly the cursor's line.
 */
import { expect, test } from "@playwright/test";
import { addChord } from "../../../e2e/probe-helpers";
import { longPart } from "./helpers";

test("the wrapped caret adds no sideways overflow to its run", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile", "touch");
  await longPart(page, { chord: true, bracket: true, bars: 16, size: { width: 412, height: 915 } });
  const rows: string[] = [];
  for (const where of ["end", "start", "mid"] as const) {
    if (where === "end") await page.getByTestId("status-row").getByRole("button", { name: "end ⇥" }).click();
    if (where === "start") await page.getByTestId("status-row").getByRole("button", { name: "⇤ start" }).click();
    if (where === "mid") await page.getByTestId("tab-column").nth(30).click();
    await page.waitForTimeout(500);
    const r = await page.evaluate(() => {
      const run = document.querySelector('[data-testid="tab-caret"]')!.closest<HTMLElement>(".tab-bar-run")!;
      return { scroll: run.scrollWidth, client: run.clientWidth };
    });
    rows.push(`${where}: caret run scrollWidth ${r.scroll}, clientWidth ${r.client}`);
  }
  console.log(rows.join("\n"));
  expect(rows.filter((r) => { const [s, c] = r.match(/\d+/g)!.map(Number); return s > c; })).toEqual([]);
});

test("with no exemption, a chord label on the cursor's line stays inside its run", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile", "touch");
  await longPart(page, { chord: true, bracket: true, bars: 16, size: { width: 412, height: 915 } });
  const count = await page.getByTestId("tab-column").count();
  const symbols = ["Cm7b5add11", "Dm7b5add11", "Em7b5add11"];
  for (const [k, i] of [count - 1, count - 2, 30].entries()) await addChord(page, i, symbols[k]);
  const bad: string[] = [];
  for (const where of ["end", "mid"] as const) {
    if (where === "end") await page.getByTestId("status-row").getByRole("button", { name: "end ⇥" }).click();
    else await page.getByTestId("tab-column").nth(30).click();
    await page.waitForTimeout(500);
    bad.push(
      ...(await page.evaluate((w) => {
        const out: string[] = [];
        for (const el of document.querySelectorAll<HTMLElement>('[data-testid="tab-column"] > div.text-accent')) {
          if (!el.textContent) continue;
          const range = document.createRange();
          range.selectNodeContents(el);
          const r = range.getBoundingClientRect();
          const run = el.closest<HTMLElement>(".tab-bar-run")!.getBoundingClientRect();
          if (r.right > run.right + 1) out.push(`${w}: ${el.textContent} past its run by ${(r.right - run.right).toFixed(1)}`);
        }
        return out;
      }, where)),
    );
  }
  expect(bad).toEqual([]);
});
