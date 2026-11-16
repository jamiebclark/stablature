/**
 * The voice as Web Audio nodes (research R12, contracts/engine-and-port.md §3). Built-in nodes only: no worklet, no
 * file, no fetch. The timeline decided every musical question; this applies a `Voice` and decides none.
 */
import type { Voice } from "./types";
import { midiToHz, voicePlan, waveFor, type VoicePlan } from "./voice";

export interface LiveVoice {
  readonly osc: OscillatorNode;
  readonly gain: GainNode;
  /** When the source stops; a legato or glide onto the string must start before it. */
  stopAt: number;
}

export interface Voicing {
  /** Live pitched voice per string, so legato and glides move it and a new note on the string ends it. */
  readonly strings: Map<number, LiveVoice>;
  readonly sources: Set<AudioScheduledSourceNode>;
  readonly noise: AudioBuffer;
  readonly bus: AudioNode;
}

const FLOOR = 0.0001;
const PEAK = { plain: 0.45, muted: 0.5, harmonic: 0.5, dead: 0.6 } as const;
const VIBRATO_HZ = 5.5;
const VIBRATO_RATIO = 2 ** (25 / 1200) - 1;
const THUD_S = 0.06;
const THUD_MUTED_S = 0.035;
const RELEASE_TAU = 0.005;

export function makeVoicing(context: BaseAudioContext, bus: AudioNode): Voicing {
  const length = Math.max(1, Math.floor(context.sampleRate * 0.2));
  const noise = context.createBuffer(1, length, context.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  return { strings: new Map(), sources: new Set(), noise, bus };
}

function track(v: Voicing, source: AudioScheduledSourceNode, ...nodes: AudioNode[]) {
  v.sources.add(source);
  source.onended = () => {
    v.sources.delete(source);
    source.disconnect();
    for (const n of nodes) n.disconnect();
  };
}

/** A glide's length in seconds, from the note's own span: half of it, between 20 and 150 ms. */
const glideSeconds = (time: number, end: number) => Math.min(0.15, Math.max(0.02, (end - time) / 2));

function vibrato(v: Voicing, context: BaseAudioContext, target: OscillatorNode, hz: number, from: number, to: number) {
  const lfo = context.createOscillator();
  const depth = context.createGain();
  lfo.frequency.value = VIBRATO_HZ;
  depth.gain.value = hz * VIBRATO_RATIO;
  lfo.connect(depth);
  depth.connect(target.frequency);
  track(v, lfo, depth);
  lfo.start(from);
  lfo.stop(to);
}

/** Every gain change is a ramp or a target: nothing steps. */
function shape(live: LiveVoice, plan: VoicePlan, from: number, attacked: boolean) {
  const g = live.gain.gain;
  g.cancelScheduledValues(from);
  // The cancel removes an attacked voice's FLOOR start, which would leave it ramping from the node's default 1.0.
  if (attacked) g.setValueAtTime(FLOOR, from);
  g.setTargetAtTime(PEAK[plan.tone], from, plan.attackS / 3);
  g.setTargetAtTime(FLOOR, from + plan.attackS, plan.decayTau);
  if (Number.isFinite(plan.endS)) {
    g.setTargetAtTime(FLOOR, plan.endS, RELEASE_TAU);
    live.stopAt = plan.endS + RELEASE_TAU * 10;
  } else {
    live.stopAt = from + plan.attackS + plan.decayTau * 8;
  }
}

function setPitch(osc: OscillatorNode, voice: Voice, hz: number, time: number, glide: number, connected: boolean) {
  const f = osc.frequency;
  if (voice.glideFrom === null) {
    f.setValueAtTime(hz, time);
  } else if (connected) {
    f.setValueAtTime(midiToHz(voice.glideFrom), Math.max(0, time - glide));
    f.exponentialRampToValueAtTime(hz, time);
  } else {
    f.setValueAtTime(midiToHz(voice.glideFrom), time);
    f.exponentialRampToValueAtTime(hz, time + glide);
  }
}

/** A new attacked note, or a thud, ends the live voice on its string at `time`. */
function endLive(live: LiveVoice | undefined, time: number) {
  if (!live) return;
  live.gain.gain.cancelScheduledValues(time);
  live.gain.gain.setTargetAtTime(FLOOR, time, RELEASE_TAU);
  try {
    live.osc.stop(time + RELEASE_TAU * 10);
  } catch {
    // Already ended.
  }
  live.stopAt = time;
}

export function playVoice(v: Voicing, context: BaseAudioContext, time: number, end: number, voice: Voice): void {
  if (voice.tone === "dead") {
    endLive(v.strings.get(voice.string), time);
    return playThud(v, context, time, voice);
  }
  const glide = glideSeconds(time, end);
  const plan = voicePlan(voice, { start: time, end, glide });
  const live = v.strings.get(voice.string);
  const hz = plan.hz;
  if (voice.attack === "none" && live && live.stopAt >= time) {
    setPitch(live.osc, voice, hz, time, glide, true);
    shape(live, plan, time, false);
    try {
      live.osc.stop(live.stopAt);
    } catch {
      // Already ended: the next attack starts fresh.
    }
    if (voice.vibrato) vibrato(v, context, live.osc, hz, time, live.stopAt);
    return;
  }
  endLive(live, time);
  const osc = context.createOscillator();
  const filter = context.createBiquadFilter();
  const gain = context.createGain();
  const { real, imag } = waveFor(voice.tone, hz);
  osc.setPeriodicWave(context.createPeriodicWave(real, imag));
  setPitch(osc, voice, hz, time, glide, false);
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(plan.cutoffStart, time);
  filter.frequency.setTargetAtTime(plan.cutoffFloor, time, plan.cutoffTau);
  gain.gain.setValueAtTime(FLOOR, time);
  osc.connect(filter);
  filter.connect(gain);
  gain.connect(v.bus);
  const made: LiveVoice = { osc, gain, stopAt: 0 };
  shape(made, plan, time, true);
  track(v, osc, filter, gain);
  osc.start(time);
  osc.stop(made.stopAt);
  if (voice.vibrato) vibrato(v, context, osc, hz, time, made.stopAt);
  v.strings.set(voice.string, made);
  osc.addEventListener("ended", () => {
    if (v.strings.get(voice.string) === made) v.strings.delete(voice.string);
  });
}

function playThud(v: Voicing, context: BaseAudioContext, time: number, voice: Voice) {
  const dur = voice.sustain === "thud-muted" ? THUD_MUTED_S : THUD_S;
  const src = context.createBufferSource();
  const band = context.createBiquadFilter();
  const gain = context.createGain();
  src.buffer = v.noise;
  band.type = "bandpass";
  band.frequency.value = Math.min(1500, Math.max(150, midiToHz(voice.midi) * 2.5));
  gain.gain.setValueAtTime(FLOOR, time);
  gain.gain.exponentialRampToValueAtTime(PEAK.dead, time + 0.002);
  gain.gain.setTargetAtTime(FLOOR, time + 0.002, dur / 4);
  src.connect(band);
  band.connect(gain);
  gain.connect(v.bus);
  track(v, src, band, gain);
  src.start(time);
  src.stop(time + dur);
}
