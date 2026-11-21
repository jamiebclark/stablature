import { describe, expect, it } from "vitest";
import { readCapped } from "../body";

function counting(chunks: number, size: number) {
  let pulled = 0;
  const stream = new ReadableStream<Uint8Array>(
    {
      pull(c) {
        if (pulled >= chunks) return c.close();
        pulled += 1;
        c.enqueue(new Uint8Array(size));
      },
    },
    { highWaterMark: 0 },
  );
  return { stream, pulled: () => pulled };
}

describe("readCapped", () => {
  it("returns too_large at max + 1 and pulls nothing after the crossing chunk", async () => {
    const { stream, pulled } = counting(50, 1024);
    const result = await readCapped(stream, 10 * 1024 - 1);
    expect(result).toEqual({ ok: false, reason: "too_large" });
    expect(pulled()).toBe(10); // chunk 10 reaches max + 1 (10240 > 10239)
  });

  it("reads exactly max", async () => {
    const { stream } = counting(10, 1024);
    const result = await readCapped(stream, 10 * 1024);
    expect(result.ok && result.bytes.length).toBe(10 * 1024);
  });

  it("is incomplete for a null stream or an erroring one", async () => {
    expect(await readCapped(null, 5)).toEqual({ ok: false, reason: "incomplete" });
    const bad = new ReadableStream<Uint8Array>({ pull: (c) => c.error(new Error("cut")) });
    expect(await readCapped(bad, 5)).toEqual({ ok: false, reason: "incomplete" });
  });
});
