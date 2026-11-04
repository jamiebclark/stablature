"use client";

/**
 * The capture surface: tap the string and fret you mean.
 *
 * Every cell shows its fret number rather than a bare dot. It looks busier, but
 * capture happens one-handed while somebody is playing a riff at you, and
 * having a number to aim at beats counting frets along a row. The numbers are
 * dim so the inlay markers still carry the shape of the neck.
 *
 * Strings run highest-at-top, matching both the tab staff above it and the
 * string indices in storage (0 = highest).
 */

import type { ReactNode } from "react";
import type { ChordRole } from "@/lib/chords";
import type { FretMap, FretValue } from "@/lib/model";
import { fretToMidi, type Tuning } from "@/lib/tunings";
import { midiToNote, noteLabel } from "@/lib/pitch";

/** Frets with position inlays on a real neck. */
const INLAYS = new Set([3, 5, 7, 9, 12, 15, 17, 19, 21, 24]);

/**
 * How loudly each chord role is drawn.
 *
 * Colour on the fret number rather than a fill or a ring, and the reason is
 * density: four chord tones repeat up a 25-fret neck, so a third of the grid
 * is a chord tone at any time. A fill at that density buries the column
 * highlight, and rings on forty cells collide with each other across the
 * one-pixel gaps. Tinting the number leaves all three background tiers -- nut,
 * inlay, plain -- intact underneath, which is also what keeps the neck's shape
 * readable.
 *
 * One colour for every chord tone, and weight carrying the distinction that
 * matters -- in the chord or not -- with a further step up for the root and a
 * written slash bass, which are the notes a run is anchored on.
 *
 * Weight does that job because colour alone cannot do it in both themes.
 * Grading the lesser roles by opacity was the first attempt and was wrong
 * twice over: accent at 60% measured 4.15:1 against its cell, near the 3.74:1
 * of the grey used for notes that are *not* in the chord, so the one thing the
 * highlight has to say was the thing it said least clearly.
 *
 * Full accent fixed that in the dark theme, where a chord tone is 9.47:1
 * against the plain cell and 8.66:1 on an inlay, against 3.79:1 and 3.46:1 for
 * a note outside the chord -- a clear separation. The light theme does not get
 * one for free: there a chord tone is 5.02:1 and a note outside the chord is
 * 5.28:1, so the two are within a tenth of each other in luminance and the
 * difference rests entirely on hue. Amber against grey at matched lightness is
 * exactly what goes first in glare, on a stage, or to a colour-blind reader.
 *
 * So every chord tone is also heavier than its surroundings. That reads the
 * same in both themes, needs no colour at all, and keeps the root distinct
 * from the rest of the chord by one more step.
 */
const ROLE_STYLES: Record<ChordRole, string> = {
  root: "font-bold text-accent",
  bass: "font-bold text-accent",
  third: "font-semibold text-accent",
  fifth: "font-semibold text-accent",
  seventh: "font-semibold text-accent",
  extension: "font-semibold text-accent",
};

/** Read aloud after the note, where the colour cannot be seen. */
const ROLE_LABELS: Record<ChordRole, string> = {
  root: "the root",
  bass: "the bass note",
  third: "the third",
  fifth: "the fifth",
  seventh: "the seventh",
  extension: "an extension",
};

export interface FretboardProps {
  tuning: Tuning;
  /** Highest fret offered. 24 covers anything a bass part will ask for. */
  maxFret?: number;
  onPress: (stringIndex: number, fret: FretValue) => void;
  /**
   * Notes already in the column being edited, lit up on the neck.
   *
   * Building a chord otherwise means remembering what you have already put in
   * it while looking at a grid of 125 identical cells.
   */
  highlight?: FretMap;
  /**
   * Notes of the chord in force at the cursor, keyed by pitch class.
   *
   * Pitch classes rather than string/fret pairs, so the geometry stays here
   * and the caller does not recompute positions per string. This is the
   * "where are my options" layer: a bass player reading a chord change wants
   * to see which frets belong to it before picking a run through them.
   */
  chordTones?: ReadonlyMap<number, ChordRole>;
  /** Dims everything and blocks input while there is no part to write to. */
  disabled?: boolean;
  /** Rendered above the fret grid, inside the neck's own surface and its disabled wrapper. */
  latchStrip?: ReactNode;
}

