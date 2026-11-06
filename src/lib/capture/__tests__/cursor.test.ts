import { describe, expect, it } from "vitest";
import type { EventRow } from "@/lib/model";
import { cursorBar, cursorStep } from "../cursor";

const col = (id: string, kind: EventRow["kind"] = "notes") => ({ id, kind }) as EventRow;
const columns = [col("a"), col("b"), col("bar1", "barline"), col("c"), col("d")];

describe("cursorStep", () => {
  it("steps by stored column", () => {
    expect(cursorStep(columns, "a", 1)).toBe("b");
    expect(cursorStep(columns, "b", -1)).toBe("a");
  });
  it("back from the first gives null, on from the last gives end", () => {
    expect(cursorStep(columns, "a", -1)).toBeNull();
    expect(cursorStep(columns, "d", 1)).toBe("end");
  });
  it("end steps back to the previous column; null steps on to the first", () => {
    expect(cursorStep(columns, "end", -1)).toBe("c");
    expect(cursorStep(columns, null, 1)).toBe("a");
    expect(cursorStep(columns, null, -1)).toBeNull();
  });
});

describe("cursorBar", () => {
  it("goes to the first column of the bar", () => {
    expect(cursorBar(columns, "a", 1)).toBe("c");
    expect(cursorBar(columns, "d", -1)).toBe("c");
    expect(cursorBar(columns, "c", -1)).toBe("a");
  });
  it("stops at the ends the way a column step does", () => {
    expect(cursorBar(columns, "b", -1)).toBe("a");
    expect(cursorBar(columns, "a", -1)).toBeNull();
    expect(cursorBar(columns, "d", 1)).toBe("end");
  });
});
