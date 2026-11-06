/**
 * Round 3, a measure and not a pass or fail. T167 gives every wrapped staff `min(columns, 40)` spare gutter blocks, which
 * only a printed bar wider than the page can use. This counts what that adds to the play view for an ordinary song on a
 * phone, and whether a run still meets the 50ms the highlight has (SC-013). Prints figures; asserts only that it ran.
 */
import { expect, test } from "@playwright/test";
import { bar, n, seedSong, type Col } from "../../../e2e/reading-helpers";

test.setTimeout(120_000);
test.skip(({ isMobile }) => !isMobile, "a phone is where the nodes cost");

const q = (fret: number) => n(fret, { d: "q" });
const part = (bars: number): Col[] => Array.from({ length: bars }, (_, b) => [q(3), q(5), q(7), q(b % 12), bar()]).flat();

for (const passes of [4, 16, 32]) {
  test(`spare gutter blocks over ${passes} passes of 16 bars`, async ({ page }) => {
    const { playUrl } = await seedSong(
      page,
      [{ key: "a", label: "A", columns: part(16) }],
      Array.from({ length: passes }, () => ({ part: "a" })),
    );
    const client = await page.context().newCDPSession(page);
    await client.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    const started = Date.now();
    await page.goto(playUrl);
    await expect(page.getByTestId("tab-staff").first()).toBeVisible({ timeout: 40_000 });
    const firstStaff = Date.now() - started;
    const nodes = await page.evaluate(() => {
      const all = document.querySelectorAll("*").length;
      const gutter = document.querySelectorAll(".tab-gutter *").length;
      const blocks = document.querySelectorAll(".tab-gutter-block").length;
      const perBlock = gutter / Math.max(blocks, 1);
      const lines = [...document.querySelectorAll(".tab-staff-wrapped")].map(
        (s) => new Set([...s.querySelectorAll('[data-testid="tab-column"]')].map((c) => Math.round(c.getBoundingClientRect().top))).size,
      );
      const used = lines.reduce((a, b) => a + b, 0);
      return { all, gutter, blocks, used, spare: Math.round((blocks - used) * perBlock) };
    });
    console.log(`SPARE ${passes} passes: first staff ${firstStaff}ms under 4x, ${JSON.stringify(nodes)}, ${Math.round((100 * nodes.spare) / nodes.all)}% of the page is spare blocks`);
    expect(nodes.blocks).toBeGreaterThan(0);
  });
}
