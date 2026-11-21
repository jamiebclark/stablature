/** Spec 010 seeders: the fit song (data-model.md §1), the Song set (plan.md) and the Fold corpus F1-F15 (contracts/cards.md §4). */
import { expect, type Page } from "@playwright/test";
import { bar, n, seedSong, type Col, type EntrySpec, type PartSpec } from "./reading-helpers";
import { setStoredTempo } from "./rhythm-probe-helpers";

const eighths = (frets: number[], over: Col = {}): Col[] => frets.map((f) => n(f, { d: "8", ...over }));
/** Eight eighth notes, one digit each (research R13). */
const barOf = (base: number): Col[] => eighths([base, base + 2, base, base + 2, base + 3, base + 2, base, base + 2]);
const joined = (...bars: Col[][]): Col[] => bars.flatMap((b, i) => (i ? [bar(), ...b] : b));

const A: Col[] = joined(
  [
    n(3, { d: "8", chord: "Em7" }),
    n(5, { d: "8", tupletId: "p1", tupletCount: null, groupKind: "plain" }),
    n(3, { d: "8", tupletId: "p1", tupletCount: null, groupKind: "plain" }),
    ...eighths([5, 6, 5, 3, 5]),
  ],
  barOf(3),
  barOf(5),
  barOf(3),
);
const A2: Col[] = [...A.slice(0, A.length - 8), ...barOf(4)];
const B: Col[] = joined(barOf(5), barOf(6), barOf(5), barOf(2));
const C: Col[] = joined(barOf(2), barOf(3));

export const section = (label: string, repeat = 1) => ({ kind: "section_start", label, repeat }) as unknown as EntrySpec;
export const sectionEnd = { kind: "section_end" } as unknown as EntrySpec;

export const FIT_PARTS: PartSpec[] = [
  { key: "a", label: "A", columns: A },
  { key: "a2", label: "A'", variantOf: "a", columns: A2 },
  { key: "b", label: "B", columns: B },
  { key: "c", label: "C", columns: C },
];
const FIT_ENTRIES: EntrySpec[] = [
  section("Verse"),
  { part: "a", repeat: 4, last: "a2" },
  sectionEnd,
  { part: "b", repeat: 2 },
  { part: "a", repeat: 2 },
  section("Outro"),
  { part: "c" },
  sectionEnd,
  { part: "b" },
];

/** Gives the song's band a 4-string E Standard tuning and selects it, as the research probes do. */
export async function openFourString(page: Page, songUrl: string) {
  await page.goto(songUrl);
  await page.getByRole("link", { name: "Band" }).first().click();
  await expect(page).toHaveURL(/\/bands\/[0-9a-f-]+$/);
  await page.goto(`${page.url()}/tunings`);
  await page.getByRole("button", { name: "Bass 4", exact: true }).click();
  await page.getByRole("button", { name: "Add E Standard" }).first().click();
  await page.waitForTimeout(300);
  await page.goto(songUrl);
  const tools = page.getByTestId("panel-song-tools");
  if ((await tools.getAttribute("aria-expanded")) !== "true") await tools.click();
  const select = page.locator("select").first();
  const value = await select.evaluate((el) =>
    [...(el as HTMLSelectElement).options].find((o) => /E Standard/.test(o.textContent ?? ""))?.value ?? "",
  );
  await select.selectOption(value);
  await page.waitForTimeout(300);
  await tools.click();
  await expect(tools).toHaveAttribute("aria-expanded", "false");
}

/** The fit song: 4 strings, 120 bpm, ten passes drawn as six cards. */
export async function seedFitSong(page: Page) {
  const seeded = await seedSong(page, FIT_PARTS, FIT_ENTRIES);
  await setStoredTempo(page, 120);
  await openFourString(page, seeded.songUrl);
  return seeded;
}

/** One-digit quarter-note bars, `count` of them, with barlines between. */
export const bars = (count: number, base = 3): Col[] =>
  joined(...Array.from({ length: count }, (_, i) => [0, 1, 2, 3].map((k) => n(base + ((i + k) % 5), { d: "q" }))));

/** The same bars with no durations, so no rhythm row: what `narrow-before.json` was recorded from (spec 010 INV-001). */
export const plainBars = (count: number, base = 3): Col[] =>
  joined(...Array.from({ length: count }, (_, i) => [0, 1, 2, 3].map((k) => n(base + ((i + k) % 5)))));

export const SONGS = ["short", "long", "wide-bar", "names", "empty", "none"] as const;
export type SongName = (typeof SONGS)[number];

