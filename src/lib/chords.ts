/**
 * Chord symbols, read as notes.
 *
 * A chord above the staff is stored as text -- "Am7" -- and that stays the
 * source of truth. This module is the read side: it turns that text into the
 * pitch classes the chord contains, so the fretboard can light up where those
 * notes fall under your hand. Nothing here writes, and nothing here is stored.
 *
 * Deliberately a parser rather than a lookup table. Chord symbols are a small
 * regular grammar -- root, quality, any number of alterations, optional slash
 * bass -- so the only data involved is a table of qualities that lives in
 * source. Putting chords in the database would mean a migration, a sync
 * surface and an offline-seeding problem, all to store facts that are
 * derivable. Music theory is not user data.
 *
 * Unparseable symbols return null rather than throwing or guessing. "N.C.", a
 * scribble, or a quality nobody has taught this table yet all degrade to what
 * the app did before chords meant anything: text above the staff, and no
 * highlighting. That is why the parser never has to be total.
 */

import type { AnnotationRow, EventRow } from "./model";

/**
 * What a note is doing in the chord.
 *
 * Roles exist because a flat set of "these four notes" throws away the thing a
 * bass player actually uses. Runs are built off the root and fifth, with the
 * third and seventh as the notes that say which chord it is; extensions are
 * colour. The fretboard leans on this to light the root hardest.
 */
export type ChordRole = "root" | "third" | "fifth" | "seventh" | "extension" | "bass";

export interface ChordTone {
  /** Pitch class, 0-11, where 0 is C. Octave-free: a fret matches by class. */
  pitchClass: number;
  /** Semitones above the root, folded into 0-11. */
  interval: number;
  role: ChordRole;
  /** The degree as a chord chart would write it, e.g. "b3", "b7". */
  degree: string;
  /** Spelt for this chord: the b3 of Cm is "Eb", never "D#". */
  name: string;
}

export interface Chord {
  /** The symbol as typed, trimmed. Kept so callers can echo it back. */
  symbol: string;
  /** Root pitch class, 0-11. */
  root: number;
  /** Slash-chord bass as a pitch class, or null when none was written. */
  bass: number | null;
  /** The quality this matched, normalised, e.g. "m7". Empty means major. */
  quality: string;
  /** Root first, then ascending. */
  tones: ChordTone[];
}

/**
 * Degrees, keyed as a chart writes them.
 *
 * Tokens rather than raw semitone counts, because semitones alone cannot tell
 * a sixth from a diminished seventh -- both are 9 above the root, and only one
 * of them is a seventh. Writing dim7 as `bb7` keeps that distinction, which is
 * what makes roles come out right without a special case.
 *
 * `step` is the diatonic step the degree sits on -- a ninth is a second, an
 * eleventh a fourth -- and is what lets a tone be spelt by letter rather than
 * guessed at. See `spellTone`.
 */
const DEGREES: Record<string, { interval: number; role: ChordRole; step: number }> = {
  "1": { interval: 0, role: "root", step: 1 },
  b2: { interval: 1, role: "extension", step: 2 },
  b9: { interval: 1, role: "extension", step: 2 },
  "2": { interval: 2, role: "extension", step: 2 },
  "9": { interval: 2, role: "extension", step: 2 },
  "#9": { interval: 3, role: "extension", step: 2 },
  b3: { interval: 3, role: "third", step: 3 },
  "3": { interval: 4, role: "third", step: 3 },
  "4": { interval: 5, role: "extension", step: 4 },
  "11": { interval: 5, role: "extension", step: 4 },
  "#11": { interval: 6, role: "extension", step: 4 },
  b5: { interval: 6, role: "fifth", step: 5 },
  "5": { interval: 7, role: "fifth", step: 5 },
  "#5": { interval: 8, role: "fifth", step: 5 },
  b13: { interval: 8, role: "extension", step: 6 },
  "6": { interval: 9, role: "extension", step: 6 },
  "13": { interval: 9, role: "extension", step: 6 },
  bb7: { interval: 9, role: "seventh", step: 7 },
  b7: { interval: 10, role: "seventh", step: 7 },
  "7": { interval: 11, role: "seventh", step: 7 },
};

