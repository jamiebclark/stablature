import { describe, expect, it } from "vitest";
import { layoutPart } from "../layout";
import { barline, bass5, ev, space } from "./helpers";

const E = 3;
const cols = (events: ReturnType<typeof ev>[], density: "expanded" | "compact" = "expanded") =>
  layoutPart({ events, tuning: bass5, density }).columns;

describe("plain parts", () => {
  it("have no connectors and keep today's descriptions", () => {
    const columns = cols([ev({ [E]: 7 }), ev({ [E]: 5, 1: 3 }), space(), barline()]);
    for (const c of columns) expect(c.connectors.every((x) => x === null)).toBe(true);
    expect(columns.map((c) => c.description)).toEqual([
      "string 4 fret 7",
      "string 2 fret 3, string 4 fret 5",
      "Empty column",
      "Barline",
    ]);
  });
});

describe("descriptions", () => {
  it("name techniques in words, never affix characters", () => {
    const d = (events: ReturnType<typeof ev>[], density?: "expanded" | "compact") =>
      cols(events, density).map((c) => c.description);
    expect(d([ev({ [E]: 5 }), ev({ [E]: 7 }, { [E]: ["vibrato", "hammer_on"] })])[1]).toBe(
      "string 4 fret 7 with hammer-on and vibrato",
    );
    expect(d([ev({ [E]: 7 }, { [E]: ["vibrato"] }, { repeat: 3 })], "compact")[0]).toBe(
      "string 4 fret 7 with vibrato, repeated 3 times",
    );
    // a transition with no source is not named
    expect(d([ev({ [E]: 7 }, { [E]: ["hammer_on"] })])[0]).toBe("string 4 fret 7");
    // a dead note
    expect(d([ev({ [E]: "x" }, { [E]: ["palm_mute"] })])[0]).toBe(
      "string 4 fret x with palm mute",
    );
    const all = d([
      ev(
        { [E]: 7 },
        { [E]: ["tap", "let_ring", "harmonic", "bend", "vibrato", "palm_mute"] },
      ),
    ])[0];
    expect(all).not.toMatch(/[~<>()]/);
    expect(all).toBe(
      "string 4 fret 7 with tap, let ring, harmonic, bend, vibrato and palm mute",
    );
  });
});
