/** What a tap reading may offer to set, and what the click accepts (which is what sync accepts). */
export const TAP_TEMPO_MIN = 20;
export const TAP_TEMPO_MAX = 400;
export const STORED_TEMPO_MIN = 1;
export const STORED_TEMPO_MAX = 999;

/** The integer if it is whole and in the stored range, otherwise null. */
export function usableTempo(bpm: unknown): number | null {
  if (typeof bpm !== "number" || !Number.isInteger(bpm)) return null;
  return bpm >= STORED_TEMPO_MIN && bpm <= STORED_TEMPO_MAX ? bpm : null;
}
