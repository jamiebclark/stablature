/**
 * Review probe, INV-002 and INV-019, through the public exports (`layoutPart`, `barPositions`, `rhythmMarks`).
 *
 * Every sequence of up to four columns over 13 tokens (eighth, sixteenth, thirty-second, q, h, w, two rests,
 * unset, an unknown stored value, a barline, two repeats), each bare and with every group overlay (plain,
 * counted that reads, counted still being built, over every contiguous span, a span across a barline being a
 * legacy split group), in both densities. Plus two adjacent groups over a smaller alphabet.
 *
 * For every adjacent pair of layout columns:
 * - the two halves agree (`right[i] === left[i+1]`);
 * - a join never touches anything in Brk: a barline, a rest, an unset or unknown value, q/h/w, a group edge
 *   (different `tupletId`), an unknown position, a compact repeat; and a join outside a counted group that reads
 *   never crosses a beat;
 * - two beamable notes in one unit (same beat and same group, or the same counted group that reads) ARE joined,
 *   at the smaller level count;
 * - after an unset or unknown column in a bar, nothing later in that bar is joined (FR-008), independent of
 *   `barPositions`.
 * For every note: flags equal levels when unjoined and 0 when joined; stubs are levels − max(left, right).
 * INV-019: a compact repeat is never joined and carries its own flags.
 */
import { describe, expect, it } from "vitest";
import type { EventRow } from "@/lib/model";
import { TICKS_PER_BEAT } from "@/lib/rhythm/durations";
import { barPositions } from "@/lib/rhythm/notation";
import { rhythmMarks } from "@/lib/rhythm/beams";
import { layoutPart, type Density } from "@/lib/tab/layout";
import { barline, bass5, ev } from "@/lib/tab/__tests__/helpers";

const TOKENS = ["8", "16", "32", "q", "h", "w", "r8", "r16", "unset", "64?", "|", "x2:8", "x3:16"];
const SMALL = ["8", "16", "r8", "unset", "|", "x2:8"];
const LEVELS: Record<string, number> = { "8": 1, "16": 2, "32": 3 };

type Overlay = { start: number; end: number; kind: "plain" | "reads" | "building" };

function build(tokens: string[], overlays: Overlay[]): EventRow[] {
  return tokens.map((t, i) => {
    if (t === "|") return barline();
    const over = overlays.find((o) => i >= o.start && i <= o.end);
    let group: Partial<EventRow> = {};
    if (over) {
      const members = tokens.slice(over.start, over.end + 1).filter((x) => x !== "|").length;
      const id = `g${over.start}-${over.end}`;
      group =
        over.kind === "plain"
          ? { tupletId: id, tupletCount: null, groupKind: "plain" }
          : { tupletId: id, tupletCount: over.kind === "reads" ? members : members + 1, groupKind: "tuplet" };
    }
    const rep = /^x(\d+):(.+)$/.exec(t);
    const rest = t.startsWith("r");
    const d = t === "unset" ? null : t === "64?" ? "64" : rep ? rep[2] : rest ? t.slice(1) : t;
    return ev(rest ? {} : { "2": 5 }, {}, {
      kind: rest ? "rest" : "notes",
      durationHint: d as never,
      repeat: rep ? Number(rep[1]) : 1,
      ...group,
    });
  });
}

function* sequences(alphabet: string[], max: number): Generator<string[]> {
  const go = function* (prefix: string[]): Generator<string[]> {
    if (prefix.length > 0) yield prefix;
    if (prefix.length === max) return;
    for (const t of alphabet) yield* go([...prefix, t]);
  };
  yield* go([]);
}

function overlaysFor(tokens: string[]): Overlay[][] {
  const out: Overlay[][] = [[]];
  for (let s = 0; s < tokens.length; s++) {
    for (let e = s; e < tokens.length; e++) {
      if (tokens[s] === "|" || tokens[e] === "|") continue;
      for (const kind of ["plain", "reads", "building"] as const) out.push([{ start: s, end: e, kind }]);
    }
  }
  return out;
}

function adjacentPairs(tokens: string[]): Overlay[][] {
  const out: Overlay[][] = [];
  for (let a = 0; a < tokens.length; a++)
    for (let b = a; b < tokens.length; b++)
      for (let c = b + 1; c < tokens.length; c++) {
        if ([a, b, b + 1, c].some((k) => tokens[k] === "|")) continue;
        for (const k1 of ["plain", "reads"] as const)
          for (const k2 of ["plain", "reads"] as const)
            out.push([
              { start: a, end: b, kind: k1 },
              { start: b + 1, end: c, kind: k2 },
            ]);
      }
  return out;
}

const violations: string[] = [];
let checked = 0;

