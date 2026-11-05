/**
 * INV-003 Same events, INV-004 Same text, INV-005 nothing passes unnoticed, INV-021 preview = write,
 * and INV-001 over H: every recorded fixture x both densities, plus a second, harsher generator.
 *
 * Adopted from review round 1 (F13). Separate from round-trip.test.ts on purpose. This one has no early returns:
 * every difference is classified by a rule that checks the claim it makes, per contracts/round-trip.md.
 */
import "fake-indexeddb/auto";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { draftPart } from "@/lib/local/clipboard";
import { importTab } from "@/lib/local/importing";
import { listAnnotations, listEvents } from "@/lib/local/queries";
import type { AnnotationRow, EventRow } from "@/lib/model";
import { pushRequestSchema } from "@/lib/sync/protocol";
import type { LayoutOptions } from "@/lib/tab/layout";
import { parseTab } from "@/lib/tab/parse";
import { readTab } from "@/lib/tab/reading";
import { presetById, type Tuning } from "@/lib/tunings";
import { contextOf, customTuning, world, type World } from "./unit-helpers";

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

import "./ascii.test";
import "./grouping.test";
import "./techniques.test";
import "./techniques-repeat.test";
import "./techniques-plain.test";
import "./techniques-layout-invariants.test";
import "@/lib/export/__tests__/text.test";

type Actual = typeof import("@/lib/tab/layout");
type Ascii = typeof import("@/lib/tab/ascii");
type Density = "expanded" | "compact";

let actual: Actual;
let ascii: Ascii;
let harvest: LayoutOptions[] = [];

/** The columns as drawn, one entry per drawn column, with group ids as a partition. */
function drawn(options: LayoutOptions, density: Density) {
  const layout = actual.layoutPart({ ...options, density });
  const bracketsOn = (options as { showTuplets?: boolean }).showTuplets !== false;
  const spans = bracketsOn ? actual.tupletSpans(layout) : [];
  const spanOf = (index: number) => spans.findIndex((s) => s.start <= index && index <= s.end);
  return layout.columns.map((c, index) => {
    const empty = c.cells.every((cell) => cell === null);
    const span = spanOf(index);
    return {
      kind: c.kind === "notes" && empty ? "rest" : c.kind,
      cells: c.cells,
      connectors: c.connectors,
      group: span,
      bracket: span < 0 ? null : c.bracketNumber,
    };
  });
}

const CLASSES = new Map<string, number>();
const hit = (name: string) => CLASSES.set(name, (CLASSES.get(name) ?? 0) + 1);

interface Outcome {
  problem: string | null;
}

/** The whole contract for one text. Returns a problem, or null with its class counted. */
function judge(options: LayoutOptions, density: Density): Outcome {
  const text = ascii.toAscii({ ...options, density });
  const source = drawn(options, density);
  const parsed = parseTab(text);
  const noNotes = !source.some((c) => c.kind !== "barline" && c.cells.some((x) => x !== null));

  if (noNotes) {
    hit("no-notes");
    const refused = !parsed.ok && parsed.refusals.some((r) => r.code === "no-notes");
    return { problem: refused ? null : `expected no-notes\n${text}` };
  }
  // FR-020 outranks SC-001: a group of 17 or more is one sync would refuse, so the reader must too.
  if (!parsed.ok && parsed.refusals.every((r) => r.code === "bracket-range")) {
    const counts = source.map((c) => c.bracket).filter((b): b is number => b !== null);
    if (counts.some((c) => c > 16 || c < 2)) {
      hit("beyond-sync-limit");
      return { problem: null };
    }
  }
  if (!parsed.ok) {
    const lines = parsed.refusals.map((r) => `${r.line}:${r.code}`).join(",");
    return { problem: `REFUSED ${lines}\n${text}` };
  }

  const rows = draftPart(parsed.clipboard);
  const next = { ...options, events: rows.events, annotations: rows.annotations };
  const redraw = ascii.toAscii({ ...next, density: parsed.density });

  if (density === "compact" && parsed.density === "expanded") hit("compact-without-label");

  if (redraw !== text) {
    // A repeated rest in compact draws one space: the only staff-row change the table allows.
    const staff = (t: string) => t.split("\n").filter((l) => l.includes("|"));
    const chordLine = text.split("\n").find((l) => !l.includes("|") && !l.includes(","));
    const ignored = chordLine !== undefined && parsed.ignored.some((l) => l.text === chordLine);
    const sameStaff = staff(redraw).join("\n") === staff(text).join("\n");
    if (sameStaff && ignored) {
      hit("chord-not-a-symbol");
      return { problem: null };
    }
    if (density === "compact" && options.events.some((e) => e.kind === "rest" && e.repeat > 1)) {
      hit("repeated-space");
      return { problem: null };
    }
    return { problem: `TEXT DIFFERS\n${text}\n---\n${redraw}` };
  }

  // Same events, drawn column by drawn column, at the density it came back in.
  const back = drawn(next, parsed.density);
  if (JSON.stringify(back) !== JSON.stringify(source)) {
    return { problem: `EVENTS DIFFER\n${text}` };
  }

  // Stored fields the drawing cannot show, which a drawing-level comparison cannot catch.
  for (const row of rows.events) {
    if (row.kind === "barline" && (row.tupletId || row.repeat !== 1)) return { problem: `BARLINE FIELDS\n${text}` };
    if (row.tupletId === null && (row.tupletCount !== null || row.groupKind !== null)) {
      return { problem: `GROUP FIELDS\n${text}` };
    }
    if (row.tupletId !== null && row.groupKind === "plain" && row.tupletCount !== null) {
      return { problem: `PLAIN WITH A COUNT\n${text}` };
    }
    if (row.tupletId !== null && row.groupKind === "tuplet" && row.tupletCount === null) {
      return { problem: `TUPLET WITH NO COUNT\n${text}` };
    }
    if (row.repeat < 1 || row.repeat > 512) return { problem: `REPEAT ${row.repeat}\n${text}` };
  }
  return { problem: null };
}

