/**
 * INV-021 / FR-031 / FR-032: the notation table; n = 2 to 20 x {one-digit, two-digit, mixed} x 2
 * densities; `,-, ,-,`; showTuplets false; plain beside counted; a one-column remnant.
 * INV-023 / FR-033: repeat: 8 at first, middle, last x {counted, plain} x 2 densities; a repeat
 * changed after grouping, up and down; a connector inside the span. All through real writes.
 */
import "fake-indexeddb/auto";

import { describe, expect, it } from "vitest";
import { deleteColumn, groupSelection, insertNote, setColumnRepeat } from "@/lib/local/editing";
import { patchRow } from "@/lib/local/mutate";
import type { EventRow, GroupKind } from "@/lib/model";
import { toAscii } from "@/lib/tab/ascii";
import type { Density } from "@/lib/tab/layout";
import { bass5, build, rows, world, type World } from "./unit-helpers";

const bracket = (events: readonly EventRow[], density: Density = "expanded") => {
  const lines = toAscii({ events, tuning: bass5, density }).split("\n");
  const gutter = lines.at(-1)!.indexOf("|") + 1;
  return lines[0].slice(gutter);
};

async function grouped(
  w: World,
  n: number,
  kind: GroupKind,
  fret: (i: number) => number = () => 5,
) {
  const all = await build(w, "n".repeat(n));
  for (const [i, r] of all.entries()) {
    await patchRow("events", r.id, { frets: { "3": fret(i) } }, w.ctx);
  }
  await groupSelection(w.part.id, all[0].id, all.at(-1)!.id, kind, w.ctx);
  return rows(w);
}

describe("INV-021", () => {
  for (const [n, counted, plain] of [
    [2, ",2,", ",-,"],
    [3, ",-3-,", ",---,"],
    [4, ",--4--,", ",-----,"],
  ] as const) {
    it(`the table: ${n} columns`, async () => {
      expect(bracket(await grouped(await world(), n, "tuplet")).trim()).toBe(counted);
      expect(bracket(await grouped(await world(), n, "plain")).trim()).toBe(plain);
    });
  }

  const FRETS = {
    "one-digit": (i: number) => (i % 9) + 1,
    "two-digit": (i: number) => 10 + (i % 9),
    mixed: (i: number) => (i % 2 ? 12 : 3),
  };
  for (const [name, fret] of Object.entries(FRETS)) {
    for (const density of ["expanded", "compact"] as const) {
      it(`n = 2 to 20, ${name}, ${density}: rails where the digits were`, async () => {
        for (let n = 2; n <= 20; n++) {
          const plain = bracket(await grouped(await world(), n, "plain", fret), density);
          expect(plain.trim()).toMatch(/^,-+,$/);
          // A count above 16 is never written, so 17 to 20 have no counted twin to compare.
          if (n > 16) continue;
          const counted = bracket(await grouped(await world(), n, "tuplet", fret), density);
          expect(plain).toBe(counted.replace(/\d/g, "-"));
        }
      });
    }
  }

  it("adjacent plain pairs read ,-, ,-,", async () => {
    const w = await world();
    const all = await build(w, "nnnn");
    await groupSelection(w.part.id, all[0].id, all[1].id, "plain", w.ctx);
    await groupSelection(w.part.id, all[2].id, all[3].id, "plain", w.ctx);
    expect(bracket(await rows(w)).trim()).toBe(",-, ,-,");
  });
  it("showTuplets false hides both", async () => {
    const w = await world();
    const all = await build(w, "nnnn");
    await groupSelection(w.part.id, all[0].id, all[1].id, "plain", w.ctx);
    await groupSelection(w.part.id, all[2].id, all[3].id, "tuplet", w.ctx);
    const text = toAscii({ events: await rows(w), tuning: bass5, showTuplets: false });
    expect(text).not.toContain(",");
    expect(text.split("\n")).toHaveLength(bass5.strings.length);
  });
  it("plain beside counted", async () => {
    const w = await world();
    const all = await build(w, "nnnnn");
    await groupSelection(w.part.id, all[0].id, all[1].id, "plain", w.ctx);
    await groupSelection(w.part.id, all[2].id, all[4].id, "tuplet", w.ctx);
    expect(bracket(await rows(w)).trim()).toBe(",-, ,-3-,");
  });
  it("a one-column remnant, left by a later delete", async () => {
    const w = await world();
    const all = await build(w, "nn");
    await groupSelection(w.part.id, all[0].id, all[1].id, "plain", w.ctx);
    await deleteColumn(all[1].id, w.ctx);
    expect(bracket(await rows(w)).trim()).toBe(",");
  });
});

describe("INV-023", () => {
  for (const at of [0, 1, 2]) {
    for (const kind of ["tuplet", "plain"] as const) {
      for (const density of ["expanded", "compact"] as const) {
        it(`repeat: 8 at ${at}, ${kind}, ${density}`, async () => {
          const w = await world();
          const all = await build(w, "nnn");
          await setColumnRepeat(all[at].id, 8, w.ctx);
          await groupSelection(w.part.id, all[0].id, all[2].id, kind, w.ctx);
          const text = bracket(await rows(w), density).trim();
          expect(text).toMatch(/^,[-\d]+,$/);
          if (kind === "tuplet") expect(text.match(/\d+/g)).toEqual(["3"]);
          else expect(text).not.toMatch(/\d/);
          if (at === 1 && kind === "tuplet") {
            expect(text).toBe(density === "expanded" ? ",--------3--------," : ",--3--,");
          }
        });
      }
    }
  }

  it("a repeat changed after grouping, up and down: the number stays, the bracket stretches", async () => {
    const w = await world();
    const all = await build(w, "nnn");
    await groupSelection(w.part.id, all[0].id, all[2].id, "tuplet", w.ctx);
    await setColumnRepeat(all[1].id, 8, w.ctx);
    expect(bracket(await rows(w)).trim()).toBe(",--------3--------,");
    await setColumnRepeat(all[1].id, 1, w.ctx);
    expect(bracket(await rows(w)).trim()).toBe(",-3-,");
  });

  for (const kind of ["tuplet", "plain"] as const) {
    it(`a connector inside the span, ${kind}`, async () => {
      const w = await world();
      const a = await insertNote(w.part, [], null, 3, 5, w.ctx);
      const b = await insertNote(w.part, [a], a.id, 3, 7, w.ctx);
      await patchRow("events", b.id, { techniques: { "3": ["hammer_on"] } }, w.ctx);
      await groupSelection(w.part.id, a.id, b.id, kind, w.ctx);
      const after = await rows(w);
      const text = toAscii({ events: after, tuning: bass5 });
      expect(text).toContain("5h7");
      const row = bracket(after).trim();
      // One unbroken bracket over `5h7`, plus the padding each column carries.
      expect(row).toMatch(/^,[-\d]+,$/);
      expect(row.length).toBeGreaterThanOrEqual(3);
      const staff = text.split("\n").find((l) => l.includes("5h7"))!;
      const gutter = staff.indexOf("|") + 1;
      const bracketLine = text.split("\n")[0];
      const from = bracketLine.indexOf(",");
      const to = bracketLine.lastIndexOf(",");
      const seven = staff.indexOf("7", gutter);
      expect(from).toBeLessThanOrEqual(staff.indexOf("5", gutter));
      expect(to).toBeGreaterThanOrEqual(seven);
    });
  }
});
