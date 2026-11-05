/**
 * INV-022/023: the alignment's difference count equals a plain edit-distance table, which shares no
 * code with it.
 */
import "fake-indexeddb/auto";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { alignColumns } from "@/lib/reading/align";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { vi } from "vitest";
import { parseChord } from "@/lib/chords";
import { type AnnotationRow, type EventRow, type PartRow } from "@/lib/model";
import { compareParts, type Op } from "@/lib/reading/compare";
import { layoutReading } from "@/lib/reading/labels";
import { playedColumns, signatureOf } from "@/lib/reading/played";
import { type LayoutOptions } from "@/lib/tab/layout";
import { stringCount } from "@/lib/tunings";
import { staffMarks } from "@/lib/reading/marks";
import { TUNING_PRESETS } from "@/lib/tunings";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { HlcClock } from "@/lib/hlc";
import { newId } from "@/lib/ids";
import { StablatureDb } from "@/lib/local/db";
import { appendNote, createBand, createPart, createSong, createTuningFromPreset, createVariant } from "@/lib/local/editing";
import { deleteRow, patchRow } from "@/lib/local/mutate";
import { listSongContent } from "@/lib/local/queries";
import { MAX_EDITS } from "@/lib/reading/align";
import { compareVariants } from "@/lib/reading/compare";
import { presetById } from "@/lib/tunings";

const recorded = vi.hoisted(() => ({ on: true, calls: [] as unknown[] }));

vi.mock("@/lib/tab/layout", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/tab/layout")>();
  return {
    ...actual,
    layoutPart: (options: LayoutOptions) => {
      if (recorded.on) recorded.calls.push(options);
      return actual.layoutPart(options);
    },
  };
});

import "@/lib/tab/__tests__/ascii.test";
import "@/lib/tab/__tests__/grouping.test";
import "@/lib/tab/__tests__/techniques.test";
import "@/lib/tab/__tests__/techniques-repeat.test";
import "@/lib/tab/__tests__/techniques-plain.test";
import "@/lib/tab/__tests__/techniques-layout-invariants.test";
import "@/lib/export/__tests__/text.test";

const BAR = 0;
const isBar = (c: number) => c === BAR;

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

/** Plain table: change, add, remove cost 1; a barline never changes into a note. */
function distance(a: number[], b: number[]): number {
  const D = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i += 1) D[i][0] = i;
  for (let j = 0; j <= b.length; j += 1) D[0][j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const sub = a[i - 1] === b[j - 1] ? 0 : isBar(a[i - 1]) !== isBar(b[j - 1]) ? Infinity : 1;
      D[i][j] = Math.min(D[i - 1][j] + 1, D[i][j - 1] + 1, D[i - 1][j - 1] + sub);
    }
  }
  return D[a.length][b.length];
}

/** Rebuild the gaps as compare.ts does, and count what is not the same. */
function differences(a: number[], b: number[]): number {
  const { matches } = alignColumns(Int32Array.from(a), Int32Array.from(b), isBar);
  let p = 0;
  let v = 0;
  let count = 0;
  const run = (pe: number, ve: number) => {
    while (p < pe || v < ve) {
      if (p < pe && v < ve) {
        if (isBar(a[p]) === isBar(b[v])) {
          if (a[p] !== b[v]) count += 1;
          p += 1;
          v += 1;
        } else {
          count += 1;
          if (isBar(a[p])) p += 1;
          else v += 1;
        }
      } else {
        count += 1;
        if (p < pe) p += 1;
        else v += 1;
      }
    }
  };
  for (const [f, t] of matches) {
    run(f, t);
    p = f + 1;
    v = t + 1;
  }
  run(a.length, b.length);
  return count;
}

describe("the alignment against a plain table", () => {
  it("agrees on 5,000 seeded pairs", () => {
    const next = rng(7);
    for (let n = 0; n < 5000; n += 1) {
      const alphabet = 2 + Math.floor(next() * 5);
      const make = () =>
        Array.from({ length: Math.floor(next() * 13) }, () => (next() < 0.2 ? BAR : 1 + Math.floor(next() * alphabet)));
      const a = make();
      const b = make();
      const got = differences(a, b);
      const want = distance(a, b);
      if (got !== want) throw new Error(`pair ${n}: ${a} vs ${b}: got ${got}, want ${want}`);
    }
  });

  it("is deterministic, and never pairs a barline with a note", () => {
    const a = [1, 2, 3, 4, 5];
    const b = [5, 6, 7, 8, 9];
    expect(differences(a, b)).toBe(5);
    expect(alignColumns(Int32Array.from(a), Int32Array.from(b), isBar)).toEqual(
      alignColumns(Int32Array.from(a), Int32Array.from(b), isBar),
    );
    const x = [1, BAR, 2];
    const y = [BAR, 1, 2];
    for (const [i, j] of alignColumns(Int32Array.from(x), Int32Array.from(y), isBar).matches) {
      expect(isBar(x[i])).toBe(isBar(y[j]));
    }
  });

  it("puts one inserted riff column in the same place each time", () => {
    const riff = [1, 2, 3, 1, 2, 3, 1, 2, 3];
    const variant = [1, 2, 3, 1, 1, 2, 3, 1, 2, 3];
    expect(differences(riff, variant)).toBe(1);
    const first = JSON.stringify(alignColumns(Int32Array.from(riff), Int32Array.from(variant), isBar));
    expect(JSON.stringify(alignColumns(Int32Array.from(riff), Int32Array.from(variant), isBar))).toBe(first);
  });
});

