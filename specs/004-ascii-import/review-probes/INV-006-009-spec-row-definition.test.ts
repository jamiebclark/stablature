/**
 * Round 10. Round 9 said the token sweep's filter is T091's own test, so its zero proves nothing
 * about that rule. This filter borrows nothing from S1 to S6. It is spec.md's table, word for word:
 * a staff row is "an optional gutter, an optional string label, a pipe or rails, then a body", and
 * a body here is anything holding a fret or `x`. So it asks only how a line opens.
 *
 * Every line that opens so, over an alphabet of the notation, is set in each layout. A line ignored
 * while the paste reads is a dropped row unless it is named below. The test fails on any line
 * outside the declared edge, and prints the count by shape so the edge can be seen and judged.
 *
 * The declared edge is NOTE F62: a rail standing apart from any note, as `- 5 - 7 -` and T091's
 * `x2 -`, and a word of two letters or more with no rail at its other end. MINOR F80 is apart: a
 * word, then a pipe that touches no rail or bare note, is counted here and failed in
 * INV-009-pipe-touching-a-wrapped-cell.test.ts, so this sweep still fails on anything new.
 *
 * SPEC_LONGEST sets the exhaustive depth, and the review ran 6.
 */
import { describe, expect, it } from "vitest";
import { readTab } from "@/lib/tab/reading";
import { presetById } from "@/lib/tunings";

const context = { tuning: presetById("bass4-e")!, bandTunings: [], songEvents: [] };
const LONGEST = Number(process.env.SPEC_LONGEST ?? 5);
const BODY = [..."-|5x()<> t"];
const LABELS = ["", "G", "G ", "G:", "G: ", "Gb", "E1 ", "Bass ", "Gtr:", "Guitar"];
const GOOD = ["---5---7---", "-----------", "-----------", "---9-------"].join("\n");

const FRET = /\d|(?<!\p{L})[xX](?!\p{L})/u;
const opensOnRail = (body: string) => /^[-|]/.test(body);

function* bodies(length: number, prefix = ""): Generator<string> {
  if (prefix.length === length) {
    yield prefix;
    return;
  }
  for (const c of BODY) yield* bodies(length, prefix + c);
}

/** What separates a rail from every note on the line, which is the edge T091 and NOTE F62 declare. */
const railsStandApart = (line: string) =>
  line.split(/\s+/).every((run) => !(/[-|]/.test(run) && /[\dxX]/.test(run)));

/** Plan deviation 8 and NOTE F62: a non-note word needs a pipe, or a rail at the line's far end, so a line with a pipe on it is not on this edge. */
const wordNoRim = (line: string) =>
  !/[-|]$/.test(line) &&
  !line.includes("|") &&
  [...line.matchAll(/(?<![\p{L}\p{N}])\p{L}{2,}(?![\p{L}\p{N}])/gu)].some((m) => !/^[A-Ga-g][#b]{0,2}$/.test(m[0]));

/** MINOR F80: a non-note word and a pipe, where the pipe touches a wrapper and no rail or bare note. */
const pipeOnACell = (line: string) =>
  line.includes("|") &&
  !/[-|]$/.test(line) &&
  !/\|[-0-9xX]|[-0-9xX]\|/.test(line) &&
  [...line.matchAll(/\p{L}{2,}/gu)].some((m) => !/^[A-Ga-g][#b]{0,2}$/.test(m[0]));

const shape = (line: string) => line.replace(/\d+/g, "5").replace(/-+/g, "-").replace(/ +/g, " ");

const LAYOUTS: [string, (line: string) => string][] = [
  ["alone between two systems", (l) => `${GOOD}\n\n${l}\n\n${GOOD}`],
  ["four deep", (l) => `${[l, l, l, l].join("\n")}\n\n${GOOD}`],
  ["over three rails-only rows", (l) => {
    const rails = "-".repeat(Math.max(l.length, 3));
    return `${l}\n${rails}\n${rails}\n${rails}\n\n${GOOD}`;
  }],
  ["under three rails-only rows", (l) => {
    const rails = "-".repeat(Math.max(l.length, 3));
    return `${rails}\n${rails}\n${rails}\n${l}\n\n${GOOD}`;
  }],
];

function sweep(layout: (line: string) => string) {
  const edge = new Map<string, number>();
  const lost = new Set<string>();
  const f80 = new Set<string>();
  let tried = 0;
  for (let length = 1; length <= LONGEST; length += 1) {
    for (const body of bodies(length)) {
      if (!opensOnRail(body) || !FRET.test(body)) continue;
      for (const label of LABELS) {
        const line = `${label}${body}`.trimEnd();
        tried += 1;
        const reading = readTab(layout(line), context);
        if (reading.kind !== "ready") continue;
        if (!reading.ignored.some((l) => l.text.trim() === line.trim())) continue;
        if (railsStandApart(line) || wordNoRim(line)) edge.set(shape(line), (edge.get(shape(line)) ?? 0) + 1);
        else if (pipeOnACell(line)) f80.add(line);
        else lost.add(line);
      }
    }
  }
  return { tried, lost: [...lost], f80: [...f80], edge };
}

describe("INV-006 INV-009 every line the spec's own table calls a staff row", () => {
  it.each(LAYOUTS)("%s", (name, layout) => {
    const r = sweep(layout);
    const top = [...r.edge.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
    process.stderr.write(
      `${name}: ${r.tried} lines, ${r.lost.length} lost, ${r.f80.length} on F80, ${[...r.edge.values()].reduce((a, b) => a + b, 0)} on the declared edge in ${r.edge.size} shapes, as ${top.map(([s]) => JSON.stringify(s)).join(" ")}\n` +
        (r.lost.length ? `  lost: ${r.lost.slice(0, 24).map((l) => JSON.stringify(l)).join(" ")}\n` : ""),
    );
    expect(r.tried).toBeGreaterThan(500);
    expect(r.lost.slice(0, 12)).toEqual([]);
  });
});
