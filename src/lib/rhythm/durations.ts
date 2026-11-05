/**
 * The one table of the six durations. Every surface reads it, so a position, a mark, the words and
 * a length cannot disagree. An unknown stored value reads as unset everywhere.
 */

export type DurationId = "w" | "h" | "q" | "8" | "16" | "32";

export interface Duration {
  readonly id: DurationId;
  readonly mark: string;
  readonly words: string;
  /** Whole-number ticks, so every grouping of 3, 5, 7 and 9 lands on a tick. */
  readonly ticks: number;
}

export const TICKS_PER_BEAT = 360360;

export const DURATIONS: readonly Duration[] = [
  { id: "w", mark: "w", words: "whole note", ticks: 1441440 },
  { id: "h", mark: "h", words: "half note", ticks: 720720 },
  { id: "q", mark: "q", words: "quarter note", ticks: 360360 },
  { id: "8", mark: "8", words: "eighth note", ticks: 180180 },
  { id: "16", mark: "16", words: "sixteenth note", ticks: 90090 },
  { id: "32", mark: "32", words: "thirty-second note", ticks: 45045 },
];

/** The table's entry for a stored value, or null for anything else. */
export function readDuration(value: unknown): Duration | null {
  if (typeof value !== "string") return null;
  return DURATIONS.find((d) => d.id === value) ?? null;
}

/** Tapping the position that is already set clears it; any other tap sets it. */
export function nextDuration(stored: unknown, tapped: DurationId): DurationId | null {
  return readDuration(stored)?.id === tapped ? null : tapped;
}
