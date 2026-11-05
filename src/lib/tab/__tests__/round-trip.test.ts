/**
 * Round trip: everything the app draws can be read back (INV-003, INV-004, INV-005).
 *
 * The fixtures are harvested rather than copied. `layoutPart` is wrapped to
 * record its options while the other tab tests run in this file, and the
 * final describe replays every recorded part through `parseTab`.
 * See specs/004-ascii-import/contracts/round-trip.md.
 */
import { readdirSync } from "node:fs";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { AnnotationRow, EventRow } from "../../model";
import { draftPart } from "../../local/clipboard";
import { parseChord } from "../../chords";
import { presetById } from "../../tunings";
import type { LayoutOptions } from "../layout";
import { parseTab } from "../parse";

const recorded = vi.hoisted(() => ({ on: true, calls: [] as unknown[] }));

vi.mock("../layout", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../layout")>();
  return {
    ...actual,
    layoutPart: (options: LayoutOptions) => {
      if (recorded.on) recorded.calls.push(options);
      return actual.layoutPart(options);
    },
  };
});

import "./ascii.test";
import "./grouping.test";
import "./techniques.test";
import "./techniques-repeat.test";
import "./techniques-plain.test";
import "./techniques-layout-invariants.test";
import "../../export/__tests__/text.test";

const HARVESTED = [
  "ascii.test.ts",
  "grouping.test.ts",
  "techniques.test.ts",
  "techniques-repeat.test.ts",
  "techniques-plain.test.ts",
  "techniques-layout-invariants.test.ts",
];
const EXCLUDED = ["round-trip.test.ts", "harvest.test.ts", "reader.test.ts", "reading.test.ts", "single-owner.test.ts"];

type Actual = typeof import("../layout");
type ActualAscii = typeof import("../ascii");

interface Shape {
  columns: {
    kind: string;
    cells: (string | null)[];
    connectors: (string | null)[];
    bracket: number | null;
    group: number | null;
  }[];
}

const CHORDS = ["Am", "G", "Cmaj7", "D/F#", "E5", "N.C.", "Bb"];

/** What a drawing keeps, with ids replaced by the partition they make. Chords are compared apart. */
function shapeOf(actual: Actual, options: LayoutOptions, density: "expanded" | "compact"): Shape {
  const layout = actual.layoutPart({ ...options, density });
  // A group the text does not draw a bracket for cannot come back (carried: undrawn groups).
  const bracketsOn = (options as { showTuplets?: boolean }).showTuplets !== false;
  const drawn = new Set(bracketsOn ? actual.tupletSpans(layout).map((span) => span.tupletId) : []);
  const groups = new Map<string, number>();
  return {
    columns: layout.columns.map((c) => {
      let group: number | null = null;
      if (c.tupletId !== null && drawn.has(c.tupletId)) {
        if (!groups.has(c.tupletId)) groups.set(c.tupletId, groups.size);
        group = groups.get(c.tupletId)!;
      }
      return {
        kind: c.kind === "notes" && c.cells.every((cell) => cell === null) ? "rest" : c.kind,
        cells: c.cells,
        connectors: c.connectors,
        bracket: group === null ? null : c.bracketNumber,
        group,
      };
    }),
  };
}

function crossesBarline(shape: Shape): boolean {
  const seen = new Map<number, number>();
  let bar = 0;
  for (const c of shape.columns) {
    if (c.kind === "barline") {
      bar += 1;
      continue;
    }
    if (c.group === null) continue;
    if (seen.has(c.group) && seen.get(c.group) !== bar) return true;
    seen.set(c.group, bar);
  }
  return false;
}

function hasNotes(shape: Shape): boolean {
  return shape.columns.some((c) => c.kind !== "barline" && c.cells.some((cell) => cell !== null));
}

/** contracts/round-trip.md, The ledger: every class is hit at least once, or the test fails. */
const CLASSES = [
  "separately-stored",
  "compact-without-label",
  "first-note-repeat",
  "counted-split",
  "plain-unrolled",
  "repeated-space",
  "no-notes",
  "chord-clipped",
  "chord-not-a-symbol",
];

const ledger = new Map<string, number>();
const hit = (name: string) => ledger.set(name, (ledger.get(name) ?? 0) + 1);

