/**
 * FR-001 and INV-031, round 2: the title and the part chips share the row at 375, and every action on it stays one tap
 * away. The earlier probes seed a short title, and INV-023's 120-character title reads only the back target, so neither
 * looks at the chips beside a long title. Filter: geometry of the chips and `+ part` against the row, no class is read.
 */
import { expect, test, type Page } from "@playwright/test";
import { n, seedSong, type Col } from "../../../e2e/reading-helpers";
import { patchSong } from "../../../e2e/rhythm-probe-helpers";

test.setTimeout(120_000);
test.skip(({ isMobile }) => !isMobile, "the row is budgeted at 375 on touch");

const TITLES = [
  { name: "a short title", title: "Riff" },
  { name: "an ordinary title", title: "Smoke Over the Water" },
  { name: "a longer title", title: "Everything in Its Right Place (Live)" },
  { name: "a 120-character title", title: "A very long song title ".repeat(6).slice(0, 120) },
];
const WIDTHS = [375, 390];
/** CANDIDATE=1 tries a fix through the page, as round 2's recommendation: the title gives way first, down to its floor. */
const CANDIDATE = `
  [data-testid="capture-title-row"] > button:first-child { flex: 1 1 0; min-width: var(--control); max-width: max-content; }
  [data-testid="capture-title-row"] > div { flex: 0 1 auto; min-width: 0; }`;
const notes: Col[] = [n(3, { d: "q" }), n(5, { d: "q" })];
const parts = (count: number) =>
  Array.from({ length: count }, (_, i) => ({ key: `p${i}`, label: String.fromCharCode(65 + i), columns: notes }));

const readRow = (page: Page) =>
  page.getByTestId("capture-title-row").evaluate((row) => {
    const rect = (el: Element) => {
      const r = el.getBoundingClientRect();
      return { left: r.left, right: r.right, width: r.width, height: r.height };
    };
    const back = row.querySelector("button")!;
    const links = [...row.querySelectorAll("a")];
    const strip = links[0]?.parentElement ?? null;
    const add = [...row.querySelectorAll("button")].find((b) => /part/.test(b.getAttribute("aria-label") ?? ""))!;
    return {
      back: rect(back),
      strip: strip ? rect(strip) : null,
      add: rect(add),
      rowRight: row.getBoundingClientRect().right,
      chips: links.length,
    };
  });

for (const width of WIDTHS) {
  for (const { name, title } of TITLES) {
    for (const count of [1, 2, 12]) {
      test(`FR-001 ${name}, ${count} part(s), at ${width}: the chips and + part are on the row`, async ({ page }) => {
        const { songUrl, parts: ids } = await seedSong(page, parts(count), [{ part: "p0" }]);
        await patchSong(page, { title });
        await page.setViewportSize({ width, height: 667 });
        await page.goto(`${songUrl}/capture/${ids.p0}`);
        await expect(page.getByTestId("tab-column").first()).toBeAttached();
        if (process.env.CANDIDATE) await page.addStyleTag({ content: CANDIDATE });
        await page.waitForTimeout(200);
        const row = await readRow(page);
        console.log(`ROW ${width} | ${name} | ${count} | back ${row.back.width.toFixed(1)} | strip ${row.strip?.width.toFixed(1)} | add at ${row.add.left.toFixed(0)}-${row.add.right.toFixed(0)}`);
        expect.soft(row.back.width, "the way back is at its floor").toBeGreaterThanOrEqual(43.5);
        expect(row.strip, "a strip of chips exists").not.toBeNull();
        expect(row.strip!.width, `the chips have room: ${JSON.stringify(row)}`).toBeGreaterThanOrEqual(44);
        // `+ part` is the last thing in the strip, so a swipe of the strip must bring it fully inside.
        const add = page.getByRole("button", { name: "Add a part" });
        await add.evaluate((el) => el.scrollIntoView({ inline: "nearest", block: "nearest" }));
        await page.waitForTimeout(80);
        const after = await readRow(page);
        expect(after.add.right, "+ part reachable").toBeLessThanOrEqual(after.strip!.right + 0.5);
        expect(after.add.left, "+ part reachable").toBeGreaterThanOrEqual(after.strip!.left - 0.5);
      });
    }
  }
}