/** The plan's Song set, other than `fit` (seedFitSong). */
export async function seedWideSong(page: Page, name: SongName) {
  switch (name) {
    case "short":
      return seedSong(
        page,
        Array.from({ length: 12 }, (_, i) => ({ key: `p${i}`, label: `P${i + 1}`, columns: bars(1, 2 + (i % 5)) })),
        Array.from({ length: 12 }, (_, i) => ({ part: `p${i}` })),
      );
    case "long":
      return seedSong(
        page,
        [
          { key: "a", label: "A", columns: bars(16) },
          { key: "b", label: "B", columns: bars(2, 4) },
          { key: "c", label: "C", columns: bars(2, 5) },
        ],
        [{ part: "a" }, { part: "b" }, { part: "c" }],
      );
    case "wide-bar":
      return seedSong(
        page,
        [{ key: "a", label: "A", columns: Array.from({ length: 40 }, (_, i) => n(2 + (i % 6), { d: "q" })) }],
        [{ part: "a" }],
      );
    case "names":
      return seedSong(
        page,
        [
          {
            key: "a",
            label: "A",
            name: "An unreasonably long part name that goes on past sixty characters",
            columns: joined(
              [10, 12, 14, 12].map((f) => n(f, { d: "q" })),
              [11, 13, 15, 13].map((f) => n(f, { d: "q" })),
            ),
          },
        ],
        [section("A heading that is rather long too"), { part: "a" }, sectionEnd],
      );
    case "empty":
      return seedSong(page, [{ key: "a", label: "A", columns: [] }], [{ part: "a" }]);
    case "none":
      return seedSong(page, [{ key: "a", label: "A", columns: bars(2) }], []);
  }
}

export interface FoldCard {
  /** Inclusive pass range the card draws. */
  passes: [number, number];
  words: string | null;
  span: string | null;
}
export interface FoldRow {
  id: string;
  parts: PartSpec[];
  entries: EntrySpec[];
  cards: FoldCard[];
}

const part = (key: string, columns: Col[], over: Partial<PartSpec> = {}): PartSpec => ({ key, label: key.toUpperCase(), columns, ...over });
const x = "×";
const dot = "·";
const dash = "–";
const range = (a: number, z: number) => `passes ${a}${dash}${z}`;
const run = (first: number, count: number, of: number, from: number, to: number | null): FoldCard => ({
  passes: [first, first + count - 1],
  words: `${x}${count} ${dot} ${range(1, count)} of ${of}`,
  span: to === null ? null : `bars ${from}${dash}${to}`,
});
const one = (pass: number, words: string | null = null): FoldCard => ({ passes: [pass, pass], words, span: null });

const a4 = () => part("a", bars(4));
const a2 = () => part("a2", bars(4, 4), { label: "A'", variantOf: "a" });

/** F1-F14. F15 is the fit song itself (seedFitSong). Passes are numbered across the whole expanded arrangement. */
export const FOLD: FoldRow[] = [
  { id: "F1", parts: [a4()], entries: [{ part: "a", repeat: 4 }], cards: [run(0, 4, 4, 1, 16)] },
  {
    id: "F2",
    parts: [a4(), a2()],
    entries: [{ part: "a", repeat: 4, last: "a2" }],
    cards: [{ passes: [0, 2], words: `${x}3 ${dot} ${range(1, 3)} of 4`, span: `bars 1${dash}12` }, one(3, "pass 4 of 4")],
  },
  {
    id: "F3",
    parts: [a4(), a2()],
    entries: [{ part: "a", repeat: 2, last: "a2" }],
    cards: [one(0, "pass 1 of 2"), one(1, "pass 2 of 2")],
  },
  { id: "F4", parts: [a4(), a2()], entries: [{ part: "a", repeat: 1, last: "a2" }], cards: [one(0)] },
  {
    id: "F5",
    parts: [a4()],
    entries: [section("Verse", 2), { part: "a", repeat: 2 }, sectionEnd],
    cards: [run(0, 2, 2, 1, 8), run(2, 2, 2, 9, 16)],
  },
  {
    id: "F6",
    parts: [a4()],
    entries: [section("", 2), { part: "a", repeat: 2 }, sectionEnd],
    cards: [run(0, 2, 2, 1, 8), run(2, 2, 2, 9, 16)],
  },
  { id: "F7", parts: [a4()], entries: [{ part: "a" }, { part: "a" }], cards: [one(0), one(1)] },
  {
    id: "F8",
    parts: [a4()],
    entries: [{ part: "a", repeat: 3, fromBar: 1, toBar: 2 }],
    cards: [run(0, 3, 3, 1, 6)],
  },
  { id: "F9", parts: [a4(), a2()], entries: [{ part: "a2", repeat: 3 }], cards: [run(0, 3, 3, 1, 12)] },
  { id: "F10", parts: [part("a", [])], entries: [{ part: "a", repeat: 3 }], cards: [run(0, 3, 3, 0, null)] },
  {
    id: "F11",
    parts: [part("a", [bar(), ...bars(4)])],
    entries: [{ part: "a", repeat: 3 }],
    cards: [run(0, 3, 3, 1, 15)],
  },
  {
    id: "F12",
    parts: [a4()],
    entries: [{ part: "a", repeat: 2 }, { kind: "text", label: "Cue" }, { part: "a", repeat: 2 }],
    cards: [run(0, 2, 2, 1, 8), run(2, 2, 2, 9, 16)],
  },
  {
    id: "F13",
    parts: [a4()],
    entries: [section("Outer"), section("Inner", 2), { part: "a", repeat: 3 }, sectionEnd, sectionEnd],
    cards: [run(0, 3, 3, 1, 12), run(3, 3, 3, 13, 24)],
  },
  { id: "F14", parts: [a4()], entries: [], cards: [] },
];

export const seedFold = (page: Page, row: FoldRow) => seedSong(page, row.parts, row.entries);
