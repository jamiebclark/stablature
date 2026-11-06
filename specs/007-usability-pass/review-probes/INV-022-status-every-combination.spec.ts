/**
 * INV-022 over **Lat** x every status text x {no chord, Am, a 10-character chord, an unknown chord} x {end, start,
 * mid-part} at 375. usability-staff.spec.ts checks one state: no chord, no latch, at the end.
 */
import { expect, test, type Locator, type Page } from "@playwright/test";
import { CHIPS, latch, stackLatch } from "../../../e2e/capture-surface-helpers";
import { n, seedSong } from "../../../e2e/reading-helpers";

test.setTimeout(240_000);
test.skip(({ isMobile }) => !isMobile, "the row is budgeted at 375 on touch");

const CHORDS: { name: string; symbol: string | null }[] = [
  { name: "no chord", symbol: null },
  { name: "Am", symbol: "Am" },
  { name: "a 10-character chord", symbol: "Cm7b5add11" },
  { name: "an unknown chord", symbol: "Xylophone1" },
];

/** Each state is the latches to press, in order. A latch disabled here is not a member of this position. */
const LATCHES: { name: string; press: (page: Page) => Locator[] }[] = [
  { name: "none", press: () => [] },
  { name: "stack", press: (p) => [stackLatch(p)] },
  ...CHIPS.map((c) => ({ name: c.name, press: (p: Page) => [latch(p, c.name)] })),
  { name: "stack and a transition", press: (p: Page) => [stackLatch(p), latch(p, "slide down")] },
  { name: "stack and two transitions", press: (p: Page) => [stackLatch(p), latch(p, "hammer-on"), latch(p, "slide down")] },
];

const POSITIONS: { name: string; go: (page: Page) => Promise<void> }[] = [
  { name: "at the end", go: async () => {} },
  { name: "at the start", go: async (p) => void (await p.getByRole("button", { name: /start$/ }).click()) },
  { name: "mid-part", go: async (p) => void (await p.getByTestId("tab-column").nth(1).click()) },
];

/** Reads the row. Every child must end inside it, and the status words and the symbol must be whole. */
const read = (page: Page, symbol: string | null) =>
  page.getByTestId("status-row").evaluate((row, sym) => {
    const box = row.getBoundingClientRect();
    const right = box.right - parseFloat(getComputedStyle(row).paddingRight);
    const kids = [...row.children] as HTMLElement[];
    const status = kids[0];
    const buttons = kids.filter((k) => k.tagName === "BUTTON");
    const problems: string[] = [];
    if (status.scrollWidth > status.clientWidth + 0.5) problems.push(`status cut: ${status.textContent}`);
    if (status.getBoundingClientRect().right > right + 0.5) problems.push(`status past the row: ${status.textContent}`);
    if (buttons.length !== 2) problems.push(`${buttons.length} jump buttons`);
    for (const b of buttons) {
      const r = b.getBoundingClientRect();
      if (r.right > right + 0.5) problems.push(`${b.textContent} clipped by ${(r.right - right).toFixed(1)}px`);
      if (r.width < 43.5 || r.height < 23.5) problems.push(`${b.textContent} ${r.width}x${r.height}`);
    }
    if (sym) {
      const walker = document.createTreeWalker(row, NodeFilter.SHOW_TEXT);
      for (let t = walker.nextNode(); t; t = walker.nextNode()) {
        const at = t.textContent?.indexOf(sym) ?? -1;
        if (at < 0) continue;
        const range = document.createRange();
        range.setStart(t, at);
        range.setEnd(t, at + sym.length);
        const holder = t.parentElement!;
        const shown = holder.getBoundingClientRect();
        if (range.getBoundingClientRect().right > Math.min(shown.right, right) + 0.5) problems.push(`symbol cut: ${sym}`);
      }
    }
    return { problems, status: status.textContent ?? "", h: box.height };
  }, symbol);

for (const chord of CHORDS) {
  test(`INV-022 ${chord.name}`, async ({ page }) => {
    const columns = [
      n(3, { d: "32", chord: chord.symbol ?? undefined }),
      n(5, { d: "32" }),
      n(7, { d: "32" }),
      n(8, { d: "32" }),
    ];
    const { songId, parts } = await seedSong(page, [{ key: "a", label: "A", columns }], [{ part: "a" }]);
    await page.setViewportSize({ width: 375, height: 667 });
    const bad: string[] = [];
    let seen = 0;
    for (const position of POSITIONS) {
      for (const armed of LATCHES) {
        await page.goto(`/songs/${songId}/capture/${parts.a}`);
        await expect(page.getByTestId("tab-column").first()).toBeVisible();
        await position.go(page);
        let reachable = true;
        for (const control of armed.press(page)) {
          if (!(await control.isEnabled({ timeout: 1500 }))) {
            reachable = false;
            break;
          }
          await control.click();
        }
        if (!reachable) continue;
        await page.waitForTimeout(60);
        const r = await read(page, chord.symbol);
        seen += 1;
        expect(r.h).toBeLessThanOrEqual(26.5);
        bad.push(...r.problems.map((p) => `${position.name}, ${armed.name} [${r.status}]: ${p}`));
      }
    }
    expect(seen).toBeGreaterThan(10);
    expect(bad).toEqual([]);
  });
}

test("INV-022 a refusal keeps its words and cuts only the chord (Deviation 3)", async ({ page }) => {
  const { songId, parts } = await seedSong(
    page,
    [{ key: "a", label: "A", columns: [n(3, { chord: "Cm7b5add11" }), n(5)] }],
    [{ part: "a" }],
  );
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto(`/songs/${songId}/capture/${parts.a}`);
  await page.getByRole("button", { name: "Triplet", exact: true }).click();
  await expect(page.getByText("a triplet needs three columns in one bar")).toBeVisible();
  const r = await read(page, null);
  expect(r.problems).toEqual([]);
});

test("INV-022 the waiting digit fits beside the longest status and a 10-character chord", async ({ page }) => {
  const { songId, parts } = await seedSong(
    page,
    [{ key: "a", label: "A", columns: [n(3, { chord: "Cm7b5add11", d: "32" }), n(5, { d: "32" })] }],
    [{ part: "a" }],
  );
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto(`/songs/${songId}/capture/${parts.a}`);
  await page.getByTestId("tab-column").nth(1).click();
  await stackLatch(page).click();
  await page.keyboard.press("1");
  await expect(page.getByTestId("digit-waiting")).toBeVisible();
  const r = await read(page, "Cm7b5add11");
  expect(r.problems).toEqual([]);
});
