/**
 * Review probe, spec 008 round 2, INV-004: a tap on a column (a Still) on the top line in view, after the band is
 * swiped away, never moves the band. Enumerated over **Wr** (412x915 coarse, 1280x800 fine) and **Wr390**, over the
 * cursor's starting place {end, mid-part}, and over three preparations: none; a copy (so `paste` is enabled); a
 * second long part B and then a copy (the round-1 INV-003 probe's preparation). Records the band's scrollTop, its
 * size, the runway and the tapped column's top before and after, and fails once with every move it saw.
 *
 * Round 2 found the round-1 INV-003 control failing at 1280x800.
 *
 * Round 3: the 1280x800 member used 16 bars, which is one line there (every run top equal, scrollTop 0), so it could
 * not fail. It now uses 40 bars, and every member asserts that the band is wrapped and overflows before the tap.
 */
import { expect, test, type Page } from "@playwright/test";
import { columns } from "../../../e2e/probe-helpers";
import { bandGeometry, decorate, longPart, seedBars, SIX } from "./helpers";

test.setTimeout(300_000);

const CONFIGS = [
  { project: "mobile", size: { width: 412, height: 915 }, bracket: true, bars: 16, label: "412x915 coarse" },
  { project: "desktop", size: { width: 1280, height: 800 }, bracket: true, bars: 40, label: "1280x800 fine" },
  { project: "mobile", size: { width: 390, height: 844 }, bracket: false, bars: 16, label: "390x844 coarse, no bracket" },
];

const state = (page: Page, index: number) =>
  page.evaluate((index) => {
    const band = document.querySelector<HTMLElement>('[data-testid="tab-band"]')!;
    const col = document.querySelectorAll<HTMLElement>('[data-testid="tab-column"]')[index];
    return {
      scrollTop: Math.round(band.scrollTop),
      size: `${band.clientWidth}x${band.clientHeight}`,
      colTop: Math.round(col.getBoundingClientRect().top),
      runway: (band.firstElementChild as HTMLElement).style.paddingTop,
    };
  }, index);

const topLineColumn = (page: Page) =>
  columns(page).evaluateAll((els) => {
    const band = document.querySelector('[data-testid="tab-band"]')!.getBoundingClientRect();
    const seen = els.map((e, i) => ({ i, r: e.getBoundingClientRect() })).filter(({ r }) => r.top >= band.top && r.bottom <= band.bottom);
    const first = Math.min(...seen.map((x) => x.r.top));
    return seen.filter((x) => x.r.top === first)[1]?.i ?? seen[0].i;
  });

for (const config of CONFIGS)
  for (const prep of ["none", "copy", "part B and copy"] as const) {
    test(`INV-004 a tap on the top line after a swipe does not move the band (${config.label}, prep: ${prep})`, async ({ page }, info) => {
      test.skip(info.project.name !== config.project, `runs on ${config.project}`);
      const { partUrl } = await longPart(page, { chord: true, bracket: config.bracket, bars: config.bars, size: config.size });
      if (prep === "part B and copy") {
        await page.getByRole("button", { name: "Add a part" }).click();
        await expect(page).not.toHaveURL(partUrl);
        await expect(columns(page)).toHaveCount(0);
        await decorate(page, { chord: true });
        await seedBars(page, page.url().split("/").pop()!, SIX.strings, 16);
        await page.goto(partUrl);
        await page.waitForTimeout(700);
      }
      if (prep !== "none") {
        await columns(page).nth(5).click();
        await page.getByRole("button", { name: /^select$/ }).click();
        await columns(page).nth(6).click();
        await page.getByTestId("toolbar-selection").getByTitle("Copy").click();
        await page.getByTestId("toolbar-selection").getByRole("button", { name: "cancel" }).click({ timeout: 1000 }).catch(() => undefined);
        await page.waitForTimeout(650);
      }
      const moves: string[] = [];
      for (const from of ["end", "mid"] as const) {
        if (from === "end") await page.getByTestId("status-row").getByRole("button", { name: "end ⇥" }).click();
        else await columns(page).nth(20).click();
        await page.waitForTimeout(700);
        await page.evaluate(() => {
          const band = document.querySelector<HTMLElement>('[data-testid="tab-band"]')!;
          band.scrollTop = -(band.scrollHeight - band.clientHeight);
        });
        await page.waitForTimeout(300);
        const index = await topLineColumn(page);
        const before = await state(page, index);
        const gBefore = await bandGeometry(page);
        expect(gBefore.wrapped && gBefore.overflows && gBefore.lines > 1, `${config.label} from ${from}: the band must be wrapped and overflow`).toBe(true);
        await columns(page).nth(index).click();
        await page.waitForTimeout(900);
        const after = await state(page, index);
        const g = await bandGeometry(page);
        console.log(
          `[${config.label} | ${prep} | from ${from}] col ${index} ${JSON.stringify(before)} -> ${JSON.stringify(after)}; ` +
            `cursorBottom ${gBefore.cursorBottom} -> ${g.cursorBottom}, band bottom ${g.bottom}, runTops ${g.runTops.join(",")}`,
        );
        if (Math.abs(after.scrollTop - before.scrollTop) > 1 || Math.abs(after.colTop - before.colTop) > 1)
          moves.push(`from ${from}: ${JSON.stringify(before)} -> ${JSON.stringify(after)}`);
      }
      expect(moves, moves.join("\n")).toEqual([]);
    });
  }
