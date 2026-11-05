import "fake-indexeddb/auto";

/**
 * INV-001: never is a row written that sync would refuse.
 * INV-002: never is text outside sync's limits read as anything but a refusal.
 * After each import every outbox row goes through the real `pushRequestSchema`, in batches of 200.
 */
import { describe, expect, it } from "vitest";
import { parseChord } from "@/lib/chords";
import { importTab } from "@/lib/local/importing";
import { MAX_CHORD_LENGTH, MAX_FRET, MAX_REPEAT, MAX_TUPLET_COLUMNS, MIN_GROUP_COLUMNS } from "@/lib/model";
import { annotationRowSchema, eventRowSchema, pushRequestSchema } from "@/lib/sync/protocol";
import { dump, four, holdNotes, imported, reading, staff, world, type World } from "./unit-helpers";

async function expectWireAccepts(w: World) {
  const rows = await w.db.outbox.toArray();
  expect(rows.length).toBeGreaterThan(0);
  for (let i = 0; i < rows.length; i += 200) {
    const mutations = rows.slice(i, i + 200).map((r) => ({ table: r.table, row: r.row }));
    const parsed = pushRequestSchema.safeParse({ mutations });
    expect(parsed.success, parsed.success ? "" : JSON.stringify(parsed.error.issues.slice(0, 3))).toBe(true);
  }
}

/** A symbol the chord reader accepts, exactly `length` characters long. */
function chordOf(length: number, root = "C"): string {
  // `add9` is four characters, `b13` three and `b5` two, so every length can be spelt.
  const room = length - root.length;
  const threes = room % 2;
  const twos = (room - 3 * threes) % 4 === 2 ? 1 : 0;
  const fours = (room - 3 * threes - 2 * twos) / 4;
  const symbol = root + "add9".repeat(fours) + "b13".repeat(threes) + "b5".repeat(twos);
  if (symbol.length !== length || parseChord(symbol) === null) throw new Error(`bad probe: ${symbol}`);
  return symbol;
}

const body = (n: number) => `-${"5-".repeat(n)}`;

const BOUNDARIES: [string, string][] = [
  ["fret 0", four("-0-")],
  ["fret 36", four("-36-")],
  ["repeat 1", four("-7x1-")],
  ["repeat 512", four("-7x512-")],
  ["group of 2", `    ,2,\n${four("-5-7-")}`],
  ["group of 16", `    ,${"-".repeat(13)}16${"-".repeat(14)},\n${four(`-${"5-7-".repeat(8)}`.slice(0, 33))}`],
  ["a run of 512", four(body(512))],
  ["a run of 513", four(body(513))],
  ["a run of 1,025", four(body(1025))],
];

describe("INV-001 the boundaries reach the wire", () => {
  it.each(BOUNDARIES)("%s", async (_name, text) => {
    const w = await world("bass4-e");
    await imported(w, text);
    await expectWireAccepts(w);
  });

  it("a chord of 200 characters", async () => {
    const w = await world("bass4-e");
    await imported(w, `    ${chordOf(200)}\n${four(`-5-${"-".repeat(210)}7-`)}`);
    await expectWireAccepts(w);
    const notes = await w.db.annotations.toArray();
    expect(notes.map((n) => n.value.length)).toEqual([200]);
  });

  it("an offer of a band tuning", async () => {
    const w = await world("bass4-e");
    await holdNotes(w, [0]);
    const { createTuningFromPreset } = await import("@/lib/local/editing");
    const { presetById } = await import("@/lib/tunings");
    await createTuningFromPreset(w.bandId, presetById("bass5-b")!, false, w.ctx);
    const { reading: r } = await imported(w, staff("GDAEB", ["-5-", "---", "---", "---", "-3-"]));
    expect(r.fitKey).toMatch(/^tuning:/);
    await expectWireAccepts(w);
  });

  it("an offer of a preset, in a band with no tunings", async () => {
    const w = await world(null);
    const { reading: r } = await imported(w, staff("GDAEB", ["-5-", "---", "---", "---", "-3-"]));
    expect(r.fitKey).toBe("preset:bass5-b");
    await expectWireAccepts(w);
  });

  /**
   * Reading repeats merges identical columns under a counted bracket, and nothing bounds the merge.
   * The app can write this: a counted group of two holding `5 x512` and `5 x512`.
   */
  it.each([
    ["two stored columns of 512, under a 2", 1024],
    ["513 columns then one more, under a 2", 513],
  ])("%s", async (_name, n) => {
    const w = await world("bass4-e");
    const notes = `${body(n)}7-`;
    const inner = notes.length - 4;
    const left = Math.floor((inner - 1) / 2);
    const bracket = `,${"-".repeat(left)}2${"-".repeat(inner - left - 1)},`;
    await imported(w, `    ${bracket}\n${four(notes)}`);
    await expectWireAccepts(w);
  });

  it("the shape the app itself draws: a group of two stored 512s", async () => {
    const { toAscii } = await import("@/lib/tab/ascii");
    const { presetById } = await import("@/lib/tunings");
    const column = (id: string) => ({
      id,
      bandId: "b",
      partId: "p",
      rank: id,
      kind: "notes",
      frets: { "0": 5 },
      techniques: {},
      repeat: 512,
      durationHint: null,
      tupletId: "g",
      tupletCount: 2,
      groupKind: "tuplet",
      updatedAt: "x",
      deletedAt: null,
      fieldClocks: {},
      serverSeq: 0,
    });
    const text = toAscii({
      events: [column("a"), column("b")] as never,
      tuning: presetById("bass4-e")!,
      density: "expanded",
    });
    const w = await world("bass4-e");
    await imported(w, text);
    await expectWireAccepts(w);
  });
});

