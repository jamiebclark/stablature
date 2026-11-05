/**
 * INV-032, INV-035, INV-036, INV-038 through the recorder and the screen. What the click plays is
 * compared with what the staves on the page show, read off the DOM, so it shares nothing with
 * `readNotation`. T045 was ticked with bar ranges, variants and sections left out.
 */
import { expect, test, type Page } from "@playwright/test";
import { generateNKeysBetween } from "fractional-indexing";
import { cols, idb, level, rec, recorder, seed, writeColumns, type Col } from "./rhythm-probe-helpers";

const BEATS: Record<string, number> = { w: 4, h: 2, q: 1, "8": 0.5, "16": 0.25, "32": 0.125 };

/** Bars as the page draws them, pass by pass: each bar's length in beats, from the marks alone. */
const barsOnScreen = (page: Page) =>
  page.locator("ol > li").evaluateAll((items) =>
    items.map((li) => {
      const bars: string[][] = [[]];
      for (const col of li.querySelectorAll("[data-testid=tab-column]")) {
        if (col.getAttribute("data-barline") === "true") bars.push([]);
        else bars[bars.length - 1].push(col.querySelector("[data-testid=tab-rhythm]")?.textContent ?? "");
      }
      return bars.filter((b) => b.length > 0);
    }),
  );

interface Entry {
  kind: "part" | "section_start" | "section_end" | "text";
  part?: string;
  repeat?: number;
  fromBar?: number | null;
  toBar?: number | null;
  lastRepeat?: string | null;
  label?: string | null;
}

/** Adds a part by cloning the first, for the arrangement to refer to. */
async function clonePart(page: Page, from: string, label: string) {
  return idb<string>(
    page,
    `const tx = db.transaction("parts", "readwrite");
     const s = tx.objectStore("parts");
     const id = crypto.randomUUID();
     const g = s.get(arg.from);
     g.onsuccess = () => s.put({ ...g.result, id, label: arg.label, name: arg.label, rank: g.result.rank + "V" });
     await new Promise((res) => (tx.oncomplete = res));
     return id;`,
    { from, label },
  );
}

async function writeArrangement(page: Page, list: Entry[]) {
  const ranks = generateNKeysBetween(null, null, list.length);
  await idb(
    page,
    `const tx = db.transaction("arrangementEntries", "readwrite");
     const s = tx.objectStore("arrangementEntries");
     const r = s.getAll();
     r.onsuccess = () => {
       const template = r.result[0];
       for (const row of r.result) s.delete(row.id);
       arg.list.forEach((e, i) => s.put({
         ...template,
         id: crypto.randomUUID(),
         rank: arg.ranks[i],
         kind: e.kind,
         partId: e.part ?? null,
         repeat: e.repeat ?? 1,
         fromBar: e.fromBar ?? null,
         toBar: e.toBar ?? null,
         lastRepeatPartId: e.lastRepeat ?? null,
         label: e.label ?? null,
       }));
     };
     await new Promise((res) => (tx.oncomplete = res));`,
    { list, ranks },
  );
}