/** One stored column, unrolled: what a row holds that the drawing could hide. */
interface Stored {
  kind: string;
  frets: string;
  decorations: string;
  transitions: string[];
  group: number | null;
  groupKind: string | null;
  groupCount: number | null;
  chord: string | null;
}

const KNOWN_DECORATIONS = new Set(["vibrato", "harmonic", "let_ring", "bend", "tap", "palm_mute"]);
const TRANSITION_SET = new Set(["hammer_on", "pull_off", "slide_up", "slide_down"]);

/** Groups become small numbers in order of first sight, so ids never matter. */
function partition() {
  const seen = new Map<string, number>();
  return (id: string | null): number | null => {
    if (id === null) return null;
    if (!seen.has(id)) seen.set(id, seen.size);
    return seen.get(id)!;
  };
}

function storedColumns(
  events: readonly EventRow[],
  annotations: readonly AnnotationRow[],
  strings: number,
  carry: boolean,
  drawnGroups: Set<string> | null = null,
): Stored[] {
  const number = partition();
  const chordOf = new Map<string, string>();
  for (const a of annotations) {
    if (a.kind === "chord" && !a.deletedAt && a.anchorEventId !== null) chordOf.set(a.anchorEventId, a.value);
  }
  const out: Stored[] = [];
  for (const e of events.filter((row) => !row.deletedAt)) {
    const fretEntries = Object.entries(e.frets).filter(([s]) => Number(s) < strings);
    const emptied = carry && e.kind === "notes" && fretEntries.length === 0; // carried.emptyColumn
    const decorations: string[] = [];
    const transitions: string[] = [];
    for (const [s, list] of Object.entries(e.techniques ?? {})) {
      if (Number(s) >= strings) continue;
      for (const id of list as string[]) {
        if (TRANSITION_SET.has(id)) transitions.push(`${s}:${id}`);
        else if (KNOWN_DECORATIONS.has(id)) decorations.push(`${s}:${id}`); // carried.undrawnTechniques
      }
    }
    // A group the text draws no bracket for cannot come back (carried: undrawn groups).
    const tupletId = drawnGroups && e.tupletId !== null && !drawnGroups.has(e.tupletId) ? null : e.tupletId;
    const kindless = carry && tupletId !== null && !e.groupKind; // carried.kindlessGroup
    const groupKind = tupletId === null ? null : (e.groupKind ?? "tuplet");
    const count =
      tupletId === null || groupKind === "plain" ? null : (e.tupletCount ?? (kindless ? 3 : null));
    const column: Stored = {
      kind: emptied ? "rest" : e.kind,
      frets: JSON.stringify(fretEntries.sort(([a], [b]) => Number(a) - Number(b))),
      decorations: decorations.sort().join(","), // carried.techniqueSets
      transitions,
      group: number(tupletId),
      groupKind,
      groupCount: count,
      chord: chordOf.get(e.id) ?? null,
    };
    for (let i = 0; i < (e.kind === "barline" ? 1 : e.repeat); i += 1) {
      out.push(i === 0 ? column : { ...column, chord: null });
    }
  }
  return out;
}

const isChordSymbol = (value: string) => value === "N.C." || parseChord(value) !== null;

/** carried.chordValues: a chord the text cannot hold as a chord leaves no chord. */
const carriedChords = (columns: Stored[]): Stored[] =>
  columns.map((c) => (c.chord !== null && !isChordSymbol(c.chord) ? { ...c, chord: null } : c));

/** carried.durations needs no code: `durationHint` is not a field of `Stored`. */

/** carried.splitAtBarline: a group never spans a barline, so a source group does not either. */
function splitAtBarline(columns: Stored[]): Stored[] {
  const number = partition();
  let bar = 0;
  return columns.map((c) => {
    if (c.kind === "barline") bar += 1;
    return c.group === null ? c : { ...c, group: number(`${bar}:${c.group}`) };
  });
}

/** What FR-005 says merges: identical neighbours, in one group, the second with no chord. */
const mergeable = (a: Stored, b: Stored) =>
  a.kind === "notes" &&
  b.kind === "notes" &&
  b.chord === null &&
  a.kind === b.kind &&
  a.frets === b.frets &&
  a.decorations === b.decorations &&
  a.transitions.length === 0 &&
  b.transitions.length === 0 &&
  a.group === b.group;

