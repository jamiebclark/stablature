import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { TICKS_PER_BEAT } from "../durations";
import { EMPTY_SCORE, readNotation, type Score, type StreamClick } from "../notation";
import { bar, ev, pass } from "./notation-helpers";
import { COUNT_IN_CLICKS, clickStream } from "../stream";

const take = (n: number, follow: boolean, score: Score = EMPTY_SCORE) => {
  const it = clickStream(score, follow);
  return Array.from({ length: n }, () => it.next().value as StreamClick);
};

describe("clickStream, plain", () => {
  it("counts in 1 to 4 then plays plain beats with no gap", () => {
    const clicks = take(8, true);
    clicks.forEach((c, i) => expect(c.tick).toBe(i * TICKS_PER_BEAT));
    expect(clicks.slice(0, 4).map((c) => [c.level, c.phase, c.count])).toEqual(
      [1, 2, 3, 4].map((n) => ["beat", "count-in", n]),
    );
    expect(clicks.slice(4).every((c) => c.phase === "plain" && c.count === null && c.level === "beat")).toBe(true);
  });

  it("never goes backwards in phase, and runs past the end", () => {
    const order = { "count-in": 0, following: 1, plain: 2 };
    const clicks = take(1000, false);
    for (let i = 1; i < clicks.length; i++) {
      expect(order[clicks[i].phase]).toBeGreaterThanOrEqual(order[clicks[i - 1].phase]);
      expect(clicks[i].tick - clicks[i - 1].tick).toBe(TICKS_PER_BEAT);
    }
  });

  it("keeps the count-in length in one named constant", () => {
    expect(COUNT_IN_CLICKS).toBe(4);
    for (const file of ["notation.ts", "stream.ts"]) {
      const src = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
      const literal = src.split("\n").filter((l) => !/^\s*(\/\/|\/?\*)/.test(l) &&/\b4\b/.test(l));
      expect(literal.filter((l) => !l.includes("COUNT_IN_CLICKS = 4"))).toEqual([]);
    }
  });

  it("follows a score and carries on from where it ended", () => {
    const score: Score = {
      clicks: [
        { tick: 0, level: "accent" },
        { tick: TICKS_PER_BEAT, level: "beat" },
      ],
      lengthTicks: 3 * TICKS_PER_BEAT,
      timedFromStart: true,
    };
    const clicks = take(8, true, score);
    expect(clicks[4]).toMatchObject({ phase: "following", level: "accent", tick: 4 * TICKS_PER_BEAT });
    expect(clicks[6]).toMatchObject({ phase: "plain", tick: 7 * TICKS_PER_BEAT });
  });
});

describe("clickStream, notated", () => {
  const q = (n: number) => Array.from({ length: n }, () => ev({}));
  const run = (events: ReturnType<typeof q>, count: number) => {
    const score = readNotation([pass(events)]);
    return { score, clicks: take(count, true, score) };
  };

  it("falls to plain after a gap in bar 1, 2 or 4", () => {
    for (const gapBar of [1, 2, 4]) {
      const events = [];
      for (let b = 1; b <= 4; b++) {
        if (b > 1) events.push(bar());
        events.push(...(b === gapBar ? [ev({ durationHint: null })] : q(4)));
      }
      const { score, clicks } = run(events, 4 + (gapBar - 1) * 4 + 2);
      expect(score.timedFromStart).toBe(gapBar > 1);
      expect(clicks[clicks.length - 1].phase).toBe("plain");
      expect(clicks[clicks.length - 1].tick).toBe((4 + (gapBar - 1) * 4 + 1) * TICKS_PER_BEAT);
    }
  });

  it("carries on plain from the score's end when it ends off the beat", () => {
    const { score, clicks } = run([ev({ durationHint: "8" }), ev({ durationHint: "8" }), ev({ durationHint: "8" })], 9);
    const first = clicks.find((c) => c.phase === "plain")!;
    expect(first.tick).toBe(4 * TICKS_PER_BEAT + score.lengthTicks);
    expect(first.level).toBe("beat");
  });

  it("plays plain after the end of the arrangement, and a notated part after an unnotated one stays plain", () => {
    const score = readNotation([pass([ev({ durationHint: null })]), pass(q(4))]);
    expect(score.timedFromStart).toBe(false);
    expect(take(6, true, score)[5].phase).toBe("plain");
  });

  it("fall-to-plain fixture", () => {
    const events = [...q(4), bar(), ...q(4), bar(), ...q(4), bar(), ev({ durationHint: null })];
    const { score, clicks } = run(events, 4 + 12 + 1);
    expect(score.lengthTicks).toBe(12 * TICKS_PER_BEAT);
    expect(clicks[clicks.length - 2]).toMatchObject({ phase: "following", tick: 15 * TICKS_PER_BEAT });
    expect(clicks[clicks.length - 1]).toMatchObject({ phase: "plain", level: "beat", tick: 16 * TICKS_PER_BEAT });
  });
});