describe("review probe INV-001-012-019-020-021-024-harvest.test.ts", { timeout: 300_000 }, () => {
  const sha = (s: string) => createHash("sha256").update(s).digest("hex").slice(0, 24);
  const part = (id: string, label: string) => ({ id, label }) as PartRow;
  
  /** Read on first use, inside a test: a top-level `beforeAll` runs before the imported fixtures have. */
  let cached: LayoutOptions[] | null = null;
  function harvest(): LayoutOptions[] {
    if (cached) return cached;
    recorded.on = false;
    const seen = new Map<string, LayoutOptions>();
    for (const call of recorded.calls as LayoutOptions[]) seen.set(JSON.stringify(call), call);
    cached = [...seen.values()];
    return cached;
  }
  
  /** A short, readable form of a part, for the failure list. */
  const show = (events: readonly EventRow[]) =>
    events
      .map((e) => {
        if (e.kind === "barline") return "|";
        const f = Object.entries(e.frets).map(([s, v]) => `${s}:${v}`).join(",") || (e.kind === "rest" ? "r" : "_");
        return `${f}${e.repeat > 1 ? `x${e.repeat}` : ""}${e.tupletId ? `[${e.tupletId}]` : ""}`;
      })
      .join(" ");
  
  /** One event per played column, so an edit can touch one column. The chord stays on the first. */
  function unroll(events: readonly EventRow[], annotations: readonly AnnotationRow[]) {
    const out: EventRow[] = [];
    const firstOf = new Map<string, string>();
    for (const e of events) {
      const times = e.kind === "barline" ? 1 : Math.max(1, e.repeat);
      for (let r = 0; r < times; r += 1) {
        const id = `${e.id}~${r}`;
        if (r === 0) firstOf.set(e.id, id);
        out.push({ ...e, id, repeat: 1 });
      }
    }
    return {
      events: out,
      annotations: annotations.map((a) => ({ ...a, anchorEventId: firstOf.get(a.anchorEventId ?? "") ?? a.anchorEventId })),
    };
  }
  
  function regenerate(events: readonly EventRow[], annotations: readonly AnnotationRow[]) {
    const group = new Map<string, string>();
    return {
      events: events.map((e) => ({
        ...e,
        id: `new-${e.id}`,
        tupletId: e.tupletId
          ? (group.get(e.tupletId) ?? (group.set(e.tupletId, `newgroup-${group.size}`), group.get(e.tupletId)!))
          : null,
      })),
      annotations: annotations.map((a, i) => ({ ...a, id: `newnote-${i}`, anchorEventId: a.anchorEventId ? `new-${a.anchorEventId}` : null })),
    };
  }
  
  const tally = (ops: readonly Op[]) => {
    const count = { changed: 0, added: 0, removed: 0 };
    for (const op of ops) if (op.kind !== "same") count[op.kind] += 1;
    return count;
  };
  
  const compare = (
    a: readonly EventRow[], an: readonly AnnotationRow[], b: readonly EventRow[], bn: readonly AnnotationRow[], strings: number,
  ) => compareParts({ part: part("p", "A"), events: a, annotations: an }, { part: part("v", "B"), events: b, annotations: bn }, strings);
  
  /** Each of F, and whether it can apply to this column. Returns the new row, or null. */
  type Edit = (e: EventRow, strings: number) => EventRow | null;
  const playedStrings = (e: EventRow) => Object.keys(e.frets);
  const F: Record<string, Edit> = {
    "kind notes to rest": (e) => (e.kind === "notes" ? { ...e, kind: "rest", frets: {}, techniques: {} } : null),
    "fret value": (e) => {
      const s = playedStrings(e).find((k) => typeof e.frets[k] === "number");
      return s === undefined ? null : { ...e, frets: { ...e.frets, [s]: (e.frets[s] as number) + 1 } };
    },
    "fret to dead": (e) => {
      const s = playedStrings(e).find((k) => typeof e.frets[k] === "number");
      return s === undefined ? null : { ...e, frets: { ...e.frets, [s]: "x" } };
    },
    "fret added on a string": (e, strings) => {
      if (e.kind !== "notes") return null;
      for (let i = 0; i < strings; i += 1) if (e.frets[String(i)] === undefined) return { ...e, frets: { ...e.frets, [String(i)]: 9 } };
      return null;
    },
    "fret removed from a string": (e) => {
      const s = playedStrings(e)[0];
      if (s === undefined) return null;
      const frets = { ...e.frets };
      delete frets[s];
      const techniques = { ...e.techniques };
      delete techniques[s];
      return { ...e, frets, techniques };
    },
    "technique added": (e) => {
      const s = playedStrings(e)[0];
      if (s === undefined || (e.techniques[s] ?? []).includes("palm_mute")) return null;
      return { ...e, techniques: { ...e.techniques, [s]: [...(e.techniques[s] ?? []), "palm_mute"] } };
    },
    "technique removed": (e) => {
      const s = playedStrings(e).find((k) => (e.techniques[k] ?? []).length > 0);
      return s === undefined ? null : { ...e, techniques: { ...e.techniques, [s]: e.techniques[s].slice(1) } };
    },
    "duration set": (e) => (e.durationHint ? null : { ...e, durationHint: "q" }),
    "duration changed": (e) => (e.durationHint ? { ...e, durationHint: e.durationHint === "q" ? "8" : "q" } : null),
    "duration cleared": (e) => (e.durationHint ? { ...e, durationHint: null } : null),
    "joined a group": (e) => (e.tupletId ? null : { ...e, tupletId: "joined", tupletCount: 3, groupKind: "tuplet" }),
    "left a group": (e) => (e.tupletId ? { ...e, tupletId: null, tupletCount: null, groupKind: null } : null),
    "group kind": (e) => (e.tupletId ? { ...e, groupKind: e.groupKind === "plain" ? "tuplet" : "plain", tupletCount: e.tupletCount ?? 3 } : null),
    "group number": (e) => (e.tupletId ? { ...e, tupletCount: (e.tupletCount ?? 3) + 2 } : null),
  };
  
  interface Failure { shape: string; edit: string; got: string }
  /** Keep the first few of each kind of failure, with a count, so the report stays readable. */
  class Failures {
    list: Failure[] = [];
    byEdit = new Map<string, number>();
    add(failure: Failure) {
      this.byEdit.set(failure.edit, (this.byEdit.get(failure.edit) ?? 0) + 1);
      if (this.list.length < 12) this.list.push(failure);
    }
  }
  
  describe("INV-001 frets with no marks draw as main drew", () => {
    it("adds the reading prop and matches every baseline markup hash", async () => {
      const actual = await vi.importActual<typeof import("@/lib/tab/layout")>("@/lib/tab/layout");
      const { TabStaff } = await import("@/components/tab/TabStaff");
      const baseline = JSON.parse(
        readFileSync("src/lib/reading/__tests__/baseline.json", "utf8"),
      ) as { entries: Record<string, Record<string, string>> };
      const noMarks = { columns: new Map(), removals: new Map(), removedAtEnd: 0, line: "Same as A", any: false, parentLabel: "A" };
      const bad: string[] = [];
      let checked = 0;
      for (const o of harvest()) {
        const id = sha(JSON.stringify(o));
        for (const density of ["expanded", "compact"] as const) {
          const want = baseline.entries[`${id}:${density}`];
          if (!want) {
            bad.push(`${id}:${density} is not in the baseline`);
            continue;
          }
          expect(sha(JSON.stringify(actual.layoutPart({ ...o, density })))).toBe(want.layout);
          for (const surface of ["base", "raised"] as const) {
            for (const showRhythm of [false, true]) {
              for (const marks of [null, undefined, noMarks]) {
                checked += 1;
                const html = renderToStaticMarkup(
                  createElement(TabStaff, {
                    events: o.events, tuning: o.tuning, annotations: o.annotations, density, surface, showRhythm,
                    reading: { view: "frets", partEvents: o.events, marks },
                  }),
                );
                if (sha(html) !== want[`markup:${surface}:${showRhythm ? "rhythm" : "plain"}`]) {
                  bad.push(`${id}:${density}:${surface}:${showRhythm}`);
                }
              }
            }
          }
        }
      }
      expect(checked).toBeGreaterThan(1000);
      expect(bad.slice(0, 10)).toEqual([]);
    });
  });
  
  /** main's `chordInForceAt`, verbatim. */
  function walkedOnMain(events: readonly EventRow[], annotations: readonly AnnotationRow[], eventId: string | null): string | null {
    if (eventId === null) return null;
    const anchored = new Map<string, string>();
    for (const annotation of annotations) {
      if (annotation.kind !== "chord") continue;
      if (annotation.anchorEventId === null) continue;
      anchored.set(annotation.anchorEventId, annotation.value);
    }
    if (anchored.size === 0) return null;
    let inForce: string | null = null;
    for (const event of events) {
      const here = anchored.get(event.id);
      if (here !== undefined) inForce = here;
      if (event.id === eventId) return inForce;
    }
    return null;
  }
  
  describe("INV-012 the staff reads the chord main's walk reads", () => {
    const FOLDED = ["1", "b2", "2", "b3", "3", "4", "b5", "5", "b6", "6", "b7", "7"];
    const GRAMMAR = /^(t·)?(\()?(<)?(.+?)(>)?(\))?(·b)?(~)?(·m)?$/;
    const LETTERS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
    const openPc = (name: string) => {
      const base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[name[0]]!;
      return (base + (name.includes("#") ? 1 : name.endsWith("b") && name.length > 1 ? -1 : 0) + 12) % 12;
    };
  
    it("over H with chords laid on in turn, whole and sliced, with every Unread ending the last", () => {
      let columns = 0;
      const wrong: string[] = [];
      for (const o of harvest()) {
        const events = o.events;
        if (events.length < 2 || events.length > 40) continue;
        const anchors = events.map((_, i) => i).filter((i) => i % 2 === 0).slice(0, 6);
        for (const at of anchors) {
          for (const ender of [null, "N.C.", "Bridge", "C(x)", "", "   ", "F"]) {
            const annotations = [
              { id: "a", kind: "chord", anchorEventId: events[at].id, value: "Am" },
              ...(ender !== null ? [{ id: "b", kind: "chord", anchorEventId: events[Math.min(at + 1, events.length - 1)].id, value: ender }] : []),
              { id: "d", kind: "chord", anchorEventId: "gone", value: "G" },
              { id: "t", kind: "text", anchorEventId: events[0].id, value: "Dm" },
            ] as AnnotationRow[];
            for (const start of [0, Math.floor(events.length / 2), events.length - 1]) {
              const slice = events.slice(start);
              const layout = layoutReading({ view: "intervals", events: slice, partEvents: events, tuning: o.tuning, annotations });
              for (const column of layout.columns) {
                if (column.kind === "barline") continue;
                const symbol = walkedOnMain(events, annotations, column.eventId);
                const chord = symbol === null ? null : parseChord(symbol);
                column.cells.forEach((text, s) => {
                  if (text === null) return;
                  const pitchText = GRAMMAR.exec(text.replace(/x\d+$/, ""))![4];
                  const fret = events.find((e) => e.id === column.eventId)!.frets[String(s)];
                  if (typeof fret !== "number" || pitchText === "?" || pitchText === "x") return;
                  columns += 1;
                  const pc = (openPc(o.tuning.strings[s].note) + fret) % 12;
                  if (chord) {
                    const tone = chord.tones.find((t) => t.pitchClass === pc);
                    const want = tone ? tone.degree : FOLDED[(pc - chord.root + 12) % 12];
                    if (pitchText !== want) wrong.push(`${show(events)} @${at}/${ender}: ${pitchText}, want ${want} under ${symbol}`);
                  } else if (!/^[A-G]/.test(pitchText)) {
                    wrong.push(`${show(events)} @${at}/${ender}: ${pitchText}, want a note, ${LETTERS[pc]}`);
                  }
                });
              }
            }
          }
        }
      }
      expect(columns).toBeGreaterThan(10_000);
      expect(wrong.slice(0, 10)).toEqual([]);
    });
  
    it("two annotations on one anchor read as main read them", () => {
      const events = [{ id: "e", kind: "notes", frets: { "0": 5 }, techniques: {}, repeat: 1 }] as unknown as EventRow[];
      const annotations = [
        { kind: "chord", anchorEventId: "e", value: "Am" },
        { kind: "chord", anchorEventId: "e", value: "Dm" },
      ] as AnnotationRow[];
      expect(walkedOnMain(events, annotations, "e")).toBe("Dm");
    });
  });
  
  describe("INV-020 the unrolling and the layout agree over H", () => {
    it("in keys, order and bars", async () => {
      const actual = await vi.importActual<typeof import("@/lib/tab/layout")>("@/lib/tab/layout");
      for (const o of harvest()) {
        const layout = actual.layoutPart({ ...o, density: "expanded" });
        const played = playedColumns(o.events, (o.annotations ?? []) as AnnotationRow[], stringCount(o.tuning), () => 0);
        expect(played.map((p) => [p.eventId, p.repetition, p.bar])).toEqual(layout.columns.map((c) => [c.eventId, c.repetition, c.barNumber]));
      }
    });
  });
  
  describe("INV-019/021/024 one edit reports itself, at every position of every fixture", () => {
    const check = (
      failures: Failures, name: string, parent: EventRow[], parentNotes: AnnotationRow[], variant: EventRow[], variantNotes: AnnotationRow[],
      strings: number, want: { changed: number; added: number; removed: number },
    ) => {
      const result = compare(parent, parentNotes, variant, variantNotes, strings);
      const got = tally(result.ops);
      const again = regenerate(variant, variantNotes);
      const renamed = compare(parent, parentNotes, again.events, again.annotations, strings);
      const gotAgain = tally(renamed.ops);
      if (got.changed !== want.changed || got.added !== want.added || got.removed !== want.removed) {
        failures.add({ shape: `${show(parent)}  ->  ${show(variant)}`, edit: name, got: JSON.stringify(got) });
      } else if (JSON.stringify(got) !== JSON.stringify(gotAgain)) {
        failures.add({ shape: show(parent), edit: `${name} (ids)`, got: `${JSON.stringify(got)} then ${JSON.stringify(gotAgain)}` });
      }
      // INV-024: every column of both, once, in order, and the report rebuilds the variant.
      const froms = result.ops.flatMap((o) => ("from" in o ? [o.from] : []));
      const tos = result.ops.flatMap((o) => ("to" in o ? [o.to] : []));
      const table = new Map<string, number>();
      const intern = (s: string) => table.get(s) ?? (table.set(s, table.size), table.size - 1);
      const a = playedColumns(parent, parentNotes, strings, intern);
      const b = playedColumns(variant, variantNotes, strings, intern);
      if (froms.join() !== a.map((_, i) => i).join() || tos.join() !== b.map((_, i) => i).join()) {
        failures.add({ shape: show(parent), edit: `${name} (coverage)`, got: `${froms} / ${tos}` });
      }
      const rebuilt: number[] = [];
      for (const op of result.ops) {
        if (op.kind === "same") rebuilt.push(a[op.from].content);
        else if (op.kind !== "removed") rebuilt.push(b[op.to].content);
      }
      if (rebuilt.join() !== b.map((c) => c.content).join()) failures.add({ shape: show(parent), edit: `${name} (rebuild)`, got: "the report does not rebuild the variant" });
    };
  
    const ONE = { changed: 0, added: 1, removed: 0 };
    const GONE = { changed: 0, added: 0, removed: 1 };
    const SWAP = { changed: 1, added: 0, removed: 0 };
  
    it("H x every position x insert, remove, alter", () => {
      const failures = new Failures();
      let edits = 0;
      const shapes = new Map<string, LayoutOptions>();
      for (const o of harvest()) shapes.set(JSON.stringify([o.events.map((e) => ({ ...e, id: 0, rank: 0 })), o.annotations ?? [], stringCount(o.tuning)]), o);
      for (const o of shapes.values()) {
        const strings = stringCount(o.tuning);
        const { events, annotations } = unroll(o.events, (o.annotations ?? []) as AnnotationRow[]);
        if (events.length > 60) continue;
        const fresh = (over: Partial<EventRow>) => ({ ...(events[0] ?? {}), id: `ins-${edits}`, kind: "notes", frets: { "0": 23 }, techniques: {}, repeat: 1, durationHint: null, tupletId: null, tupletCount: null, groupKind: null, ...over }) as EventRow;
        for (let at = 0; at <= events.length; at += 1) {
          const inserted = (row: EventRow) => [...events.slice(0, at), row, ...events.slice(at)];
          edits += 1;
          check(failures, "insert a note", events, annotations, inserted(fresh({})), annotations, strings, ONE);
          const beside = events[at]?.tupletId ?? events[at - 1]?.tupletId;
          if (beside) {
            edits += 1;
            check(failures, "insert a note into the group", events, annotations, inserted(fresh({ tupletId: beside, tupletCount: 3, groupKind: "tuplet" })), annotations, strings, ONE);
          }
          edits += 1;
          check(failures, "insert a barline", events, annotations, inserted(fresh({ kind: "barline", frets: {} })), annotations, strings, ONE);
        }
        events.forEach((event, at) => {
          const rest = [...events.slice(0, at), ...events.slice(at + 1)];
          // A chord on the removed column has nowhere to go: that is two edits, so take the chord with it.
          const anchored = annotations.some((a) => a.anchorEventId === event.id);
          if (!anchored) {
            edits += 1;
            check(failures, `remove a ${event.kind === "barline" ? "barline" : "column"}`, events, annotations, rest, annotations, strings, GONE);
          }
          if (event.kind === "barline") return;
          for (const [name, edit] of Object.entries(F)) {
            const row = edit(event, strings);
            if (!row) continue;
            edits += 1;
            check(failures, name, events, annotations, events.map((e, i) => (i === at ? row : e)), annotations, strings, SWAP);
          }
          const others = annotations.filter((a) => a.anchorEventId !== event.id);
          const own = annotations.find((a) => a.kind === "chord" && a.anchorEventId === event.id);
          const note = (value: string) => ({ ...(annotations[0] ?? {}), id: "c", kind: "chord", anchorEventId: event.id, value }) as AnnotationRow;
          edits += 1;
          if (own) {
            check(failures, "chord changed", events, annotations, events, [...others, note(`${own.value}7`)], strings, SWAP);
            check(failures, "chord removed", events, annotations, events, others, strings, SWAP);
          } else {
            check(failures, "chord added", events, annotations, events, [...others, note("Am")], strings, SWAP);
          }
        });
      }
      expect(edits).toBeGreaterThan(5_000);
      expect({ byEdit: Object.fromEntries(failures.byEdit), first: failures.list }).toEqual({ byEdit: {}, first: [] });
    });
  });
  
  describe("INV-019 no id reaches a result", () => {
    it("over H: every event id, every group id, every annotation id, and all of them", () => {
      const wrong: string[] = [];
      for (const o of harvest()) {
        const strings = stringCount(o.tuning);
        const { events, annotations } = unroll(o.events, (o.annotations ?? []) as AnnotationRow[]);
        if (events.length < 3 || events.length > 60) continue;
        // One of each op: change the first note, add one, remove the last column.
        const note = events.findIndex((e) => e.kind === "notes");
        if (note < 0) continue;
        const variant = events.map((e, i) => (i === note ? { ...e, durationHint: "q" as const } : e)).slice(0, -1);
        variant.splice(1, 0, { ...events[note], id: "extra", frets: { "0": 22 }, tupletId: null, tupletCount: null });
        const base = compare(events, annotations, variant, annotations, strings);
        const strip = (ops: readonly Op[]) =>
          JSON.stringify(ops.map((op) => ("before" in op ? { ...op, before: op.before === null ? null : "k" } : "key" in op ? { ...op, key: "k", eventId: "k" } : op)));
        const all = regenerate(variant, annotations);
        const eventsOnly = variant.map((e) => ({ ...e, id: `new-${e.id}` }));
        const ids = new Set(variant.map((e) => e.id));
        const anchored = annotations.map((a) => ({ ...a, anchorEventId: ids.has(a.anchorEventId ?? "") ? `new-${a.anchorEventId}` : a.anchorEventId }));
        const groupsOnly = regenerate(variant, annotations).events.map((e, i) => ({ ...e, id: variant[i].id }));
        const notesOnly = annotations.map((a, i) => ({ ...a, id: `other-${i}` }));
        const runs: [string, EventRow[], AnnotationRow[]][] = [
          ["all", all.events, all.annotations],
          ["events", eventsOnly, anchored],
          ["groups", groupsOnly, annotations],
          ["annotations", variant, notesOnly],
        ];
        for (const [name, e, a] of runs) {
          if (strip(compare(events, annotations, e, a, strings).ops) !== strip(base.ops)) wrong.push(`${name}: ${show(events)}`);
        }
      }
      expect(wrong.slice(0, 10)).toEqual([]);
    });
  });
});

