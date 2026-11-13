/**
 * Adopted from the round-1 review probe, spec 008 INV-002: the band wraps exactly when two whole lines fit, never shows a single wrapped line,
 * and never oscillates. Enumerates plan.md **Rows** × **Sz** × {chord form closed, open}, then a 412-wide height
 * sweep from 600 to 1000 in 20px steps (the implementation's own spec steps by 40), sampling each step three times.
 */
import { expect, test, type Page } from "@playwright/test";
import { addChord, columns, TUNINGS } from "./probe-helpers";
import { bandGeometry, GUITAR7, longPart, SIX, type Tuning } from "./polish-review-helpers";

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

/** INV-002: the mode is re-decided when the drawn line changes height while the band and the columns do not. */
const FOUR = TUNINGS[0];
const SMALL = { width: 375, height: 667 };

const verdict = async (page: Page) => {
  const g = await bandGeometry(page);
  const need = 2 * g.line + g.gap;
  return { ...g, need, fits: g.content >= need, ok: g.wrapped === g.content >= need };
};

const OPENS = [
  { label: "4 + chord + bracket at 375x667", tuning: FOUR, size: SMALL },
  // Plan Deviation 1: six strings with a chord and a bracket stay one line at 390x844 (363 < 380).
  { label: "6 + chord + bracket at 390x844", tuning: TUNINGS[2], size: { width: 390, height: 844 } },
];
for (const o of OPENS)
test(`INV-002 the mode is right after every open (${o.label}, 16 opens)`, async ({ page }, info) => {
  test.skip(info.project.name !== "mobile", "touch rows");
  const { partUrl } = await longPart(page, { tuning: o.tuning, chord: true, bracket: true, bars: 16, size: o.size });
  const bad: string[] = [];
  for (let i = 0; i < 16; i++) {
    await page.goto(partUrl);
    await expect(columns(page).first()).toBeVisible();
    await page.waitForTimeout(1200);
    const v = await verdict(page);
    if (!v.ok) bad.push(`open ${i + 1}: wrapped ${v.wrapped}, band ${v.content}, line ${v.line}, two lines need ${v.need}`);
  }
  console.log(bad.length ? bad.join("\n") : "16 of 16 right");
  expect(bad, bad.join("\n")).toEqual([]);
});

test("INV-002 a chord symbol from a second context that makes two lines no longer fit leaves wrapped mode (4 + bracket at 375x667)", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile", "touch rows");
  const { partUrl } = await longPart(page, { tuning: FOUR, chord: false, bracket: true, bars: 16, size: SMALL });
  const before = await verdict(page);
  console.log(`before: wrapped ${before.wrapped}, band ${before.content}, line ${before.line}, need ${before.need}`);
  expect(before.ok && before.wrapped, "precondition: 4 + bracket wraps at 375x667").toBe(true);

  const other = await page.context().newPage();
  await other.goto(partUrl);
  await expect(columns(other).first()).toBeVisible();
  await addChord(other, 0, "Am");
  await expect.poll(async () => (await bandGeometry(page)).line, { timeout: 5000 }).toBeGreaterThan(before.line + 1);
  await page.waitForTimeout(1200);
  const after = await verdict(page);
  console.log(`after: wrapped ${after.wrapped}, band ${after.content}, line ${after.line}, need ${after.need}`);
  expect(after.ok, `wrapped ${after.wrapped} at band ${after.content} with a line of ${after.line} (two need ${after.need})`).toBe(true);
});
