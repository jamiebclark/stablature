/**
 * INV-041 over its whole set, by reading stored rows in rank order (usability-keys.spec.ts only counts columns).
 * The oracle for a navigation key is the same keys typed slowly: a key must mean the same thing at any speed.
 */
import { expect, test, type Page } from "@playwright/test";
import { cols, eventRows, seed } from "../../../e2e/rhythm-probe-helpers";
import { bar, n, seedSong } from "../../../e2e/reading-helpers";

test.setTimeout(120_000);
test.skip(({ isMobile }) => isMobile, "a keyboard probe: the desktop project is the mouse-and-keyboard device");

type Row = { partId: string; rank: string; kind: string; frets: Record<string, number | "x">; deletedAt: unknown };

/** The stored frets of a part in rank order, one label per column. */
async function stored(page: Page, partId: string) {
  const rows = ((await eventRows(page)) as unknown as Row[])
    .filter((r) => r.partId === partId && !r.deletedAt)
    .sort((a, b) => (a.rank < b.rank ? -1 : 1));
  return {
    frets: rows.map((r) => (r.kind === "barline" ? "|" : Object.values(r.frets).join("+") || "r")),
    ranks: rows.map((r) => r.rank),
  };
}

const settled = async (page: Page, partId: string, count: number) => {
  await expect.poll(async () => (await stored(page, partId)).frets.length, { timeout: 8000 }).toBe(count);
  await page.waitForTimeout(350);
};

async function start(page: Page) {
  const { partUrl, partId } = await seed(page, cols("q", "q"), { bpm: 120 });
  await page.goto(partUrl);
  await expect(page.getByTestId("tab-column")).toHaveCount(2);
  return partId;
}

for (const [delay, want] of [
  [0, ["5", "7", "3", "8", "0", "12", "15", "24", "2", "5"]],
  [10, ["5", "7", "3", "8", "0", "12", "15", "24", "2", "5"]],
  [700, ["5", "7", "3", "8", "0", "1", "2", "1", "5", "2", "4", "2", "5"]],
] as const) {
  test(`INV-041 5 7 3 8 0 12 15 24 25 at delay ${delay}`, async ({ page }) => {
    const partId = await start(page);
    await page.keyboard.type("5738012152425", { delay });
    await settled(page, partId, 2 + want.length);
    await page.waitForTimeout(800);
    const { frets, ranks } = await stored(page, partId);
    expect(frets.slice(2)).toEqual(want);
    expect(new Set(ranks).size, "no two stored ranks equal").toBe(ranks.length);
  });
}

/** Keys pressed one after another with `gap` ms between. A digit is a note; anything else is a key. */
async function play(page: Page, keys: readonly string[], gap: number) {
  for (const key of keys) {
    await page.keyboard.press(key);
    if (gap) await page.waitForTimeout(gap);
  }
}

/** The same keys at speed and at a walk must store the same part. */
for (const [name, keys, notes] of [
  ["5 7 Left 3", ["5", "7", "ArrowLeft", "3"], 3],
  ["5 7 [ 3", ["5", "7", "[", "3"], 3],
  ["5 7 Home 3", ["5", "7", "Home", "3"], 3],
  ["1 Left 3 (a waiting digit flushed by Left)", ["1", "ArrowLeft", "3"], 2],
  ["1 Right 3 from mid-part", ["ArrowLeft", "1", "ArrowRight", "3"], 2],
  ["1 [ 3", ["1", "[", "3"], 2],
  ["1 Home 3", ["1", "Home", "3"], 2],
] as const) {
  test(`INV-041 ${name}: fast and slow store the same part`, async ({ page }) => {
    const slowPart = await start(page);
    await play(page, keys.flatMap((k) => (k === "1" ? ["1", "Enter"] : [k])), 400);
    await settled(page, slowPart, 2 + notes);
    const slow = (await stored(page, slowPart)).frets;

    const fastPart = await start(page);
    await play(page, keys, 0);
    await settled(page, fastPart, 2 + notes);
    await page.waitForTimeout(800);
    const fast = await stored(page, fastPart);
    expect(fast.frets, `typed at speed, against ${slow.join(" ")}`).toEqual(slow);
    expect(new Set(fast.ranks).size).toBe(fast.ranks.length);
  });
}

