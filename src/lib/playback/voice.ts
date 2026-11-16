/** The voice as pure numbers (research R12). The synth applies these verbatim; nothing here touches Web Audio. */
import type { Voice } from "./types";

export const midiToHz = (midi: number): number => 440 * 2 ** ((midi - 69) / 12);

const MAX_PARTIALS = 64;
const CUTOFF_HZ = 200;

/**
 * Pulls partials below the knee down on a power curve, so a low string keeps most of its energy where a speaker plays it.
 * A harmonic's knee is higher: its fundamental alone would otherwise sit just under 200 Hz.
 */
const lift = (f: number, power: number, knee: number): number => (f >= knee ? 1 : (f / knee) ** power);

export function waveFor(tone: Voice["tone"], hz: number): { real: Float32Array; imag: Float32Array } {
  const count = Math.max(1, Math.min(MAX_PARTIALS, Math.floor(18000 / hz)));
  const real = new Float32Array(count + 1);
  const imag = new Float32Array(count + 1);
  const harmonic = tone === "harmonic";
  for (let n = 1; n <= count; n++) {
    const base = harmonic ? 1 / (n * n) : 1 / n;
    imag[n] = base * lift(n * hz, harmonic ? 24 : 6, harmonic ? 300 : 2 * CUTOFF_HZ);
  }
  return { real, imag };
}

export interface VoicePlan {
  readonly hz: number;
  readonly tone: Voice["tone"];
  /** Lowpass cutoff at the note's start and at its darkest, in Hz, and the time constant of the fall. */
  readonly cutoffStart: number;
  readonly cutoffFloor: number;
  readonly cutoffTau: number;
  readonly attackS: number;
  /** Time constant of the gain's fall; null when the note ends at its length. */
  readonly decayTau: number;
  readonly endS: number;
  readonly glideS: number;
  readonly releaseTau: number;
}

const TAU: Record<Voice["sustain"], number> = {
  length: 0.5,
  half: 0.18,
  ring: 1.5,
  long: 2,
  thud: 0.02,
  "thud-muted": 0.012,
};

export function voicePlan(voice: Voice, seconds: { start: number; end: number; glide: number }): VoicePlan {
  const tone = voice.tone;
  const [cutoffStart, cutoffFloor] =
    tone === "muted" ? [800, 500] : tone === "harmonic" ? [4000, 2500] : [2500, 1200];
  const ends = voice.sustain === "ring" || voice.sustain === "long" ? Number.POSITIVE_INFINITY : seconds.end;
  return {
    hz: midiToHz(voice.midi),
    tone,
    cutoffStart,
    cutoffFloor,
    cutoffTau: voice.sustain === "half" ? 0.08 : 0.35,
    attackS: voice.attack === "pick" ? 0.003 : 0.012,
    decayTau: TAU[voice.sustain],
    endS: ends,
    glideS: seconds.glide,
    releaseTau: 0.005,
  };
}

/** RBJ lowpass magnitude squared at f for a cutoff fc, Q = 1/sqrt(2). */
const lowpass2 = (f: number, fc: number): number => {
  const r = f / fc;
  return 1 / ((1 - r * r) ** 2 + (r * Math.SQRT2) ** 2);
};

/** SC-012: the fraction of the filtered energy at or above 200 Hz, with the filter at its start or its floor cutoff. */
export function energyAbove(hz: number, plan: VoicePlan, atCutoff: "start" | "floor"): number {
  const fc = atCutoff === "start" ? plan.cutoffStart : plan.cutoffFloor;
  const { imag } = waveFor(plan.tone, hz);
  let above = 0;
  let total = 0;
  for (let n = 1; n < imag.length; n++) {
    const e = imag[n] ** 2 * lowpass2(n * hz, fc);
    total += e;
    if (n * hz >= CUTOFF_HZ) above += e;
  }
  return total === 0 ? 0 : above / total;
}
