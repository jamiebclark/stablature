/** INV-004, INV-013: no sideways scroll at any width; the song page wraps at wide widths and never at narrow ones. */
import { expect, test } from "@playwright/test";
import { remember, VIEWS } from "./reading-helpers";
import { seedFitSong, seedWideSong, type SongName } from "./wide-helpers";

test.setTimeout(400_000);

const WIDTHS = [320, 375, 412, 767, 768, 1024, 1280, 1440, 1920, 2560];
const SONG_NAMES: Array<"fit" | SongName> = ["fit", "wide-bar", "names", "long"];

for (const name of SONG_NAMES) {
  for (const v of VIEWS) {
    test(`no sideways scroll, ${name} in ${v}`, async ({ page }) => {
      const { songUrl, playUrl } = name === "fit" ? await seedFitSong(page) : await seedWideSong(page, name);
      await remember(page, v);
      for (const colorScheme of ["dark", "light"] as const) {
        await page.emulateMedia({ colorScheme });
        for (const width of WIDTHS) {
          await page.setViewportSize({ width, height: 900 });
          for (const [which, url] of [["song", songUrl], ["play", playUrl]] as const) {
            await page.goto(url);
            await expect(page.getByTestId("tab-staff").first()).toBeVisible();
            if (width >= 768) await expect(page.locator(".tab-staff-wrapped").first()).toBeAttached();
            await page.evaluate(() => document.fonts.ready);
            const m = await page.evaluate(() => {
              const runs = [...document.querySelectorAll<HTMLElement>(".tab-bar-run")];
              const over = runs.filter((r) => r.scrollWidth > r.clientWidth + 1);
              return {
                scroll: document.documentElement.scrollWidth,
                inner: window.innerWidth,
                wrapped: document.querySelectorAll(".tab-staff-wrapped").length,
                tooWide: over.length,
                // A bar scrolling inside itself is alone on its line.
                aloneWhenWide: over.every((r) => r.offsetWidth >= (r.parentElement?.clientWidth ?? 0) - 1),
                gutter: document.querySelectorAll(".tab-gutter").length,
              };
            });
            const where = `${name} ${v} ${colorScheme} ${width} ${which}`;
            expect(m.scroll, `sideways scroll ${where} ${JSON.stringify(m)}`).toBeLessThanOrEqual(m.inner);
            if (width >= 768) {
              expect(m.wrapped, `wrapped ${where}`).toBeGreaterThan(0);
              expect(m.gutter, `string labels ${where}`).toBeGreaterThan(0);
              if (name !== "wide-bar") expect(m.tooWide, `bar overruns its line ${where}`).toBe(0);
              else expect(m.aloneWhenWide, `over-wide bar alone ${where}`).toBe(true);
            } else if (which === "song") {
              expect(m.wrapped, `narrow song page never wraps ${where}`).toBe(0);
            }
          }
        }
      }
    });
  }
}

// --- INV-013 compact density (review round 1) ---
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
