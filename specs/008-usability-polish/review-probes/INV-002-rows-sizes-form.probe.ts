/**
 * Review probe, spec 008 INV-002: the band wraps exactly when two whole lines fit, never shows a single wrapped line,
 * and never oscillates. Enumerates plan.md **Rows** × **Sz** × {chord form closed, open}, then a 412-wide height
 * sweep from 600 to 1000 in 20px steps (the implementation's own spec steps by 40), sampling each step three times.
 */
import { expect, test, type Page } from "@playwright/test";
import { columns, TUNINGS } from "../../../e2e/probe-helpers";
import { bandGeometry, GUITAR7, longPart, SIX, type Tuning } from "./helpers";

test.setTimeout(600_000);

const ROWS: { label: string; tuning: Tuning; chord: boolean; bracket: boolean }[] = [
  { label: "6 plain", tuning: SIX, chord: false, bracket: false },
  { label: "6 + chord", tuning: SIX, chord: true, bracket: false },
  { label: "6 + chord + bracket", tuning: SIX, chord: true, bracket: true },
  { label: "4 + chord + bracket", tuning: TUNINGS[0], chord: true, bracket: true },
  { label: "5 + chord + bracket", tuning: TUNINGS[1], chord: true, bracket: true },
  { label: "7 + chord + bracket", tuning: GUITAR7, chord: true, bracket: true },
];
const SZ = {
  mobile: [
    { width: 375, height: 667 },
    { width: 390, height: 844 },
    { width: 412, height: 915 },
  ],
  desktop: [{ width: 1280, height: 800 }],
} as const;

async function check(page: Page, label: string, bad: string[], seen: string[]) {
  await page.waitForTimeout(600);
  const g = await bandGeometry(page);
  const fits = g.content >= 2 * g.line + g.gap;
  seen.push(`${label}: content ${g.content.toFixed(1)}, line ${g.line.toFixed(1)}, gap ${g.gap}, wrapped ${g.wrapped}, lines ${g.lines}`);
  if (g.wrapped !== fits) bad.push(`${label}: wrapped ${g.wrapped} but two lines ${fits ? "fit" : "do not fit"} (content ${g.content}, 2 lines + gap ${2 * g.line + g.gap})`);
  if (g.wrapped) {
    const inView = await page.evaluate(() => {
      const band = document.querySelector('[data-testid="tab-band"]')!.getBoundingClientRect();
      const tops = [...document.querySelectorAll(".tab-bar-run")]
        .map((r) => r.getBoundingClientRect())
        .filter((r) => r.bottom > band.top + 1 && r.top < band.bottom - 1)
        .map((r) => Math.round(r.top));
      return new Set(tops).size;
    });
    if (inView < Math.min(2, g.lines)) bad.push(`${label}: wrapped with ${inView} line(s) in view`);
  }
}

for (const row of ROWS) {
  for (const project of ["mobile", "desktop"] as const) {
    test(`INV-002 ${row.label} at every size, chord form closed and open (${project})`, async ({ page }, info) => {
      test.skip(info.project.name !== project, project);
      await longPart(page, { tuning: row.tuning, chord: row.chord, bracket: row.bracket, bars: 16, size: SZ[project][0] });
      const bad: string[] = [];
      const seen: string[] = [];
      for (const size of SZ[project]) {
        await page.setViewportSize(size);
        // The cursor at the end: at the start, line 1 sits alone at the bottom by design (spec edge case).
        await page.getByTestId("status-row").getByRole("button", { name: "end ⇥" }).click();
        await check(page, `${row.label} ${size.width}x${size.height} form closed`, bad, seen);
        await columns(page).last().click();
        await page.getByRole("button", { name: "chord symbol" }).click();
        await expect(page.getByRole("textbox", { name: "Chord" })).toBeVisible();
        await check(page, `${row.label} ${size.width}x${size.height} form open`, bad, seen);
        await page.keyboard.press("Escape");
        await page.getByRole("button", { name: /^cancel$/i }).click({ timeout: 500 }).catch(() => undefined);
        await expect(page.getByRole("textbox", { name: "Chord" })).toHaveCount(0);
      }
      for (const s of seen) console.log(`  ${s}`);
      expect(bad).toEqual([]);
    });
  }
}

test("INV-002 a 20px height sweep at 412 wide never flips back and forth", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile", "touch rows");
  await longPart(page, { chord: true, bracket: true, bars: 16, size: { width: 412, height: 600 } });
  const bad: string[] = [];
  const modes: boolean[] = [];
  for (let height = 600; height <= 1000; height += 20) {
    await page.setViewportSize({ width: 412, height });
    const samples: boolean[] = [];
    for (let i = 0; i < 3; i++) {
      await page.waitForTimeout(200);
      const g = await bandGeometry(page);
      samples.push(g.wrapped);
      if (g.wrapped !== g.content >= 2 * g.line + g.gap) bad.push(`412x${height}: wrapped ${g.wrapped}, content ${g.content}, need ${2 * g.line + g.gap}`);
    }
    if (new Set(samples).size > 1) bad.push(`412x${height}: mode changed while the size held (${samples.join(",")})`);
    modes.push(samples[2]);
  }
  const flips = modes.filter((m, i) => i > 0 && m !== modes[i - 1]).length;
  if (flips > 1) bad.push(`mode flipped ${flips} times over a rising sweep: ${modes.join(",")}`);
  expect(bad).toEqual([]);
});