test("INV-032 the click plays the bars the screen draws, over every arrangement shape", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "the engine and hook do not differ by device");
  test.setTimeout(90_000);
  await recorder(page);
  const A = cols("q", "q", "|", "8", "8", "8", "8", "q", "|", "h");
  const V = cols("h", "h", "|", "q");
  const B = cols("q", "|", "q", "q");
  const { playUrl, partId } = await seed(page, A, { bpm: 400 });
  const variant = await clonePart(page, partId, "V");
  const other = await clonePart(page, partId, "B");
  const gone = await clonePart(page, partId, "G");
  await writeColumns(page, variant, V);
  await writeColumns(page, other, B);
  await writeColumns(page, gone, cols("q"));
  await idb(
    page,
    `const tx = db.transaction("parts", "readwrite");
     const s = tx.objectStore("parts");
     const g = s.get(arg.gone);
     g.onsuccess = () => s.put({ ...g.result, deletedAt: "2026-11-05T00:00:00.000Z-0000-x" });
     await new Promise((res) => (tx.oncomplete = res));`,
    { gone },
  );
  await writeArrangement(page, [
    { kind: "part", part: partId, repeat: 2, lastRepeat: variant }, // a repeat, a variant on the last pass
    { kind: "text", label: "Everybody out" }, // a text entry
    { kind: "part", part: partId, fromBar: 2, toBar: 2 }, // a bar range on a part
    { kind: "part", part: partId, repeat: 2, fromBar: 1, toBar: 1, lastRepeat: variant }, // a bar range on a variant
    { kind: "section_start", repeat: 2, label: "Chorus" }, // a section x2 holding those
    { kind: "part", part: other, fromBar: 2 },
    { kind: "part", part: partId, repeat: 2, lastRepeat: variant, toBar: 1 },
    { kind: "section_end" },
    { kind: "part", part: gone }, // a deleted part
    { kind: "section_start", repeat: 1, label: "Coda" }, // an unterminated section
    { kind: "part", part: other },
  ]);
  await page.goto(playUrl);
  await expect(page.getByTestId("click-start")).toBeEnabled();
  await expect(page.locator("ol > li").first()).toBeVisible();

  const passes = await barsOnScreen(page);
  const bars = passes.flat();
  expect(bars.flat().every((m) => m in BEATS), JSON.stringify(passes)).toBe(true);
  const lengths = bars.map((b) => b.reduce((sum, m) => sum + BEATS[m], 0));
  const total = lengths.reduce((a, b) => a + b, 0);
  const starts: number[] = [];
  lengths.reduce((at, n) => (starts.push(at), at + n), 0);

  await page.getByTestId("click-start").click();
  const beat = 60 / 400;
  await expect
    .poll(async () => (await rec(page)).starts.length, { timeout: 30_000 })
    .toBeGreaterThan(4 + total + 8);
  await page.getByTestId("click-stop").click();
  const heard = (await rec(page)).starts;
  const t0 = heard[4].when;
  const at = (s: { when: number }) => Math.round(((s.when - t0) / beat) * 1000) / 1000;
  const accents = heard.filter((s) => level(s.hz) === "accent").map(at);
  expect(accents, "accents land on the bars drawn").toEqual(starts);
  const after = heard.filter((s) => s.when - t0 >= total * beat - 1e-6);
  expect(after[0] && at(after[0]), "plain from the end of what is drawn").toBe(total);
  expect(after.every((s) => level(s.hz) === "beat")).toBe(true);
});

const STATE = "click-state";

test("INV-035 the worked example against the spec's table, by ear", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "the engine and hook do not differ by device");
  await recorder(page);
  const triplet: Col = { d: "8", tupletId: "t", tupletCount: 3, groupKind: "tuplet" };
  const { playUrl } = await seed(
    page,
    [...cols("q", "q", "q", "q", "|"), triplet, triplet, triplet, ...cols("q", "h")],
    { bpm: 240 },
  );
  await page.goto(playUrl);
  await page.getByTestId("click-start").click();
  await expect.poll(async () => (await rec(page)).starts.length, { timeout: 6000 }).toBeGreaterThan(16);
  await page.getByTestId("click-stop").click();
  const heard = (await rec(page)).starts.slice(4);
  const t0 = heard[0].when;
  const got = heard.slice(0, 11).map((s) => [Math.round(((s.when - t0) / 0.25) * 3) / 3, level(s.hz)]);
  const third = 1 / 3;
  const want: [number, string][] = [
    [0, "accent"],
    [1, "beat"],
    [2, "beat"],
    [3, "beat"],
    [4, "accent"],
    [4 + third, "soft"],
    [4 + 2 * third, "soft"],
    [5, "beat"],
    [6, "beat"],
    [7, "beat"],
    [8, "beat"], // the plain beat, from where the score ended
  ];
  got.forEach(([b, l], i) => {
    expect(b as number, `click ${i}`).toBeCloseTo(want[i][0], 2);
    expect(l, `click ${i}`).toBe(want[i][1]);
  });
});

