import { describe, expect, it } from "vitest";
import { encodeHlc, type Hlc } from "../../hlc";
import type { MemoRow } from "../../model";
import { applyPatch, mergeRow, stampNewRow } from "../merge";

const at = (ms: number, node = "a"): Hlc => encodeHlc({ wallMs: ms, counter: 0, nodeId: node });

const base: MemoRow = stampNewRow(
  "memos",
  {
    id: "00000000-0000-7000-8000-000000000001",
    bandId: "00000000-0000-7000-8000-0000000000bb",
    partId: "00000000-0000-7000-8000-0000000000aa",
    recordedById: null,
    recordedByName: null,
    durationMs: 5000,
    format: "audio/webm;codecs=opus",
    size: 1234,
    recordedAt: 1,
    label: null,
    deletedAt: null,
  },
  at(1),
);

const e1 = applyPatch("memos", base, { label: "Chorus feel" }, at(5, "a"));
const e2 = applyPatch("memos", base, { label: "Slower" }, at(6, "b"));
const e3 = applyPatch("memos", base, { deletedAt: at(7, "c") }, at(7, "c"));
const e4: MemoRow = { ...base, recordedById: "u1", recordedByName: "Sam", serverSeq: 9 };
const edits = [e1, e2, e3, e4];

function permutations<T>(items: T[]): T[][] {
  if (items.length <= 1) return [items];
  return items.flatMap((item, i) =>
    permutations([...items.slice(0, i), ...items.slice(i + 1)]).map((rest) => [item, ...rest]),
  );
}

const fold = (list: MemoRow[]) => list.reduce((acc, e) => mergeRow("memos", acc, e), base);

describe("memo merge (INV-005)", () => {
  it("M1/M4: all 24 orderings converge, and the server's stamp survives", () => {
    const orders = permutations(edits);
    expect(orders).toHaveLength(24);
    const results = orders.map(fold);
    for (const r of results) {
      expect(r).toEqual(results[0]);
      expect(r.recordedById).toBe("u1");
      expect(r.recordedByName).toBe("Sam");
    }
    expect(results[0].label).toBe("Slower");
    expect(results[0].deletedAt).toBe(at(7, "c"));
  });

  it("M2: folding any edit twice equals folding it once", () => {
    for (const e of edits) expect(fold([e, e])).toEqual(fold([e]));
  });

  it("M3: pairwise commutativity over the 12 ordered pairs", () => {
    let pairs = 0;
    for (const x of edits) {
      for (const y of edits) {
        if (x === y) continue;
        pairs += 1;
        expect(fold([x, y])).toEqual(fold([y, x]));
      }
    }
    expect(pairs).toBe(12);
  });

  it("M5: a patch cannot write the stamp", () => {
    expect(() => applyPatch("memos", base, { recordedById: "x" } as never, at(9))).toThrow();
  });

  it("a device that left the stamp null never overwrites the server's", () => {
    expect(mergeRow("memos", e4, { ...base }).recordedById).toBe("u1");
  });
});