// A seeded generator with what G leaves out: every count, chords with rails in them, wider repeats.
function seeded(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DECORATIONS = ["vibrato", "harmonic", "let_ring", "bend", "tap", "palm_mute"];
const TRANSITIONS = ["hammer_on", "pull_off", "slide_up", "slide_down"];

function generate(seed: number, strings: number, chords: readonly string[]) {
  const random = seeded(seed);
  const pick = <T,>(list: readonly T[]) => list[Math.floor(random() * list.length)];
  const events: EventRow[] = [];
  const annotations: AnnotationRow[] = [];
  let n = 0;
  const base = (over: Partial<EventRow>) => {
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
      groupKind: null,
      updatedAt: "x",
      deletedAt: null,
      fieldClocks: {},
      serverSeq: 0,
      ...over,
    } as EventRow;
  };
  const count = 2 + Math.floor(random() * 22);
  for (let i = 0; i < count; i += 1) {
    const roll = random();
    if (roll < 0.14) {
      events.push(base({ kind: "barline" }));
      continue;
    }
    if (roll < 0.24) {
      events.push(base({ kind: "rest", repeat: random() < 0.2 ? 2 + Math.floor(random() * 4) : 1 }));
      continue;
    }
    const frets: Record<string, number | "x"> = {};
    const techniques: Record<string, string[]> = {};
    const played = 1 + Math.floor(random() * Math.min(4, strings));
    for (let k = 0; k < played; k += 1) {
      const s = Math.floor(random() * strings);
      frets[s] = random() < 0.12 ? "x" : Math.floor(random() * 37);
      const list: string[] = [];
      for (const d of DECORATIONS) if (random() < 0.08) list.push(d);
      if (random() < 0.3) list.push(pick(TRANSITIONS));
      if (list.length) techniques[s] = list;
    }
    const event = base({
      frets,
      techniques: techniques as EventRow["techniques"],
      repeat: random() < 0.3 ? 1 + Math.floor(random() * 40) : 1,
    });
    events.push(event);
    // Spaced so two chords never touch: what touching does is the table's business, not this one.
    if (chords.length > 0 && i % 6 === 0 && random() < 0.7) {
      annotations.push({
        id: `a-${event.id}`,
        bandId: "b",
        partId: "p",
        anchorEventId: event.id,
        kind: "chord",
        value: pick(chords),
        updatedAt: "x",
        deletedAt: null,
        fieldClocks: {},
        serverSeq: 0,
      } as AnnotationRow);
    }
  }
  for (let i = 0; i + 1 < events.length; i += 1) {
    if (random() > 0.2) continue;
    const size = 2 + Math.floor(random() * 5);
    const span = events.slice(i, i + size);
    if (span.length < 2 || span.some((e) => e.kind === "barline" || e.tupletId !== null)) continue;
    const plain = random() < 0.35;
    for (const e of span) {
      e.tupletId = `grp-${seed}-${i}`;
      e.tupletCount = plain ? null : span.length;
      e.groupKind = plain ? "plain" : "tuplet";
    }
  }
  return { events, annotations };
}

