/**
 * INV-040, round 2: "differ from the matching tap", for the rows the earlier probe left out. contracts/keys.md section 5
 * says `start` and `end` do the same as the jump buttons. Each pair runs the jump by button on one song and by key on
 * another, plays one tapped note, and compares what is stored. The note is tapped both times, so only the jump differs.
 */
import { expect, test, type Page } from "@playwright/test";
import { fret, stackLatch } from "../../../e2e/capture-surface-helpers";
import { eventRows, seed, type Col } from "../../../e2e/rhythm-probe-helpers";

test.setTimeout(150_000);
test.skip(({ isMobile }) => isMobile, "a keyboard probe: the desktop project is the mouse-and-keyboard device");

type Row = { partId: string; rank: string; kind: string; frets: unknown; techniques: unknown; deletedAt: unknown };

const columnsOf = async (page: Page, partId: string) =>
  ((await eventRows(page)) as unknown as Row[])
    .filter((r) => r.partId === partId && !r.deletedAt)
    .sort((a, b) => (a.rank < b.rank ? -1 : 1))
    .map(({ kind, frets, techniques }) => ({ kind, frets, techniques }));

const NOTES: Col[] = [{ d: "q" }, { d: "q" }, { kind: "barline" }, { d: "q" }, { d: "q" }];

async function open(page: Page) {
  const { partUrl, partId } = await seed(page, NOTES, { bpm: 120 });
  await page.goto(partUrl);
  await expect(page.getByTestId("tab-column")).toHaveCount(5);
  return partId;
}

const latch = (page: Page, name: string) => page.getByTestId("latch-strip").getByRole("button", { name });

const LATCHES: { name: string; arm: (page: Page) => Promise<void> }[] = [
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

const JUMPS = [
  { key: "End", button: /^end/, from: "second column", at: 1 },
  { key: "End", button: /^end/, from: "last column", at: 4 },
  { key: "Home", button: /start$/, from: "second column", at: 1 },
] as const;

for (const jump of JUMPS) {
  for (const armed of LATCHES) {
    test(`INV-040 ${jump.key} equals its jump button: ${armed.name} armed, from the ${jump.from}`, async ({ page }) => {
      const byButton = await open(page);
      await page.getByTestId("tab-column").nth(jump.at).click();
      await armed.arm(page);
      await page.getByRole("button", { name: jump.button }).click();
      await page.waitForTimeout(120);
      await fret(page, "B", 7).click();
      await page.waitForTimeout(350);
      const want = await columnsOf(page, byButton);

      const byKey = await open(page);
      await page.getByTestId("tab-column").nth(jump.at).click();
      await armed.arm(page);
      await page.keyboard.press(jump.key);
      await page.waitForTimeout(120);
      await fret(page, "B", 7).click();
      await page.waitForTimeout(350);
      expect(await columnsOf(page, byKey)).toEqual(want);
    });
  }
}
