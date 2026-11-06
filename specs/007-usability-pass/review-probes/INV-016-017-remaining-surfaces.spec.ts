/**
 * INV-016 and INV-017 on the three members of **Stf** round 1 left unmeasured: song page compact, capture selecting and
 * the paste preview. T135 records them as still not measured. Same reads as INV-016-017-038-staves.spec.ts, by rects.
 */
import { expect, test, type Page } from "@playwright/test";
import { columns as cols } from "../../../e2e/capture-surface-helpers";
import { pasteTab } from "../../../e2e/import-helpers";
import { bar, n, seedSong, type Col } from "../../../e2e/reading-helpers";
import { openTools } from "../../../e2e/usability-helpers";

test.setTimeout(180_000);

const q = (fret: number, over: Col = {}) => n(fret, { d: "q", ...over });

const SYMBOLS = ["Em7", "Cmaj7", "F#m7b5", "Cm7b5add11", "Cmaj7".repeat(16)];

const staffFor = (symbol: string): Col[] => [
  q(3, { chord: symbol }),
  q(12, { chord: symbol }),
  q(3, { chord: symbol }),
  q(5),
  bar(),
  q(3, { chord: symbol, repeat: 2 }),
  q(5, { chord: symbol }),
  bar(),
  q(12),
  q(3, { chord: symbol }),
];

const measure = (page: Page) =>
  page.evaluate(() => {
    const bad: string[] = [];
    const textRect = (el: Element) => {
      const r = document.createRange();
      r.selectNodeContents(el);
      return r.getBoundingClientRect();
    };
    let seenLabels = 0;
    for (const staff of document.querySelectorAll('[data-testid="tab-staff"]')) {
      const scroller = staff.querySelector("[role=group]")!;
      const inner = scroller.firstElementChild ?? scroller;
      const edge = inner.getBoundingClientRect().right;
      const labels = [...staff.querySelectorAll('[data-testid="tab-column"] > div.text-accent')].filter((e) => e.textContent);
      seenLabels += labels.length;
      const rects = labels.map((el) => ({ el, r: textRect(el) }));
      rects.forEach(({ el, r }, i) => {
        if ((el.textContent ?? "").includes("…")) bad.push(`chord cut: ${el.textContent}`);
        if (r.right > edge + 1) bad.push(`chord past the staff by ${Math.round(r.right - edge)}`);
        const next = rects[i + 1];
        if (next && Math.abs(next.r.top - r.top) <= 1 && next.r.left - r.right < 2) bad.push(`chords touch: ${(el.textContent ?? "").slice(0, 12)}`);
        const column = el.closest('[data-testid="tab-column"]')!.getBoundingClientRect();
        if (Math.abs(r.left - column.left) > 1) bad.push(`label off its column by ${Math.round(r.left - column.left)}`);
      });
      for (const col of staff.querySelectorAll('[data-testid="tab-column"]')) {
        const c = col.getBoundingClientRect();
        const bracket = col.querySelector('[data-testid="tab-bracket"]');
        if (bracket) {
          const b = bracket.getBoundingClientRect();
          if (Math.abs(b.left - c.left) > 1 || Math.abs(b.right - c.right) > 1) bad.push("bracket off its column");
        }
      }
    }
    return { bad: [...new Set(bad)], labels: seenLabels };
  });

for (const symbol of SYMBOLS) {
  const name = symbol.length > 12 ? "a symbol longer than a line" : symbol;
  for (const size of [{ width: 375, height: 667 }, { width: 1280, height: 800 }]) {
    test(`INV-016 INV-017 ${name} at ${size.width}: song page compact, capture selecting`, async ({ page }) => {
      const { songUrl, parts } = await seedSong(page, [{ key: "a", label: "A", columns: staffFor(symbol) }], [{ part: "a" }]);
      await page.setViewportSize(size);

      await page.goto(songUrl);
      await openTools(page);
      await page.getByRole("button", { name: /compact/i }).first().click();
      await page.waitForTimeout(200);
      const compact = await measure(page);
      expect(compact.labels, "compact draws the chords").toBeGreaterThan(0);

      await page.goto(`${songUrl}/capture/${parts.a}`);
      await expect(cols(page).first()).toBeAttached();
      await cols(page).first().click();
      await page.getByRole("button", { name: /^select$/ }).click();
      await cols(page).nth(3).click();
      await expect(page.getByTestId("toolbar-selection")).toBeVisible();
      await page.waitForTimeout(150);
      const selecting = await measure(page);
      expect([...compact.bad.map((b) => `compact: ${b}`), ...selecting.bad.map((b) => `selecting: ${b}`)]).toEqual([]);
    });
  }
}

// The seeded tuning is B Standard, five strings, so the system has five rows.
const PASTE = [
  "  Am7     D7      Cmaj7      F#m7b5",
  "G|--3-------5-------7----------12---|",
  "D|----------------------------------|",
  "A|----------------------------------|",
  "E|----------------------------------|",
  "B|----------------------------------|",
].join("\n");

for (const size of [{ width: 375, height: 667 }, { width: 1280, height: 800 }]) {
  test(`INV-016 INV-017 the paste preview at ${size.width}`, async ({ page }) => {
    const { songUrl } = await seedSong(page, [{ key: "a", label: "A", columns: [q(3)] }], [{ part: "a" }]);
    await page.setViewportSize(size);
    await page.goto(songUrl);
    await pasteTab(page, PASTE);
    await page.waitForTimeout(350);
    const seen = await measure(page);
    const said = (await page.getByTestId("paste-tab").innerText()).replace(/\s+/g, " ").slice(-140);
    console.log(`paste preview @${size.width}: ${JSON.stringify(seen)} ${said}`);
    expect(seen.labels, "the preview draws the chords").toBeGreaterThan(0);
    expect(seen.bad).toEqual([]);
  });
}
