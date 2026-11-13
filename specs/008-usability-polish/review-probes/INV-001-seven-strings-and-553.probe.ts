/**
 * Review probe, spec 008 round 3, INV-001's two members outside the recorded fixture: "7 strings at 375x667 and 6 at
 * 375x553, which are one line with a swipe". `e2e/polish-band-unchanged.spec.ts` compares {4, 5, 6} strings at
 * 375x667 only, and no e2e file names 553.
 *
 * There is no "before" recording for these, so the probe checks what the plan's rule makes them: the band does not
 * wrap (two whole lines do not fit), the staff is the one-line branch (no `.tab-staff-wrapped`, no runway padding on
 * the band's child), the band holds one child, and the staff still scrolls sideways (one line with a swipe), for
 * {plain, chord, chord + bracket} × {dark, light} × {at rest, selecting}.
 */
import { expect, test, type Page } from "@playwright/test";
import { addRests, addChord, cancelSelection, selectColumns, startWith, tupletControl, TUNINGS } from "../../../e2e/probe-helpers";
import { GUITAR7, type Tuning } from "./helpers";

test.setTimeout(300_000);

const CASES: { label: string; tuning: Tuning; size: { width: number; height: number } }[] = [
  { label: "7 strings at 375x667", tuning: GUITAR7, size: { width: 375, height: 667 } },
  { label: "6 strings at 375x553", tuning: TUNINGS[2], size: { width: 375, height: 553 } },
];

const look = (page: Page) =>
  page.evaluate(() => {
    const band = document.querySelector<HTMLElement>('[data-testid="tab-band"]')!;
    const style = getComputedStyle(band);
    const content = band.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
    const line = band.querySelector('[data-testid="tab-column"]')!.getBoundingClientRect().height;
    const child = band.firstElementChild as HTMLElement;
    const staff = band.querySelector<HTMLElement>('[data-testid="tab-staff"]')!;
    const scroller = [staff, ...staff.querySelectorAll<HTMLElement>("*")].find((e) => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflowX !== "visible");
    return {
      wrapped: !!band.querySelector(".tab-staff-wrapped"),
      fits: content >= 2 * line + parseFloat(style.rowGap),
      children: band.children.length,
      childStyle: child.getAttribute("style"),
      swipeable: !!scroller,
      content,
      line,
    };
  });

for (const c of CASES) {
  test(`INV-001 ${c.label} stays the one-line capture`, async ({ page }, info) => {
    test.skip(info.project.name !== "mobile", "touch");
    const bad: string[] = [];
    for (const deco of ["plain", "chord", "chord+bracket"] as const) {
      await startWith(page, c.tuning, `Band ${c.tuning.strings} ${deco}`);
      await page.setViewportSize(c.size);
      await addRests(page, 24);
      if (deco !== "plain") await addChord(page, 0, "Am");
      if (deco === "chord+bracket") {
        await selectColumns(page, 0, 1);
        await tupletControl(page).click();
        await expect(page.locator('[data-testid="tab-bracket"][data-start]')).toHaveCount(1);
        // Grouping ends the selection; cancel only if it is still there.
        await page.getByTestId("toolbar-selection").getByRole("button", { name: "cancel" }).click({ timeout: 1000 }).catch(() => undefined);
      }
      for (const theme of ["dark", "light"] as const) {
        await page.emulateMedia({ colorScheme: theme });
        for (const state of ["rest", "selecting"] as const) {
          if (state === "selecting") await selectColumns(page, 0, 3);
          await page.waitForTimeout(400);
          const g = await look(page);
          const key = `${deco}|${theme}|${state}`;
          console.log(`${c.label} ${key}: ${JSON.stringify(g)}`);
          if (g.fits) bad.push(`${key}: two lines fit (${g.content} vs line ${g.line}), so this is not the member the plan names`);
          if (g.wrapped) bad.push(`${key}: wrapped`);
          if (g.children !== 1) bad.push(`${key}: band has ${g.children} children`);
          if (g.childStyle) bad.push(`${key}: band child has style "${g.childStyle}"`);
          if (!g.swipeable) bad.push(`${key}: nothing scrolls sideways`);
          if (state === "selecting") await cancelSelection(page);
        }
      }
    }
    expect(bad, bad.join("\n")).toEqual([]);
  });
}
