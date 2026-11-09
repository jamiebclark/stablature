/**
 * INV-013 through the sheet, with REAL pointer clicks fired with no wait between them. The
 * suite's "burst" awaits each click, so the row has settled before the next one starts.
 * Members: pairs and double taps on one string, one pair across two strings, all six.
 */
import { expect, test, type Page } from "@playwright/test";
import {
  DECORATIONS,
  details,
  exportRow,
  exportText,
  fret,
  inspector,
  openDialog,
  stackLatch,
  startCapturing,
  storedRows,
} from "./capture-surface-helpers";

const name = (words: string, note = "A1") => `${words} on the ${note} string`;

/** Fire real clicks at each named toggle with none of them awaited. */
async function burst(page: Page, names: string[]) {
  const points = [];
  for (const n of names) {
    const b = (await inspector(page).getByRole("button", { name: n, exact: true }).boundingBox())!;
    points.push({ x: b.x + b.width / 2, y: b.y + b.height / 2 });
  }
  await Promise.all(points.map((p) => page.mouse.click(p.x, p.y)));
}

async function oneNote(page: Page) {
  const ctx = await startCapturing(page);
  await fret(page, "A", 7).click();
  await details(page).click();
  await expect(openDialog(page)).toHaveCount(1);
  return ctx;
}

const list = async (page: Page, string = "2") =>
  new Set((await storedRows(page)).at(-1)?.techniques[string] ?? []);

const byId = (id: string) => DECORATIONS.find((d) => d.id === id)!;

const PAIRS = [
  ["vibrato", "harmonic"], // the typical pair: a suffix and the harmonic's brackets
  ["tap", "let_ring"], // the two other mark positions: the prefix and the let-ring parens
].map(([a, b]) => [byId(a), byId(b)] as const);

for (const [a, b] of PAIRS) {
  test(`pair ${a.id} + ${b.id}`, async ({ page }) => {
    await oneNote(page);
    await burst(page, [name(a.words), name(b.words)]);
    await expect.poll(() => list(page)).toEqual(new Set([a.id, b.id]));
  });
}

// Every decoration toggles through the same handler; one typical and one multi-word name.
for (const d of [byId("vibrato"), byId("let_ring")]) {
  test(`double tap ${d.id} lands back at off`, async ({ page }) => {
    await oneNote(page);
    const before = (await storedRows(page)).at(-1)!;
    await burst(page, [name(d.words), name(d.words)]);
    await expect
      .poll(async () => {
        const row = (await storedRows(page)).at(-1)!;
        return row;
      })
      .toMatchObject({ techniques: {} });
    expect((await storedRows(page)).at(-1)!.frets).toEqual(before.frets);
    await expect(inspector(page).getByRole("button", { name: name(d.words) })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });
}

test("one pair across two strings", async ({ page }) => {
  await startCapturing(page);
  await fret(page, "A", 7).click();
  await stackLatch(page).click();
  await fret(page, "E", 5).click();
  await expect.poll(async () => Object.keys((await storedRows(page)).at(-1)!.frets).length).toBe(2);
  await details(page).click();
  await burst(page, [name("bend", "A1"), name("tap", "E1")]);
  await expect
    .poll(async () => (await storedRows(page)).at(-1)!.techniques)
    .toEqual({ "2": ["bend"], "3": ["tap"] });
});

test("all six in one burst, then the export", async ({ page }) => {
  const { songUrl } = await oneNote(page);
  await burst(page, DECORATIONS.map((d) => name(d.words)));
  await expect.poll(() => list(page)).toEqual(new Set(DECORATIONS.map((d) => d.id)));
  for (const d of DECORATIONS) {
    await expect(inspector(page).getByRole("button", { name: name(d.words) })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  }
  expect(exportRow(await exportText(page, songUrl), "A")).toBe("-t(<7>)b~m-");
});
