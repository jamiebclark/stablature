/**
 * INV-006 / FR-008 / T066, round 2: the row's y over every shape x {4, 5, 6 strings}, including the
 * sheets too tall for the screen. `INV-006-row-every-column.spec.ts` only ran on the seeded 5-string
 * tuning, one group shape and no chord symbol, so its tallest sheet still fitted.
 *
 * Each shape records where the row is when the sheet opens: y, whether all of it is on screen with no
 * scrolling, and whether the sheet had to scroll. One y per tuning, all of it on screen, is the rule.
 */
import { expect, test, type Page } from "@playwright/test";
import { addChord, columns, details, inspector, startWith } from "./capture-surface-helpers";
import { writeColumns, type Col } from "./rhythm-probe-helpers";

const TUNINGS = [
  { family: "Bass 4", preset: "E Standard", strings: 4 },
  { family: "Bass 5", preset: "B Standard", strings: 5 },
  { family: "Guitar 6", preset: "E Standard", strings: 6 },
] as const;

const chord = (n: number) => Object.fromEntries(Array.from({ length: n }, (_, i) => [String(i), 5]));
const group = { tupletId: "g", tupletCount: 3, groupKind: "tuplet" as const };

interface Shape {
  name: string;
  col: Col;
  symbol?: string;
}

function shapes(strings: number): Shape[] {
  const out: Shape[] = [
    { name: "note", col: { frets: { 0: 5 } } },
    { name: "space", col: { kind: "rest", frets: {} } },
    { name: "grouped note", col: { frets: { 0: 5 }, ...group } },
    { name: "note with a symbol", col: { frets: { 0: 5 } }, symbol: "Am" },
    {
      name: "every technique",
      col: { frets: { 0: 5 }, techniques: { 0: ["vibrato", "harmonic", "let_ring", "bend", "tap", "palm_mute"] } },
    },
  ];
  for (let n = 2; n <= strings; n++) out.push({ name: `chord of ${n}`, col: { frets: chord(n) } });
  out.push({ name: `grouped chord of ${strings}`, col: { frets: chord(strings), tupletId: "h", tupletCount: 3, groupKind: "tuplet" } });
  out.push({ name: `chord of ${strings} with a symbol`, col: { frets: chord(strings) }, symbol: "Dm7" });
  return out;
}

async function rowAtOpening(page: Page, index: number) {
  await columns(page).nth(index).click();
  await details(page).click();
  await expect(inspector(page)).toBeVisible();
  const buttons = page.getByTestId("duration-row").getByRole("button");
  await expect(buttons).toHaveCount(6);
  const at = await page.evaluate(() => {
    const dialog = document.querySelector("dialog[open]") as HTMLElement;
    const row = document.querySelector('[data-testid="duration-row"]') as HTMLElement;
    const r = row.getBoundingClientRect();
    return {
      y: Math.round(r.y),
      bottom: Math.round(r.bottom),
      sheet: Math.round(dialog.getBoundingClientRect().height),
      content: dialog.scrollHeight,
      screen: innerHeight,
    };
  });
  await page.keyboard.press("Escape");
  await expect(page.locator("dialog[open]")).toHaveCount(0);
  return at;
}

for (const theme of ["light", "dark"] as const) {
  for (const t of TUNINGS) {
    test(`INV-006 one y, on screen, on every shape: ${t.strings} strings, ${theme}`, async ({ page }, info) => {
      test.skip(info.project.name !== "mobile" && theme === "dark", "the dark run on mobile already covers the theme");
      await page.emulateMedia({ colorScheme: theme });
      await page.setViewportSize({ width: 375, height: 667 });
      const { partUrl } = await startWith(page, t.family, t.preset, t.strings);
      const partId = /\/capture\/([0-9a-f-]+)/.exec(partUrl)![1];
      await page.goto(partUrl);
      // A row must exist for the raw write to copy, so make one through the neck first.
      await page.getByRole("button", { name: /string, fret 5,/ }).first().click();
      await expect(columns(page)).toHaveCount(1);
      const list = shapes(t.strings);
      await writeColumns(page, partId, list.map((s) => s.col));
      await page.goto(partUrl);
      await expect(columns(page)).toHaveCount(list.length);
      for (const [i, s] of list.entries()) {
        if (s.symbol) await addChord(page, i, s.symbol);
      }

      const seen: { name: string; y: number; bottom: number; sheet: number; content: number }[] = [];
      for (const [i, s] of list.entries()) {
        const at = await rowAtOpening(page, i);
        seen.push({ name: s.name, y: at.y, bottom: at.bottom, sheet: at.sheet, content: at.content });
      }
      console.log(`ROW ${t.strings} strings ${theme}: ${JSON.stringify(seen)}`);

      const offScreen = seen.filter((s) => s.bottom > 667).map((s) => `${s.name} (bottom ${s.bottom})`);
      expect(offScreen, "shapes whose row opens below the screen").toEqual([]);
      expect(new Set(seen.map((s) => s.y)).size, JSON.stringify(seen)).toBe(1);
    });
  }
}
