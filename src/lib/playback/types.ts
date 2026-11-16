/** The shapes of the play timeline (data-model §2). React-free and Web-Audio-free. */

export interface Voice {
  readonly string: number;
  /** fretToMidi, the harmonic table, or for a thud the open string. */
  readonly midi: number;
  readonly attack: "pick" | "soft" | "none";
  /** With attack "none" the glide ends at the note's start; with "soft" it starts there. */
  readonly glideFrom: number | null;
  /** 0 unless glideFrom is set. */
  readonly glideTicks: number;
  readonly vibrato: boolean;
  readonly tone: "plain" | "muted" | "harmonic" | "dead";
  readonly sustain: "length" | "half" | "ring" | "long" | "thud" | "thud-muted";
}

export interface PlayHit {
  readonly tick: number;
  readonly ticks: number;
  readonly pass: number;
  readonly eventId: string;
  readonly repetition: number;
}

export interface PlayVoice {
  readonly tick: number;
  readonly endTick: number;
  readonly string: number;
  readonly voice: Voice;
}

/** What a string was doing when the round ended, for the seam: where it stops sounding, its pitch and its length. */
export interface StringTail {
  readonly endTick: number;
  readonly midi: number;
  readonly ticks: number;
}

export interface PlayTimeline {
  readonly hits: readonly PlayHit[];
  readonly voices: readonly PlayVoice[];
  readonly lengthTicks: number;
  readonly rule: "written" | "some" | "none" | "empty";
  /** Per string, the last voice and where it stops sounding, in ticks from the round's start. Feeds the next round's seam. */
  readonly tail: ReadonlyMap<number, StringTail>;
}

export interface PlayMark {
  readonly pass: number;
  readonly eventId: string;
  readonly repetition: number;
}
