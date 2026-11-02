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

import type { FretMap, FretValue } from "@/lib/model";
import { fretToMidi, type Tuning } from "@/lib/tunings";
import { midiToNote, noteLabel } from "@/lib/pitch";

/** Frets with position inlays on a real neck. */
const INLAYS = new Set([3, 5, 7, 9, 12, 15, 17, 19, 21, 24]);

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
  /** Dims everything and blocks input while there is no part to write to. */
  disabled?: boolean;
}

export function Fretboard({
  tuning,
  maxFret = 24,
  onPress,
  highlight,
  disabled = false,
}: FretboardProps) {
  // Bare note names, matching the tab staff. The octave lives in the
  // accessible label, where it disambiguates without adding visual noise.
  const labels = tuning.strings.map((s) => s.note);
  const frets = Array.from({ length: maxFret + 1 }, (_, fret) => fret);

  return (
    <div
      className={`overflow-x-auto border-t border-border-subtle bg-bg-sunken ${
        disabled ? "pointer-events-none opacity-40" : ""
      }`}
    >
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
              const pitch = midiToNote(fretToMidi(tuning, stringIndex, fret));
              const lit = highlight?.[String(stringIndex)] === fret;
              return (
                <button
                  key={fret}
                  type="button"
                  onClick={() => onPress(stringIndex, fret)}
                  // Deliberately generous: 2.25rem is about a thumb pad, and
                  // mis-taps here are the main way bad data gets captured.
                  className={`fret-cell relative h-9 w-9 shrink-0 font-mono text-[0.7rem] transition-colors active:bg-accent active:text-accent-text ${
                    lit
                      ? "!bg-accent font-semibold !text-accent-text"
                      : fret === 0
                        ? "fret-nut rounded-l border-r-2 border-border-strong"
                        : INLAYS.has(fret)
                          ? "fret-cell-inlay"
                          : ""
                  }`}
                  aria-label={`${labels[stringIndex]} string, fret ${fret}, ${noteLabel(pitch)}${
                    lit ? ", in this column" : ""
                  }`}
                  aria-pressed={lit || undefined}
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
          <div className="w-9 shrink-0 pr-1 text-right text-[0.6rem] text-text-faint">mute</div>
          {tuning.strings.map((_, stringIndex) => (
            <button
              key={stringIndex}
              type="button"
              onClick={() => onPress(stringIndex, "x")}
              className="fret-cell h-7 w-9 shrink-0 rounded font-mono text-[0.7rem] active:!bg-accent active:!text-accent-text"
              aria-label={`Dead note on the ${labels[stringIndex]} string`}
            >
              {labels[stringIndex]}
              <span className="text-text-faint">x</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
