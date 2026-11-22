/**
 * INV-008 (e2e half): a card's hidden ruler reads its true one-line width however many columns the part has.
 * Chromium reads a flat calc() sum past ~48 columns as 0px; the ruler sums in nested groups instead.
 */
import { expect, test } from "@playwright/test";
import { measureCards, seedLongChord, seedLongRuler, seedManyChord } from "./cards-helpers";
import { choose, n, seedSong, type Col } from "./reading-helpers";
import { openTools } from "./usability-helpers";
import { bars } from "./wide-helpers";

test.setTimeout(300_000);

const seeds = {
  "1 bar": (page: import("@playwright/test").Page) => seedLongRuler(page, 1),
  "10 bars": (page: import("@playwright/test").Page) => seedLongRuler(page, 10),
  "16 bars": (page: import("@playwright/test").Page) => seedLongRuler(page, 16),
  "64 bars": (page: import("@playwright/test").Page) => seedLongRuler(page, 64),
  "many chords": (page: import("@playwright/test").Page) => seedManyChord(page, 60),
  "40-character chord": (page: import("@playwright/test").Page) => seedLongChord(page),
};

// Past ~100 columns the one-line clone's own sub-pixel rounding (1/64px a column) adds up to about 3px; the ruler is exact.
for (const [name, seed] of Object.entries(seeds)) {
  test(`ruler is the one-line width: ${name}`, async ({ page }) => {
    const { songUrl, playUrl } = (await seed(page)) as { songUrl: string; playUrl: string };
    await page.setViewportSize({ width: 1280, height: 900 });
    for (const url of [playUrl, songUrl]) {
      await page.goto(url);
      await expect(page.getByTestId("tab-staff").first()).toBeVisible();
      await page.waitForTimeout(300);
      const m = await measureCards(page);
      const staffed = m.cards.filter((c) => c.oneLineStaff > 0);
      expect(staffed.length).toBeGreaterThan(0);
      for (const card of staffed) {
        expect(card.ruler).toBeGreaterThan(0);
        expect(Math.abs(card.ruler - card.oneLineStaff)).toBeLessThanOrEqual(name === "64 bars" ? 4 : 1);
      }
    }
  });
}

const col64: Col[] = Array.from({ length: 64 }, (_, i) => n(2 + (i % 6), { d: "s" }));

/** INV-008 (review F3): every plan member on both pages in every view, including the 64-column bar, a removal-gap variant and an empty part. */
test("every ruler member reads its one-line width, in every view", async ({ page }) => {
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
      const info = await page.evaluate(() =>
        [...document.querySelectorAll(".reading-cards > li")].map((li) => ({
          inline: li.querySelector<HTMLElement>('[data-testid="tab-ruler"]')?.style.width ?? null,
          columns: li.querySelectorAll('[data-testid="tab-column"]').length,
          label: (li.querySelector(".reading-card > :first-child")?.textContent ?? "").trim().slice(0, 12),
        })),
      );
      m.cards.forEach((c, i) => {
        const where = `${pg} ${view} card ${i + 1} (${info[i].label})`;
        if (info[i].inline === "") bad.push(`${where}: ruler width is invalid CSS (dropped by the browser)`);
        if (c.ruler <= 0) bad.push(`${where}: ruler reads 0`);
        // An empty part has no columns: its ruler reads its gutter, as on main (the clone also carries the empty-state text).
        if (info[i].columns === 0) return;
        // Chromium's one-line clone rounds each column to 1/64px (Firefox matches exactly).
        if (Math.abs(c.ruler - c.oneLineStaff) > Math.max(1, info[i].columns / 64)) bad.push(`${where}: ruler ${c.ruler} vs one line ${c.oneLineStaff}`);
      });
    }
  }
  expect(bad).toEqual([]);
});
