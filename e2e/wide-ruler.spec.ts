/** INV-019 (e2e half): the hidden ruler is as wide as the staff drawn on one line. */
import { expect, test } from "@playwright/test";
import { bar, n, remember, seedSong, VIEWS, type Col } from "./reading-helpers";
import { seedFitSong, seedWideSong, type SongName } from "./wide-helpers";

test.setTimeout(180_000);

const SONG_NAMES: Array<"fit" | SongName> = ["fit", "names", "wide-bar"];

for (const name of SONG_NAMES) {
  for (const v of VIEWS) {
    test(`ruler equals the one-line staff, ${name} in ${v}`, async ({ page }) => {
      const { songUrl, playUrl } = name === "fit" ? await seedFitSong(page) : await seedWideSong(page, name);
      await remember(page, v);
      await page.setViewportSize({ width: 1280, height: 900 });
      for (const url of [songUrl, playUrl]) {
        await page.goto(url);
        await expect(page.getByTestId("tab-ruler").first()).toBeAttached();
        await page.waitForFunction(() => {
          const ol = document.querySelector(".reading-cards");
          if (!ol) return true;
          return [...ol.children].every((li) => li.querySelector("[data-column]")) && (ol as HTMLElement).style.getPropertyValue("--staff-line") !== "";
        });
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(300);
        const rows = await page.evaluate(() =>
          [...document.querySelectorAll<HTMLElement>(".tab-wrapped-body")].map((body) => {
            const lines = body.querySelector<HTMLElement>(".tab-lines")!;
            const ruler = body.parentElement!.querySelector<HTMLElement>('[data-testid="tab-ruler"]')!;
            lines.style.flexWrap = "nowrap";
            lines.style.width = "max-content";
            lines.querySelectorAll<HTMLElement>(".tab-bar-run").forEach((r) => (r.style.flex = "none"));
            const gutter = parseFloat(getComputedStyle(body).paddingLeft);
            return { lines: lines.getBoundingClientRect().width + gutter, ruler: ruler.getBoundingClientRect().width };
          }),
        );
        expect(rows.length).toBeGreaterThan(0);
        for (const r of rows) expect(Math.abs(r.lines - r.ruler)).toBeLessThanOrEqual(1);
      }
    });
  }
}

// --- INV-019 connector gaps, removal gaps, a chord-widened column (review round 1) ---
const q = (fret: number, over: Col = {}) => n(fret, { d: "q", ...over });
const PARENT: Col[] = [q(3, { chord: "F#m7b5" }), q(5), q(7), q(5), bar(), q(3), q(5, { techniques: { 2: ["hammer_on"] } }), q(7), q(5), bar(), q(3), q(5, { techniques: { 2: ["slide_up"] } }), q(7), q(9)];
/** The variant drops a note in bar 1 and two at the end, so it draws removal gaps, mid-staff and at its end. */
const VARIANT: Col[] = [q(3, { chord: "F#m7b5" }), q(5), q(5), bar(), q(3), q(5, { techniques: { 2: ["hammer_on"] } }), q(7), q(5), bar(), q(3), q(5)];

for (const v of VIEWS) {
  test(`ruler equals the one-line staff with connectors and removal gaps, ${v}`, async ({ page }) => {
    const { songUrl, playUrl } = await seedSong(
      page,
      [
        { key: "a", label: "A", columns: PARENT },
        { key: "b", label: "A'", variantOf: "a", columns: VARIANT },
      ],
      [{ part: "a" }, { part: "b" }],
    );
    await remember(page, v);
    await page.setViewportSize({ width: 1280, height: 900 });
    const bad: string[] = [];
    for (const url of [songUrl, playUrl]) {
      await page.goto(url);
      await expect(page.getByTestId("tab-ruler").first()).toBeAttached();
      await page.evaluate(() => document.fonts.ready);
      const rows = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>(".tab-wrapped-body")].map((body) => {
          const lines = body.querySelector<HTMLElement>(".tab-lines")!;
          const ruler = body.parentElement!.querySelector<HTMLElement>('[data-testid="tab-ruler"]')!;
          lines.style.flexWrap = "nowrap";
          lines.style.width = "max-content";
          lines.querySelectorAll<HTMLElement>(".tab-bar-run").forEach((r) => (r.style.flex = "none"));
          const gutter = parseFloat(getComputedStyle(body).paddingLeft);
          return {
            lines: lines.getBoundingClientRect().width + gutter,
            ruler: ruler.getBoundingClientRect().width,
            removals: body.querySelectorAll('[data-testid="tab-removal"]').length,
            connectors: body.querySelectorAll("[data-connector], .tab-connector").length,
          };
        }),
      );
      expect(rows.length).toBe(2);
      expect(rows[1].removals, "the variant draws removal gaps").toBeGreaterThan(0);
      rows.forEach((r, i) => {
        if (Math.abs(r.lines - r.ruler) > 1) bad.push(`${url.endsWith("/play") ? "play" : "song"} card ${i}: lines ${r.lines.toFixed(2)} vs ruler ${r.ruler.toFixed(2)}`);
      });
    }
    expect(bad).toEqual([]);
  });
}

// --- INV-019 the fit song settled, frets (review F4) ---
test("ruler equals the one-line staff on every card of the fit song, frets", async ({ page }) => {
  const { songUrl, playUrl } = await seedFitSong(page);
  await remember(page, "frets");
  await page.setViewportSize({ width: 1280, height: 900 });
  const bad: string[] = [];
  for (const url of [songUrl, playUrl]) {
    await page.goto(url);
    await expect(page.getByTestId("tab-ruler").first()).toBeAttached();
    await page.waitForFunction(() => {
      const lis = [...document.querySelectorAll(".reading-cards > li")];
      return lis.length > 0 && lis.every((li) => li.querySelector("[data-column]")) && document.querySelector<HTMLElement>(".reading-cards")!.style.getPropertyValue("--staff-line") !== "";
    });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(300);
    const rows = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>(".tab-wrapped-body")].map((body) => {
        const lines = body.querySelector<HTMLElement>(".tab-lines")!;
        const ruler = body.parentElement!.querySelector<HTMLElement>('[data-testid="tab-ruler"]')!;
        const before = { lines: lines.getBoundingClientRect().width, runs: lines.querySelectorAll(".tab-bar-run").length };
        lines.style.flexWrap = "nowrap";
        lines.style.width = "max-content";
        lines.querySelectorAll<HTMLElement>(".tab-bar-run").forEach((r) => (r.style.flex = "none"));
        const gutter = parseFloat(getComputedStyle(body).paddingLeft);
        return { before, lines: lines.getBoundingClientRect().width + gutter, ruler: ruler.getBoundingClientRect().width, columns: body.querySelectorAll("[data-column]").length };
      }),
    );
    rows.forEach((r, i) => {
      if (Math.abs(r.lines - r.ruler) > 1) bad.push(`${url.endsWith("/play") ? "play" : "song"} card ${i}: ${JSON.stringify(r)}`);
    });
  }
  expect(bad).toEqual([]);
});
