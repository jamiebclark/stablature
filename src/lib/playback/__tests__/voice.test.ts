import { describe, expect, it } from "vitest";
import { noteToMidi } from "@/lib/pitch";
import { TUNING_PRESETS } from "@/lib/tunings";
import type { Voice } from "../types";
import { energyAbove, midiToHz, voicePlan, waveFor } from "../voice";

const voice = (midi: number, tone: Voice["tone"]): Voice => ({
  string: 0, midi, attack: "pick", glideFrom: null, glideTicks: 0, vibrato: false, tone,
  sustain: tone === "muted" ? "half" : tone === "harmonic" ? "long" : "length",
});
const plan = (midi: number, tone: Voice["tone"]) => voicePlan(voice(midi, tone), { start: 0, end: 1, glide: 0 });

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

describe("INV-018 low strings keep their energy above 200 Hz", () => {
  it("midiToHz is A440", () => expect(midiToHz(69)).toBe(440));

  it("the plan's enumerated set", () => {
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

  it("every tone x string x fret 0..24 and the harmonic nodes", () => {
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

  it("a wave has partials and no DC", () => {
    const { real, imag } = waveFor("plain", 55);
    expect(real.length).toBe(imag.length);
    expect(imag[1]).toBeGreaterThan(0);
    expect(real[0]).toBe(0);
  });
});