const comparable = (c: Stored) => JSON.stringify({ ...c, transitions: undefined });

function roundTrip(
  actual: Actual,
  ascii: ActualAscii,
  options: LayoutOptions,
  density: "expanded" | "compact",
): string | null {
  const text = ascii.toAscii({ ...options, density });
  const source = shapeOf(actual, options, density);
  const reading = parseTab(text);

  if (!hasNotes(source)) {
    hit("no-notes");
    const refused = !reading.ok && reading.refusals.some((r) => r.code === "no-notes");
    return refused ? null : `expected no-notes\n${text}`;
  }
  if (!reading.ok) {
    // FR-020 outranks SC-001: a bracket sync would refuse is one the reader refuses too.
    const counts = source.columns.map((c) => c.bracket).filter((b): b is number => b !== null);
    if (reading.refusals.every((r) => r.code === "bracket-range") && counts.some((n) => n > 16 || n < 2)) {
      hit("group-out-of-range");
      return null;
    }
    return `refused:${reading.refusals.map((r) => r.code).join(",")}\n${text}`;
  }

  const rows = draftPart(reading.clipboard);
  const next = { ...options, events: rows.events, annotations: rows.annotations };
  const back = shapeOf(actual, next, reading.density);
  const strings = options.tuning.strings.length;

  if (density === "compact" && reading.density === "expanded") hit("compact-without-label");

  // Same text.
  let chordsDropped = false; // carried.chordOverwrite
  const redraw = ascii.toAscii({ ...next, density: reading.density });
  const repeatedRests =
    density === "compact" && options.events.some((e) => e.kind === "rest" && e.repeat > 1);
  if (redraw !== text) {
    const staff = (t: string) => t.split("\n").filter((l) => l.includes("|") || l.includes(",")).join("\n");
    // The chord line was drawn, and the reader listed it as ignored: it held no chord symbol.
    const chordLine = text.split("\n").find((l) => !l.includes("|") && !l.includes(","));
    const holdsNonSymbol = chordLine?.split(/\s+/).some((t) => t !== "" && !isChordSymbol(t));
    const notSymbols =
      holdsNonSymbol === true && reading.ignored.some((l) => l.text === chordLine);
    if (notSymbols && staff(redraw) === staff(text)) {
      expect(reading.ignored.length, `chord-not-a-symbol is listed as ignored\n${text}`).toBeGreaterThan(0);
      chordsDropped = true;
      hit("chord-not-a-symbol");
    } else if (repeatedRests) {
      hit("repeated-space");
    } else {
      return `text differs\n${JSON.stringify(text)}\n${JSON.stringify(redraw)}`;
    }
  }

  // Same events, as drawn.
  const crosses = crossesBarline(source);
  if (crosses) hit("split-at-barline");
  if (!crosses && JSON.stringify(back) !== JSON.stringify(source)) {
    const at = source.columns.findIndex(
      (c, i) => JSON.stringify(c) !== JSON.stringify(back.columns[i]),
    );
    return `events differ\n${text}\n${JSON.stringify(source.columns[at])}\n${JSON.stringify(back.columns[at])} ${source.columns.length}/${back.columns.length}`;
  }

  // Same events, as stored: the rows themselves, through `carried`.
  if (repeatedRests || reading.clipped.length > 0) return null;
  const layout = actual.layoutPart({ ...options, density });
  const bracketsOn = (options as { showTuplets?: boolean }).showTuplets !== false;
  const drawnGroups = new Set(bracketsOn ? actual.tupletSpans(layout).map((span) => span.tupletId) : []);
  const want = carriedChords(
    storedColumns(options.events, chordsDropped ? [] : (options.annotations ?? []), strings, true, drawnGroups),
  );
  const wantColumns = crosses ? splitAtBarline(want) : want;
  const have = storedColumns(rows.events, rows.annotations, strings, false);
  // carried.chordOverwrite: a chord a neighbour cuts short, or runs into, is read as what the row holds.
  for (const [i, column] of wantColumns.entries()) {
    const kept = have[i]?.chord;
    if (column.chord !== null && kept && kept !== column.chord && (column.chord.startsWith(kept) || kept.startsWith(column.chord))) {
      column.chord = kept;
    }
  }
  const a = wantColumns.map(comparable);
  const b = have.map(comparable);
  if (JSON.stringify(a) !== JSON.stringify(b)) {
    const at = a.findIndex((x, i) => x !== b[i]);
    return `stored rows differ at column ${at} of ${a.length}/${b.length}\n${text}\n${a[at]}\n${b[at]}`;
  }
  for (const [i, column] of wantColumns.entries()) {
    const bad = have[i].transitions.filter((t) => !column.transitions.includes(t));
    if (bad.length > 0) return `a transition the source lacks: ${bad}\n${text}`;
  }
  // The merged form: no two neighbours the reader should have joined are left as two rows.
  const alive = rows.events;
  for (let i = 0; i + 1 < alive.length; i += 1) {
    const x = storedColumns([alive[i]], rows.annotations, strings, false)[0];
    const y = storedColumns([alive[i + 1]], rows.annotations, strings, false)[0];
    if (reading.density === "expanded" && alive[i].tupletId === null && alive[i + 1].tupletId === null && mergeable(x, y)) {
      return `two rows left unmerged at ${i}\n${text}
${JSON.stringify(alive.map((r) => [r.kind, r.frets, r.techniques, r.repeat, r.tupletId]))}`;
    }
  }
  hit("separately-stored");
  return null;
}

