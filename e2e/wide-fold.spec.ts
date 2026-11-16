/** INV-007 / INV-008: repeated passes of one entry are drawn once, with their words (contracts/cards.md section 4). */
import { expect, test, type Page } from "@playwright/test";
import { bar, n, seedSong, type Col } from "./reading-helpers";
import { FOLD, seedFitSong, seedFold, type FoldRow } from "./wide-helpers";

test.setTimeout(120_000);

const IDS = ["F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8", "F9", "F13"];
const ROWS = FOLD.filter((r) => IDS.includes(r.id));

async function check(page: Page, row: FoldRow) {
  const cards = page.locator("ol.reading-cards > li");
  await expect(cards).toHaveCount(row.cards.length);
  for (const [i, want] of row.cards.entries()) {
    const li = cards.nth(i);
    await expect(li).toHaveAttribute("data-first-pass", String(want.passes[0]));
    await expect(li).toHaveAttribute("data-last-pass", String(want.passes[1]));
    const rest = li.getByTestId("card-passes-rest");
    if (want.words === null) await expect(rest).toHaveCount(0);
    else await expect(rest).toHaveText(want.words);
    const span = li.getByTestId("card-bars");
    if (want.span === null) await expect(span).toHaveCount(0);
    else await expect(span).toHaveText(want.span);
    await expect(li).not.toContainText("×1 ");
  }
}

for (const row of ROWS) {
  test(`${row.id} folds as the table says at 375, 1280 and in print`, async ({ page }) => {
    const { playUrl } = await seedFold(page, row);
    for (const width of [375, 1280]) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(playUrl);
      await check(page, row);
    }
    await page.emulateMedia({ media: "print" });
    for (const width of [718, 1047]) {
      await page.setViewportSize({ width, height: 800 });
      await check(page, row);
    }
  });
}

test("F15 the fit song draws six cards, numbered, with its words", async ({ page }) => {
  const { playUrl } = await seedFitSong(page);
  for (const width of [375, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto(playUrl);
    const cards = page.locator("ol.reading-cards > li");
    await expect(cards).toHaveCount(6);
    await expect(cards.nth(0).getByTestId("card-passes-rest")).toHaveText("×3 · passes 1–3 of 4");
    await expect(cards.nth(0).getByTestId("card-bars")).toHaveText("bars 1–12");
    await expect(cards.nth(0)).toContainText("Verse");
    await expect(cards.nth(1).getByTestId("card-passes-rest")).toHaveText("pass 4 of 4");
    await expect(cards.nth(4)).toContainText("Outro");
    const firstBars = await cards.evaluateAll((els) =>
      els.map((el) => el.querySelector('[data-testid="tab-bar-number"]')?.textContent?.trim()),
    );
    expect(firstBars).toEqual(["1", "13", "17", "25", "33", "35"]);
    await expect(cards.nth(1).getByTestId("variant-line")).toBeVisible();
  }
});

/** The folded twin of usability-bars-sections' "twice through": one entry of two passes is one card, numbered from its first pass. */
const four: Col[] = [3, 5, 3, 5].map((f) => n(f, { d: "q" }));
const TWICE: { name: string; columns: Col[]; numbers: number[] }[] = [
  { name: "a leading barline", columns: [bar(), ...four], numbers: [2] },
  { name: "an empty bar in the middle", columns: [...four, bar(), bar(), ...four], numbers: [1, 3] },
];
for (const shape of TWICE) {
  test(`F11 ${shape.name}, twice through, is one card`, async ({ page }) => {
    const { playUrl } = await seedSong(page, [{ key: "a", label: "A", columns: shape.columns }], [{ part: "a", repeat: 2 }]);
    await page.goto(playUrl);
    const cards = page.locator("ol.reading-cards > li");
    await expect(cards).toHaveCount(1);
    await expect(cards.nth(0).getByTestId("card-passes-rest")).toHaveText("×2 · passes 1–2 of 2");
    const numbers = await cards.nth(0).getByTestId("tab-bar-number").evaluateAll((els) => els.map((x) => Number(x.textContent)));
    expect(numbers).toEqual(shape.numbers);
  });
}