test("INV-036 fall to plain, by ear and on screen: no break in time, never back", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "the engine and hook do not differ by device");
  await recorder(page);
  const { playUrl } = await seed(page, cols("q", "q", "q", "8", "|", null, "q", "|", "q", "q", "q", "q"), { bpm: 240 });
  await page.goto(playUrl);
  await expect(page.getByTestId("click-follow")).toBeVisible();
  await page.getByTestId("click-start").click();
  await expect(page.getByTestId(STATE)).toHaveText("Following the notation.", { timeout: 3000 });
  await expect(page.getByTestId(STATE)).toHaveText("Plain beat.", { timeout: 3000 });
  await page.waitForTimeout(1500);
  await expect(page.getByTestId(STATE)).toHaveText("Plain beat.");
  await page.getByTestId("click-stop").click();
  const heard = (await rec(page)).starts.slice(4);
  const t0 = heard[0].when;
  const beats = heard.map((s) => (s.when - t0) / 0.25);
  // Bar 1 is 3.5 beats: clicks at 0, 1, 2, 3, then plain from 3.5, one a beat, and no accent again.
  expect(beats.slice(0, 7).map((b) => Math.round(b * 100) / 100)).toEqual([0, 1, 2, 3, 3.5, 4.5, 5.5]);
  expect(heard.slice(1).every((s) => level(s.hz) === "beat")).toBe(true);
});

const WORDS = {
  follows: "Click follows the notation.",
  plain: "Click is a plain beat.",
};

for (const c of [
  { name: "first bar timed", list: cols("q", "q"), offered: true, arrange: true },
  { name: "a leading empty bar", list: cols("|", "q", "q"), offered: true, arrange: true },
  { name: "first bar untimed", list: cols("q", null, "|", "q"), offered: false, arrange: true },
  { name: "no durations", list: cols(null, null), offered: false, arrange: true },
  { name: "no arrangement", list: cols("q", "q"), offered: false, arrange: false },
]) {
  test(`INV-038 ${c.name}: the choice and the words`, async ({ page }) => {
    await recorder(page);
    const { playUrl } = await seed(page, c.list, { bpm: 120, arrange: c.arrange });
    await page.goto(playUrl);
    await expect(page.getByTestId("click-start")).toBeEnabled();
    await expect(page.getByTestId("click-follow")).toHaveCount(c.offered ? 1 : 0);
    await expect(page.getByTestId(STATE)).toHaveText(c.offered ? WORDS.follows : WORDS.plain);
    if (c.offered) {
      await expect(page.getByTestId("click-follow")).toHaveAttribute("aria-pressed", "true");
      await page.getByTestId("click-follow").click();
      await expect(page.getByTestId(STATE)).toHaveText(WORDS.plain);
      await expect(page.getByTestId("click-follow")).toHaveAttribute("aria-pressed", "false");
      await page.reload();
      await expect(page.getByTestId("click-follow")).toHaveAttribute("aria-pressed", "true");
    }
  });
}

test("INV-038 follow off: a timed song is plain from the first click, and says so", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "the engine and hook do not differ by device");
  await recorder(page);
  const { playUrl } = await seed(page, cols("q", "q", "|", "q", "q"), { bpm: 240 });
  await page.goto(playUrl);
  await page.getByTestId("click-follow").click();
  await page.getByTestId("click-start").click();
  await expect(page.getByTestId(STATE)).toHaveText("Counting in.");
  await expect(page.getByTestId(STATE)).toHaveText("Plain beat.", { timeout: 3000 });
  await page.waitForTimeout(800);
  await page.getByTestId("click-stop").click();
  expect((await rec(page)).starts.every((s) => level(s.hz) === "beat")).toBe(true);
});
