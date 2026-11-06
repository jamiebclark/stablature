/**
 * INV-032, INV-033 and INV-034 over **Bars** x **Arr**. Every expected list is written by hand from the rule in
 * data-model.md: a trailing barline opens nothing, a pass with no notes adds nothing.
 */
import { expect, test, type Page } from "@playwright/test";
import { bar, n, seedSong, type Col, type EntrySpec } from "./reading-helpers";

test.setTimeout(120_000);

const q = (fret = 3): Col => n(fret, { d: "q" });
const four: Col[] = [q(), q(5), q(), q(5)];
const TWO: Col[] = [...four, bar(), ...four];
const ONE: Col[] = [...four];
const THREE: Col[] = [...four, bar(), ...four, bar(), ...four];

const cards = (page: Page) =>
  page.locator("ol > li").evaluateAll((items) =>
    items.map((li) => ({
      numbers: [...li.querySelectorAll("[data-testid=tab-bar-number]")].map((x) => Number(x.textContent)),
      head: (li.querySelector("div > div")?.textContent ?? "").replace(/\s+/g, " ").trim(),
      section: [...li.querySelectorAll("span")].find((x) => x.className.includes("uppercase"))?.textContent?.trim() ?? null,
    })),
  );

const section = (label: string | null, repeat = 1) =>
  ({ kind: "section_start", label, repeat }) as unknown as EntrySpec;
const end = { kind: "section_end" } as unknown as EntrySpec;
const cue = { kind: "text", label: "build slowly" } as EntrySpec;

const ARR: { name: string; entries: EntrySpec[]; numbers: number[][]; words: (string | null)[] }[] = [
  { name: "one part", entries: [{ part: "a" }], numbers: [[1, 2]], words: [null] },
  { name: "A x4", entries: [{ part: "a", repeat: 4 }], numbers: [[1, 2], [3, 4], [5, 6], [7, 8]], words: [null, null, null, null] },
  { name: "last-pass variant", entries: [{ part: "a", repeat: 2, last: "c" }], numbers: [[1, 2], [3, 4, 5]], words: [null, null] },
  { name: "a sliced pass", entries: [{ part: "a" }, { part: "c", fromBar: 2, toBar: 3 }], numbers: [[1, 2], [3, 4]], words: [null, null] },
  {
    name: "Verse x2",
    entries: [section("Verse", 2), { part: "a" }, { part: "b" }, end],
    numbers: [[1, 2], [3], [4, 5], [6]],
    words: ["VERSE", "VERSE", "VERSE, 2ND TIME", "VERSE, 2ND TIME"],
  },
  {
    name: "nested sections",
    entries: [section("Outer"), section("Inner", 2), { part: "b" }, end, end],
    numbers: [[1], [2]],
    words: ["OUTER / INNER", "OUTER / INNER, 2ND TIME"],
  },
  {
    name: "same name not adjacent",
    entries: [section("Verse"), { part: "b" }, end, { part: "a" }, section("Verse"), { part: "b" }, end],
    numbers: [[1], [2, 3], [4]],
    words: ["VERSE", null, "VERSE, 2ND TIME"],
  },
  {
    name: "names differing only in case",
    entries: [section("Verse"), { part: "b" }, end, section("verse"), { part: "b" }, end],
    numbers: [[1], [2]],
    words: ["VERSE", "VERSE, 2ND TIME"],
  },
  { name: "an empty section", entries: [section("Verse"), end, { part: "b" }], numbers: [[1]], words: [null] },
  { name: "an unnamed section", entries: [section(null, 2), { part: "b" }, end], numbers: [[1], [2]], words: [null, null] },
  { name: "a text cue between", entries: [{ part: "b" }, cue, { part: "b" }], numbers: [[1], [2]], words: [null, null] },
];

for (const arr of ARR) {
  test(`INV-032 INV-033 ${arr.name}`, async ({ page }) => {
    const { playUrl } = await seedSong(
      page,
      [
        { key: "a", label: "A", columns: TWO },
        { key: "b", label: "B", columns: ONE },
        { key: "c", label: "C", variantOf: "a", columns: THREE },
      ],
      arr.entries,
    );
    await page.goto(playUrl);
    await expect(page.locator("ol > li")).toHaveCount(arr.numbers.length);
    // Cards land before their staves, so wait for the numbers or an empty read looks like a miscount.
    await expect(page.getByTestId("tab-bar-number").first()).toBeVisible();
    await page.waitForTimeout(150);
    const got = await cards(page);
    expect(got.map((c) => c.numbers), "bars as played").toEqual(arr.numbers);
    got.forEach((card, i) => {
      expect(card.section?.toUpperCase() ?? null, `card ${i}: ${card.head}`).toBe(arr.words[i]);
    });
    if (arr.name === "a sliced pass") expect(got[1].head).toContain("bars 2–3 of this part");
  });
}