describe("review probe INV-020-not-compared.test.ts", { timeout: 300_000 }, () => {
  const tuning = TUNING_PRESETS[0];
  const strings = tuning.strings.length;

  let serial = 0;
  const col = (over: Partial<EventRow> = {}) =>
    ({
      id: `c${++serial}`, rank: `a${serial}`, kind: "notes", frets: { "0": 5 }, techniques: {}, repeat: 1, durationHint: null,
      tupletId: null, tupletCount: null, groupKind: null, ...over,
    }) as unknown as EventRow;
  const ann = (anchor: string, over: Partial<AnnotationRow> = {}) =>
    ({ id: `n${++serial}`, anchorEventId: anchor, kind: "chord", value: "Am", ...over }) as unknown as AnnotationRow;

  const P = { id: "p", label: "A", name: "Riff", notes: "one" } as unknown as PartRow;
  const V = { id: "v", label: "B", name: "Other", notes: "two" } as unknown as PartRow;

  function same(a: EventRow[], b: EventRow[], an: AnnotationRow[] = [], bn: AnnotationRow[] = []) {
    const comparison = compareParts({ part: P, events: a, annotations: an }, { part: V, events: b, annotations: bn }, strings);
    expect(comparison.ops.filter((op) => op.kind !== "same")).toEqual([]);
    expect(staffMarks(comparison, { events: b, fromBar: null, toBar: null, density: "expanded" }).line).toBe("Same as A");
  }

  describe("INV-020 what must not count", () => {
    it("every event id, and event rank values", () => same([col(), col()], [col(), col()]));
    it("part name, part notes and part label", () => same([col()], [col()]));
    it("every group id", () => {
      const group = (id: string) => ({ tupletId: id, tupletCount: 3, groupKind: "tuplet" }) as Partial<EventRow>;
      same([col(group("g1")), col(group("g1")), col(group("g1"))], [col(group("g2")), col(group("g2")), col(group("g2"))]);
    });
    it("every annotation id", () => {
      const a = col();
      const b = col();
      same([a], [b], [ann(a.id)], [ann(b.id)]);
    });
    it("annotation row order, one chord on each of two columns", () => {
      const [a1, a2, b1, b2] = [col(), col(), col(), col()];
      same([a1, a2], [b1, b2], [ann(a1.id, { value: "Am" }), ann(a2.id, { value: "C" })], [ann(b2.id, { value: "C" }), ann(b1.id, { value: "Am" })]);
    });
    it("a text annotation", () => {
      const a = col();
      const b = col();
      same([a], [b], [], [ann(b.id, { kind: "text", value: "slowly" } as Partial<AnnotationRow>)]);
    });
    it("a dynamic annotation", () => {
      const a = col();
      const b = col();
      same([a], [b], [], [ann(b.id, { kind: "dynamic", value: "ff" } as Partial<AnnotationRow>)]);
    });
    it("technique order", () =>
      same([col({ techniques: { "0": ["vibrato", "bend"] } } as Partial<EventRow>)], [col({ techniques: { "0": ["bend", "vibrato"] } } as Partial<EventRow>)]));
    it("a duplicate technique", () =>
      same([col({ techniques: { "0": ["bend"] } } as Partial<EventRow>)], [col({ techniques: { "0": ["bend", "bend"] } } as Partial<EventRow>)]));
    it("an empty technique list", () => same([col()], [col({ techniques: { "0": [] } } as Partial<EventRow>)]));
    it("a technique on an unplayed string", () => same([col()], [col({ techniques: { "1": ["bend"] } } as Partial<EventRow>)]));
    it("a fret on a string the tuning lacks", () =>
      same([col()], [col({ frets: { "0": 5, [String(strings + 3)]: 9 } } as Partial<EventRow>)]));
    it("chord with surrounding spaces", () => {
      const a = col();
      const b = col();
      same([a], [b], [ann(a.id, { value: "Am" })], [ann(b.id, { value: "  Am " })]);
    });
    it("7x8 against 7x4 7x4", () => same([col({ repeat: 8 })], [col({ repeat: 4 }), col({ repeat: 4 })]));
    it("legacy null kind and null count against a modern 3", () => {
      const legacy = { tupletId: "g", tupletCount: null, groupKind: null } as Partial<EventRow>;
      const modern = { tupletId: "h", tupletCount: 3, groupKind: "tuplet" } as Partial<EventRow>;
      same([col(legacy), col(legacy), col(legacy)], [col(modern), col(modern), col(modern)]);
    });
  });
});

