import type { DurationId } from "@/lib/rhythm/durations";

/**
 * SVG path data for the rhythm symbols: one table, shared by the staff (flags, rests, the whole-note oval)
 * and the inspector's duration buttons (`NoteSymbol`). Every path is drawn in `currentColor`.
 * Coordinates are in a 12 x 20 box; the stem is at x = 8 and runs from y = 2 to the notehead.
 */

export const GLYPH_BOX = { width: 12, height: 20 } as const;

/** An elliptical notehead centred at (6, 16), tilted as in engraving. */
export const NOTEHEAD = { cx: 6, cy: 16, rx: 3.6, ry: 2.6, rotate: -20 } as const;

/** The stem, from the top of the symbol down to the notehead's right edge. */
export const STEM = "M9.2 16 V2" as const;

/** Flags hang from the stem top; level k is level 1 moved down by `FLAG_STEP * (k - 1)`, see `flagPath`. */
export const FLAG_STEP = 4;

/** The whole note's open oval, no stem. */
export const OVAL = "M6 13.4 a4.4 2.9 0 1 0 0.01 0 Z" as const;

/** Six rests, one per duration, each in a 12 x 20 box. */
export const RESTS: Record<DurationId, string> = {
  w: "M1 6 H11 M2 6 V10 H10 V6",
  h: "M1 14 H11 M2 14 V10 H10 V14",
  q: "M5 2 L8 6 L5 9 L8 13 C5 13 4 15 6 18",
  "8": "M7.5 1 L4.5 19.5 M5.7 3 C0.5 2.5 0.5 6.5 5.4 6.5",
  "16": "M7.5 1 L4.5 19.5 M5.7 3 C0.5 2.5 0.5 6.5 5.4 6.5 M5.2 8 C0.3 7.5 0.3 12.5 5 12.5",
  "32": "M7.5 1 L4.5 19.5 M5.7 3 C0.5 2.5 0.5 6.5 5.4 6.5 M5.2 8 C0.3 7.5 0.3 12.5 5 12.5 M4.8 14 C0.3 13.5 0.3 18 4.6 18",
};

/** Whether the duration's symbol has a stem, a filled notehead and how many flags. */
export const NOTES: Record<DurationId, { stem: boolean; filled: boolean; flags: 0 | 1 | 2 | 3 }> = {
  w: { stem: false, filled: false, flags: 0 },
  h: { stem: true, filled: false, flags: 0 },
  q: { stem: true, filled: true, flags: 0 },
  "8": { stem: true, filled: true, flags: 1 },
  "16": { stem: true, filled: true, flags: 2 },
  "32": { stem: true, filled: true, flags: 3 },
};

/** The flag path for level `k` (1-based). */
export function flagPath(level: number): string {
  const dy = FLAG_STEP * (level - 1);
  return `M9.2 ${2 + dy} C9.2 ${6 + dy} 13 ${7.5 + dy} 12 ${11.5 + dy}`;
}

/**
 * The staff's flag: a short straight stroke in a 7 x 4 box whose bottom edge is the stem's lower end, rising 0.8px to the
 * right. The path sits half a stroke (1px) above the box's bottom, so the ink ends on the stem's end, not below it.
 * Level k is the same path moved up by the flag step, by CSS.
 */
export const STAFF_FLAG = { width: 7, height: 4, path: "M0.5 2.95 L6.5 2.15" } as const;
