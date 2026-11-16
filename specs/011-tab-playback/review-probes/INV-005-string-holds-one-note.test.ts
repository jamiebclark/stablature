/**
 * INV-005 / FR-011 / the let_ring row, through the real chain: `playTimeline` decides the voices, `playVoice` (the
 * synth the port calls) turns them into nodes on a recording context. A string holds one note at a time: whatever
 * plays next on a string ends a let-ring (or harmonic) note on that string, and a note on ANOTHER string does not.
 *
 * Enumerated over: the ringing kinds {let_ring, harmonic} x what plays next on the SAME string {picked fret, hammer-on,
 * slide, x, x + palm_mute, dead_note} plus the control "a fret on another string".
 * A ringing source counts as ended when its last stop() is no later than 60 ms after the next note's start.
 */
import { describe, expect, it } from "vitest";
import { playTimeline } from "@/lib/playback/timeline";
import { makeVoicing, playVoice } from "@/lib/playback/synth";
import { passesOf } from "@/lib/playback/__tests__/fixtures";
import { TICKS_PER_BEAT } from "@/lib/rhythm/durations";
import { presetById } from "@/lib/tunings";
import { FakeContext, type FakeSource } from "./fake-audio";

const bass = presetById("bass4-e")!;
const SECONDS_PER_BEAT = 0.5; // 120 bpm
const at = (tick: number) => 1 + (tick / TICKS_PER_BEAT) * SECONDS_PER_BEAT;

function play(text: string) {
  const ctx = new FakeContext();
  const voicing = makeVoicing(ctx as unknown as BaseAudioContext, ctx.createGain() as unknown as AudioNode);
  const t = playTimeline(passesOf([text]), bass);
  const made: { tick: number; sources: FakeSource[] }[] = [];
  for (const v of t.voices) {
    const before = ctx.oscillators.length + ctx.buffers.length;
    playVoice(voicing, ctx as unknown as BaseAudioContext, at(v.tick), at(v.endTick), v.voice);
    made.push({ tick: v.tick, sources: [...ctx.oscillators, ...ctx.buffers].slice(before) });
  }
  return { ctx, t, made };
}

const RINGING = { let_ring: "3:5[let_ring]", harmonic: "3:12[harmonic]" } as const;
const NEXT_SAME = {
  "picked fret": "3:7",
  "hammer-on": "3:7[hammer_on]",
  slide: "3:7[slide_up]",
  x: "3:x",
  "x + palm_mute": "3:x[palm_mute]",
  dead_note: "3:7[dead_note]",
} as const;

describe("INV-005 a string holds one note: what plays next on it ends a ringing note", () => {
  for (const [ringName, ring] of Object.entries(RINGING)) {
    for (const [nextName, next] of Object.entries(NEXT_SAME)) {
      it(`${ringName} then ${nextName} on the same string`, () => {
        const { t, made } = play(`${ring} ${next} 0:2 0:2 0:2`);
        const ringOsc = made[0].sources.find((s) => s.kind === "osc")!;
        expect(ringOsc, "the ringing note made an oscillator").toBeDefined();
        const nextStart = at(t.hits[1].tick);
        // Legato and slides move the ringing oscillator itself (no new source): then it is one note, and it must
        // end when its new length ends, not ring on for seconds.
        const connected = made[1].sources.filter((s) => s.kind === "osc").length === 0 && t.voices[1].voice.tone !== "dead";
        const limit = connected ? at(t.voices[1].endTick) + 0.06 : nextStart + 0.06;
        expect(
          ringOsc.stopAt,
          `${ringName} source stops at ${ringOsc.stopAt.toFixed(3)} s; the next note on its string starts at ${nextStart} s`,
        ).toBeLessThanOrEqual(limit);
      });
    }
    it(`${ringName} then a note on another string: it keeps ringing (control)`, () => {
      const { t, made } = play(`${ring} 0:2 0:2 0:2`);
      const ringOsc = made[0].sources.find((s) => s.kind === "osc")!;
      expect(ringOsc.stopAt).toBeGreaterThan(at(t.lengthTicks));
    });
  }
});