describe("review probe INV-021-022-023-025-026-compare.test.ts", { timeout: 300_000 }, () => {
  const tuning = TUNING_PRESETS[0];
  const strings = tuning.strings.length;
  let serial = 0;
  const col = (fret: number, over: Partial<EventRow> = {}) =>
    ({ id: `c${++serial}`, kind: "notes", frets: { "0": fret }, techniques: {}, repeat: 1, durationHint: null, tupletId: null, tupletCount: null, groupKind: null, ...over }) as unknown as EventRow;
  const bar = () => col(0, { kind: "barline", frets: {} } as Partial<EventRow>);
  const grouped = (group: string, ...frets: number[]) => frets.map((f) => col(f, { tupletId: group, tupletCount: 3, groupKind: "tuplet" }));
  const P = { id: "p", label: "A" } as PartRow;
  const V = { id: "v", label: "B" } as PartRow;
  const compare = (a: readonly EventRow[], b: readonly EventRow[], an: readonly AnnotationRow[] = [], bn: readonly AnnotationRow[] = []) =>
    compareParts({ part: P, events: a, annotations: an }, { part: V, events: b, annotations: bn }, strings);
  const lineOf = (a: readonly EventRow[], b: readonly EventRow[]) =>
    staffMarks(compare(a, b), { events: b, fromBar: null, toBar: null, density: "expanded" }).line;
  const counts = (ops: readonly Op[]) => ({
    changed: ops.filter((o) => o.kind === "changed").length,
    added: ops.filter((o) => o.kind === "added").length,
    removed: ops.filter((o) => o.kind === "removed").length,
  });
  
  describe("INV-021 an edit beside an equal column reports itself", () => {
    const triplets = () => [...grouped("g1", 7, 7, 7), ...grouped("g2", 7, 7, 7)];
  
    it("removing one note of a run of triplets of one note", () => {
      const parent = triplets();
      const variant = parent.filter((_, i) => i !== 2);
      expect(lineOf(parent, variant)).toBe("Differs from A in bar 1: 1 removed");
    });
    it("removing the first note of the second triplet", () => {
      const parent = triplets();
      const variant = parent.filter((_, i) => i !== 3);
      expect(lineOf(parent, variant)).toBe("Differs from A in bar 1: 1 removed");
    });
    it("adding a note to the first triplet", () => {
      const parent = triplets();
      const variant = [...parent.slice(0, 3), col(7, { tupletId: "g1", tupletCount: 3, groupKind: "tuplet" }), ...parent.slice(3)];
      expect(lineOf(parent, variant)).toBe("Differs from A in bar 1: 1 added");
    });
    it("adding a note between the two triplets", () => {
      const parent = triplets();
      const variant = [...parent.slice(0, 3), col(7), ...parent.slice(3)];
      expect(lineOf(parent, variant)).toBe("Differs from A in bar 1: 1 added");
    });
    it("removing a note of a two-note figure across two groups", () => {
      const parent = [...grouped("a", 5, 7), ...grouped("b", 5, 7), ...grouped("c", 5, 7)];
      const variant = [...parent.slice(0, 2), ...parent.slice(3)];
      expect(lineOf(parent, variant)).toBe("Differs from A in bar 1: 1 removed");
    });
    it("removing a whole triplet leaves the other unmarked", () => {
      const parent = triplets();
      expect(lineOf(parent, parent.slice(3))).toBe("Differs from A in bar 1: 3 removed");
    });
  });
  
  /** The page's own numbers against a table: the op list, not a re-derivation of it. */
  const seeded = (seed: number) => {
    let s = seed >>> 0;
    return () => {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      return s / 2 ** 32;
    };
  };
  const BAR = -1;
  function table(a: number[], b: number[]) {
    const D = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
    for (let i = 0; i <= a.length; i += 1) D[i][0] = i;
    for (let j = 0; j <= b.length; j += 1) D[0][j] = j;
    for (let i = 1; i <= a.length; i += 1) {
      for (let j = 1; j <= b.length; j += 1) {
        const sub = a[i - 1] === b[j - 1] ? 0 : (a[i - 1] === BAR) !== (b[j - 1] === BAR) ? Infinity : 1;
        D[i][j] = Math.min(D[i - 1][j] + 1, D[i][j - 1] + 1, D[i - 1][j - 1] + sub);
      }
    }
    return D[a.length][b.length];
  }
  const rows = (list: number[]) => list.map((n) => (n === BAR ? bar() : col(n)));
  
  describe("INV-022 never above the true minimum, through the op list", () => {
    it.each([
      ["the plan's set: up to 12 columns", 5000, 12, 0.2],
      ["longer", 3000, 40, 0.2],
      ["mostly barlines", 3000, 24, 0.6],
      ["barlines only beside notes of one alphabet", 3000, 30, 0.45],
    ])("%s", (_name, pairs, length, barlines) => {
      const next = seeded(11 + length);
      for (let n = 0; n < pairs; n += 1) {
        const alphabet = 2 + Math.floor(next() * 5);
        const make = () => Array.from({ length: Math.floor(next() * (length + 1)) }, () => (next() < barlines ? BAR : 1 + Math.floor(next() * alphabet)));
        const a = make();
        const b = make();
        const { ops, coarse } = compare(rows(a), rows(b));
        const got = ops.filter((o) => o.kind !== "same").length;
        expect(coarse).toBe(false);
        if (got !== table(a, b)) throw new Error(`${a} / ${b}: ${got}, table says ${table(a, b)}`);
        // INV-023 on the same pairs: order, and a barline never in a change.
        let lastFrom = -1;
        let lastTo = -1;
        for (const op of ops) {
          if ("from" in op) {
            expect(op.from).toBeGreaterThan(lastFrom);
            lastFrom = op.from;
          }
          if ("to" in op) {
            expect(op.to).toBeGreaterThan(lastTo);
            lastTo = op.to;
          }
          if (op.kind === "changed") expect(a[op.from] === BAR || b[op.to] === BAR).toBe(false);
        }
      }
    });
    it("a b c d e against e f g h i", () => {
      expect(counts(compare(rows([1, 2, 3, 4, 5]), rows([5, 6, 7, 8, 9])).ops)).toEqual({ changed: 5, added: 0, removed: 0 });
    });
  });
  
  describe("INV-023 the same two parts, the same result", () => {
    const stripped = (ops: readonly Op[]) => JSON.stringify(ops.map((o) => ({ kind: o.kind, from: "from" in o ? o.from : null, to: "to" in o ? o.to : null })));
  
    it("a barline at each position on each side, and the worked example", () => {
      const base = [5, 7, 8, 5, 7, 8];
      for (let i = 0; i <= base.length; i += 1) {
        const withBar = [...base.slice(0, i), BAR, ...base.slice(i)];
        expect(counts(compare(rows(base), rows(withBar)).ops)).toEqual({ changed: 0, added: 1, removed: 0 });
        expect(counts(compare(rows(withBar), rows(base)).ops)).toEqual({ changed: 0, added: 0, removed: 1 });
      }
      const worked = compare(rows([5, 7, 8, BAR, 5, 7, 8]), rows([5, 7, 8, BAR, 5, 7, 9, 10])).ops.filter((o) => o.kind !== "same");
      expect(worked.map((o) => o.kind)).toEqual(["changed", "added"]);
    });
  
    it("a riff with one column inserted at every equally valid position", () => {
      const riff = [1, 2, 3, 1, 2, 3, 1, 2, 3];
      for (let at = 0; at <= riff.length; at += 1) {
        for (const inserted of [1, 2, 3]) {
          const variant = [...riff.slice(0, at), inserted, ...riff.slice(at)];
          const first = compare(rows(riff), rows(variant));
          expect(first.ops.filter((o) => o.kind !== "same").length).toBe(1);
          expect(stripped(compare(rows(riff), rows(variant)).ops)).toBe(stripped(first.ops));
        }
      }
    });
  
    it("object key order and annotation row order do not move a result", () => {
      const events = [col(5, { frets: { "0": 5, "1": 7 }, techniques: { "0": ["bend", "palm_mute"] } as never }), col(7)];
      const shuffled = [col(5, { frets: { "1": 7, "0": 5 }, techniques: { "0": ["palm_mute", "bend"] } as never }), col(7)];
      const notes = (list: readonly EventRow[]) => [
        { id: "1", kind: "chord", anchorEventId: list[0].id, value: "Am" },
        { id: "2", kind: "chord", anchorEventId: list[1].id, value: "F" },
      ] as AnnotationRow[];
      const a = compare(events, shuffled, notes(events), notes(shuffled).reverse());
      expect(counts(a.ops)).toEqual({ changed: 0, added: 0, removed: 0 });
    });
  });
  
  const best = (run: () => void, times = 5) => {
    let fastest = Infinity;
    for (let i = 0; i < times; i += 1) {
      const start = performance.now();
      run();
      fastest = Math.min(fastest, performance.now() - start);
    }
    return fastest;
  };
  const song = (partsOf: Record<string, EventRow[]>, parentId = "p") => {
    const parts = Object.keys(partsOf).map((id) => ({ id, label: id, variantOfPartId: id === parentId ? null : parentId }) as PartRow);
    return { parts, eventsByPart: partsOf, annotationsByPart: {} } as unknown as Parameters<typeof compareVariants>[0];
  };
  
  describe("INV-025 every member of the budget set", () => {
    const report: Record<string, number> = {};
    const longRiff = (n: number, f: (i: number) => number) => Array.from({ length: n }, (_, i) => col(f(i)));
  
    it("SC-009: 20 variants of 1,000, ten differences each, in 20 ms", () => {
      const base = Array.from({ length: 1000 }, (_, i) => (i * 7) % 23);
      const partsOf: Record<string, EventRow[]> = { p: base.map((f) => col(f)) };
      for (let v = 0; v < 20; v += 1) partsOf[`v${v}`] = base.map((f, i) => col(i % 100 === v ? f + 1 : f));
      report["SC-009"] = best(() => compareVariants(song(partsOf), tuning), 15);
      expect(report["SC-009"]).toBeLessThan(20);
    });
    it("SC-010: two unrelated parts of 5,000 in 50 ms, every column accounted for", () => {
      const a = longRiff(5000, (i) => i % 31);
      const b = longRiff(5000, (i) => 40 + ((i * 3 + 1) % 29));
      report["SC-010"] = best(() => compare(a, b));
      const result = compare(a, b);
      expect(result.coarse).toBe(true);
      expect(result.ops.length).toBe(5000);
      expect(report["SC-010"]).toBeLessThan(50);
    });
    it("two periodic riffs of 5,000", () => {
      const a = longRiff(5000, (i) => [1, 2, 3, 4][i % 4]);
      const b = longRiff(5000, (i) => [1, 3, 2, 5, 4][i % 5]);
      report.periodic = best(() => compare(a, b));
      expect(report.periodic).toBeLessThan(50);
    });
    it("two parts sharing an alphabet", () => {
      const next = seeded(3);
      const a = longRiff(5000, () => Math.floor(next() * 3));
      const b = longRiff(5000, () => Math.floor(next() * 3));
      report.shared = best(() => compare(a, b));
      expect(report.shared).toBeLessThan(50);
    });
    // No figure in the spec or contract covers this shape, so this only proves it is bounded. research R-budget
    // predicted about 50 ms; 200 to 292 ms was measured, which is a follow-up rather than a violated invariant.
    it("20 unrelated variants of 1,000 stay bounded", () => {
      const partsOf: Record<string, EventRow[]> = { p: longRiff(1000, (i) => i % 31) };
      for (let v = 0; v < 20; v += 1) partsOf[`v${v}`] = longRiff(1000, (i) => 40 + ((i * (v + 2)) % 29));
      report.unrelated20 = best(() => compareVariants(song(partsOf), tuning));
      expect(report.unrelated20).toBeLessThan(1000);
    });
    it("where the 20 unrelated variants' time goes: one alignment, alone", () => {
      const a = Int32Array.from({ length: 1000 }, (_, i) => i % 31);
      const b = Int32Array.from({ length: 1000 }, (_, i) => 40 + ((i * 2) % 29));
      report.oneAlignment1000 = best(() => alignColumns(a, b, () => false), 9);
      expect(report.oneAlignment1000).toBeGreaterThan(0);
    });
    it("a x512 repeat in each of 200 events", () => {
      const a = Array.from({ length: 200 }, (_, i) => col(i % 24, { repeat: 512 }));
      const b = Array.from({ length: 200 }, (_, i) => col((i + 1) % 24, { repeat: 512 }));
      report.x512 = best(() => compare(a, b), 3);
      const result = compare(a, b);
      expect(result.ops.filter((o) => "from" in o).length).toBe(102400);
      expect(report.x512).toBeLessThan(1000);
    });
    it("exactly MAX_EDITS, and one past it, still accounts for every column", () => {
      const isBar = () => false;
      const at = alignColumns(Int32Array.from({ length: MAX_EDITS }, () => 1), Int32Array.from({ length: MAX_EDITS }, () => 2), isBar);
      const past = alignColumns(Int32Array.from({ length: MAX_EDITS + 1 }, () => 1), Int32Array.from({ length: MAX_EDITS + 1 }, () => 2), isBar);
      expect([at.coarse, past.coarse]).toEqual([false, true]);
      const a = longRiff(MAX_EDITS + 1, () => 1);
      const b = longRiff(MAX_EDITS + 1, () => 2);
      const { ops, coarse } = compare(a, b);
      expect(coarse).toBe(true);
      expect(ops.map((o) => ("from" in o ? o.from : -1))).toEqual(a.map((_, i) => i));
    });
    it("reports what it measured", () => {
      writeFileSync(
        path.join(tmpdir(), "spec006-inv025.json"),
        JSON.stringify(Object.fromEntries(Object.entries(report).map(([k, v]) => [k, Number(v.toFixed(2))]))),
      );
      expect(Object.keys(report).length).toBeGreaterThan(5);
    });
  });
  
  describe("INV-026 Par through real rows", () => {
    it("is keyed by exactly the parts with another live part of this song as a parent", async () => {
      const db = new StablatureDb(`probe-${newId()}`);
      await db.open();
      let now = 1_000_000;
      const clock = new HlcClock("probe", () => (now += 1));
      const ctx = { db, clock };
      const band = await createBand("Hollow Crown", ctx);
      const row = await createTuningFromPreset(band.id, presetById("bass5-b")!, true, ctx);
      const song1 = await createSong(band.id, "One", row.id, ctx);
      const song2 = await createSong(band.id, "Two", row.id, ctx);
      const A = await createPart(song1, ctx);
      await appendNote(A, 3, 5, ctx);
      const plain = await createPart(song1, ctx);
      const B = await createVariant(A, ctx);
      const C = await createVariant(B, ctx);
      const ofDeleted = await createVariant(A, ctx);
      const deleted = await createPart(song1, ctx);
      const other = await createPart(song2, ctx);
      const elsewhere = await createVariant(A, ctx);
      const self = await createVariant(A, ctx);
      const noRow = await createVariant(A, ctx);
      const set = (id: string, variantOfPartId: string) => patchRow("parts", id, { variantOfPartId }, ctx);
      await set(ofDeleted.id, deleted.id);
      await set(elsewhere.id, other.id);
      await set(self.id, self.id);
      await set(noRow.id, "no-such-part");
      await deleteRow("parts", deleted.id, ctx);
  
      const compared = compareVariants(await listSongContent(song1.id, db), row);
      expect(new Set(compared.keys())).toEqual(new Set([B.id, C.id]));
      expect(compared.has(plain.id)).toBe(false);
      expect(compared.get(B.id)!.parent.id).toBe(A.id);
      // A chain compares with its own parent and nothing further up.
      expect(compared.get(C.id)!.parent.id).toBe(B.id);
    });
  });
});

