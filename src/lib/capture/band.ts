/**
 * How the capture band decides to wrap, and where it must sit so the cursor's line is its bottom line.
 * Pure and React-free: the hook reads the DOM, these decide.
 */

/** Whole lines of height `line`, separated by `gap`, that fit in `band`. 0 when `line` is 0. */
export function bandLines(band: number, line: number, gap: number): number {
  if (!(line > 0)) return 0;
  return Math.max(0, Math.floor((band + gap) / (line + gap)));
}

/** True when two or more whole lines fit. */
export function bandWraps(band: number, line: number, gap: number): boolean {
  return bandLines(band, line, gap) >= 2;
}

/**
 * Where the band must be, for the cursor's line to be its bottom line.
 * All inputs are in px, measured in the band's coordinates at the moment of anchoring.
 */
export function anchorFor(input: {
  /** The band's content height. */
  band: number;
  /** The staff's height, without runway. */
  contentHeight: number;
  /** The cursor line's bottom, measured from the content top. */
  lineBottom: number;
}): { runway: number; overflows: boolean } {
  const overflows = input.contentHeight > input.band;
  const runway = overflows ? Math.max(0, input.band - input.lineBottom) : 0;
  return { runway, overflows };
}
