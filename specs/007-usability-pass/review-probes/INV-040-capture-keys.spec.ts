/**
 * INV-040 and contracts/staff.md section 6: a key does what the matching tap does, and a cursor moved by key is
 * kept in view. Run the key on one song and the tap on another, then compare stored columns.
 */
import { expect, test, type Page } from "@playwright/test";
import { fret, stackLatch } from "../../../e2e/capture-surface-helpers";
import { cols, eventRows, seed, type Col } from "../../../e2e/rhythm-probe-helpers";

test.setTimeout(150_000);
test.skip(({ isMobile }) => isMobile, "a keyboard probe: the desktop project is the mouse-and-keyboard device");

type Row = {
  partId: string;
  rank: string;
  kind: string;
  frets: Record<string, unknown>;
  techniques: unknown;
  repeat: number;
  durationHint: unknown;
  deletedAt: unknown;
};

const columnsOf = async (page: Page, partId: string) =>
  ((await eventRows(page)) as unknown as Row[])
    .filter((r) => r.partId === partId && !r.deletedAt)
    .sort((a, b) => (a.rank < b.rank ? -1 : 1))
    .map(({ kind, frets, techniques, repeat, durationHint }) => ({ kind, frets, techniques, repeat, durationHint }));

const NOTES: Col[] = [{ d: "q" }, { d: "q" }, { kind: "barline" }, { d: "q" }, { d: "q" }];

async function open(page: Page) {
  const { partUrl, partId } = await seed(page, NOTES, { bpm: 120 });
  await page.goto(partUrl);
  await expect(page.getByTestId("tab-column")).toHaveCount(5);
  return partId;
}

const latch = (page: Page, name: string) => page.getByTestId("latch-strip").getByRole("button", { name });

const LATCHES: { name: string; arm: (page: Page) => Promise<void> }[] = [
  { name: "none", arm: async () => {} },
  { name: "stack", arm: async (p) => void (await stackLatch(p).click()) },
  ...["hammer-on", "pull-off", "slide up", "slide down"].map((t) => ({
    name: t,
    arm: async (p: Page) => void (await latch(p, t).click()),
  })),
  {
    name: "stack and a transition",
    arm: async (p: Page) => {
      await stackLatch(p).click();
      await latch(p, "hammer-on").click();
    },
  },
];

const CURSORS: { name: string; go: (page: Page) => Promise<void> }[] = [
  { name: "at the end", go: async () => {} },
  { name: "on the first column", go: async (p) => void (await p.getByTestId("tab-column").first().click()) },
  { name: "on the last column", go: async (p) => void (await p.getByTestId("tab-column").last().click()) },
];

for (const cursor of CURSORS) {
  for (const armed of LATCHES) {
    test(`INV-040 a typed 7 equals a tapped 7: ${armed.name}, ${cursor.name}`, async ({ page }) => {
      const tapped = await open(page);
      await cursor.go(page);
      await armed.arm(page);
      await fret(page, "B", 7).click();
      await page.waitForTimeout(350);
      const want = await columnsOf(page, tapped);

      const typed = await open(page);
      await cursor.go(page);
      await armed.arm(page);
      await page.keyboard.press("7");
      await page.waitForTimeout(350);
      expect(await columnsOf(page, typed)).toEqual(want);
    });
  }
}

test("INV-040 keys stop at both ends of the parts and of the strings", async ({ page }) => {
  await open(page);
  const url = page.url();
  await page.keyboard.press(",");
  await page.keyboard.press(".");
  expect(page.url(), "one part: neither key leaves it").toBe(url);
  for (let i = 0; i < 9; i++) await page.keyboard.press("ArrowDown");
  await expect(page.locator("[data-keyboard-string]")).toContainText("B");
  for (let i = 0; i < 9; i++) await page.keyboard.press("ArrowUp");
  await expect(page.locator("[data-keyboard-string]")).toContainText("G");
});

test("INV-040 Left and Right extend a selection exactly as a tap does", async ({ page }) => {
  await open(page);
  await page.getByTestId("tab-column").first().click();
  await page.getByRole("button", { name: /^select$/ }).click();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator('[data-testid="tab-column"][data-selected="true"]')).toHaveCount(2);
});

test("INV-040 Home during a selection does not move the cursor behind it", async ({ page }) => {
  await open(page);
  await page.getByTestId("tab-column").nth(1).click();
  await page.getByRole("button", { name: /^select$/ }).click();
  await page.keyboard.press("Home");
  await page.getByTestId("toolbar-selection").getByRole("button", { name: "cancel" }).click();
  await expect(
    page.getByText("adding after the marked column"),
    "no jump button shows while selecting, so no key should jump",
  ).toBeVisible();
});

const LONG = cols(...Array.from({ length: 160 }, (_, i) => (i % 5 === 4 ? "|" : "q")));

for (const [name, keys] of [
  ["Home", ["Home"]],
  ["Left, walked down the part", Array.from({ length: 60 }, () => "ArrowLeft")],
  ["[, back through the bars", Array.from({ length: 14 }, () => "[")],
] as const) {
  test(`staff.md section 6: a cursor moved by ${name} stays in view`, async ({ page }) => {
    const { partUrl } = await seed(page, LONG, { bpm: 120 });
    await page.setViewportSize({ width: 800, height: 700 });
    await page.goto(partUrl);
    await expect(page.getByTestId("tab-column").first()).toBeAttached();
    for (const key of keys) await page.keyboard.press(key);
    await page.waitForTimeout(400);
    const m = await page.evaluate(() => {
      const mark = document.querySelector('[data-testid="tab-caret"]');
      const scroller = document.querySelector('[data-testid="tab-staff"] [role="group"]')!;
      if (!mark) return null;
      const a = mark.getBoundingClientRect();
      const b = scroller.getBoundingClientRect();
      return { caret: Math.round(a.left), left: Math.round(b.left), right: Math.round(b.right), scrollLeft: Math.round(scroller.scrollLeft) };
    });
    expect(m, "a caret is drawn").not.toBeNull();
    expect(m!.caret >= m!.left - 1 && m!.caret <= m!.right + 1, JSON.stringify(m)).toBe(true);
  });
}
