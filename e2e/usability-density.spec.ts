import { expect, test, type Page } from "@playwright/test";
import { startCapturing } from "./capture-surface-helpers";

test.setTimeout(120_000);

/**
 * INV-014: sizes follow the pointer, never the window. Touch sizes equal the floors table and each other
 * across windows; a 500px mouse uses mouse sizes; an 820px tablet uses touch sizes. The pointer comes from
 * the project (mobile = coarse, desktop = fine, no-pointer = none), and the test asserts its own
 * `matchMedia` first so a flag that did not take fails here rather than as a wrong size.
 */
const PTR: Record<string, "coarse" | "fine" | "none"> = { mobile: "coarse", desktop: "fine", "no-pointer": "none" };
const WINDOWS = [
  { w: 375, h: 667 },
  { w: 500, h: 800 },
  { w: 820, h: 1180 },
  { w: 1280, h: 800 },
];
// Fine is mouse sizes; coarse and none are touch (the defaults).
const EXPECT = {
  touch: { fret: 36, dead: 28, control: 44, chip: 31, string: 24.8 },
  mouse: { fret: 32, dead: 24, control: 32, chip: 26, string: 20.8 },
} as const;

async function measure(page: Page) {
  const h = (loc: ReturnType<Page["locator"]>) => loc.first().boundingBox().then((b) => b?.height ?? -1);
  const w = (loc: ReturnType<Page["locator"]>) => loc.first().boundingBox().then((b) => b?.width ?? -1);
  const fretCell = page.getByRole("button", { name: /string, fret 5,/ });
  await fretCell.first().scrollIntoViewIfNeeded();
  return {
    fret: await h(fretCell),
    fretW: await w(fretCell),
    dead: await h(page.getByRole("button", { name: /^Dead note on/ })),
    control: await h(page.getByTestId("toolbar-stable").locator("button")),
    chip: await h(page.getByTestId("latch-strip").locator("button")),
    column: await w(page.getByTestId("tab-column")),
    string: await page.locator(".tab-cell").first().evaluate((el) => el.getBoundingClientRect().height),
  };
}

test("INV-014 sizes follow the pointer and not the window", async ({ page }, info) => {
  const ptr = PTR[info.project.name];
  test.skip(!ptr, "pointer projects only");
  await startCapturing(page);
  await page.getByRole("button", { name: /string, fret 5,/ }).first().click();

  const actual = await page.evaluate(() => ({
    fine: matchMedia("(pointer: fine)").matches,
    coarse: matchMedia("(pointer: coarse)").matches,
    none: matchMedia("(pointer: none)").matches,
  }));
  expect(actual[ptr], `the ${info.project.name} project did not give a ${ptr} pointer`).toBe(true);

  const want = ptr === "fine" ? EXPECT.mouse : EXPECT.touch;
  let first: Awaited<ReturnType<typeof measure>> | undefined;
  for (const win of WINDOWS) {
    await page.setViewportSize({ width: win.w, height: win.h });
    const m = await measure(page);
    const at = `${ptr} at ${win.w}x${win.h}`;
    expect(m.fret, `fret cell ${at}`).toBeCloseTo(want.fret, 0);
    expect(m.fretW, `fret cell width ${at}`).toBeCloseTo(want.fret, 0);
    expect(m.dead, `dead-note cell ${at}`).toBeCloseTo(want.dead, 0);
    expect(m.control, `toolbar control ${at}`).toBeGreaterThanOrEqual(want.control - 0.5);
    expect(m.chip, `chip ${at}`).toBeCloseTo(want.chip, 0);
    expect(m.string, `string height ${at}`).toBeCloseTo(want.string, 0);
    first ??= m;
    expect(m.column, `column ${at}`).toBeCloseTo(first.column, 0);
  }
});

// INV-020 (a mouse fits more columns and a shorter staff) runs with a real pointer on each side in usability-two-pointers.spec.ts.
