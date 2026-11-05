/**
 * How playing techniques are drawn, declared as data.
 *
 * A technique is one of two shapes. A *transition* (hammer-on, pull-off,
 * slide) joins two notes, so it is drawn in the gap before the note it
 * arrives at. A *decoration* (vibrato, bend, ...) belongs to a single note, so
 * it is drawn as an affix on that note's cell.
 *
 * Only `layout.ts`, the capture descriptors and the ASCII reader read this module; the ASCII
 * serialiser and the staff component place what the layout hands them and
 * never look at a technique themselves.
 */

import type { Technique } from "../model";

export type Transition = Extract<Technique, "hammer_on" | "pull_off" | "slide_up" | "slide_down">;
export type Decoration = Extract<
  Technique,
  "vibrato" | "harmonic" | "let_ring" | "bend" | "tap" | "palm_mute"
>;

export interface TransitionSpec {
  readonly id: Transition;
  readonly glyph: "h" | "p" | "/" | "\\";
  readonly words: string;
}

export interface DecorationSpec {
  readonly id: Decoration;
  readonly before: string;
  readonly after: string;
  readonly words: string;
  /** The toggle's visible label. */
  readonly short: string;
}

/** Priority order: the one drawn when two are stored on a string. */
export const TRANSITIONS: readonly TransitionSpec[] = [
  { id: "hammer_on", glyph: "h", words: "hammer-on" },
  { id: "pull_off", glyph: "p", words: "pull-off" },
  { id: "slide_up", glyph: "/", words: "slide up" },
  { id: "slide_down", glyph: "\\", words: "slide down" },
];

/** Toggle order in the inspector. NOT the drawing order. */
export const DECORATIONS: readonly DecorationSpec[] = [
  { id: "vibrato", before: "", after: "~", words: "vibrato", short: "vib" },
  { id: "harmonic", before: "<", after: ">", words: "harmonic", short: "harm" },
  { id: "let_ring", before: "(", after: ")", words: "let ring", short: "ring" },
  { id: "bend", before: "", after: "b", words: "bend", short: "bend" },
  { id: "tap", before: "t", after: "", words: "tap", short: "tap" },
  { id: "palm_mute", before: "", after: "m", words: "palm mute", short: "mute" },
];

/** The wire's cap on one string's list. Pinned against `eventRowSchema` by a test. */
export const MAX_TECHNIQUES_PER_STRING = 8;

const BY_ID = new Map<string, DecorationSpec>(DECORATIONS.map((d) => [d.id, d]));

/**
 * Wrapping order, innermost first: each affix is applied around what the
 * previous ones built, which yields `t(<7>)b~m` whatever order was stored.
 */
const WRAP_ORDER: readonly Decoration[] = [
  "harmonic",
  "let_ring",
  "tap",
  "bend",
  "vibrato",
  "palm_mute",
];

/** Reading order, left to right across the drawn cell. */
const READING_ORDER: readonly Decoration[] = [
  "tap",
  "let_ring",
  "harmonic",
  "bend",
  "vibrato",
  "palm_mute",
];

/** The decorations in a stored list, deduplicated, in reading order. */
export function drawnDecorations(stored: readonly string[]): readonly DecorationSpec[] {
  const present = new Set(stored);
  return READING_ORDER.filter((id) => present.has(id)).map((id) => BY_ID.get(id)!);
}

/** The fret text with its affixes, in the fixed order, for any stored order. */
export function decorate(fret: string, stored: readonly string[]): string {
  const present = new Set(stored);
  let text = fret;
  for (const id of WRAP_ORDER) {
    if (!present.has(id)) continue;
    const spec = BY_ID.get(id)!;
    text = `${spec.before}${text}${spec.after}`;
  }
  return text;
}

/** The transition to draw from a stored list, or null. Ignores anything it does not manage. */
export function drawnTransition(stored: readonly string[]): TransitionSpec | null {
  const present = new Set(stored);
  return TRANSITIONS.find((t) => present.has(t.id)) ?? null;
}
