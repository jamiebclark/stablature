/**
 * Review probe, spec 008 round 2, INV-002: the band wraps exactly when two whole lines fit, also when the drawn
 * line's height changes while the band's size and the part's columns do not.
 *
 * `useCaptureBand` re-decides the mode only when `content` (the part's columns), the band's size or the mode
 * changes (`src/components/capture/useCaptureBand.ts:111`). The line's height also depends on the chord row, which
 * comes from the annotations, and CaptureScreen passes only `events` as `content`. So:
 *   1. On open, when the columns arrive before the chord annotations, the decision is made on a line without its
 *      chord row and is never re-made (the round-2 e2e failure of `polish-band-rows-sizes.spec.ts`, 4 + chord +
 *      bracket at 375x667, wrapped at band 258 < 2 x 134.4 + 12).
 *   2. A chord symbol that arrives from a second context makes the line taller, with no column and no size change.
 */
import { expect, test, type Page } from "@playwright/test";
import { addChord, columns, TUNINGS } from "../../../e2e/probe-helpers";
import { bandGeometry, longPart } from "./helpers";

test.setTimeout(300_000);

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