/**
 * Qualities, as degree tokens.
 *
 * Case matters: `m` is minor and `M` is major, which is the one piece of chord
 * notation that genuinely depends on it. Aliases are spelt out rather than
 * normalised away, because the person typing during capture will write
 * whichever one they grew up with.
 *
 * `5` earns its place -- a power chord is a real chord in this music, and the
 * tunings list is weighted the same way.
 */
const QUALITIES: Record<string, string[]> = {
  // Triads.
  "": ["1", "3", "5"],
  maj: ["1", "3", "5"],
  major: ["1", "3", "5"],
  M: ["1", "3", "5"],
  m: ["1", "b3", "5"],
  min: ["1", "b3", "5"],
  minor: ["1", "b3", "5"],
  "-": ["1", "b3", "5"],
  dim: ["1", "b3", "b5"],
  o: ["1", "b3", "b5"],
  aug: ["1", "3", "#5"],
  "+": ["1", "3", "#5"],
  "5": ["1", "5"],
  sus: ["1", "4", "5"],
  sus4: ["1", "4", "5"],
  sus2: ["1", "2", "5"],

  // Sixths.
  "6": ["1", "3", "5", "6"],
  M6: ["1", "3", "5", "6"],
  maj6: ["1", "3", "5", "6"],
  m6: ["1", "b3", "5", "6"],
  min6: ["1", "b3", "5", "6"],
  "-6": ["1", "b3", "5", "6"],
  "69": ["1", "3", "5", "6", "9"],
  "6/9": ["1", "3", "5", "6", "9"],

  // Sevenths.
  "7": ["1", "3", "5", "b7"],
  dom7: ["1", "3", "5", "b7"],
  maj7: ["1", "3", "5", "7"],
  M7: ["1", "3", "5", "7"],
  m7: ["1", "b3", "5", "b7"],
  min7: ["1", "b3", "5", "b7"],
  "-7": ["1", "b3", "5", "b7"],
  mmaj7: ["1", "b3", "5", "7"],
  mM7: ["1", "b3", "5", "7"],
  minmaj7: ["1", "b3", "5", "7"],
  "-maj7": ["1", "b3", "5", "7"],
  dim7: ["1", "b3", "b5", "bb7"],
  o7: ["1", "b3", "b5", "bb7"],
  m7b5: ["1", "b3", "b5", "b7"],
  halfdim: ["1", "b3", "b5", "b7"],
  aug7: ["1", "3", "#5", "b7"],
  "7sus": ["1", "4", "5", "b7"],
  "7sus4": ["1", "4", "5", "b7"],

  // Ninths and up. These stack the seventh, which is what separates `9` from
  // `add9` -- the latter is the triad plus a ninth and no seventh at all.
  "9": ["1", "3", "5", "b7", "9"],
  maj9: ["1", "3", "5", "7", "9"],
  M9: ["1", "3", "5", "7", "9"],
  m9: ["1", "b3", "5", "b7", "9"],
  min9: ["1", "b3", "5", "b7", "9"],
  "-9": ["1", "b3", "5", "b7", "9"],
  // The third is conventionally dropped from a dominant eleventh, where it
  // would sit a semitone off the eleventh and fight it.
  "11": ["1", "5", "b7", "9", "11"],
  m11: ["1", "b3", "5", "b7", "9", "11"],
  maj11: ["1", "3", "5", "7", "9", "11"],
  "13": ["1", "3", "5", "b7", "9", "13"],
  m13: ["1", "b3", "5", "b7", "9", "13"],
  maj13: ["1", "3", "5", "7", "9", "13"],
  M13: ["1", "3", "5", "7", "9", "13"],
};

interface Modifier {
  /** Degree token to add. */
  add?: string;
  /** Drop any tone already holding this role before adding -- b5 over 5. */
  replaces?: ChordRole;
  /** Drop tones holding this role, for `no3` and friends. */
  removes?: ChordRole;
}

/**
 * Alterations that follow a quality, in any number and any order.
 *
 * Parsing these separately rather than enumerating every combination is what
 * keeps the quality table from needing `7b9b13` and its forty siblings.
 */
const MODIFIERS: Record<string, Modifier> = {
  add2: { add: "2" },
  add4: { add: "4" },
  add6: { add: "6" },
  add9: { add: "9" },
  add11: { add: "11" },
  add13: { add: "13" },
  b5: { add: "b5", replaces: "fifth" },
  "#5": { add: "#5", replaces: "fifth" },
  b9: { add: "b9" },
  "#9": { add: "#9" },
  "#11": { add: "#11" },
  b13: { add: "b13" },
  no3: { removes: "third" },
  omit3: { removes: "third" },
  no5: { removes: "fifth" },
  omit5: { removes: "fifth" },
};