// --- round 2: settleEdits, on grouped columns (the 5,000 ungrouped pairs above cannot reach it) ---
describe("settleEdits (the slide)", () => {
  // `settleEdits` moves matched pairs after the alignment. The 5,000 pairs of INV-022 and INV-023 carry no groups, so every `joined` is false, no position beats another, and the slide
  // never moves a thing. These run it, on grouped columns, and check what it must not break.
  //
  //  - INV-021: every group shape of a run of equal columns × every position × {remove, add}: exactly the one edit.
  //  - INV-022, 023, 024 on random grouped pairs, several edits each: every `same` pair really is equal, the ops cover
  //    both parts in order, the edits are the plain table's minimum, and a second run gives the same ops.
  //
  const strings = TUNING_PRESETS[0].strings.length;
  let serial = 0;
  const col = (fret: number, group: string | null, over: Partial<EventRow> = {}) =>
    ({
      id: `s${++serial}`,
      kind: "notes",
      frets: { "0": fret },
      techniques: {},
      repeat: 1,
      durationHint: null,
      tupletId: group,
      tupletCount: group ? 3 : null,
      groupKind: group ? "tuplet" : null,
      ...over,
    }) as unknown as EventRow;
  const bar = () => col(0, null, { kind: "barline", frets: {} } as Partial<EventRow>);
  const P = { id: "p", label: "A" } as PartRow;
  const V = { id: "v", label: "B" } as PartRow;
  const compare = (a: readonly EventRow[], b: readonly EventRow[]) =>
    compareParts({ part: P, events: a, annotations: [] }, { part: V, events: b, annotations: [] }, strings);
  const tally = (ops: readonly Op[]) => ({
    changed: ops.filter((o) => o.kind === "changed").length,
    added: ops.filter((o) => o.kind === "added").length,
    removed: ops.filter((o) => o.kind === "removed").length,
  });

  /** Every way of cutting `n` equal columns into plain columns and groups. */
  function shapes(n: number): (number | null)[][] {
    const out: (number | null)[][] = [];
    const go = (row: (number | null)[], next: number) => {
      if (row.length === n) {
        out.push(row);
        return;
      }
      go([...row, null], next);
      go([...row, next], next + 1);
      const last = row[row.length - 1];
      if (last !== null && last !== undefined) go([...row, last], next);
    };
    go([], 1);
    return out;
  }

  describe("INV-021 every group shape of a run of equal columns", () => {
    for (const n of [2, 3, 4, 5, 6, 7]) {
      it(`${n} columns: remove and add at every position`, () => {
        const bad: string[] = [];
        for (const shape of shapes(n)) {
          const parent = shape.map((g) => col(7, g === null ? null : `g${g}`));
          for (let at = 0; at < n; at += 1) {
            const removed = tally(compare(parent, parent.filter((_, i) => i !== at)).ops);
            if (removed.removed !== 1 || removed.changed + removed.added !== 0) {
              bad.push(`remove ${at} of ${JSON.stringify(shape)}: ${JSON.stringify(removed)}`);
            }
          }
          for (let at = 0; at <= n; at += 1) {
            // Added plain, or into the group on its left, or the group on its right.
            const homes = new Set([null, shape[at - 1] ?? null, shape[at] ?? null]);
            for (const home of homes) {
              const variant = [...parent.slice(0, at), col(7, home === null ? null : `g${home}`), ...parent.slice(at)];
              const added = tally(compare(parent, variant).ops);
              if (added.added !== 1 || added.changed + added.removed !== 0) {
                bad.push(`add ${home} at ${at} of ${JSON.stringify(shape)}: ${JSON.stringify(added)}`);
              }
            }
          }
        }
        expect(bad.slice(0, 12)).toEqual([]);
      });
    }
  });

  function rng(seed: number) {
    let s = seed >>> 0;
    return () => {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      return s / 2 ** 32;
    };
  }

  function randomPart(r: () => number, length: number, alphabet: number) {
    const out: EventRow[] = [];
    let group: string | null = null;
    for (let i = 0; i < length; i += 1) {
      if (r() < 0.1) {
        group = null;
        out.push(bar());
        continue;
      }
      const roll = r();
      if (roll < 0.25) group = `r${++serial}`;
      else if (roll < 0.45) group = null;
      out.push(col(1 + Math.floor(r() * alphabet), group));
    }
    return out;
  }

  /** A second part a few edits from the first. */
  function mutate(r: () => number, from: readonly EventRow[], alphabet: number) {
    const out = from.map((e) => ({ ...e, id: `s${++serial}` }) as EventRow);
    const edits = 1 + Math.floor(r() * 5);
    for (let e = 0; e < edits; e += 1) {
      const at = Math.floor(r() * (out.length + 1));
      const roll = r();
      if (roll < 0.45 && out.length > 0) out.splice(Math.min(at, out.length - 1), 1);
      else if (roll < 0.9) out.splice(at, 0, col(1 + Math.floor(r() * alphabet), out[at - 1]?.tupletId ?? null));
      else if (out.length > 0) {
        const i = Math.min(at, out.length - 1);
        if (out[i].kind !== "barline") out[i] = { ...out[i], tupletId: r() < 0.5 ? null : `r${++serial}` } as EventRow;
      }
    }
    return out;
  }

  const minimumEdits = (a: readonly number[], b: readonly number[], isBar: (x: number) => boolean) => {
    const row = Array.from({ length: b.length + 1 }, (_, j) => j);
    for (let i = 1; i <= a.length; i += 1) {
      let diagonal = row[0];
      row[0] = i;
      for (let j = 1; j <= b.length; j += 1) {
        const held = row[j];
        const sub = a[i - 1] === b[j - 1] ? 0 : isBar(a[i - 1]) !== isBar(b[j - 1]) ? 1e9 : 1;
        row[j] = Math.min(row[j] + 1, row[j - 1] + 1, diagonal + sub);
        diagonal = held;
      }
    }
    return row[b.length];
  };

  describe("the slide keeps what the alignment promised, on grouped columns", () => {
    it("20,000 grouped pairs", { timeout: 120_000 }, () => {
      const r = rng(20261105);
      let continuations = 0;
      for (let round = 0; round < 20_000; round += 1) {
        const alphabet = 1 + Math.floor(r() * 3);
        const a = randomPart(r, 2 + Math.floor(r() * 14), alphabet);
        const b = mutate(r, a, alphabet);
        const { ops } = compare(a, b);
        const table = new Map<string, number>();
        const intern = (s: string) => {
          if (!table.has(s)) table.set(s, table.size);
          return table.get(s)!;
        };
        const pa = playedColumns(a, [], strings, intern);
        const pb = playedColumns(b, [], strings, intern);
        const barId = table.get("barline");
        const ctx = () =>
          JSON.stringify({ a: pa.map((c) => [c.content, c.joined]), b: pb.map((c) => [c.content, c.joined]), ops });

        // INV-024: each column of both parts once, in order.
        let from = 0;
        let to = 0;
        for (const op of ops) {
          if (op.kind !== "added") {
            if (op.from !== from) throw new Error(`parent order: ${ctx()}`);
            from += 1;
          }
          if (op.kind !== "removed") {
            if (op.to !== to) throw new Error(`variant order: ${ctx()}`);
            to += 1;
          }
          // A same pair is equal, and a barline only ever sits with a barline.
          if (op.kind === "same" && pa[op.from].content !== pb[op.to].content) throw new Error(`same but unequal: ${ctx()}`);
          if (op.kind === "changed" && (pa[op.from].content === barId) !== (pb[op.to].content === barId)) {
            throw new Error(`barline paired: ${ctx()}`);
          }
        }
        if (from !== pa.length || to !== pb.length) throw new Error(`lost a column: ${ctx()}`);

        // INV-022: content changes, added and removed are the true minimum. A changed op between equal columns comes
        // from the continuation pass, on top of the alignment, so it is not counted here.
        const edits = ops.filter(
          (o) =>
            o.kind === "added" ||
            o.kind === "removed" ||
            (o.kind === "changed" && pa[o.from].content !== pb[o.to].content),
        ).length;
        const minimum = minimumEdits(
          pa.map((c) => c.content),
          pb.map((c) => c.content),
          (x) => x === barId,
        );
        if (edits !== minimum) throw new Error(`edits ${edits} against minimum ${minimum}: ${ctx()}`);
        if (ops.some((o) => o.kind === "changed" && o.words === "group changed")) continuations += 1;

        // INV-023: the same two parts, the same answer.
        if (JSON.stringify(compare(a, b).ops) !== JSON.stringify(ops)) throw new Error(`second run differs: ${ctx()}`);
      }
      // The sweep must reach the code it is here for.
      expect(continuations).toBeGreaterThan(100);
    });
  });
});

