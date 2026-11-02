import { describe, expect, it } from "vitest";
import {
  compareHlc,
  decodeHlc,
  encodeHlc,
  HlcClock,
  MAX_COUNTER,
  maxHlc,
  randomNodeId,
  ZERO_HLC,
} from "../hlc";

describe("encoding", () => {
  it("round-trips", () => {
    const parts = { wallMs: 1762051200000, counter: 42, nodeId: "k3f9a1b2c7de" };
    expect(decodeHlc(encodeHlc(parts))).toEqual(parts);
  });

  it("pads to a fixed width so string order is numeric order", () => {
    const small = encodeHlc({ wallMs: 5, counter: 0, nodeId: "a" });
    const large = encodeHlc({ wallMs: 100, counter: 0, nodeId: "a" });
    // The whole design rests on this: naive string compare must agree with time.
    expect(small < large).toBe(true);
  });

  it("orders by counter within a millisecond", () => {
    const first = encodeHlc({ wallMs: 1000, counter: 9, nodeId: "a" });
    const second = encodeHlc({ wallMs: 1000, counter: 16, nodeId: "a" });
    // 16 is 0x10, so a decimal encoding would sort it before 9. Hex padding fixes it.
    expect(first < second).toBe(true);
  });

  it("sorts ZERO_HLC below any real timestamp", () => {
    expect(ZERO_HLC < encodeHlc({ wallMs: 1, counter: 0, nodeId: "a" })).toBe(true);
  });

  it("rejects values that would corrupt ordering or parsing", () => {
    expect(() => encodeHlc({ wallMs: -1, counter: 0, nodeId: "a" })).toThrow(RangeError);
    expect(() => encodeHlc({ wallMs: 0, counter: MAX_COUNTER + 1, nodeId: "a" })).toThrow(RangeError);
    expect(() => encodeHlc({ wallMs: 0, counter: 0, nodeId: "has:colon" })).toThrow(RangeError);
    expect(() => encodeHlc({ wallMs: 0, counter: 0, nodeId: "" })).toThrow(RangeError);
    expect(() => decodeHlc("nonsense")).toThrow(SyntaxError);
    expect(() => decodeHlc("123:0:a")).toThrow(SyntaxError);
  });

  it("generates node ids that are legal to encode", () => {
    for (let i = 0; i < 50; i += 1) {
      expect(() => encodeHlc({ wallMs: 0, counter: 0, nodeId: randomNodeId() })).not.toThrow();
    }
  });
});

describe("comparison", () => {
  it("compares and maxes", () => {
    const a = encodeHlc({ wallMs: 1000, counter: 0, nodeId: "a" });
    const b = encodeHlc({ wallMs: 2000, counter: 0, nodeId: "a" });
    expect(compareHlc(a, b)).toBe(-1);
    expect(compareHlc(b, a)).toBe(1);
    expect(compareHlc(a, a)).toBe(0);
    expect(maxHlc(a, b)).toBe(b);
    expect(maxHlc(b, a)).toBe(b);
  });
});

describe("HlcClock", () => {
  it("is strictly increasing when the clock is frozen", () => {
    const clock = new HlcClock("node1", () => 1000);
    const stamps = Array.from({ length: 5 }, () => clock.send());
    expect(stamps).toEqual([...stamps].sort());
    expect(new Set(stamps).size).toBe(5);
  });

  it("is strictly increasing even when the physical clock runs backwards", () => {
    // NTP corrections and phones waking from sleep both do this. A device
    // whose clock jumps back must not be able to mint a timestamp that loses
    // merges against its own earlier writes.
    let now = 5000;
    const clock = new HlcClock("node1", () => now);
    const before = clock.send();
    now = 1000;
    const after = clock.send();
    expect(after > before).toBe(true);
  });

  it("advances past a remote timestamp from the future", () => {
    const clock = new HlcClock("local", () => 1000);
    const local = clock.send();
    const remote = encodeHlc({ wallMs: 9_000_000, counter: 3, nodeId: "remote" });

    const merged = clock.recv(remote);
    expect(merged > remote).toBe(true);
    expect(merged > local).toBe(true);

    // And the next purely-local write still beats everything we have seen.
    expect(clock.send() > merged).toBe(true);
  });

  it("breaks same-millisecond ties against a remote counter", () => {
    const clock = new HlcClock("local", () => 1000);
    clock.send();
    const remote = encodeHlc({ wallMs: 1000, counter: 5, nodeId: "remote" });
    expect(decodeHlc(clock.recv(remote)).counter).toBe(6);
  });

  it("resets the counter once physical time moves on", () => {
    let now = 1000;
    const clock = new HlcClock("node1", () => now);
    clock.send();
    clock.send();
    now = 2000;
    expect(decodeHlc(clock.send()).counter).toBe(0);
  });

  it("refuses to silently wrap on counter overflow", () => {
    const clock = new HlcClock("node1", () => 1000);
    expect(() => {
      for (let i = 0; i <= MAX_COUNTER + 1; i += 1) clock.send();
    }).toThrow(/counter overflow/);
  });

  it("rejects an illegal node id at construction", () => {
    expect(() => new HlcClock("has:colon")).toThrow(RangeError);
  });
});