/** Longest first, so `m7b5` is not eaten by `m7` and `69` not by `6`. */
const QUALITY_KEYS = Object.keys(QUALITIES)
  .filter((key) => key !== "")
  .sort((a, b) => b.length - a.length);
const MODIFIER_KEYS = Object.keys(MODIFIERS).sort((a, b) => b.length - a.length);

const NOTE_ONLY = /^[A-G][#b]?$/;

/**
 * Fold the ways people actually type a symbol onto the ways this table spells
 * them. Spaces and brackets go too, so `C(add9)` and `C add9` both arrive as
 * `Cadd9`.
 */
function normalise(symbol: string): string {
  return symbol
    .replace(/[♯＃]/g, "#")
    .replace(/♭/g, "b")
    .replace(/[∆Δ]/g, "maj")
    .replace(/[°º]/g, "dim")
    .replace(/ø/g, "m7b5")
    .replace(/[−–—]/g, "-")
    .replace(/[()[\]\s]/g, "");
}

const LETTERS = ["C", "D", "E", "F", "G", "A", "B"] as const;
const NATURAL: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** Accidentals as a signed semitone count, so "bb" is -2. */
function accidentalSemitones(accidental: string): number {
  let offset = 0;
  for (const character of accidental) offset += character === "#" ? 1 : -1;
  return offset;
}

/** Pitch class of a bare note name, which is all a chord root or bass can be. */
function notePitchClass(note: string): number {
  const letter = note[0].toUpperCase();
  return (((NATURAL[letter] + accidentalSemitones(note.slice(1))) % 12) + 12) % 12;
}

/**
 * Match the longest key the string starts with.
 *
 * Case-sensitive on purpose: see the note on QUALITIES about `m` and `M`.
 */
function matchLongest(text: string, keys: string[]): string | null {
  for (const key of keys) {
    if (text.startsWith(key)) return key;
  }
  return null;
}

/**
 * Split a trailing slash bass off the quality.
 *
 * Has to be careful, because `6/9` is a quality with a slash in it. Only a
 * remainder that is itself a bare note name counts as a bass.
 */
function splitBass(text: string): { quality: string; bass: string | null } {
  const slash = text.lastIndexOf("/");
  if (slash === -1) return { quality: text, bass: null };
  const after = text.slice(slash + 1);
  if (!NOTE_ONLY.test(after)) return { quality: text, bass: null };
  return { quality: text.slice(0, slash), bass: after };
}

/** "bb" | "b" | "" | "#" | "##", from a count of semitones. */
function accidentalText(offset: number): string {
  if (offset < 0) return "b".repeat(-offset);
  return "#".repeat(offset);
}

/**
 * Name a tone the way the chord means it.
 *
 * Not a sharp-or-flat preference but letter arithmetic, which is the only way
 * to get this right: the b3 of Cm is an E of some kind because a third above C
 * is always some E, so it comes out "Eb" and never "D#". The same reasoning
 * spells Cdim7's bb7 as "Bbb" and a C7#9's #9 as "D#" -- enharmonically a
 * minor third, but written as an altered second because that is what it is.
 *
 * Display only. Highlighting matches on pitch class, so a mis-spelt name could
 * never light the wrong fret.
 */
function spellTone(
  rootLetter: string,
  rootAccidental: number,
  step: number,
  interval: number,
): string {
  const letter = LETTERS[(LETTERS.indexOf(rootLetter as (typeof LETTERS)[number]) + step - 1) % 7];
  const naturalGap = (((NATURAL[letter] - NATURAL[rootLetter]) % 12) + 12) % 12;
  let offset = rootAccidental + interval - naturalGap;
  // A gap wrapped the octave rather than genuinely needing six accidentals.
  if (offset > 6) offset -= 12;
  if (offset < -6) offset += 12;
  return `${letter}${accidentalText(offset)}`;
}

/**
 * Read a chord symbol.
 *
 * Returns null for anything it does not fully understand, including a symbol
 * with trailing characters left over -- a half-parse would highlight the wrong
 * notes, which is worse than highlighting none.
 */
export function parseChord(symbol: string): Chord | null {
  const trimmed = symbol.trim();
  if (!trimmed) return null;

  const text = normalise(trimmed);
  const rootMatch = /^([A-Ga-g])([#b]?)/.exec(text);
  if (!rootMatch) return null;

  const letter = rootMatch[1].toUpperCase();
  const accidentalOffset = accidentalSemitones(rootMatch[2]);
  const root = (((NATURAL[letter] + accidentalOffset) % 12) + 12) % 12;

  const { quality: qualityText, bass: bassText } = splitBass(text.slice(rootMatch[0].length));

  // A quality may be absent entirely, which means a major triad.
  const matchedQuality = matchLongest(qualityText, QUALITY_KEYS) ?? "";
  let rest = qualityText.slice(matchedQuality.length);
  let degrees = [...QUALITIES[matchedQuality]];

  while (rest.length > 0) {
    const key = matchLongest(rest, MODIFIER_KEYS);
    if (!key) return null; // Something left over that this table cannot read.
    const modifier = MODIFIERS[key];
    const role = modifier.replaces ?? modifier.removes;
    if (role) degrees = degrees.filter((degree) => DEGREES[degree].role !== role);
    if (modifier.add) degrees.push(modifier.add);
    rest = rest.slice(key.length);
  }

  const tones: ChordTone[] = [];
  const seen = new Set<number>();
  for (const degree of degrees) {
    const entry = DEGREES[degree];
    // The quality's own degrees come first, so where an alteration collides
    // with a degree already present the original keeps its role.
    if (seen.has(entry.interval)) continue;
    seen.add(entry.interval);
    tones.push({
      pitchClass: (root + entry.interval) % 12,
      interval: entry.interval,
      role: entry.role,
      degree,
      name: spellTone(letter, accidentalOffset, entry.step, entry.interval),
    });
  }
  tones.sort((a, b) => a.interval - b.interval);

  const bass = bassText ? notePitchClass(bassText) : null;

  return { symbol: trimmed, root, bass, quality: matchedQuality, tones };
}

/**
 * Pitch class to role, which is the shape the fretboard wants.
 *
 * Pitch classes rather than string/fret pairs, so fretboard geometry stays in
 * the fretboard and nothing has to recompute positions per string.
 *
 * A slash bass that is not otherwise in the chord is included as "bass" -- a
 * C/F# means the bass player is being told to play an F#, and leaving it unlit
 * would be the one wrong answer. When the bass note is already a chord tone it
 * keeps its harmonic role, and `chord.bass` is there for any caller that wants
 * to mark it specially.
 */
export function chordToneMap(chord: Chord): ReadonlyMap<number, ChordRole> {
  const map = new Map<number, ChordRole>();
  for (const tone of chord.tones) {
    if (!map.has(tone.pitchClass)) map.set(tone.pitchClass, tone.role);
  }
  if (chord.bass !== null && !map.has(chord.bass)) map.set(chord.bass, "bass");
  return map;
}

/** Note names for a chord, spelt as the chord means them: Am7 -> A C E G. */
export function chordToneNames(chord: Chord): string[] {
  return chord.tones.map((tone) => tone.name);
}

/**
 * The chord in force at a column.
 *
 * A chord symbol is anchored to one column but means "from here until the next
 * one", so the fretboard cannot just ask for the chord on the column under the
 * cursor -- it has to look back. That is also why this walks `events` rather
 * than the annotations: the answer depends on column order, and only the events
 * carry it.
 *
 * `events` must be in rank order, which is how the local queries return them.
 * Annotations with a null anchor are skipped, since the column is optional in
 * storage and an unanchored chord is not in force anywhere.
 */
export function chordInForceAt(
  events: readonly EventRow[],
  annotations: readonly AnnotationRow[],
  eventId: string | null,
): string | null {
  if (eventId === null) return null;

  const anchored = new Map<string, string>();
  for (const annotation of annotations) {
    if (annotation.kind !== "chord") continue;
    if (annotation.anchorEventId === null) continue;
    anchored.set(annotation.anchorEventId, annotation.value);
  }
  if (anchored.size === 0) return null;

  let inForce: string | null = null;
  for (const event of events) {
    const here = anchored.get(event.id);
    if (here !== undefined) inForce = here;
    if (event.id === eventId) return inForce;
  }

  // The cursor is pointing at a column this part does not have -- deleted on
  // another device, most likely. Claiming a chord would be a guess.
  return null;
}
