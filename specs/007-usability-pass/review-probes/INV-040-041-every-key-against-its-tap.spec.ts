/**
 * INV-040 and INV-041, round 3. Round 2 compared digits and the jump keys with their taps. INV-040's set is every key on
 * its screen x **Lat**, so this runs the rows no probe has compared: Left and Right against a tap on that column, `,` and
 * `.` against a chip, and `x` against the neck's dead-note cell, each with every armed state. Each pair plays one tapped
 * note afterwards and compares what is stored. Then INV-041 for the route T160 changed: the jump keys inside fast typing.
 */
import { expect, test, type Page } from "@playwright/test";
import { fret, stackLatch } from "../../../e2e/capture-surface-helpers";
import { n, seedSong } from "../../../e2e/reading-helpers";
import { eventRows, seed, type Col } from "../../../e2e/rhythm-probe-helpers";

test.setTimeout(200_000);
test.skip(({ isMobile }) => isMobile, "a keyboard probe: the desktop project is the mouse-and-keyboard device");

type Row = { partId: string; rank: string; kind: string; frets: unknown; techniques: unknown; deletedAt: unknown };

/** Each run seeds its own song in the same browser, so a read names the parts it means. */
const stored = async (page: Page, partIds: readonly string[]) =>
  ((await eventRows(page)) as unknown as Row[])
    .filter((r) => partIds.includes(r.partId) && !r.deletedAt)
    .sort((a, b) => (a.partId === b.partId ? (a.rank < b.rank ? -1 : 1) : partIds.indexOf(a.partId) - partIds.indexOf(b.partId)))
    .map(({ kind, frets, techniques }) => ({ kind, frets, techniques }));

const NOTES: Col[] = [{ d: "q" }, { d: "q" }, { kind: "barline" }, { d: "q" }, { d: "q" }];
const latch = (page: Page, name: string) => page.getByTestId("latch-strip").getByRole("button", { name });
const columns = (page: Page) => page.getByTestId("tab-column");

const LATCHES: { name: string; arm: (page: Page) => Promise<void> }[] = [
  { name: "nothing", arm: async () => {} },
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

async function open(page: Page) {
  const { partUrl, partId } = await seed(page, NOTES, { bpm: 120 });
  await page.goto(partUrl);
  await expect(columns(page)).toHaveCount(5);
  return [partId];
}

/** From column index `from`, each key against the tap on the column the table says it reaches. */
const MOVES = [
  { key: "ArrowLeft", from: 3, to: 2 },
  { key: "ArrowRight", from: 0, to: 1 },
] as const;

for (const armed of LATCHES) {
  for (const move of MOVES) {
    test(`INV-040 ${move.key} equals a tap on that column: ${armed.name} armed`, async ({ page }) => {
      const byTap = await open(page);
      await columns(page).nth(move.from).click();
      await armed.arm(page);
      await columns(page).nth(move.to).click();
      await page.waitForTimeout(120);
      await fret(page, "B", 7).click();
      await page.waitForTimeout(350);
      const want = await stored(page, byTap);

      const byKey = await open(page);
      await columns(page).nth(move.from).click();
      await armed.arm(page);
      await page.keyboard.press(move.key);
      await page.waitForTimeout(120);
      await fret(page, "B", 7).click();
      await page.waitForTimeout(350);
      expect(await stored(page, byKey)).toEqual(want);
    });
  }

  test(`INV-040 x equals the neck's dead-note cell: ${armed.name} armed`, async ({ page }) => {
    const byTap = await open(page);
    await columns(page).nth(1).click();
    await armed.arm(page);
    await page.getByRole("button", { name: /dead note/i }).last().click();
    await page.waitForTimeout(350);
    const want = await stored(page, byTap);

    const byKey = await open(page);
    await columns(page).nth(1).click();
    await armed.arm(page);
    await page.keyboard.press("x");
    await page.waitForTimeout(350);
    expect(await stored(page, byKey)).toEqual(want);
  });

  for (const [key, chip] of [[".", "B"], [",", "A"]] as const) {
    test(`INV-040 ${key} equals the ${chip} chip: ${armed.name} armed`, async ({ page }) => {
      const go = async () => {
        const { songUrl, parts } = await seedSong(
          page,
          [
            { key: "a", label: "A", columns: [n(3, { d: "q" }), n(5, { d: "q" })] },
            { key: "b", label: "B", columns: [n(7, { d: "q" }), n(8, { d: "q" })] },
          ],
          [{ part: "a" }],
        );
        await page.goto(`${songUrl}/capture/${chip === "B" ? parts.a : parts.b}`);
        await expect(columns(page)).toHaveCount(2);
        await columns(page).first().click();
        await armed.arm(page);
        return [parts.a, parts.b];
      };
      const after = async (ids: string[]) => {
        await page.waitForTimeout(250);
        await fret(page, "B", 7).click();
        await page.waitForTimeout(350);
        return stored(page, ids);
      };
      const byTap = await go();
      await page.getByTestId("capture-title-row").getByRole("link", { name: chip, exact: true }).click();
      const want = await after(byTap);
      const byKey = await go();
      await page.keyboard.press(key);
      expect(await after(byKey)).toEqual(want);
    });
  }
}

const frets = async (page: Page, partIds: readonly string[]) =>
  (await stored(page, partIds)).map((r) => (r.kind === "barline" ? "|" : Object.values((r.frets ?? {}) as Record<string, unknown>).join("+") || "r"));

for (const delay of [0, 10, 150]) {
  test(`INV-041 the jump keys keep their place in fast typing at ${delay}ms`, async ({ page }) => {
    const ids = await open(page);
    const before = await frets(page, ids);
    for (const key of ["5", "Home", "7", "End", "3", "Home", "4", "9", "End", "8"]) await page.keyboard.press(key, { delay });
    await page.waitForTimeout(1800);
    const got = await frets(page, ids);
    console.log(`INV-041 at ${delay}: ${JSON.stringify(got)}`);
    // Home goes before the first column, and notes follow one another from there, so 4 and 9 land ahead of the 7.
    expect(got).toEqual(["4", "9", "7", ...before, "5", "3", "8"]);
  });

  test(`INV-041 a digit waiting when a jump key lands enters where it was typed at ${delay}ms`, async ({ page }) => {
    const ids = await open(page);
    const before = await frets(page, ids);
    await page.keyboard.press("1", { delay });
    await page.keyboard.press("Home", { delay });
    await page.keyboard.press("6", { delay });
    await page.waitForTimeout(1200);
    const got = await frets(page, ids);
    console.log(`INV-041 digit at ${delay}: ${JSON.stringify(got)}`);
    expect(got).toEqual(["6", ...before, "1"]);
  });
}
