/**
 * The play timeline: every column of the passes as a hit with a length, every sounding string of every hit as a
 * resolved `Voice` (research R4, R7, R8). Pure. The click's own arithmetic (`readGroups`, `hitTicks`) sets every
 * length, so a note starts on the click's tick wherever the notation is timed.
 */
import type { DrawnPass } from "@/lib/arrangement/passes";
import { fretAt, type EventRow } from "@/lib/model";
import { noteToMidi } from "@/lib/pitch";
import { DURATIONS, readDuration, TICKS_PER_BEAT, type Duration } from "@/lib/rhythm/durations";
import { hitTicks, readGroups } from "@/lib/rhythm/notation";
import { drawnTransition } from "@/lib/tab/techniques";
import type { Tuning } from "@/lib/tunings";
import type { PlayHit, PlayTimeline, PlayVoice, StringTail, Voice } from "./types";

const QUARTER = DURATIONS.find((d) => d.id === "q") as Duration;

/** fret → semitones over the open string. */
export const HARMONIC_NODES: Readonly<Record<number, number>> = {
  12: 12,
  7: 19,
  19: 19,
  5: 24,
  24: 24,
  4: 28,
  9: 28,
  16: 28,
};

const playable = (e: EventRow) => e.kind === "notes" || e.kind === "rest";
const repeatOf = (e: EventRow) => (Number.isFinite(e.repeat) ? Math.max(1, Math.floor(e.repeat)) : 1);

export function lengthRule(passes: readonly DrawnPass[]): PlayTimeline["rule"] {
  let set = 0;
  let unset = 0;
  for (const pass of passes) {
    for (const e of pass.events) {
      if (!playable(e)) continue;
      if (readDuration(e.durationHint)) set++;
      else unset++;
    }
  }
  if (set + unset === 0) return "empty";
  if (unset === 0) return "written";
  return set === 0 ? "none" : "some";
}

const isFret = (v: unknown): v is number | "x" =>
  v === "x" || (typeof v === "number" && Number.isInteger(v) && v >= 0);

export function playTimeline(
  passes: readonly DrawnPass[],
  tuning: Tuning,
  opts: { after?: PlayTimeline } = {},
): PlayTimeline {
  const hits: PlayHit[] = [];
  const voices: PlayVoice[] = [];
  const strings = new Map<number, StringTail>();
  if (opts.after) {
    for (const [s, t] of opts.after.tail) strings.set(s, { ...t, endTick: t.endTick - opts.after.lengthTicks });
  }
  let at = 0;
  for (let p = 0; p < passes.length; p++) {
    const events = passes[p].events;
    const groups = readGroups(events);
    let carried: Duration | null = null;
    for (const e of events) {
      if (!playable(e)) continue;
      const set = readDuration(e.durationHint);
      if (set) carried = set;
      const len = set ?? carried ?? QUARTER;
      const ticks = hitTicks(len, e.tupletId ? groups.get(e.tupletId) : null);
      for (let r = 0; r < repeatOf(e); r++) {
        hits.push({ tick: at, ticks, pass: p, eventId: e.id, repetition: r });
        if (e.kind === "notes") {
          for (const key of Object.keys(e.frets)) {
            const s = Number(key);
            const open = Number.isInteger(s) ? tuning.strings[s] : undefined;
            const fret = fretAt(e.frets, s);
            if (!open || !isFret(fret) || String(s) !== key) continue;
            const techs = (e.techniques?.[key] ?? []) as readonly string[];
            const made = resolve(s, noteToMidi(open), fret, techs, at, ticks, strings.get(s));
            voices.push({ tick: at, endTick: made.endTick, string: s, voice: made.voice });
            strings.set(s, made.tail);
          }
        }
        at += ticks;
      }
    }
  }
  voices.sort((a, b) => a.tick - b.tick || a.string - b.string);
  return { hits, voices, lengthTicks: at, rule: lengthRule(passes), tail: strings };
}

function resolve(
  string: number,
  open: number,
  fret: number | "x",
  techs: readonly string[],
  tick: number,
  ticks: number,
  prev: StringTail | undefined,
): { voice: Voice; endTick: number; tail: StringTail } {
  const has = (t: string) => techs.includes(t);
  const hitEnd = tick + ticks;
  if (fret === "x" || has("dead_note")) {
    const voice: Voice = {
      string,
      midi: open,
      attack: "pick",
      glideFrom: null,
      glideTicks: 0,
      vibrato: false,
      tone: "dead",
      sustain: has("palm_mute") ? "thud-muted" : "thud",
    };
    // A thud is over at once and nothing connects to it.
    return { voice, endTick: hitEnd, tail: { endTick: Number.NEGATIVE_INFINITY, midi: open, ticks } };
  }
  const harmonic = has("harmonic");
  const midi = open + (harmonic ? (HARMONIC_NODES[fret] ?? fret) : fret);
  const tone: Voice["tone"] = harmonic ? "harmonic" : has("palm_mute") ? "muted" : "plain";
  const sustain: Voice["sustain"] = harmonic ? "long" : has("let_ring") ? "ring" : has("palm_mute") ? "half" : "length";
  const sounding = prev !== undefined && prev.endTick >= tick;
  const transition = drawnTransition(techs)?.id ?? null;
  let attack: Voice["attack"] = "pick";
  let glideFrom: number | null = null;
  let glideTicks = 0;
  if (transition) {
    attack = sounding ? "none" : "soft";
    if (transition === "slide_up" || transition === "slide_down") {
      if (sounding) {
        glideFrom = prev.midi;
        glideTicks = Math.min(prev.ticks / 2, TICKS_PER_BEAT / 2);
      } else {
        glideFrom = transition === "slide_up" ? midi - 3 : midi + 3;
        glideTicks = Math.min(ticks / 2, TICKS_PER_BEAT / 2);
      }
    }
  }
  const voice: Voice = { string, midi, attack, glideFrom, glideTicks, vibrato: has("vibrato"), tone, sustain };
  const sounds = sustain === "ring" || sustain === "long" ? Number.POSITIVE_INFINITY : sustain === "half" ? tick + ticks / 2 : hitEnd;
  return { voice, endTick: sustain === "half" ? tick + ticks / 2 : hitEnd, tail: { endTick: sounds, midi, ticks } };
}
