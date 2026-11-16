import { describe, expect, it } from "vitest";
import { presetById } from "@/lib/tunings";
import { playRounds } from "../stream";
import { playTimeline } from "../timeline";
import type { Voice } from "../types";
import { beats, passesOf } from "./fixtures";

const bass = presetById("bass4-e")!; // string 3 = E1, MIDI 28
const bass5 = presetById("bass5-b")!;

/** A voice written out in full: every field is spelled, the defaults are the plain picked note. */
const V = (over: Partial<Voice> & { midi: number }): Voice => ({
  string: 3,
  attack: "pick",
  glideFrom: null,
  glideTicks: 0,
  vibrato: false,
  tone: "plain",
  sustain: "length",
  ...over,
});
const voices = (texts: string[], tuning = bass) => playTimeline(passesOf(texts), tuning).voices;
const second = (texts: string[]) => voices(texts)[1].voice;

describe("INV-005 technique corpus", () => {
  it("T1 hammer-on connects", () => expect(second(["3:5@q 3:7[hammer_on]@q"])).toEqual(V({ midi: 35, attack: "none" })));
  it("T2 hammer-on alone is soft", () =>
    expect(voices(["3:7[hammer_on]@q"])[0].voice).toEqual(V({ midi: 35, attack: "soft" })));
  it("T3 pull-off connects, alone it is soft", () => {
    expect(second(["3:7@q 3:5[pull_off]@q"])).toEqual(V({ midi: 33, attack: "none" }));
    expect(voices(["3:5[pull_off]@q"])[0].voice).toEqual(V({ midi: 33, attack: "soft" }));
  });
  it("T4 slide up from a sounding note glides from it", () =>
    expect(second(["3:7@q 3:9[slide_up]@q"])).toEqual(
      V({ midi: 37, attack: "none", glideFrom: 35, glideTicks: beats(1, 2) }),
    ));
  it("T5 slides with nothing sounding start three semitones away", () => {
    expect(voices(["3:9[slide_up]@q"])[0].voice).toEqual(V({ midi: 37, attack: "soft", glideFrom: 34, glideTicks: beats(1, 2) }));
    expect(voices(["3:9[slide_down]@q"])[0].voice).toEqual(V({ midi: 37, attack: "soft", glideFrom: 40, glideTicks: beats(1, 2) }));
  });
  it("T6 vibrato", () => expect(voices(["3:7[vibrato]@q"])[0].voice).toEqual(V({ midi: 35, vibrato: true })));
  it("T7 palm mute sounds half its length", () => {
    const v = voices(["3:5[palm_mute]@q"])[0];
    expect(v.voice).toEqual(V({ midi: 33, tone: "muted", sustain: "half" }));
    expect(v.endTick - v.tick).toBe(beats(1, 2));
  });
  it("T8 let ring chord is not ended by a later string", () => {
    const t = playTimeline(passesOf(["0:2[let_ring]+1:2[let_ring]+2:4[let_ring] 3:0"]), bass);
    expect(t.voices.filter((v) => v.voice.sustain === "ring").map((v) => v.string)).toEqual([0, 1, 2]);
    for (const s of [0, 1, 2]) expect(t.tail.get(s)!.endTick).toBe(Number.POSITIVE_INFINITY);
  });
  it("T9 harmonics", () => {
    const frets = [12, 7, 19, 5, 24, 4, 9, 16, 3];
    const got = voices([frets.map((f) => `3:${f}[harmonic]@q`).join(" ")]);
    expect(got.map((v) => v.voice.midi)).toEqual([40, 47, 47, 52, 52, 56, 56, 56, 31]);
    for (const v of got) expect(v.voice).toMatchObject({ tone: "harmonic", sustain: "long" });
  });
  it("T10 bend and tap change nothing", () => {
    const plain = voices(["3:7@q"])[0].voice;
    for (const t of ["bend", "tap", "bend,tap"]) expect(voices([`3:7[${t}]@q`])[0].voice).toEqual(plain);
  });
  it("T11 a tap then a pull-off connects", () =>
    expect(second(["3:7[tap]@q 3:5[pull_off]@q"]).attack).toBe("none"));
  it("T12 x is a thud, lower on lower strings", () => {
    const got = [0, 1, 2, 3, 4].map((s) => voices([`${s}:x@q`], bass5)[0].voice);
    expect(got.map((v) => v.midi)).toEqual([43, 38, 33, 28, 23]);
    for (const [s, v] of got.entries()) expect(v).toEqual(V({ string: s, midi: v.midi, tone: "dead", sustain: "thud" }));
  });
  it("T13 thud variants ignore everything else", () => {
    expect(voices(["3:x[palm_mute]@q"])[0].voice).toEqual(V({ midi: 28, tone: "dead", sustain: "thud-muted" }));
    expect(voices(["3:x[slide_up]@q"])[0].voice).toEqual(V({ midi: 28, tone: "dead", sustain: "thud" }));
    expect(voices(["3:x[hammer_on,vibrato,let_ring,harmonic]@q"])[0].voice).toEqual(V({ midi: 28, tone: "dead", sustain: "thud" }));
  });
  it("T14 dead_note on a fret is a thud on that string", () =>
    expect(voices(["3:5[dead_note]@q"])[0].voice).toEqual(V({ midi: 28, tone: "dead", sustain: "thud" })));
  it("T15 a thud never carries", () =>
    expect(voices(["3:5@q 3:x@q 3:7[hammer_on]@q"])[2].voice).toEqual(V({ midi: 35, attack: "soft" })));
  it("T16 priority order: hammer-on wins over a slide", () =>
    expect(second(["3:5@q 3:7[slide_up,hammer_on]@q"])).toEqual(V({ midi: 35, attack: "none" })));
  it("T17 connects across a pass boundary", () =>
    expect(second(["3:5@q", "3:7[hammer_on]@q"]).attack).toBe("none"));
  it("T18 the loop seam: round 1 soft, rounds 2 and 3 connect and are byte-equal", () => {
    const rounds = playRounds(passesOf(["3:7[hammer_on]@q 3:5@q"]), bass);
    expect(rounds.first.voices[0].voice.attack).toBe("soft");
    expect(rounds.later.voices[0].voice.attack).toBe("none");
    const again = playTimeline(passesOf(["3:7[hammer_on]@q 3:5@q"]), bass, { after: rounds.later });
    expect(JSON.stringify(again.voices)).toBe(JSON.stringify(rounds.later.voices));
  });
});