export function Fretboard({
  tuning,
  maxFret = 24,
  onPress,
  highlight,
  chordTones,
  disabled = false,
  latchStrip,
}: FretboardProps) {
  // Bare note names, matching the tab staff. The octave lives in the
  // accessible label, where it disambiguates without adding visual noise.
  const labels = tuning.strings.map((s) => s.note);
  const frets = Array.from({ length: maxFret + 1 }, (_, fret) => fret);

  return (
    <div
      className={`border-t border-border-subtle bg-bg-sunken ${
        disabled ? "pointer-events-none opacity-40" : ""
      }`}
    >
      {latchStrip}
      <div data-testid="fret-grid" className="overflow-x-auto">
        <div className="w-max min-w-full px-1 pb-2">
          {/* Fret numbers along the top, so the neck is readable at a glance. */}
          <div className="flex items-end gap-px pl-9 pt-1">
            {frets.map((fret) => (
              <div
                key={fret}
                className={`w-9 shrink-0 text-center text-[0.6rem] ${
                  INLAYS.has(fret) ? "text-text-dim" : "text-text-faint"
                }`}
              >
                {fret}
              </div>
            ))}
          </div>

          {tuning.strings.map((_, stringIndex) => (
            <div key={stringIndex} className="flex items-center gap-px">
              <div className="w-9 shrink-0 pr-1 text-right font-mono text-xs text-text-dim">
                {labels[stringIndex]}
              </div>

              {frets.map((fret) => {
                const midi = fretToMidi(tuning, stringIndex, fret);
                const pitch = midiToNote(midi);
                const lit = highlight?.[String(stringIndex)] === fret;
                /*
                 * Precedence, in one place: a note actually in the column beats a
                 * chord tone. Being in the column is a fact about the part, and
                 * the chord is only ever a suggestion about what would fit.
                 */
                const role = lit ? undefined : chordTones?.get(midi % 12);
                /*
                 * Background tier and ink are kept apart because they are two
                 * questions -- where on the neck, and what the note is doing --
                 * and because two competing text-colour utilities in one class
                 * list resolve by stylesheet order rather than by what was meant.
                 */
                /*
                 * Exactly one background utility and one text utility per cell.
                 * Two of either on one element resolve by stylesheet order
                 * rather than by intent, which is how the chord-tone colour was
                 * lost once already.
                 */
                const tier = lit
                  ? "bg-accent"
                  : fret === 0
                    ? "rounded-l border-r-2 border-border-strong bg-bg-raised"
                    : INLAYS.has(fret)
                      ? "bg-fret-cell-inlay"
                      : "bg-fret-cell";
                const ink = lit
                  ? "font-semibold text-accent-text"
                  : role
                    ? ROLE_STYLES[role]
                    : "text-fret-number";
                return (
                  <button
                    key={fret}
                    type="button"
                    onClick={() => onPress(stringIndex, fret)}
                    // Deliberately generous: 2.25rem is about a thumb pad, and
                    // mis-taps here are the main way bad data gets captured.
                    className={`relative h-9 w-9 shrink-0 font-mono text-[0.7rem] transition-colors active:bg-accent active:text-accent-text ${tier} ${ink}`}
                    aria-label={`${labels[stringIndex]} string, fret ${fret}, ${noteLabel(pitch)}${
                      lit
                        ? ", in this column"
                        : role
                          ? `, ${ROLE_LABELS[role]} of this chord`
                          : ""
                    }`}
                    // Chord tones are not a toggle state, so they stay out of
                    // aria-pressed; the data attribute is what tests assert on.
                    aria-pressed={lit || undefined}
                    data-chord-role={role}
                  >
                    {/* The string itself, drawn through the cell. */}
                    <span
                      aria-hidden
                      className="pointer-events-none absolute inset-x-0 top-1/2 border-t border-tab-line"
                      style={{ borderTopColor: "var(--tab-line)" }}
                    />
                    <span className="relative">{fret}</span>
                  </button>
                );
              })}
            </div>
          ))}

          {/* Dead notes are constant in this music, so they get their own row. */}
          <div className="flex items-center gap-px pt-1">
            <div className="w-9 shrink-0 pr-1 text-right text-[0.6rem] text-text-faint">
              mute
            </div>
            {tuning.strings.map((_, stringIndex) => (
              <button
                key={stringIndex}
                type="button"
                onClick={() => onPress(stringIndex, "x")}
                className="h-7 w-9 shrink-0 rounded bg-fret-cell font-mono text-[0.7rem] text-fret-number active:bg-accent active:text-accent-text"
                aria-label={`Dead note on the ${labels[stringIndex]} string`}
              >
                {labels[stringIndex]}
                <span className="text-text-faint">x</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