function check(tokens: string[], overlays: Overlay[], density: Density) {
  const events = build(tokens, overlays);
  const layout = layoutPart({ events, tuning: bass5, density });
  const positions = barPositions(events);
  const marks = rhythmMarks(layout.columns, positions, density);
  const cols = layout.columns;
  const tag = () => `${tokens.join(" ")} ${JSON.stringify(overlays)} ${density}`;
  const bad = (msg: string) => violations.length < 40 && violations.push(`${tag()}: ${msg}`);
  checked++;
  if (marks.length !== cols.length) bad("length");

  const posOf = (i: number) => positions.get(`${cols[i].eventId}:${cols[i].repetition}`);
  const levelsOf = (i: number) => (cols[i].kind === "notes" && cols[i].duration ? (LEVELS[cols[i].duration!.id] ?? 0) : 0);
  const beamable = (i: number) =>
    cols[i].kind === "notes" && levelsOf(i) > 0 && !!posOf(i) && !(density === "compact" && cols[i].repeat > 1);
  const left = (i: number) => (marks[i].kind === "note" ? (marks[i] as { left: number }).left : 0);
  const right = (i: number) => (marks[i].kind === "note" ? (marks[i] as { right: number }).right : 0);

  // FR-008, read straight from the events: after an unreadable column in a bar, later columns are never joined.
  let blind = false;
  for (let i = 0; i < cols.length; i++) {
    if (cols[i].kind === "barline") {
      blind = false;
      continue;
    }
    if (blind && (left(i) > 0 || right(i) > 0)) bad(`column ${i} joined after an unreadable column in its bar`);
    if (cols[i].duration === null) blind = true;
  }

  for (let i = 0; i < cols.length; i++) {
    const m = marks[i];
    if (cols[i].kind === "barline" && m.kind !== "none") bad(`barline ${i} draws ${m.kind}`);
    if (cols[i].duration === null && m.kind !== "none") bad(`unset ${i} draws ${m.kind}`);
    if (m.kind === "note") {
      const joined = m.left > 0 || m.right > 0;
      if (m.levels !== levelsOf(i)) bad(`levels ${i}`);
      if (joined && m.flags !== 0) bad(`joined ${i} has flags`);
      if (!joined && m.flags !== m.levels) bad(`lone ${i} flags ${m.flags} != levels ${m.levels}`);
      if (joined && m.stubs !== m.levels - Math.max(m.left, m.right)) bad(`stubs ${i}`);
      if (density === "compact" && cols[i].repeat > 1 && (joined || m.flags !== m.levels)) bad(`INV-019 compact repeat ${i}`);
    }
    if (i + 1 >= cols.length) continue;
    const j = i + 1;
    if (right(i) !== left(j)) bad(`halves ${i}|${j}: ${right(i)} vs ${left(j)}`);
    const joined = right(i) > 0;
    const a = posOf(i);
    const b = posOf(j);
    if (joined) {
      for (const k of [i, j]) {
        if (cols[k].kind !== "notes") bad(`join ${i}|${j} touches a ${cols[k].kind}`);
        if (cols[k].duration === null) bad(`join ${i}|${j} touches an unset/unknown column`);
        if (levelsOf(k) === 0) bad(`join ${i}|${j} touches a ${cols[k].duration?.id}`);
        if (!posOf(k)) bad(`join ${i}|${j} touches an unknown position`);
        if (density === "compact" && cols[k].repeat > 1) bad(`join ${i}|${j} touches a compact repeat`);
      }
      if (cols[i].tupletId !== cols[j].tupletId) bad(`join ${i}|${j} crosses a group edge`);
      if (a && b && !a.countedGroup && Math.floor(a.tick / TICKS_PER_BEAT) !== Math.floor(b.tick / TICKS_PER_BEAT))
        bad(`join ${i}|${j} crosses a beat outside a counted group`);
      if (a && b && a.countedGroup !== b.countedGroup) bad(`join ${i}|${j} crosses counted groups`);
      if (right(i) !== Math.min(levelsOf(i), levelsOf(j))) bad(`join ${i}|${j} level ${right(i)}`);
    }
    const sameUnit =
      beamable(i) &&
      beamable(j) &&
      cols[i].tupletId === cols[j].tupletId &&
      !!a &&
      !!b &&
      (a.countedGroup
        ? a.countedGroup === b.countedGroup
        : !b.countedGroup && Math.floor(a.tick / TICKS_PER_BEAT) === Math.floor(b.tick / TICKS_PER_BEAT));
    if (sameUnit && !joined) bad(`beamable pair ${i}|${j} in one unit left unjoined`);
  }
}

describe("INV-002 / INV-019 over every short sequence and group overlay", () => {
  it("single groups over 13 tokens, up to 3 columns, both densities", () => {
    for (const tokens of sequences(TOKENS, 3))
      for (const overlays of overlaysFor(tokens))
        for (const density of ["expanded", "compact"] as const) check(tokens, overlays, density);
    expect(checked).toBeGreaterThan(50_000);
    expect(violations).toEqual([]);
  }, 60_000);

  it("two adjacent groups over 6 tokens, up to 4 columns, both densities", () => {
    for (const tokens of sequences(SMALL, 4))
      for (const overlays of adjacentPairs(tokens))
        for (const density of ["expanded", "compact"] as const) check(tokens, overlays, density);
    expect(violations).toEqual([]);
  }, 60_000);
});