// ------------------------------------------------------------------ generator

function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DECORATION_IDS = ["vibrato", "harmonic", "let_ring", "bend", "tap", "palm_mute"];
const TRANSITION_IDS = ["hammer_on", "pull_off", "slide_up", "slide_down"];

function generate(seed: number, strings: number) {
  const random = seeded(seed);
  const pick = <T,>(list: readonly T[]) => list[Math.floor(random() * list.length)];
  const events: EventRow[] = [];
  const annotations: AnnotationRow[] = [];
  let n = 0;
  const base = (over: Partial<EventRow>): EventRow => {
    n += 1;
    return {
      id: `g${seed}-${n}`,
      bandId: "b",
      partId: "p",
      rank: `a${String(n).padStart(4, "0")}`,
      kind: "notes",
      frets: {},
      techniques: {},
      repeat: 1,
      durationHint: null,
      tupletId: null,
      tupletCount: null,
      updatedAt: "x",
      deletedAt: null,
      fieldClocks: {},
      serverSeq: 0,
      ...over,
    } as EventRow;
  };
  const count = 1 + Math.floor(random() * 14);
  let groupId = 0;
  for (let i = 0; i < count; i += 1) {
    const roll = random();
    if (roll < 0.12) {
      events.push(base({ kind: "barline" }));
      continue;
    }
    if (roll < 0.2) {
      events.push(base({ kind: "rest", repeat: random() < 0.3 ? 1 + Math.floor(random() * 3) : 1 }));
      continue;
    }
    const frets: Record<string, number | "x"> = {};
    const techniques: Record<string, string[]> = {};
    const played = 1 + Math.floor(random() * Math.min(3, strings));
    for (let k = 0; k < played; k += 1) {
      const s = Math.floor(random() * strings);
      frets[s] = random() < 0.1 ? "x" : Math.floor(random() * 37);
      const list: string[] = [];
      if (random() < 0.3) list.push(pick(DECORATION_IDS));
      if (random() < 0.25) list.push(pick(TRANSITION_IDS));
      if (list.length) techniques[s] = list;
    }
    const event = base({
      frets,
      techniques: techniques as EventRow["techniques"],
      repeat: random() < 0.3 ? 1 + Math.floor(random() * 12) : 1,
    });
    events.push(event);
    if (random() < 0.2) {
      annotations.push({
        id: `a-${event.id}`,
        bandId: "b",
        partId: "p",
        anchorEventId: event.id,
        kind: "chord",
        value: pick(CHORDS),
        updatedAt: "x",
        deletedAt: null,
        fieldClocks: {},
        serverSeq: 0,
      } as AnnotationRow);
    }
  }
  for (let i = 0; i + 1 < events.length; i += 1) {
    if (random() > 0.15) continue;
    const span = events.slice(i, i + 2 + Math.floor(random() * 2));
    if (span.length < 2 || span.some((e) => e.kind === "barline" || e.tupletId !== null)) continue;
    groupId += 1;
    const plain = random() < 0.4;
    for (const e of span) {
      e.tupletId = `grp-${seed}-${groupId}`;
      e.tupletCount = plain ? null : 3;
      e.groupKind = plain ? "plain" : "tuplet";
    }
  }
  return { events, annotations };
}

