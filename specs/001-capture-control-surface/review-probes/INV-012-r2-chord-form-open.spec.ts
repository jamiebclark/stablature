/**
 * INV-012 / FR-026 / FR-028 (round 2): FR-026 names the optional chord form among the
 * bands that must fit, but INV-012's 12 members all measure with it closed. This adds
 * that member: 2 themes x 3 shapes, chord form open, at 375x667.
 *
 * main clips 2 of the 5 strings in this state (INV-012-r2-measure-any-build: 103 px band),
 * so this is pinned to "no page scroll, and no worse than main", not to "all strings".
 */
import { expect, test, type Page } from "@playwright/test";
import { columns, fret, inspector, mouseHold, openDialog, startCapturing } from "./helpers";

async function measure(page: Page) {
  return page.evaluate(() => {
    const root = document.scrollingElement!;
    const staff = document.querySelector('[data-testid="tab-staff"]')!;
    let scroller: Element | null = staff.parentElement;
    while (scroller && !/(auto|scroll)/.test(getComputedStyle(scroller).overflowY)) {
      scroller = scroller.parentElement;
    }
    const box = scroller!.getBoundingClientRect();
    const rows = [...staff.querySelectorAll(".tab-cell")].map((c) => c.getBoundingClientRect());
    return {
      pageOver: root.scrollHeight - root.clientHeight,
      scrollerOver: scroller!.scrollHeight - scroller!.clientHeight,
      stringsClipped: new Set(
        rows
          .filter((r) => r.top < box.top - 1 || r.bottom > box.bottom + 1)
          .map((r) => Math.round(r.top)),
      ).size,
      staffBand: Math.round(box.height),
    };
  });
}

for (const theme of ["light", "dark"] as const) {
  for (const shape of ["plain", "chords", "tuplet"] as const) {
    test(`chord form open - ${theme}, ${shape}`, async ({ page }, info) => {
      await page.emulateMedia({ colorScheme: theme });
      await page.setViewportSize({ width: 375, height: 667 });
      await startCapturing(page);
      await fret(page, "A", 5).click();
      await fret(page, "A", 7).click();
      await fret(page, "A", 9).click();
      await expect(columns(page)).toHaveCount(3);
      if (shape === "tuplet") await page.getByTitle(/triplet/).click();
      if (shape !== "plain") {
        await mouseHold(page, columns(page).nth(0));
        await inspector(page).getByLabel("chord symbol").fill("Am");
        await inspector(page).getByRole("button", { name: "set" }).click();
        await page.keyboard.press("Escape");
        await expect(openDialog(page)).toHaveCount(0);
      }
      await page.getByRole("button", { name: "chord symbol" }).click();
      await expect(page.getByRole("textbox", { name: "Chord" })).toBeVisible();
      const m = await measure(page);
      console.log(`[${info.project.name}] ${theme}/${shape}: ${JSON.stringify(m)}`);
      expect(m.pageOver).toBeLessThanOrEqual(0);
      expect(m.scrollerOver).toBeLessThanOrEqual(0);
      expect(m.stringsClipped, "no worse than main").toBeLessThanOrEqual(2);
    });
  }
}
