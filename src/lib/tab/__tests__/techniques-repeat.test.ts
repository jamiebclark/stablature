import { describe, expect, it } from "vitest";
import { TRANSITIONS, DECORATIONS } from "../techniques";
import { allRows, bass5, ev, rowOf } from "./helpers";
import { toAscii } from "../ascii";
import type { Density } from "../layout";

const E = 3;

describe("techniques on repeated columns", () => {
  it("draws the exact strings", () => {
    const h = { [E]: ["hammer_on"] };
    const src = () => ev({ [E]: 5 });
    expect(rowOf([src(), ev({ [E]: 7 }, h, { repeat: 3 })], E)).toBe("-5h7h7h7-");
    expect(rowOf([src(), ev({ [E]: 7 }, h, { repeat: 3 })], E, "compact")).toBe("-5h7x3-");
    expect(rowOf([ev({ [E]: 7 }, { [E]: ["vibrato"] }, { repeat: 3 })], E)).toBe("-7~-7~-7~-");
    expect(rowOf([ev({ [E]: 7 }, { [E]: ["vibrato"] }, { repeat: 3 })], E, "compact")).toBe(
      "-7~x3-",
    );
    expect(rowOf([ev({ [E]: 7 }, h, { repeat: 3 })], E)).toBe("-7h7h7-");
    expect(rowOf([ev({ [E]: 7 }, h, { repeat: 3 })], E, "compact")).toBe("-7x3-");
    expect(rowOf([ev({ [E]: 7 }, { [E]: ["harmonic"] }, { repeat: 2 })], E)).toBe("-<7>-<7>-");
    expect(rowOf([ev({ [E]: 7 }, { [E]: ["harmonic"] }, { repeat: 2 })], E, "compact")).toBe(
      "-<7>x2-",
    );
  });

  it("keeps rows aligned for 10 techniques x 2 densities x repeat 1/3 x source/first", () => {
    for (const id of [...TRANSITIONS.map((t) => t.id), ...DECORATIONS.map((d) => d.id)]) {
      for (const density of ["expanded", "compact"] as Density[]) {
        for (const repeat of [1, 3]) {
          for (const source of [true, false]) {
            const events = [
              ...(source ? [ev({ [E]: 5 })] : []),
              ev({ [E]: 7 }, { [E]: [id] }, { repeat }),
            ];
            const rows = allRows(events, density);
            expect(new Set(rows.map((r) => r.length)).size).toBe(1);
          }
        }
      }
    }
  });

  it("draws a chord symbol on the first repetition only while techniques draw on all", () => {
    const event = ev({ [E]: 7 }, { [E]: ["vibrato"] }, { repeat: 3 });
    const text = toAscii({
      events: [event],
      tuning: bass5,
      annotations: [
        {
          id: "a",
          bandId: "band",
          partId: "part",
          anchorEventId: event.id,
          kind: "chord",
          value: "Em",
          updatedAt: "x",
          deletedAt: null,
          fieldClocks: {},
          serverSeq: 0,
        },
      ],
    });
    const lines = text.split("\n");
    expect(lines[0].match(/Em/g)).toHaveLength(1);
    expect(lines[lines.length - 2]).toContain("7~-7~-7~");
  });
});
