import { MAX_FRET } from "@/components/capture/Fretboard";

/** How long a `1` or `2` waits for a second digit. */
export const FRET_WAIT_MS = 600;

export interface FretEntry {
  readonly waiting: 1 | 2 | null;
}

export type FretInput =
  | { readonly type: "digit"; readonly digit: number }
  | { readonly type: "enter" }
  | { readonly type: "timeout" }
  | { readonly type: "other" };

export interface FretStep {
  readonly state: FretEntry;
  /** Frets to enter now, in order. */
  readonly enters: readonly number[];
}

export const IDLE: FretEntry = { waiting: null };

/** A digit alone: 1 and 2 might start a pair, the rest are whole frets. */
function fresh(digit: number): FretStep {
  return digit === 1 || digit === 2
    ? { state: { waiting: digit }, enters: [] }
    : { state: IDLE, enters: [digit] };
}

export function stepFretEntry(state: FretEntry, input: FretInput, maxFret: number = MAX_FRET): FretStep {
  const w = state.waiting;
  if (w === null) {
    return input.type === "digit" ? fresh(input.digit) : { state: IDLE, enters: [] };
  }
  switch (input.type) {
    case "digit": {
      const pair = w * 10 + input.digit;
      if (pair <= maxFret) return { state: IDLE, enters: [pair] };
      const next = fresh(input.digit);
      return { state: next.state, enters: [w, ...next.enters] };
    }
    case "enter":
    case "timeout":
    case "other":
      return { state: IDLE, enters: [w] };
  }
}
