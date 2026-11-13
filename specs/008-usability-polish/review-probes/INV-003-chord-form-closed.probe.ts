/**
 * Review probe, spec 008 round 3, INV-003: the one member of plan.md **Trig** that `INV-003-every-trigger.probe.ts`
 * does not run, "band resize: chord form closed": closing the form with Cancel writes nothing and only gives the
 * band back its height. After it, at rest, the cursor's line must be the band's bottom line when the part overflows.
 *
 * Enumerated over **Wr** (412x915 coarse with 16 bars; 1280x800 fine with 40 bars) and **Wr390**, × the positions
 * where the form exists (a column under the cursor): end, mid-part on the last line, mid-part on an upper line.
 * Before Cancel the band is swiped away, and the probe checks that the swipe really took the cursor's line off the
 * bottom, so a pass is evidence.
 *
 * With six strings the open form leaves room for one line only, so there Cancel is also "entering wrapped mode". The
 * 4-string configs keep two lines with the form open, so Cancel is a pure resize of a band that stays wrapped.
 * The blank clause ("less than one line") is INV-003's, and holds at the end only: mid-part, the runway above line 1
 * or 2 is blank by design.
 */
import { expect, test, type Page } from "@playwright/test";
import { columns, TUNINGS } from "../../../e2e/probe-helpers";
import { bandGeometry, longPart, swipeAway } from "./helpers";

test.setTimeout(300_000);

type Pos = "end" | "mid-last" | "mid-upper";

async function setPos(page: Page, pos: Pos) {
  if (pos === "end") {
    await page.getByTestId("status-row").getByRole("button", { name: "end ⇥" }).click();
  } else {
    const index = await columns(page).evaluateAll((els, pos) => {
      const runs = [...new Set(els.map((e) => e.closest(".tab-bar-run")!))];
      const run = pos === "mid-last" ? runs[runs.length - 1] : runs[Math.floor(runs.length / 2)];
      const mine = els.filter((e) => e.closest(".tab-bar-run") === run);
      return els.indexOf(mine[Math.min(1, mine.length - 1)]);
    }, pos);
    await columns(page).nth(index).click();
  }
  await page.waitForTimeout(650);
}

const FOUR = TUNINGS[0];
const CONFIGS = [
  { project: "mobile", size: { width: 412, height: 915 }, bracket: false, bars: 16, tuning: FOUR, label: "4 strings, 412x915 coarse (stays wrapped)" },
  { project: "desktop", size: { width: 1280, height: 800 }, bracket: false, bars: 120, tuning: FOUR, label: "4 strings, 1280x800 fine, 120 bars (stays wrapped)" },
  { project: "mobile", size: { width: 412, height: 915 }, bracket: true, bars: 16, label: "Wr 412x915 coarse" },
  { project: "desktop", size: { width: 1280, height: 800 }, bracket: true, bars: 40, label: "Wr 1280x800 fine, 40 bars" },
  { project: "mobile", size: { width: 390, height: 844 }, bracket: false, bars: 16, label: "Wr390 390x844 coarse, no bracket" },
];

for (const config of CONFIGS) {
  test(`INV-003 closing the chord form anchors the cursor's line (${config.label})`, async ({ page }, info) => {
    test.skip(info.project.name !== config.project, `runs on ${config.project}`);
    await longPart(page, { tuning: "tuning" in config ? config.tuning : undefined, chord: true, bracket: config.bracket, bars: config.bars, size: config.size });
    const misses: string[] = [];
    const report: string[] = [];
    for (const pos of ["end", "mid-last", "mid-upper"] as Pos[]) {
      await setPos(page, pos);
      await page.getByRole("button", { name: "chord symbol" }).click();
      await expect(page.getByRole("textbox", { name: "Chord" })).toBeVisible();
      await page.waitForTimeout(650);
      const open = await bandGeometry(page);
      await swipeAway(page);
      await page.waitForTimeout(300);
      const swiped = await bandGeometry(page);
      const away = swiped.cursorBottom === null || Math.abs(swiped.cursorBottom - swiped.bottom) > 1;
      await page.getByRole("button", { name: /^cancel$/i }).click();
      await expect(page.getByRole("textbox", { name: "Chord" })).toHaveCount(0);
      await page.waitForTimeout(650);
      const g = await bandGeometry(page);
      const line = `${pos}: band ${open.content} (${open.wrapped ? "wrapped" : "one line"}) -> ${g.content}, swiped away ${away}, cursor bottom ${g.cursorBottom} vs band bottom ${g.bottom}, blank ${g.blank.toFixed(1)} (line ${g.line})`;
      report.push(line);
      if (!g.wrapped || !g.overflows) misses.push(`${line}: not a wrapped, overflowing band`);
      else if (!away) misses.push(`${line}: the swipe did not take the cursor's line off the bottom, so this checks nothing`);
      else if (g.content === open.content) misses.push(`${line}: closing the form did not resize the band`);
      else if (g.cursorBottom === null || Math.abs(g.cursorBottom - g.bottom) > 1 || (pos === "end" && g.blank >= g.line)) misses.push(`${line}: NOT ANCHORED`);
    }
    console.log(`[${config.label}]\n  ${report.join("\n  ")}`);
    expect(misses, misses.join("\n")).toEqual([]);
  });
}
