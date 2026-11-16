/** INV-007 / INV-008: which passes share a card, and the words on it. Expected values are the hand table of contracts/cards.md section 4. */
import { describe, expect, it } from "vitest";
import type { ArrangementEntryRow, EventRow } from "@/lib/model";
import { expandArrangement, parseArrangement } from "@/lib/arrangement/expand";
import { drawnPasses } from "@/lib/arrangement/passes";
import { passBars } from "../bars";
import { cardSpanWords, cardWords, drawnCards, livePassWords } from "../cards";

let seq = 0;
function entry(o: Partial<ArrangementEntryRow>): ArrangementEntryRow {
  seq += 1;
  return {
    id: `en${seq}`, bandId: "b", songId: "s", rank: `a${String(seq).padStart(4, "0")}`, kind: "part", partId: null,
    repeat: 1, fromBar: null, toBar: null, lastRepeatPartId: null, label: null, updatedAt: "x", deletedAt: null,
    fieldClocks: {}, serverSeq: 0, ...o,
  } as ArrangementEntryRow;
}
const part = (partId: string, o: Partial<ArrangementEntryRow> = {}) => entry({ kind: "part", partId, ...o });
const start = (label: string, repeat = 1) => entry({ kind: "section_start", label, repeat });
const end = () => entry({ kind: "section_end" });
const text = () => entry({ kind: "text", label: "Cue" });

let ev = 0;
function event(partId: string, kind: EventRow["kind"] = "notes"): EventRow {
  ev += 1;
  return {
    id: `v${ev}`, bandId: "b", partId, rank: `a${String(ev).padStart(5, "0")}`, kind,
    frets: kind === "notes" ? { "0": 3 } : {}, techniques: {}, repeat: 1, durationHint: null, tupletId: null,
    tupletCount: null, updatedAt: "x", deletedAt: null, fieldClocks: {}, serverSeq: 0,
  } as EventRow;
}
/** n bars of one note each, barlines between. */
function bars(partId: string, n: number, leadingBarline = false): EventRow[] {
  const out: EventRow[] = leadingBarline ? [event(partId, "barline")] : [];
  for (let i = 0; i < n; i++) {
    if (i > 0) out.push(event(partId, "barline"));
    out.push(event(partId));
  }
  return out;
}

const EVENTS = (): Record<string, EventRow[]> => ({
  A: bars("A", 4), A2: bars("A2", 4), B: bars("B", 4), C: bars("C", 2), E: [], L: bars("L", 4, true),
});

function build(entries: ArrangementEntryRow[]) {
  const steps = expandArrangement(parseArrangement(entries));
  const passes = drawnPasses(steps, EVENTS());
  const drawn = drawnCards(passes, passBars(passes));
  return { passes, ...drawn };
}

type Want = { passes: [number, number]; words: string | null; span: string | null };
const x = "×", dot = "·", dash = "–";
const run = (a: number, z: number, n: number, span: string | null): Want => ({
  passes: [a, z], words: `${x}${z - a + 1} ${dot} passes 1${dash}${z - a + 1} of ${n}`, span,
});
const one = (p: number, words: string | null = null): Want => ({ passes: [p, p], words, span: null });
const bs = (a: number, z: number) => `bars ${a}${dash}${z}`;

const F15 = () => [
  start("Verse"), part("A", { repeat: 4, lastRepeatPartId: "A2" }), end(), part("B", { repeat: 2 }),
  part("A", { repeat: 2 }), start("Outro"), part("C"), end(), part("B"),
];

const ROWS: [string, () => ArrangementEntryRow[], Want[]][] = [
  ["F1", () => [part("A", { repeat: 4 })], [run(0, 3, 4, bs(1, 16))]],
  ["F2", () => [part("A", { repeat: 4, lastRepeatPartId: "A2" })],
    [{ passes: [0, 2], words: `${x}3 ${dot} passes 1${dash}3 of 4`, span: bs(1, 12) }, one(3, "pass 4 of 4")]],
  ["F3", () => [part("A", { repeat: 2, lastRepeatPartId: "A2" })], [one(0, "pass 1 of 2"), one(1, "pass 2 of 2")]],
  ["F4", () => [part("A", { repeat: 1, lastRepeatPartId: "A2" })], [one(0)]],
  ["F5", () => [start("Verse", 2), part("A", { repeat: 2 }), end()], [run(0, 1, 2, bs(1, 8)), run(2, 3, 2, bs(9, 16))]],
  ["F6", () => [start("", 2), part("A", { repeat: 2 }), end()], [run(0, 1, 2, bs(1, 8)), run(2, 3, 2, bs(9, 16))]],
  ["F7", () => [part("A"), part("A")], [one(0), one(1)]],
  ["F8", () => [part("A", { repeat: 3, fromBar: 1, toBar: 2 })], [run(0, 2, 3, bs(1, 6))]],
  ["F9", () => [part("A2", { repeat: 3 })], [run(0, 2, 3, bs(1, 12))]],
  ["F10", () => [part("E", { repeat: 3 })], [run(0, 2, 3, null)]],
  ["F11", () => [part("L", { repeat: 3 })], [run(0, 2, 3, bs(1, 15))]],
  ["F12", () => [part("A", { repeat: 2 }), text(), part("A", { repeat: 2 })], [run(0, 1, 2, bs(1, 8)), run(2, 3, 2, bs(9, 16))]],
  ["F13", () => [start("Outer"), start("Inner", 2), part("A", { repeat: 3 }), end(), end()], [run(0, 2, 3, bs(1, 12)), run(3, 5, 3, bs(13, 24))]],
  ["F14", () => [], []],
  ["F15", F15,
    [{ passes: [0, 2], words: `${x}3 ${dot} passes 1${dash}3 of 4`, span: bs(1, 12) }, one(3, "pass 4 of 4"),
      run(4, 5, 2, bs(17, 24)), run(6, 7, 2, bs(25, 32)), one(8), one(9)]],
];

describe("drawnCards against the hand table", () => {
  for (const [id, entries, want] of ROWS) {
    it(id, () => {
      const { cards, cardOf, passes } = build(entries());
      expect(
        cards.map((c) => ({ passes: [c.first, c.last], words: cardWords(c, passes), span: cardSpanWords(c) })),
      ).toEqual(want);
      expect(cardOf.length).toBe(passes.length);
      cardOf.forEach((c, p) => {
        expect(cards[c].first).toBeLessThanOrEqual(p);
        expect(p).toBeLessThanOrEqual(cards[c].last);
      });
      expect(cards.reduce((s, c) => s + c.count, 0)).toBe(passes.length);
      cards.forEach((c, i) => {
        expect(c.index).toBe(i);
        if (i > 0 && cards[i - 1].span) expect(c.offset).toBe(cards[i - 1].span!.to);
      });
    });
  }

  it("F15 maps passes to cards", () => {
    expect(build(F15()).cardOf).toEqual([0, 0, 0, 1, 2, 2, 3, 3, 4, 5]);
  });

  it("says the live pass of a folded card, and nothing for a single", () => {
    const { cards, passes } = build([part("A", { repeat: 4 })]);
    expect(livePassWords(cards[0], passes, 2)).toBe("pass 3 of 4");
    const two = build([part("A", { repeat: 4, lastRepeatPartId: "A2" })]);
    expect(livePassWords(two.cards[1], two.passes, 3)).toBeNull();
  });
});