describe("INV-002 what sync would refuse is refused at reading", () => {
  const cases: [string, string, string][] = [
    ["fret 37", four("-37-"), "fret-range"],
    ["fret 57", four("-57-"), "fret-range"],
    ["a repeat of 0", four("-7x0-"), "repeat-range"],
    ["a repeat of 513", four("-7x513-"), "repeat-range"],
    ["a group of 1", `    ,-1-,\n${four("-5-7-")}`, "bracket-range"],
    ["a group of 17", `    ,-17-,\n${four("-5-7--")}`, "bracket-range"],
    ["a chord of 201", `    ${chordOf(201)}\n${four("-5-7-")}`, "chord-too-long"],
    // The chord reader takes a lower-case root, so a guard on `[A-G]` alone lets these through.
    ["a chord of 201, lower-case root", `    ${chordOf(201, "c")}\n${four("-5-7-")}`, "chord-too-long"],
    ["a chord of 300, lower-case root", `    ${chordOf(300, "a")}\n${four("-5-7-")}`, "chord-too-long"],
  ];

  it.each(cases)("%s", async (_name, text, code) => {
    const w = await world("bass4-e");
    const r = await reading(w, text);
    expect(r.kind).toBe("refused");
    if (r.kind === "refused") expect(r.refusals.map((x) => x.code)).toContain(code);
    const before = await dump(w);
    const result = await importTab(w.song, text, "fits", w.ctx);
    expect(result.kind).toBe("changed");
    expect(await dump(w)).toBe(before);
  });

  const uuid = "018f0000-0000-7000-8000-000000000000";
  const meta = { updatedAt: "000000000000000:0000:a", deletedAt: null, fieldClocks: {}, serverSeq: 0 };
  const event = (over: object) => ({
    id: uuid,
    bandId: uuid,
    partId: uuid,
    rank: "a0",
    kind: "notes",
    frets: {},
    techniques: {},
    repeat: 1,
    durationHint: null,
    tupletId: null,
    tupletCount: null,
    ...meta,
    ...over,
  });
  const chord = (value: string) => ({
    id: uuid,
    bandId: uuid,
    partId: uuid,
    anchorEventId: null,
    kind: "chord",
    value,
    ...meta,
  });

  it("the reader's constants are the wire's, on both sides of each edge", () => {
    expect(eventRowSchema.safeParse(event({ frets: { "0": MAX_FRET } })).success).toBe(true);
    expect(eventRowSchema.safeParse(event({ frets: { "0": MAX_FRET + 1 } })).success).toBe(false);
    expect(eventRowSchema.safeParse(event({ repeat: MAX_REPEAT })).success).toBe(true);
    expect(eventRowSchema.safeParse(event({ repeat: MAX_REPEAT + 1 })).success).toBe(false);
    expect(annotationRowSchema.safeParse(chord("x".repeat(MAX_CHORD_LENGTH))).success).toBe(true);
    expect(annotationRowSchema.safeParse(chord("x".repeat(MAX_CHORD_LENGTH + 1))).success).toBe(false);
    const group = (tupletCount: number) => event({ tupletId: uuid, tupletCount, groupKind: "tuplet" });
    expect(eventRowSchema.safeParse(group(MIN_GROUP_COLUMNS)).success).toBe(true);
    expect(eventRowSchema.safeParse(group(MIN_GROUP_COLUMNS - 1)).success).toBe(false);
    expect(eventRowSchema.safeParse(group(MAX_TUPLET_COLUMNS)).success).toBe(true);
    expect(eventRowSchema.safeParse(group(MAX_TUPLET_COLUMNS + 1)).success).toBe(false);
    expect([MAX_FRET, MAX_REPEAT, MAX_CHORD_LENGTH]).toEqual([36, 512, 200]);
  });
});
