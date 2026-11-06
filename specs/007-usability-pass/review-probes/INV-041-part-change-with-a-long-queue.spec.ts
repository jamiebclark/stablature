/**
 * INV-041, round 2: T125 queues navigation, and F1's "owed" said a part change already behaves this way. `stepPart` runs
 * at once and is not queued, and the queue reads `pressRef.current`, the latest render's `press`, so a note still queued
 * when the new part's render lands would go to that part. The round 1 probe queues three notes. Here the queue is run at
 * several depths and rates, with the key gaps a person can reach as well as none.
 */
import { expect, test, type Page } from "@playwright/test";
import { n, seedSong } from "../../../e2e/reading-helpers";
import { eventRows } from "../../../e2e/rhythm-probe-helpers";

test.setTimeout(120_000);
test.skip(({ isMobile }) => isMobile, "a keyboard probe");

type Row = { partId: string; rank: string; frets: Record<string, number | "x">; deletedAt: unknown };

const stored = async (page: Page, partId: string) =>
  ((await eventRows(page)) as unknown as Row[])
    .filter((r) => r.partId === partId && !r.deletedAt)
    .sort((a, b) => (a.rank < b.rank ? -1 : 1))
    .map((r) => Object.values(r.frets).join("+"));

for (const [depth, gap] of [[3, 0], [6, 0], [12, 0], [24, 0], [6, 30], [12, 30], [6, 80]] as const) {
  test(`INV-041 ${depth} notes at ${gap}ms then the next part: every note stays on the part it was typed on`, async ({ page }) => {
    const { songUrl, parts } = await seedSong(
      page,
      [
        { key: "a", label: "A", columns: [n(3)] },
        { key: "b", label: "B", columns: [n(7)] },
      ],
      [{ part: "a" }],
    );
    await page.goto(`${songUrl}/capture/${parts.a}`);
    await expect(page.getByTestId("tab-column")).toHaveCount(1);
    await page.waitForTimeout(150);
    const notes = Array.from({ length: depth }, (_, i) => String(3 + (i % 7)));
    for (const key of notes) {
      await page.keyboard.press(key);
      if (gap) await page.waitForTimeout(gap);
    }
    await page.keyboard.press(".");
    await expect(page).toHaveURL(new RegExp(parts.b));
    // A queue left behind by the unmount loses its delivery signal and runs at one note per 250ms, so wait for all of it.
    await page.waitForTimeout(depth * 300 + 900);
    const a = await stored(page, parts.a);
    const b = await stored(page, parts.b);
    console.log(`depth ${depth} gap ${gap}: A ${a.length - 1} of ${depth}, B gained ${b.length - 1}; typed ${notes.join(" ")}; stored ${a.slice(1).join(" ")}`);
    expect({ onA: a.length - 1, onB: b.length - 1 }).toEqual({ onA: depth, onB: 0 });
    expect(a.slice(1), "in the order typed").toEqual(notes);
  });
}
