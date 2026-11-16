/** INV-018 / review F16: a new attacked voice's gain starts at FLOOR, and no later cancel removes that start. */
import { describe, expect, it } from "vitest";
import { makeVoicing, playVoice } from "@/lib/playback/synth";
import type { Voice } from "@/lib/playback/types";
import { FakeContext } from "./fake-audio";

const picked: Voice = {
  string: 0, midi: 40, attack: "pick", glideFrom: null, glideTicks: 0, vibrato: false, tone: "plain", sustain: "length",
};

describe("a new picked voice starts from FLOOR", () => {
  it("keeps its FLOOR value at `time` after every cancelScheduledValues", () => {
    const ctx = new FakeContext();
    const voicing = makeVoicing(ctx as unknown as BaseAudioContext, ctx.createGain() as unknown as AudioNode);
    const time = 1;
    playVoice(voicing, ctx as unknown as BaseAudioContext, time, 2, picked);
    const calls = ctx.gains[ctx.gains.length - 1].gain.calls;
    let lastCancel = -1;
    calls.forEach((c, i) => {
      if (c.op === "cancel" && c.when <= time) lastCancel = i;
    });
    const start = calls.findIndex((c, i) => i > lastCancel && c.op === "set" && c.when === time && c.value <= 0.001);
    expect(start, "a FLOOR setValueAtTime at `time` after the last cancel").toBeGreaterThan(-1);
    expect(calls[start].value).toBeGreaterThan(0);
  });
});
