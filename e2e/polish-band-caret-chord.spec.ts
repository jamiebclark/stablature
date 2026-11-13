/**
 * Adopted from the round-1 review probe, spec 008 INV-006: with no exemption on a run's overflow, a chord label on
 * the cursor's line stays inside its run. (The probe's test 1, whether the caret alone adds sideways overflow,
 * waits on MINOR F4, review.md FU1, and is not adopted.)
 */
import { expect, test } from "@playwright/test";
import { addChord } from "./probe-helpers";
import { longPart } from "./polish-review-helpers";

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
