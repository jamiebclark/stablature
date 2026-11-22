/**
 * Review probe, INV-008: never does a ruler read 0px or differ from its staff laid out on one line by more than 1px.
 * The suite's e2e half (cards-ruler-long.spec.ts) seeds 1, 10, 16, 64 bars and two chord songs; this probe adds the
 * plan's other members: 4, 8, 12, 32 bars, one 64-column bar, a variant with removal gaps, and an empty part (the
 * `empty` song's case), on both pages, in every view, in the probe-desktop, probe-mobile and probe-firefox projects.
 * It also reads the ruler's inline `width` so an invalid calc() (which the browser drops) shows up as "".
 */
import { expect, test } from "@playwright/test";
import { measureCards } from "../../../e2e/cards-helpers";
import { choose, n, seedSong, type Col } from "../../../e2e/reading-helpers";
import { openTools } from "../../../e2e/usability-helpers";
import { bars } from "../../../e2e/wide-helpers";

test.setTimeout(400_000);

const col64: Col[] = Array.from({ length: 64 }, (_, i) => n(2 + (i % 6), { d: "s" }));

test("INV-008 every ruler member reads its one-line width", async ({ page }) => {
  const { songUrl, playUrl } = await seedSong(
    page,
    [
      { key: "b1", label: "B1", columns: bars(1) },
      { key: "b4", label: "B4", columns: bars(4) },
      { key: "b8", label: "B8", columns: bars(8) },
      { key: "b12", label: "B12", columns: bars(12) },
      { key: "b32", label: "B32", columns: bars(32) },
      { key: "c64", label: "C64", columns: col64 },
      { key: "e", label: "E", columns: [] },
      { key: "v", label: "B4v", variantOf: "b4", columns: bars(3) },
    ],
    ["b1", "b4", "b8", "b12", "b32", "c64", "e", "v"].map((part) => ({ part })),
  );
  await page.setViewportSize({ width: 1280, height: 900 });
  const bad: string[] = [];
  for (const [pg, url] of [["song", songUrl], ["play", playUrl]] as const) {
    for (const view of ["frets", "notes", "intervals"] as const) {
      await page.goto(url);
      await expect(page.getByTestId("tab-staff").first()).toBeVisible();
      if (pg === "song") await openTools(page);
      await choose(page, view);
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(400);
      const m = await measureCards(page);
      const inline = await page.evaluate(() =>
        [...document.querySelectorAll(".reading-cards > li")].map((li) => li.querySelector<HTMLElement>('[data-testid="tab-ruler"]')?.style.width ?? null),
      );
      const columns = await page.evaluate(() =>
        [...document.querySelectorAll(".reading-cards > li")].map((li) => li.querySelectorAll('[data-testid="tab-column"]').length),
      );
      const gutters = await page.evaluate(() =>
        [...document.querySelectorAll(".reading-cards > li")].map((li) => {
          const body = li.querySelector(".tab-wrapped-body");
          return body ? parseFloat(getComputedStyle(body).paddingLeft) || li.querySelector<HTMLElement>(".tab-gutter")?.getBoundingClientRect().width || 0 : 0;
        }),
      );
      const labels = await page.evaluate(() =>
        [...document.querySelectorAll(".reading-cards > li")].map((li) => (li.querySelector(".reading-card > :first-child")?.textContent ?? "").trim().slice(0, 12)),
      );
      m.cards.forEach((c, i) => {
        const where = `${pg} ${view} card ${i + 1} (${labels[i]})`;
        console.log(`${where}: ruler ${c.ruler.toFixed(2)} oneLine ${c.oneLineStaff.toFixed(2)} inline ${inline[i] === "" ? "<dropped>" : (inline[i] ?? "none").slice(0, 40)}`);
        if (inline[i] === "") bad.push(`${where}: ruler width is invalid CSS (dropped by the browser)`);
        if (c.ruler <= 0) bad.push(`${where}: ruler reads 0`);
        // Round 2: an empty part has no column terms, so its ruler is its gutter, as on main (round 1 F3's owed fix). The
        // drawn EmptyStaff placeholder is not a column and no ruler has ever counted it (main: 28 vs 78), so the empty
        // member is checked against the gutter, not the clone.
        if (columns[i] === 0) {
          if (Math.abs(c.ruler - gutters[i]) > 1) bad.push(`${where}: empty ruler ${c.ruler} vs gutter ${gutters[i]}`);
          return;
        }
        // Chromium's one-line clone rounds each column to 1/64px (Firefox matches exactly): allow that, as the suite does.
        if (Math.abs(c.ruler - c.oneLineStaff) > Math.max(1, columns[i] / 64)) bad.push(`${where}: ruler ${c.ruler} vs one line ${c.oneLineStaff}`);
      });
    }
  }
  console.log(bad.join("\n"));
  expect(bad).toEqual([]);
});