/** Twice through, so the second card shows what the first pass added. */
const SHAPES: { name: string; columns: Col[]; numbers: number[][] }[] = [
  { name: "no barlines", columns: [...four, ...four], numbers: [[1], [2]] },
  { name: "a trailing barline", columns: [...four, bar()], numbers: [[1], [2]] },
  { name: "a leading barline", columns: [bar(), ...four], numbers: [[2], [4]] },
  { name: "an empty bar in the middle", columns: [...four, bar(), bar(), ...four], numbers: [[1, 3], [4, 6]] },
  { name: "a pass with no notes", columns: [{ kind: "rest", d: "q" }], numbers: [[1], [2]] },
];

for (const shape of SHAPES) {
  test(`INV-032 ${shape.name}, twice through`, async ({ page }) => {
    const { playUrl } = await seedSong(page, [{ key: "a", label: "A", columns: shape.columns }], [{ part: "a", repeat: 2 }]);
    await page.goto(playUrl);
    await expect(page.locator("ol > li")).toHaveCount(2);
    expect((await cards(page)).map((c) => c.numbers)).toEqual(shape.numbers);
  });
}

test("INV-032 a song page numbers from 1", async ({ page }) => {
  const { songUrl } = await seedSong(page, [{ key: "a", label: "A", columns: TWO }], [{ part: "a", repeat: 2 }]);
  await page.goto(songUrl);
  await expect(page.getByTestId("tab-bar-number").first()).toHaveText("1");
});

const BEATS: { name: string; columns: Col[]; text: string | null }[] = [
  { name: "all bars 3", columns: [q(), q(), q(), bar(), q(), q(), q()], text: "3 beats a bar" },
  { name: "all bars 4", columns: TWO, text: "4 beats a bar" },
  { name: "all bars 5", columns: [...four, q(), bar(), ...four, q()], text: "5 beats a bar" },
  { name: "all bars 6", columns: [...four, q(), q(), bar(), ...four, q(), q()], text: "6 beats a bar" },
  { name: "one bar differs", columns: [...four, bar(), q(), q(), q()], text: null },
  { name: "a pickup", columns: [q(), bar(), ...four, bar(), ...four], text: null },
  { name: "one untimed bar", columns: [...four, bar(), n(3), n(5)], text: null },
  { name: "an empty bar in the middle", columns: [...four, bar(), bar(), ...four], text: null },
  { name: "a leading barline", columns: [bar(), ...four, bar(), ...four], text: "4 beats a bar" },
  { name: "a trailing barline", columns: [...four, bar(), ...four, bar()], text: "4 beats a bar" },
  { name: "a part of no durations", columns: [n(3), n(5), bar(), n(3), n(5)], text: null },
  { name: "a fractional bar", columns: [q(), q(), n(3, { d: "8" })], text: null },
  {
    name: "a tuplet in a bar",
    columns: [
      q(),
      q(),
      q(),
      n(3, { d: "8", tupletId: "t", tupletCount: 3 }),
      n(5, { d: "8", tupletId: "t", tupletCount: 3 }),
      n(3, { d: "8", tupletId: "t", tupletCount: 3 }),
    ],
    text: "4 beats a bar",
  },
];

for (const shape of BEATS) {
  test(`INV-034 ${shape.name}`, async ({ page }) => {
    const { playUrl, songUrl } = await seedSong(page, [{ key: "a", label: "A", columns: shape.columns }], [{ part: "a" }]);
    for (const url of [playUrl, songUrl]) {
      await page.goto(url);
      await expect(page.getByTestId("tab-staff").first()).toBeVisible();
      const body = await page.locator("main").innerText();
      expect(/\d+ beats? a bar/.exec(body)?.[0] ?? null, url).toBe(shape.text);
      expect(body).not.toMatch(/\b\d\s*\/\s*\d\b/);
    }
  });
}