// T073: pack's fast path may never number two columns alike that the signature tells apart.
{
let serial = 0;
const col = (over: Partial<EventRow> = {}) =>
  ({
    id: `c${++serial}`, kind: "notes", frets: {}, techniques: {}, repeat: 1, durationHint: null,
    tupletId: null, tupletCount: null, groupKind: null, ...over,
  }) as unknown as EventRow;
const P = { id: "p", label: "A" } as unknown as PartRow;
const V = { id: "v", label: "B" } as unknown as PartRow;
const reportsSame = (a: EventRow, b: EventRow, strings: number) =>
  compareParts({ part: P, events: [a], annotations: [] }, { part: V, events: [b], annotations: [] }, strings).ops.every(
    (op) => op.kind === "same",
  );
const FRETS: (number | "x" | undefined)[] = [undefined, 7, 36, "x"];
const TECHNIQUES: (string[] | undefined)[] = [undefined, [], ["bend"], ["bend", "bend"], ["bend", "vibrato"], ["vibrato", "bend"]];
function validColumns(): EventRow[] {
  const out: EventRow[] = [];
  for (const kind of ["notes", "rest"] as const) {
    for (const durationHint of [null, "8", "q"] as const) {
      for (const tupletId of [null, "g"]) {
        for (const first of FRETS) {
          for (const second of FRETS) {
            for (const technique of TECHNIQUES) {
              const frets: Record<string, number | "x"> = {};
              if (first !== undefined) frets["0"] = first;
              if (second !== undefined) frets["1"] = second;
              out.push(
                col({
                  kind,
                  durationHint,
                  tupletId,
                  tupletCount: tupletId ? 3 : null,
                  frets,
                  techniques: technique ? { "0": technique } as EventRow["techniques"] : {},
                }),
              );
            }
          }
        }
      }
    }
  }
  return out;
}
/** One of each class under the old signature is enough for a pair sweep: more would only repeat it. */
function byOldSignature(columns: EventRow[], strings: number): EventRow[] {
  const seen = new Map<string, EventRow>();
  for (const column of columns) {
    const signature = signatureOf(column, strings, "");
    if (!seen.has(signature)) seen.set(signature, column);
  }
  return [...seen.values()];
}

describe("T073 pairs: Same exactly when the signature before T073 was equal", () => {
  for (const strings of [6, 9]) {
    it(`every valid column against every other, ${strings} strings`, () => {
      const columns = validColumns();
      // Every column against each class: a class holds columns of both paths, so this crosses them.
      const classes = byOldSignature(columns, strings);
      let pairs = 0;
      const wrong: string[] = [];
      for (const a of columns) {
        const sa = signatureOf(a, strings, "");
        for (const b of classes) {
          pairs += 1;
          const want = sa === signatureOf(b, strings, "");
          if (reportsSame(a, b, strings) !== want && wrong.length < 5) wrong.push(`${JSON.stringify(a)} / ${JSON.stringify(b)}`);
        }
      }
      expect(wrong).toEqual([]);
      expect(pairs).toBeGreaterThan(1_000);
    }, 120_000);
  }
});
describe("T073 words: a column keeps its own repetition", () => {
  it("a repeated column names its chord on the first pass only", () => {
    const a = col({ frets: { "0": 5 }, repeat: 2 });
    const b = col({ frets: { "0": 7 }, repeat: 2 });
    const chord = (anchor: EventRow, value: string) =>
      [{ id: `n${++serial}`, anchorEventId: anchor.id, kind: "chord", value }] as unknown as AnnotationRow[];
    const { ops } = compareParts(
      { part: P, events: [a], annotations: chord(a, "Am") },
      { part: V, events: [b], annotations: chord(b, "G") },
      6,
    );
    expect(ops.map((op) => (op.kind === "changed" ? op.words : op.kind))).toEqual([
      "fret 5 to fret 7 on string 1, chord Am to G",
      "fret 5 to fret 7 on string 1",
    ]);
  });
});

describe("T073 twins: no two frets share a number", () => {
  it("every fret 0 to 70 and x on each of eight strings, against every other on that string", () => {
    const values: (number | "x")[] = [...Array.from({ length: 71 }, (_, i) => i), "x"];
    for (let s = 0; s < 8; s += 1) {
      for (const a of values) {
        for (const b of values) {
          const same = reportsSame(col({ frets: { [String(s)]: a } }), col({ frets: { [String(s)]: b } }), 8);
          if (same !== (a === b)) throw new Error(`string ${s}: ${a} against ${b} read ${same ? "Same" : "changed"}`);
        }
      }
    }
  }, 120_000);

  // Past eight strings the number would need more than 53 bits, so the low strings would round away.
  it("one fret apart on any string, with every other string held high, from 1 to 12 strings", () => {
    for (let strings = 1; strings <= 12; strings += 1) {
      const full: Record<string, number | "x"> = {};
      for (let s = 0; s < strings; s += 1) full[String(s)] = 36;
      for (let s = 0; s < strings; s += 1) {
        for (const kind of ["notes", "rest"] as const) {
          const a = col({ kind, frets: { ...full } });
          const b = col({ kind, frets: { ...full, [String(s)]: 35 } });
          if (reportsSame(a, b, strings)) throw new Error(`${strings} strings, string ${s}, ${kind}: read Same`);
        }
      }
    }
  });

  it("a note on the top string never meets a rest or a note on the next", () => {
    expect(reportsSame(col({ kind: "rest" }), col({ frets: {} }), 8)).toBe(false);
    expect(reportsSame(col({ frets: { "0": 0 } }), col({ frets: { "1": 0 } }), 8)).toBe(false);
    expect(reportsSame(col({ kind: "rest", frets: { "7": 64 } }), col({ frets: { "6": 1 } }), 8)).toBe(false);
  });
});
}
