/**
 * INV-022 and FR-026, round 4. Round 3's probe crossed a waiting digit with armed states and, separately, a refusal with
 * every symbol. Neither crossed the two, and a refusal holds until the cursor moves, so a digit typed during one is a
 * reachable state: the refusal's words, `fret N…` and both jump buttons on one row. Oracle: Deviation 3, the refusal keeps
 * its words and cuts only the chord, and surfaces.md's table, jump buttons at least 44×24 that never give way.
 *
 * Two edges are read, because they are not the same thing. The row is `overflow: hidden`, which clips at its PADDING box,
 * so a button past the content edge is still whole until it passes the row's own right edge. "cut" is the padding box:
 * what a person loses. "overrun" is the content edge: what round 3's probe read. Only "cut" is the invariant. The tap is
 * proved by `elementFromPoint` at the button's far edge, not by arithmetic.
 * Filter: rects, hit tests and the row's own text. No class is read.
 */
import { expect, test, type Locator, type Page } from "@playwright/test";
import { latch, stackLatch } from "../../../e2e/capture-surface-helpers";
import { n, seedSong } from "../../../e2e/reading-helpers";

test.setTimeout(200_000);
test.skip(({ isMobile }) => !isMobile, "the row is budgeted at 375 on touch");

const SYMBOLS = [
  { name: "no chord", symbol: undefined },
  { name: "Am", symbol: "Am" },
  { name: "10 known", symbol: "Cm7b5add11" },
  { name: "14 known", symbol: "Cmaj7add9add11" },
  { name: "4 unknown", symbol: "Xylo" },
  { name: "10 unknown", symbol: "Xylophone1" },
  { name: "19 unknown", symbol: "Xylophone Solo Part" },
  { name: "80 unknown", symbol: "Xylophone ".repeat(8) },
];

const ARMED: { name: string; press: (page: Page) => Locator[] }[] = [
  { name: "none", press: () => [] },
  { name: "stack", press: (p) => [stackLatch(p)] },
  { name: "a transition", press: (p) => [latch(p, "slide down")] },
  { name: "stack and a transition", press: (p) => [stackLatch(p), latch(p, "slide down")] },
];

const POSITIONS: { name: string; go: (page: Page) => Promise<void> }[] = [
  { name: "at the end", go: async () => {} },
  { name: "mid-part", go: async (p) => void (await p.getByTestId("tab-column").nth(0).click()) },
];

const read = (page: Page) =>
  page.getByTestId("status-row").evaluate((row) => {
    const box = row.getBoundingClientRect();
    const content = box.right - parseFloat(getComputedStyle(row).paddingRight);
    const kids = [...row.children] as HTMLElement[];
    const status = kids[0];
    const buttons = kids.filter((k) => k.tagName === "BUTTON");
    const problems: string[] = [];
    let overrun = 0;
    if (status.scrollWidth > status.clientWidth + 0.5) problems.push(`status cut: ${status.textContent}`);
    if (status.getBoundingClientRect().right > box.right + 0.5) problems.push("status past the row");
    if (buttons.length !== 2) problems.push(`${buttons.length} jump buttons`);
    for (const b of buttons) {
      const r = b.getBoundingClientRect();
      overrun = Math.max(overrun, r.right - content);
      const seen = Math.min(r.right, box.right) - r.left;
      if (seen < 43.5 || r.height < 23.5) problems.push(`${b.textContent} seen at ${seen.toFixed(1)}x${r.height}`);
      for (const x of [r.left + 1, r.right - 1]) {
        if (!b.contains(document.elementFromPoint(x, r.top + r.height / 2))) problems.push(`${b.textContent} does not take a tap at x=${x.toFixed(1)}`);
      }
    }
    return { problems, overrun, text: (row as HTMLElement).innerText.replace(/\s+/g, " ") };
  });

for (const { name, symbol } of SYMBOLS) {
  test(`INV-022 a refusal with a digit waiting, beside ${name}: every armed state and position`, async ({ page }) => {
    const { songId, parts } = await seedSong(
      page,
      [{ key: "a", label: "A", columns: [n(3, symbol ? { chord: symbol } : {}), n(5)] }],
      [{ part: "a" }],
    );
    await page.setViewportSize({ width: 375, height: 667 });
    const bad: string[] = [];
    let seen = 0;
    let worst = -Infinity;
    for (const position of POSITIONS) {
      for (const armed of ARMED) {
        for (const digit of ["1", "2"]) {
          await page.goto(`/songs/${songId}/capture/${parts.a}`);
          await expect(page.getByTestId("tab-column").first()).toBeVisible();
          await position.go(page);
          await page.getByRole("button", { name: "Triplet", exact: true }).click();
          await expect(page.getByText("a triplet needs three columns in one bar")).toBeVisible();
          let reachable = true;
          for (const control of armed.press(page)) {
            if (!(await control.isEnabled({ timeout: 1000 }))) {
              reachable = false;
              break;
            }
            await control.click();
          }
          if (!reachable) continue;
          await page.keyboard.press(digit);
          await expect(page.getByTestId("digit-waiting")).toBeVisible();
          // The state must be the crossed one, or this proves nothing.
          await expect(page.getByText("a triplet needs three columns in one bar")).toBeVisible();
          const r = await read(page);
          seen += 1;
          worst = Math.max(worst, r.overrun);
          bad.push(...r.problems.map((p) => `${position.name}, ${armed.name}, ${digit} [${r.text.slice(0, 80)}]: ${p}`));
        }
      }
    }
    console.log(`INV-022 refusal+digit ${name}: ${seen} states, ${bad.length} bad, worst overrun ${worst.toFixed(1)}px`);
    expect(seen).toBeGreaterThan(5);
    expect(bad).toEqual([]);
  });
}
