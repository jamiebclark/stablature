/**
 * Everything the plan enumerates over **H**, the harvest of every `layoutPart` fixture.
 *
 * INV-001: the "frets with no marks" markup that frets-unchanged.test.ts names in its header but never draws.
 * INV-012: the staff's chord against the walk `chordInForceAt` did on main, kept here verbatim, because the
 *          suite's check compares `chordInForceAt` with the map it is now a lookup in, which cannot fail.
 * INV-019 to 021, 024: H x every position x {insert, remove, alter by each of F}, ids regenerated.
 */
import "fake-indexeddb/auto";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { parseChord } from "@/lib/chords";
import type { AnnotationRow, EventRow, PartRow } from "@/lib/model";
import { compareParts, type Op } from "@/lib/reading/compare";
import { layoutReading } from "@/lib/reading/labels";
import { playedColumns } from "@/lib/reading/played";
import type { LayoutOptions } from "@/lib/tab/layout";
import { stringCount } from "@/lib/tunings";

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
