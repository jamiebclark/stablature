/**
 * INV-018. `energyAbove` reads the same `voicePlan` the synth applies.
 *
 * (1) The plan's enumerated set: {plain, muted, harmonic} x the lowest string of every preset x
 *     {open, +12, +19, +24, +28}, filter at its start and its floor.
 * (2) The invariant's own words, "never does a pitched note keep less than half its energy above 200 Hz", over
 *     every tone x every string of every preset x frets 0..24 plus the harmonic nodes. Failures are collected so
 *     the whole band shows at once.
 */
import { describe, expect, it } from "vitest";
import { noteToMidi } from "@/lib/pitch";
import { TUNING_PRESETS } from "@/lib/tunings";
import type { Voice } from "@/lib/playback/types";
import { energyAbove, midiToHz, voicePlan } from "@/lib/playback/voice";

const SUSTAIN: Record<Voice["tone"], Voice["sustain"]> = { plain: "length", muted: "half", harmonic: "long", dead: "thud" };
const share = (midi: number, tone: Voice["tone"], cut: "start" | "floor") =>
  energyAbove(
    midiToHz(midi),
    voicePlan(
      { string: 0, midi, attack: "pick", glideFrom: null, glideTicks: 0, vibrato: false, tone, sustain: SUSTAIN[tone] },
      { start: 0, end: 1, glide: 0 },
    ),
    cut,
  );
const TONES = ["plain", "muted", "harmonic"] as const;
const CUTS = ["start", "floor"] as const;

describe("INV-018 a pitched note keeps half its energy above 200 Hz", () => {
  it("(1) the plan's enumerated set", () => {
    const bad: string[] = [];
    let n = 0;
    for (const preset of TUNING_PRESETS) {
      const lowest = noteToMidi(preset.strings[preset.strings.length - 1]);
      for (const tone of TONES)
        for (const k of [0, 12, 19, 24, 28])
          for (const cut of CUTS) {
            n++;
            const v = share(lowest + k, tone, cut);
            if (v < 0.5) bad.push(`${preset.id} ${tone} +${k} ${cut} ${v.toFixed(3)}`);
          }
    }
    expect(n).toBe(17 * 3 * 5 * 2);
    expect(bad).toEqual([]);
  });

  it("(2) every tone x string x fret 0..24 and the harmonic nodes", () => {
    const midis = new Set<number>();
    for (const preset of TUNING_PRESETS)
      for (const string of preset.strings) {
        const open = noteToMidi(string);
        for (let f = 0; f <= 24; f++) midis.add(open + f);
        for (const k of [19, 28]) midis.add(open + k);
      }
    const bad: string[] = [];
    for (const tone of TONES)
      for (const cut of CUTS)
        for (const midi of [...midis].sort((a, b) => a - b)) {
          const v = share(midi, tone, cut);
          if (v < 0.5) bad.push(`${tone}/${cut} midi ${midi} (${midiToHz(midi).toFixed(0)} Hz) ${v.toFixed(3)}`);
        }
    expect(bad).toEqual([]);
  });
});
