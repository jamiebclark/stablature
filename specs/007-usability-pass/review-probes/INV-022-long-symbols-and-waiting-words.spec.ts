/**
 * INV-022 and FR-026, round 2. FR-026 keeps both jump buttons "in every combination of status and chord", and only
 * promises a symbol whole up to ten characters, so a longer one may be cut but must not push a button out. The earlier
 * probe stops at exactly ten. It also reads the waiting digit beside the words the row shows, not whether those words
 * are still true, so the second half compares them with what is armed.
 */
import { expect, test, type Page } from "@playwright/test";
import { latch, stackLatch } from "../../../e2e/capture-surface-helpers";
import { n, seedSong } from "../../../e2e/reading-helpers";

test.setTimeout(120_000);

const SYMBOLS = [
  { name: "11 characters, unknown", symbol: "Xylophone12" },
  { name: "19 characters, unknown", symbol: "Xylophone Solo Part" },
  { name: "80 characters, INV-016's own symbol", symbol: "Cmaj7".repeat(16) },
  { name: "14 characters, known", symbol: "Cmaj7add9add11" },
];

/** CANDIDATE=1: past ten characters the symbol gives way, holding ten (surfaces.md's status row table). */
const CANDIDATE = `
  [data-testid="status-row"] > span.font-mono:nth-child(2) { flex-shrink: 1; min-width: 10ch; overflow: hidden; text-overflow: ellipsis; }`;

const POSITIONS: { name: string; go: (page: Page) => Promise<void> }[] = [
  { name: "at the end", go: async () => {} },
  { name: "mid-part", go: async (p) => void (await p.getByTestId("tab-column").nth(1).click()) },
];

const open = async (page: Page, chord?: string) => {
  const { songUrl, parts } = await seedSong(
    page,
    [{ key: "a", label: "A", columns: [n(3, { d: "q", chord }), n(5, { d: "q" }), n(7, { d: "q" })] }],
    [{ part: "a" }],
  );
  await page.goto(`${songUrl}/capture/${parts.a}`);
  await expect(page.getByTestId("tab-column").first()).toBeAttached();
};

const buttonsInRow = (page: Page) =>
  page.getByTestId("status-row").evaluate((row) => {
    const right = row.getBoundingClientRect().right - parseFloat(getComputedStyle(row).paddingRight);
    return [...row.querySelectorAll("button")].map((b) => ({
      text: b.textContent,
      over: Math.round((b.getBoundingClientRect().right - right) * 10) / 10,
    }));
  });

for (const { name, symbol } of SYMBOLS) {
  for (const position of POSITIONS) {
    test(`INV-022 a symbol of ${name}, ${position.name}: both jump buttons stay on the row`, async ({ page, isMobile }) => {
      test.skip(!isMobile, "the row is budgeted at 375 on touch");
      await page.setViewportSize({ width: 375, height: 667 });
      await open(page, symbol);
      await position.go(page);
      if (process.env.CANDIDATE) await page.addStyleTag({ content: CANDIDATE });
      await page.waitForTimeout(150);
      const buttons = await buttonsInRow(page);
      console.log(`row: ${symbol.slice(0, 20)} | ${(await page.getByTestId("status-row").innerText()).replace(/s+/g, " ").slice(0, 90)}`);
      expect(buttons, "two jump buttons").toHaveLength(2);
      for (const b of buttons) expect(b.over, `${b.text} past the row`).toBeLessThanOrEqual(0.5);
    });
  }
}

const ARMED: { name: string; arm: (page: Page) => Promise<void>; stack: boolean }[] = [
  { name: "hammer-on", arm: async (p) => void (await latch(p, "hammer-on").click()), stack: false },
  { name: "pull-off", arm: async (p) => void (await latch(p, "pull-off").click()), stack: false },
  { name: "slide up", arm: async (p) => void (await latch(p, "slide up").click()), stack: false },
  { name: "slide down", arm: async (p) => void (await latch(p, "slide down").click()), stack: false },
  { name: "stack", arm: async (p) => void (await stackLatch(p).click()), stack: true },
];

for (const width of [375, 1280]) {
  for (const armed of ARMED) {
    test(`INV-022 at ${width}: with ${armed.name} armed, the words beside a waiting digit are true`, async ({ page, isMobile }) => {
      test.skip(isMobile, "a keyboard probe");
      await page.setViewportSize({ width, height: 800 });
      await open(page);
      await page.getByTestId("tab-column").nth(1).click();
      await armed.arm(page);
      const row = page.getByTestId("status-row");
      const before = (await row.locator("span").first().textContent()) ?? "";
      await page.keyboard.press("1");
      await expect(page.getByTestId("digit-waiting")).toBeVisible();
      const during = (await row.locator("span").first().textContent()) ?? "";
      console.log(`${width} ${armed.name}: "${before}" -> "${during}"`);
      if (!armed.stack) expect(during, "nothing is stacking").not.toMatch(/stack/);
      if (width === 1280) expect(during, "a wide row has the room for the whole words").toBe(before);
    });
  }
}
