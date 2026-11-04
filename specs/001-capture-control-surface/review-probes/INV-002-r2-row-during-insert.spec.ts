/**
 * INV-002 / FR-012 (round 2): the cursor runs ahead of the live query after a mid-part
 * insert (setCursor(inserted.id) lands before `columns` holds it), so `target` is briefly
 * "no-column". On main that greyed four buttons for a frame. Here it unmounts row 2.
 * Measures how often and for how long the contextual row disappears per fret press with
 * the cursor mid-part and tracking the end. Round 2 result: 6 of 6 mid-part presses, 1-3 ms.
 */
import { expect, test } from "@playwright/test";
import { columns, fret, startCapturing } from "./helpers";

for (const where of ["mid-part", "at the end"] as const) {
  test(`contextual row across fret presses, cursor ${where}`, async ({ page }, info) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await startCapturing(page);
    await fret(page, "E", 7).click();
    await fret(page, "A", 5).click();
    await expect(columns(page)).toHaveCount(2);
    if (where === "mid-part") await columns(page).nth(0).click();

    await page.evaluate(() => {
      const w = window as unknown as { __gaps: number[]; __gone: number | null };
      w.__gaps = [];
      w.__gone = null;
      new MutationObserver(() => {
        const present = !!document.querySelector('[data-testid="toolbar-contextual"]');
        if (!present && w.__gone === null) w.__gone = performance.now();
        if (present && w.__gone !== null) {
          w.__gaps.push(Math.round((performance.now() - w.__gone) * 10) / 10);
          w.__gone = null;
        }
      }).observe(document.body, { subtree: true, childList: true });
    });

    for (let i = 0; i < 6; i++) {
      await fret(page, "D", 3 + i).click();
      await expect(columns(page)).toHaveCount(3 + i);
    }
    const gaps = await page.evaluate(() => (window as unknown as { __gaps: number[] }).__gaps);
    console.log(
      `[${info.project.name}] ${where}: row 2 vanished ${gaps.length}x over 6 presses, ms: ${gaps.join(", ")}`,
    );
    // One frame at 60 Hz. A gap shorter than that is never painted, so nobody can see it.
    for (const gap of gaps) expect(gap, "row 2 must not be gone for a painted frame").toBeLessThan(16);
  });
}
