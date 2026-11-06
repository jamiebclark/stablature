/**
 * INV-006, INV-010 and INV-018 over all of **Scr** x **Sz** x **Th**. usability-floors.spec.ts walks eleven of the
 * twenty-seven states and usability-contrast.spec.ts two. A failure names the screen, size and theme.
 */
import { expect, test, type Page } from "@playwright/test";
import { addRests, startWith, TUNINGS } from "../../../e2e/probe-helpers";
import { FLOORS, SENTENCE_LINKS } from "../../../e2e/usability-helpers";
import { fullWorld, lowContrast, reach, readTargets, SCREENS, smallFields, type Target } from "./screens";

test.setTimeout(420_000);

const floorOf = (t: Target, touch: boolean): { w: number; h: number } | null => {
  const f = (k: keyof typeof FLOORS) => FLOORS[k][touch ? "touch" : "mouse"];
  if (t.testId === "tab-column") return null;
  if (/^Dead note on/.test(t.name)) return f("deadNoteCell");
  if (/string, fret/.test(t.name)) return f("fretCell");
  if (t.row === "latch-strip") return f("latchChip");
  if (t.row === "status-row") return f("jump");
  if (/one (fewer|more)/i.test(t.name)) return f("stepperHalf");
  if (t.row === "toolbar-selection") return { w: f("bracketControl").w, h: f("toolbarControl").h };
  if (t.row === "capture-title-row" && /^[A-Z]\d?$/.test(t.text)) return f("partChip");
  if (t.row === "capture-title-row" && /^Back to/.test(t.name)) return f("backToSong");
  return f("everythingElse");
};

function under(list: Target[], touch: boolean, where: string) {
  const bad: string[] = [];
  for (const t of list) {
    if (t.sentence && SENTENCE_LINKS.some((s) => s.text === t.text)) continue;
    const floor = floorOf(t, touch);
    if (!floor) continue;
    // The spec's row: "44 wide or as wide as its label". A control with no text has no label to be as wide as.
    const wide = t.w >= floor.w - 0.5 || (t.text.length > 0 && t.w >= t.textWidth - 0.5);
    if (t.h < floor.h - 0.5 || !wide) {
      bad.push(`${where}: ${t.tag} "${t.name}" ${Math.round(t.w)}x${Math.round(t.h)} under ${floor.w}x${floor.h}`);
    }
  }
  return bad;
}

const SIZES = [
  { name: "375x667", width: 375, height: 667 },
  { name: "390x844", width: 390, height: 844 },
];

async function walkAll(page: Page, touch: boolean, sizes: { name: string; width: number; height: number }[], theme: "dark" | "light") {
  await page.emulateMedia({ colorScheme: theme });
  const world = await fullWorld(page);
  const floors: string[] = [];
  const contrast: string[] = [];
  const fields: string[] = [];
  for (const size of sizes) {
    await page.setViewportSize({ width: size.width, height: size.height });
    for (const visit of SCREENS) {
      const where = `${visit[0]} @${size.name} ${theme}`;
      await reach(page, visit, world);
      floors.push(...under(await readTargets(page), touch, where));
      contrast.push(...(await lowContrast(page)).map((x) => `${where}: ${x}`));
      if (touch) fields.push(...(await smallFields(page, 16)).map((x) => `${where}: ${x}`));
      await page.evaluate(() => {
        for (const d of document.querySelectorAll("dialog[open]")) (d as HTMLDialogElement).close();
      });
    }
  }
  return { floors: [...new Set(floors)], contrast: [...new Set(contrast)], fields: [...new Set(fields)] };
}

for (const theme of ["dark", "light"] as const) {
  test(`INV-006 INV-010 INV-018 every screen on touch, ${theme}`, async ({ page, isMobile }) => {
    test.skip(!isMobile, "the touch column");
    const r = await walkAll(page, true, SIZES, theme);
    expect.soft(r.contrast, "INV-018 text under 4.5:1").toEqual([]);
    expect.soft(r.fields, "INV-010 fields under 16px").toEqual([]);
    expect(r.floors, "INV-006 targets under their floor").toEqual([]);
  });

  test(`INV-006 INV-018 every screen on a mouse, ${theme}`, async ({ page, isMobile }) => {
    test.skip(isMobile, "the mouse column");
    const r = await walkAll(page, false, [{ name: "1280x800", width: 1280, height: 800 }], theme);
    expect.soft(r.contrast, "INV-018 text under 4.5:1").toEqual([]);
    expect(r.floors, "INV-006 targets under their floor").toEqual([]);
  });
}

for (const tuning of TUNINGS) {
  test(`INV-006 INV-018 capture at rest on ${tuning.strings} strings, both sizes and themes`, async ({ page, isMobile }) => {
    test.skip(!isMobile, "the touch column");
    await startWith(page, tuning);
    await addRests(page, 6);
    const floors: string[] = [];
    const contrast: string[] = [];
    for (const size of SIZES) {
      for (const theme of ["dark", "light"] as const) {
        await page.setViewportSize({ width: size.width, height: size.height });
        await page.emulateMedia({ colorScheme: theme });
        // Long enough for a fret cell's colour transition to finish: read mid-way it reads 3.82 under load.
        await page.waitForTimeout(450);
        const where = `${size.name} ${theme}`;
        floors.push(...under(await readTargets(page), true, where));
        contrast.push(...(await lowContrast(page)).map((x) => `${where}: ${x}`));
      }
    }
    expect.soft(contrast).toEqual([]);
    expect([...new Set(floors)]).toEqual([]);
  });
}

test("INV-006 INV-018 the empty band list", async ({ page, isMobile }) => {
  await page.goto("/");
  await page.waitForTimeout(200);
  expect(under(await readTargets(page), isMobile, "bands empty")).toEqual([]);
  expect(await lowContrast(page)).toEqual([]);
});
