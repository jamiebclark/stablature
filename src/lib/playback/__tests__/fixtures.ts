/**
 * Spec 011 fixtures: part T, the playback song, and the hand corpora of contracts/playback-stream.md §3–§4.
 * Oracles are literals in beats; `beats()` only turns a written fraction into ticks and never calls the code under test.
 */
import type { DrawnPass } from "@/lib/arrangement/passes";
import type { EventRow, FretValue } from "@/lib/model";
import { TICKS_PER_BEAT } from "@/lib/rhythm/durations";
import { barline, ev } from "@/lib/tab/__tests__/helpers";

/** A beat count written as a fraction, in ticks: `beats(1, 3)` is a third of a beat. */
export const beats = (num: number, den = 1): number => (num * TICKS_PER_BEAT) / den;

/**
 * A bar written as text. Columns are separated by spaces. `|` is a barline, `rest` a space (an empty rest column),
 * `3:5[hammer_on,vibrato]` one string's fret with techniques, `+` stacks strings in one column, `@8` sets the
 * duration, `x4` repeats the column, and `t3(…)` / `p(…)` wrap a counted or a plain group.
 */
let gid = 0;
function column(token: string, over: Partial<EventRow>): EventRow {
  if (token === "|") return barline();
  const rep = /x(\d+)$/.exec(token);
  const stripped = token.replace(/x\d+$/, "");
  const dur = /@([0-9a-z"]+)/.exec(stripped);
  const body = stripped.replace(/@[0-9a-z"]+/, "");
  const extra: Partial<EventRow> = {
    ...over,
    ...(rep ? { repeat: Number(rep[1]) } : {}),
    ...(dur ? { durationHint: dur[1] as never } : {}),
  };
  if (body === "rest") return ev({}, {}, { kind: "rest", ...extra });
  const frets: Record<string, FretValue> = {};
  const tech: Record<string, string[]> = {};
  for (const piece of body.split("+")) {
    const m = /^([^:]+):([^[]+)(?:\[([^\]]*)\])?$/.exec(piece);
    if (!m) throw new Error(`bad column ${token}`);
    const f = m[2];
    frets[m[1]] = (f === "x" ? "x" : Number(f)) as FretValue;
    if (m[3]) tech[m[1]] = m[3].split(",");
  }
  return ev(frets, tech, extra);
}

export function parseColumns(text: string): EventRow[] {
  const out: EventRow[] = [];
  const re = /(t(\d+)|p)\(([^)]*)\)|(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m[4] !== undefined) {
      out.push(column(m[4], {}));
      continue;
    }
    const id = `pg${++gid}`;
    const over: Partial<EventRow> =
      m[1] === "p"
        ? { tupletId: id, tupletCount: null, groupKind: "plain" }
        : { tupletId: id, tupletCount: Number(m[2]), groupKind: "tuplet" };
    for (const t of m[3].trim().split(/\s+/)) out.push(column(t, over));
  }
  return out;
}

/** Part T (data-model §5). String 0 = G, 3 = E. Every duration is unset. */
export const PART_T_TEXT = [
  "3:5 3:7[hammer_on] |",
  "3:7 3:9[slide_up] |",
  "2:5[slide_up] 1:7[slide_down] |",
  "3:5[pull_off] 3:3[pull_off] |",
  "2:7[vibrato] |",
  "3:5[palm_mute] 3:5[palm_mute] 3:x 3:x[palm_mute] |",
  "0:2[let_ring]+1:2[let_ring]+2:4[let_ring] 3:0 |",
  "3:12[harmonic] 2:7[harmonic] 1:5[harmonic] 0:4[harmonic] 2:3[harmonic] |",
  "3:7[bend] 3:7[tap] 3:7[tap] 3:5[pull_off] |",
  "3:x[slide_up] 3:5[dead_note] 9:3 |",
  "rest",
].join(" ");
export const partT = (): EventRow[] => parseColumns(PART_T_TEXT);

/** One row of a length corpus: the columns as text, per-pass where the row has passes, and the hand oracle. */
export interface LenRow {
  id: string;
  passes: string[];
  /** Start of each sounding hit and its length, in ticks. */
  starts: number[];
  lengths: number[];
  total: number;
  rule: "written" | "some" | "none" | "empty";
}

const seq = (...lens: number[]): { starts: number[]; lengths: number[]; total: number } => {
  const starts: number[] = [];
  let at = 0;
  for (const l of lens) {
    starts.push(at);
    at += l;
  }
  return { starts, lengths: lens, total: at };
};
const row = (id: string, passes: string[], lens: number[], rule: LenRow["rule"]): LenRow => ({
  id,
  passes,
  rule,
  ...seq(...lens),
});


export const LEN: LenRow[] = [
  // L1 is the spec's worked example: 5 · 7(8) · 7 · t3[5 7 9] · space
  row("L1", ["3:5 3:7@8 3:7 t3(3:5 3:7 3:9) rest"], [beats(1), beats(1, 2), beats(1, 2), beats(1, 3), beats(1, 3), beats(1, 3), beats(1, 2)], "some"),
  row("L2", [Array(8).fill("3:5").join(" ")], Array(8).fill(beats(1)), "none"),
  row("L3", ["3:5@q 3:5@q 3:5@8 3:5@8 | 3:5@h"], [beats(1), beats(1), beats(1, 2), beats(1, 2), beats(2)], "written"),
  row("L4", ["3:5@8 3:5 | 3:5"], [beats(1, 2), beats(1, 2), beats(1, 2)], "some"),
  row("L5", ["3:5@8 3:5", "3:5"], [beats(1, 2), beats(1, 2), beats(1)], "some"),
  row("L7", ['3:5@"64" 3:5'], [beats(1), beats(1)], "none"),
  row("L8", ["3:5@8x4"], Array(4).fill(beats(1, 2)), "written"),
  row("L9", ["3:5@16 3:5x3"], Array(4).fill(beats(1, 4)), "some"),
  row("L11", ["3:5@8 t3(3:5 3:5 3:5)"], [beats(1, 2), beats(1, 3), beats(1, 3), beats(1, 3)], "some"),
  row("L12", ["t3(3:5@8 3:5@8 3:5@8 3:5@8)"], Array(4).fill(beats(1, 2)), "written"),
  row("L15", ["p(3:5@8 3:5@8 3:5@8)"], Array(3).fill(beats(1, 2)), "written"),
  row("L17", ["| |"], [], "empty"),
  row("L18", [""], [], "empty"),
  row("L19", ["3:5@q 3:5@q 3:5@q 3:5@q |"], Array(4).fill(beats(1)), "written"),
];

/**
 * The technique corpus inputs (contracts/playback-stream.md §4), on string 3 (E1, MIDI 28) unless the text says
 * otherwise. Each case is one or more passes; the expected `Voice`s are literals in `techniques.test.ts`.
 */
export interface TechCase {
  id: string;
  passes: string[];
}
export const TECH: TechCase[] = [
  { id: "T1", passes: ["3:5@q 3:7[hammer_on]@q"] },
  { id: "T2", passes: ["3:7[hammer_on]@q"] },
  { id: "T3", passes: ["3:7@q 3:5[pull_off]@q", "3:5[pull_off]@q"] },
  { id: "T4", passes: ["3:7@q 3:9[slide_up]@q"] },
  { id: "T5", passes: ["3:9[slide_up]@q", "3:9[slide_down]@q"] },
  { id: "T6", passes: ["3:7[vibrato]@q"] },
  { id: "T7", passes: ["3:5[palm_mute]@q"] },
  { id: "T8", passes: ["0:2[let_ring]+1:2[let_ring]+2:4[let_ring] 3:0"] },
  {
    id: "T9",
    passes: [[12, 7, 19, 5, 24, 4, 9, 16, 3].map((f) => `3:${f}[harmonic]@q`).join(" ")],
  },
  { id: "T10", passes: ["3:7[bend]@q", "3:7[tap]@q", "3:7[bend,tap,vibrato]@q", "3:7@q"] },
  { id: "T11", passes: ["3:7[tap]@q 3:5[pull_off]@q"] },
  { id: "T12", passes: ["0:x@q", "1:x@q", "2:x@q", "3:x@q", "4:x@q"] },
  { id: "T13", passes: ["3:x[palm_mute]@q", "3:x[slide_up]@q", "3:x[hammer_on,vibrato,let_ring,harmonic]@q"] },
  { id: "T14", passes: ["3:5[dead_note]@q"] },
  { id: "T15", passes: ["3:5@q 3:x@q 3:7[hammer_on]@q"] },
  { id: "T16", passes: ["3:5@q 3:7[slide_up,hammer_on]@q"] },
  { id: "T17", passes: ["3:5@q", "3:7[hammer_on]@q"] },
  { id: "T18", passes: ["3:7[hammer_on]@q 3:5@q"] },
  {
    id: "T19",
    passes: ["9:3@q 3:5@q", '"a":3@q 3:5@q', "3:-1@q 3:5@q", "3:2.5@q 3:5@q"],
  },
];

/** Passes from texts: one `DrawnPass` per text, each its own part. */
export const passesOf = (texts: readonly string[]): DrawnPass[] =>
  texts.map((t, i) => ({
    step: { partId: `p${i}`, entryId: "", pass: 1, passes: 1, fromBar: null, toBar: null, sections: [], visits: [] },
    events: parseColumns(t),
  }));
