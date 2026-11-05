/**
 * Round 5. INV-006 through the real write: `readTab`, then `importTab`, then the stored frets, the
 * plan's own probe. A five-row paste on a four-string song, its top or bottom row made of wrapped
 * cells joined by a character the spec's refused list names. Story 4 scenario 10: "no outcome loses
 * a row: it imports whole, or it is refused".
 *
 * The `reading` must be `refused`. The second test records the damage if it is not: what a person
 * gets is every note one string up, and the top row's frets nowhere.
 */
import { describe, expect, it } from "vitest";
import { eventsOf, imported, reading, world } from "./unit-helpers";

const REST = ["---5---7---", "---5---7---", "---3---5---", "---3---5---"];
const TIDY = ["G|---5---|", "D|---5---|", "A|---3---|", "E|---3---|"];

const PASTES: [string, string[]][] = [
  ["`s` between let-ring notes, above", ["-(5)s(7)-", ...REST]],
  ["`r` between let-ring notes, above", ["-(5)r(7)-", ...REST]],
  ["`^` between let-ring notes, above", ["-(5)^(7)-", ...REST]],
  ["a space between let-ring notes, above", ["-(5) (7)-", ...REST]],
  ["a label, then let-ring notes, above", ["C (5)-(7)-", ...TIDY]],
  ["a label flush on let-ring notes, above", ["C(5)-(7)-", ...TIDY]],
  ["a label, then tapped and bent notes, above", ["C t5b-t7b-", ...TIDY]],
  ["`s` between let-ring notes, below", [...REST, "-(5)s(7)-"]],
  ["a low B row of let-ring notes, below", [...TIDY, "B (5)-(7)-"]],
];

describe("INV-006 one row more than the song has strings, through the real write", () => {
  it.each(PASTES)("%s is refused", async (_name, lines) => {
    const w = await world("bass4-e");
    expect((await reading(w, lines.join("\n"))).kind).toBe("refused");
  });

  it("what is stored when it is not", async () => {
    const w = await world("bass4-e");
    const text = ["-(5)s(7)-", ...REST].join("\n");
    const r = await reading(w, text);
    if (r.kind !== "ready") return;
    const { part } = await imported(w, text);
    const frets = (await eventsOf(w, part.id)).map((e) => e.frets);
    console.log("stored:", JSON.stringify(frets), "ignored:", JSON.stringify(r.ignored));
    // Line 2 of the paste is the second string, so nothing it holds belongs on key 0.
    expect(frets.filter((f) => "0" in f)).toEqual([]);
  });
});