/** Human speed. The flush happens on the navigation key's own keydown, so this needs no racing at all. */
for (const gap of [150, 300, 450]) {
  for (const [name, keys] of [
    ["1 Left 3", ["1", "ArrowLeft", "3"]],
    ["1 Right 3 from mid-part", ["ArrowLeft", "1", "ArrowRight", "3"]],
  ] as const) {
    test(`INV-041 ${name} at ${gap} ms between keys`, async ({ page }) => {
      const slowPart = await start(page);
      await play(page, keys.flatMap((k) => (k === "1" ? ["1", "Enter"] : [k])), 700);
      await settled(page, slowPart, 4);
      const slow = (await stored(page, slowPart)).frets;

      const humanPart = await start(page);
      await play(page, keys, gap);
      await settled(page, humanPart, 4);
      await page.waitForTimeout(800);
      const human = (await stored(page, humanPart)).frets;
      console.log(`HUMAN ${name} @${gap}: slow ${slow.join(" ")} | human ${human.join(" ")}`);
      expect(human, `at ${gap} ms, against ${slow.join(" ")}`).toEqual(slow);
    });
  }
}

const TWO_PARTS = [
  { key: "a", label: "A", columns: [n(3)] },
  { key: "b", label: "B", columns: [n(7), bar(), n(9)] },
];

async function onFirstPart(page: Page) {
  const { parts, songId } = await seedSong(page, TWO_PARTS, [{ part: "a" }, { part: "b" }]);
  await page.goto(`/songs/${songId}/capture/${parts.a}`);
  await expect(page.getByTestId("tab-column")).toHaveCount(1);
  return parts;
}

test("INV-041 a part change with notes still queued keeps them on the part they were typed on", async ({ page }) => {
  const parts = await onFirstPart(page);
  await play(page, ["5", "7", "9", "."], 0);
  await expect(page).toHaveURL(new RegExp(parts.b));
  await page.waitForTimeout(1200);
  expect((await stored(page, parts.a)).frets.slice(1), "typed on A").toEqual(["5", "7", "9"]);
  expect((await stored(page, parts.b)).frets, "B is untouched").toEqual(["7", "|", "9"]);
});

test("INV-041 a part change with a digit waiting enters it on the old part", async ({ page }) => {
  const parts = await onFirstPart(page);
  await play(page, ["1", "."], 0);
  await expect(page).toHaveURL(new RegExp(parts.b));
  await page.waitForTimeout(1200);
  expect((await stored(page, parts.a)).frets).toEqual(["3", "1"]);
  expect((await stored(page, parts.b)).frets).toEqual(["7", "|", "9"]);
});

test("INV-041 a sheet opening with a digit waiting enters it once", async ({ page }) => {
  const partId = await start(page);
  await page.getByTestId("tab-column").first().click();
  await page.keyboard.press("1");
  await page.getByRole("button", { name: "Open column details" }).click();
  await expect(page.getByTestId("column-inspector")).toBeVisible();
  await page.waitForTimeout(900);
  const { frets } = await stored(page, partId);
  expect(frets.filter((f) => f === "1")).toHaveLength(1);
});

test("INV-041 a held key enters one note", async ({ page }) => {
  const partId = await start(page);
  await page.keyboard.down("7");
  await page.keyboard.down("7");
  await page.keyboard.down("7");
  await page.keyboard.up("7");
  await page.keyboard.down("x");
  await page.keyboard.down("x");
  await page.keyboard.up("x");
  await page.waitForTimeout(800);
  expect((await stored(page, partId)).frets.slice(2)).toEqual(["7", "x"]);
});

test("INV-041 2 on a neck of 24 waits, and 2 4 is fret 24", async ({ page }) => {
  const partId = await start(page);
  await page.keyboard.press("2");
  await expect(page.getByTestId("digit-waiting")).toHaveText(/fret 2/);
  await page.keyboard.press("4");
  await settled(page, partId, 3);
  expect((await stored(page, partId)).frets[2]).toBe("24");
});