describe("the replay, after every harvested file has run", () => {
beforeAll(async () => {
  recorded.on = false;
  actual = await vi.importActual<Actual>("@/lib/tab/layout");
  ascii = await vi.importActual<Ascii>("@/lib/tab/ascii");
  harvest = recorded.calls as LayoutOptions[];
});

describe("H and a harsher G, judged with no early return", () => {
  it("every harvested text reads back, or names why not", () => {
    const seen = new Set<string>();
    const problems: string[] = [];
    let texts = 0;
    for (const options of harvest) {
      for (const density of ["expanded", "compact"] as const) {
        const key = JSON.stringify([options.events, options.annotations, options.tuning, density]);
        if (seen.has(key)) continue;
        seen.add(key);
        texts += 1;
        const { problem } = judge(options, density);
        if (problem) problems.push(problem);
      }
    }
    console.log(`harvest: ${harvest.length} calls, ${texts} texts, ${problems.length} problems`);
    console.log(`first problems:\n${problems.slice(0, 6).join("\n=====\n")}`);
    const kinds = new Map<string, number>();
    for (const p of problems) {
      const k = p.split("\n")[0];
      kinds.set(k, (kinds.get(k) ?? 0) + 1);
    }
    console.log(`problem kinds: ${JSON.stringify([...kinds])}`);
    expect(problems.length).toBe(0);
  });

  it("the generator with the suite's own safe chord list", () => {
    const chords = ["Am", "G", "Cmaj7", "D/F#", "E5", "N.C.", "Bb"];
    const problems: string[] = [];
    let seed = 90_001;
    for (let k = 0; k < 1500; k += 1) {
      for (const id of ["bass4-e", "bass5-b", "guitar6-e"]) {
        const tuning = presetById(id)!;
        const { events, annotations } = generate(seed, tuning.strings.length, chords);
        for (const density of ["expanded", "compact"] as const) {
          const { problem } = judge({ events, annotations, tuning }, density);
          if (problem) problems.push(`seed ${seed} ${id} ${density}\n${problem}`);
        }
        seed += 1;
      }
    }
    const kinds = new Map<string, number>();
    for (const p of problems) {
      const k = p.split("\n")[1].replace(/\d+:/g, "");
      kinds.set(k, (kinds.get(k) ?? 0) + 1);
    }
    console.log(`generator: ${problems.length} problems ${JSON.stringify([...kinds])}`);
    console.log(problems.slice(0, 4).join("\n=====\n"));
    expect(problems.length).toBe(0);
  }, 300_000);

  it("the ledger's classes the texts actually reach", () => {
    console.log(`classes: ${JSON.stringify([...CLASSES])}`);
    expect(CLASSES.get("compact-without-label") ?? 0).toBeGreaterThan(0);
    expect(CLASSES.get("no-notes") ?? 0).toBeGreaterThan(0);
  });
});

describe("H through the real write: INV-001 and INV-021", () => {
  async function homeFor(tuning: Tuning, homes: Map<string, World>) {
    const key = JSON.stringify(tuning.strings);
    let w = homes.get(key);
    if (!w) {
      w = await world(null);
      const row = await customTuning(w, tuning, "Harvest", true);
      expect(row.isDefault).toBe(true);
      homes.set(key, w);
    }
    return w;
  }

  it("each is written, passes the wire, and draws what the preview drew, at both densities", async () => {
    const homes = new Map<string, World>();
    const seen = new Set<string>();
    const problems: string[] = [];
    let written = 0;
    for (const options of harvest) {
      for (const density of ["expanded", "compact"] as const) {
        const text = ascii.toAscii({ ...options, density });
        const key = `${JSON.stringify(options.tuning.strings)}|${text}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const w = await homeFor(options.tuning, homes);
        const context = await contextOf(w);
        const reading = readTab(text, { ...context, songEvents: [] });
        if (reading.kind !== "ready") continue;
        if (reading.fit.kind !== "fits") {
          problems.push(`no fit for its own tuning\n${text}`);
          continue;
        }
        const draft = draftPart(reading.clipboard);
        const result = await importTab(w.song, text, reading.fitKey, w.ctx);
        if (result.kind !== "imported") {
          problems.push(`not imported\n${text}`);
          continue;
        }
        written += 1;
        const events = await listEvents(result.part.id, w.db);
        const annotations = await listAnnotations(result.part.id, w.db);
        for (const d of ["expanded", "compact"] as const) {
          const a = ascii.toAscii({ events: draft.events, annotations: draft.annotations, tuning: options.tuning, density: d });
          const b = ascii.toAscii({ events, annotations, tuning: options.tuning, density: d });
          if (a !== b) problems.push(`preview differs from stored at ${d}\n${a}\n---\n${b}`);
        }
      }
    }
    for (const w of homes.values()) {
      const rows = await w.db.outbox.toArray();
      for (let i = 0; i < rows.length; i += 200) {
        const mutations = rows.slice(i, i + 200).map((r) => ({ table: r.table, row: r.row }));
        const parsed = pushRequestSchema.safeParse({ mutations });
        if (!parsed.success) problems.push(JSON.stringify(parsed.error.issues.slice(0, 2)));
      }
    }
    console.log(`written through importTab: ${written}, problems ${problems.length}`);
    console.log(problems.slice(0, 3).join("\n=====\n"));
    expect(written).toBeGreaterThan(300);
    expect(problems.length).toBe(0);
  }, 300_000);
});

});
