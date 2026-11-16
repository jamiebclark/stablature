/**
 * INV-013 (review round 1), the **Dens** member wide-sideways.spec.ts does not reach: the song page in compact
 * density at {768, 1024, 1280}, in every **View**, for {fit, wide-bar, names}. The staff wraps, no run that fits
 * its line scrolls, the string labels, bar numbers, chord row and rhythm row are drawn on the wrapped staff, and no
 * beam crosses a line end (`data-beams-right` is 0 on a line's last column).
 */
import { expect, test } from "@playwright/test";
import { remember, VIEWS } from "../../../e2e/reading-helpers";
import { seedFitSong, seedWideSong } from "../../../e2e/wide-helpers";

test.setTimeout(400_000);

for (const name of ["fit", "wide-bar", "names"] as const) {
  test(`compact song page wraps and keeps its rows: ${name}`, async ({ page }) => {
    const { songUrl } = name === "fit" ? await seedFitSong(page) : await seedWideSong(page, name);
    const bad: string[] = [];
    for (const v of VIEWS) {
      await remember(page, v);
      for (const width of [768, 1024, 1280]) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(songUrl);
        await expect(page.locator(".tab-staff-wrapped").first()).toBeAttached();
        // Density is page state, not stored: set it on each load, through the tools panel.
        const tools = page.getByTestId("panel-song-tools");
        if ((await tools.getAttribute("aria-expanded")) !== "true") await tools.click();
        await page.getByRole("button", { name: "compact", exact: true }).click();
        await expect(page.getByRole("button", { name: "compact", exact: true })).toHaveClass(/bg-accent/);
        await page.evaluate(() => document.fonts.ready);
        const m = await page.evaluate(() => {
          const staves = [...document.querySelectorAll<HTMLElement>(".tab-staff-wrapped")];
          const runs = [...document.querySelectorAll<HTMLElement>(".tab-bar-run")];
          const over = runs.filter((r) => r.scrollWidth > r.clientWidth + 1);
          const crossing = runs.filter((r) => {
            const cols = r.querySelectorAll<HTMLElement>('[data-testid="tab-column"]');
            const last = cols[cols.length - 1];
            if (!last) return false;
            const right = r.getBoundingClientRect().right;
            const nextLineStarts = !r.nextElementSibling || (r.nextElementSibling as HTMLElement).getBoundingClientRect().top > r.getBoundingClientRect().top + 1;
            return nextLineStarts && Math.abs(last.getBoundingClientRect().right - right) < 2 && Number(last.getAttribute("data-beams-right") ?? 0) > 0;
          });
          return {
            staves: staves.length,
            gutters: document.querySelectorAll(".tab-gutter").length,
            barNumbers: document.querySelectorAll('[data-testid="tab-bar-number"]').length,
            over: over.length,
            alone: over.every((r) => r.offsetWidth >= (r.parentElement?.clientWidth ?? 0) - 1),
            crossing: crossing.length,
            sideways: document.documentElement.scrollWidth - innerWidth,
          };
        });
        const at = `${v} ${width}`;
        if (m.staves === 0) bad.push(`${at}: no wrapped staff`);
        if (m.gutters < m.staves) bad.push(`${at}: string labels missing`);
        if (m.barNumbers === 0) bad.push(`${at}: no bar numbers`);
        if (name !== "wide-bar" && m.over > 0) bad.push(`${at}: ${m.over} runs scroll`);
        if (name === "wide-bar" && !m.alone) bad.push(`${at}: an over-wide bar is not alone`);
        if (m.crossing > 0) bad.push(`${at}: ${m.crossing} beams cross a line end`);
        if (m.sideways > 0) bad.push(`${at}: page scrolls sideways by ${m.sideways}`);
      }
    }
    expect(bad).toEqual([]);
  });
}