const row = (over: Partial<EventRow>): EventRow =>
  ({
    id: "e1",
    bandId: "b",
    partId: "p",
    rank: "a",
    kind: "notes",
    frets: {},
    techniques: {},
    repeat: 1,
    durationHint: null,
    tupletId: null,
    tupletCount: null,
    updatedAt: "x",
    deletedAt: null,
    fieldClocks: {},
    serverSeq: 0,
    ...over,
  }) as EventRow;

const chord = (value: string): AnnotationRow =>
  ({
    id: "a1",
    bandId: "b",
    partId: "p",
    anchorEventId: "e1",
    kind: "chord",
    value,
    updatedAt: "x",
    deletedAt: null,
    fieldClocks: {},
    serverSeq: 0,
  }) as AnnotationRow;

// ------------------------------------------------------------------ the replay

describe("round trip (INV-003, INV-004, INV-005)", () => {
  let actual: Actual;
  let ascii: ActualAscii;
  let snapshot: LayoutOptions[] = [];

  beforeAll(async () => {
    recorded.on = false;
    actual = await vi.importActual<Actual>("../layout");
    ascii = await vi.importActual<ActualAscii>("../ascii");
    snapshot = recorded.calls as LayoutOptions[];
  });

  it("the harvest saw enough, and missed no test file", () => {
    expect(snapshot.length).toBeGreaterThanOrEqual(1000);
    const texts = new Set(
      snapshot.map((o) => ascii.toAscii({ ...o, density: o.density ?? "expanded" })),
    );
    expect(texts.size).toBeGreaterThanOrEqual(400);
    const found = readdirSync(new URL(".", import.meta.url)).filter((f) => f.endsWith(".test.ts"));
    const stray = found.filter(
      (f) => !HARVESTED.includes(f) && !EXCLUDED.includes(f) && !f.startsWith("review-"),
    );
    expect(stray).toEqual([]);
  });

  it("every harvested part reads back to the same events and the same text", () => {
    const seen = new Set<string>();
    const failures: string[] = [];
    for (const options of snapshot) {
      for (const density of ["expanded", "compact"] as const) {
        const key = JSON.stringify([options.events, options.annotations, options.tuning, density]);
        if (seen.has(key)) continue;
        seen.add(key);
        const problem = roundTrip(actual, ascii, options, density);
        if (problem) failures.push(problem);
      }
    }
    expect(failures.length + "\n" + failures.slice(0, 5).join("\n=====\n")).toBe("0\n");
  });

  it("the seeded generator G reads back too", () => {
    const failures: string[] = [];
    let seed = 1;
    for (let k = 0; k < 500; k += 1) {
      for (const id of ["bass4-e", "bass5-b", "guitar6-e"]) {
        const tuning = presetById(id)!;
        const { events, annotations } = generate(seed, tuning.strings.length);
        for (const density of ["expanded", "compact"] as const) {
          const problem = roundTrip(actual, ascii, { events, annotations, tuning }, density);
          if (problem) failures.push(`seed ${seed} ${id} ${density}\n${problem}`);
        }
        seed += 1;
      }
    }
    expect(failures.length + "\n" + failures.slice(0, 3).join("\n=====\n")).toBe("0\n");
  });

  it("pinned: Cmaj7 on the only column reads Cm and is clipped", () => {
    const text = ascii.toAscii({
      tuning: presetById("bass4-e")!,
      events: [row({ frets: { 0: 7 } })],
      annotations: [chord("Cmaj7")],
    });
    const reading = parseTab(text);
    expect(reading.ok).toBe(true);
    if (reading.ok) {
      expect(reading.clipboard.annotations.map((a) => a.value)).toEqual(["Cm"]);
      expect(reading.clipped).toHaveLength(1);
      hit("chord-clipped");
    }
  });

  it("pinned: riff as a chord value is commentary and draws no chord row", () => {
    const text = ascii.toAscii({
      tuning: presetById("bass4-e")!,
      events: [row({ frets: { 0: 7 } }), row({ id: "e2", frets: { 0: 7 } }), row({ id: "e3", frets: { 0: 7 } })],
      annotations: [chord("riff")],
    });
    const reading = parseTab(text);
    expect(reading.ok).toBe(true);
    if (reading.ok) {
      expect(reading.clipboard.annotations).toEqual([]);
      expect(reading.ignored.map((l) => l.text.trim())).toContain("riff");
      hit("chord-not-a-symbol");
    }
  });

  /** The part drawn, read, and drafted: the text, and the rows as `[kind, frets, techniques, repeat, count]`. */
  function readBack(events: EventRow[], density: "expanded" | "compact") {
    const tuning = presetById("bass4-e")!;
    const text = ascii.toAscii({ tuning, events, annotations: [], density });
    const reading = parseTab(text);
    if (!reading.ok) throw new Error(`refused\n${text}`);
    const rows = draftPart(reading.clipboard).events;
    const again = ascii.toAscii({ tuning, events: rows, annotations: [], density: reading.density });
    const columns = (list: EventRow[]) => storedColumns(list, [], 4, false).map(comparable);
    return {
      text,
      again,
      rows: rows.map((e) => [e.kind, e.frets, e.techniques, e.repeat, e.tupletCount]),
      unrolled: columns(rows),
      sourceUnrolled: columns(events),
    };
  }

  it("pinned: 7h7h7 reads a first pass with no technique, then the rest repeated with it", () => {
    const events = [row({ frets: { 0: 7 }, techniques: { 0: ["hammer_on"] }, repeat: 3 })];
    const back = readBack(events, "expanded");
    expect(back.text).toContain("-7h7h7-");
    expect(back.rows).toEqual([
      ["notes", { 0: 7 }, {}, 1, null],
      ["notes", { 0: 7 }, { 0: ["hammer_on"] }, 2, null],
    ]);
    expect(back.again).toBe(back.text);
    hit("first-note-repeat");
  });

  it("pinned: a counted group over a repeat reads the same ten columns, split as 5x8 5 5", () => {
    const g = { tupletId: "g", tupletCount: 3, groupKind: "tuplet" } as const;
    const events = [
      row({ frets: { 0: 5 }, ...g }),
      row({ id: "e2", frets: { 0: 5 }, repeat: 8, ...g }),
      row({ id: "e3", frets: { 0: 5 }, ...g }),
    ];
    const back = readBack(events, "expanded");
    expect(back.text).toContain(",--------3--------,");
    expect(back.rows.map((r) => [r[3], r[4]])).toEqual([[8, 3], [1, 3], [1, 3]]);
    expect(back.again).toBe(back.text);
    expect(back.unrolled).toHaveLength(10);
    hit("counted-split");
  });

  it("pinned: a repeat under a plain bracket is unrolled, and draws the same", () => {
    const g = { tupletId: "g", tupletCount: null, groupKind: "plain" } as const;
    const events = [
      row({ frets: { 0: 5 }, ...g }),
      row({ id: "e2", frets: { 0: 5 }, repeat: 3, ...g }),
    ];
    const back = readBack(events, "expanded");
    expect(back.rows).toHaveLength(4);
    expect(back.rows.every((r) => r[3] === 1)).toBe(true);
    expect(back.unrolled).toEqual(back.sourceUnrolled.map((c) => c));
    expect(back.again).toBe(back.text);
    hit("plain-unrolled");
  });

  it("pinned: a repeated rest in compact draws one space", () => {
    const events = [
      row({ frets: { 0: 5 } }),
      row({ id: "e2", kind: "rest", repeat: 3 }),
      row({ id: "e3", frets: { 0: 5 } }),
    ];
    const back = readBack(events, "compact");
    expect(back.text).toContain("-5---5-");
    expect(back.rows.map((r) => [r[0], r[3]])).toEqual([["notes", 1], ["rest", 1], ["notes", 1]]);
    hit("repeated-space");
  });

  it("the ledger's named classes were all hit", () => {
    expect(CLASSES.filter((name) => (ledger.get(name) ?? 0) === 0)).toEqual([]);
  });
});
