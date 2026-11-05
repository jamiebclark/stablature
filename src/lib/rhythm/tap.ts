/**
 * The tap-tempo run, as a pure reducer over tap times (ms). Held only in the open sheet's state.
 * Rules: spec FR-020 to FR-023, research R11 and R12.
 */
import { TAP_TEMPO_MAX, TAP_TEMPO_MIN } from "./tempo";

export const MAX_TAPS = 9;
export const RESTART_GAP_MS = 3000;

export interface TapRun {
  /** Tap times in ms, the most recent nine. */
  readonly taps: readonly number[];
  /** The last tap restarted a run of one after a gap: two taps too far apart to read. */
  readonly tooSlow: boolean;
}

export type TapReading =
  | { kind: "waiting"; tapsNeeded: 1 | 2 | 3 }
  | { kind: "reading"; bpm: number }
  | { kind: "out-of-range"; bpm: number | null };

export const EMPTY_RUN: TapRun = { taps: [], tooSlow: false };

function meanInterval(taps: readonly number[]): number {
  return (taps[taps.length - 1] - taps[0]) / (taps.length - 1);
}

export function addTap(run: TapRun, time: number): TapRun {
  const { taps } = run;
  if (taps.length === 0) return { taps: [time], tooSlow: false };
  const last = taps[taps.length - 1];
  if (time <= last) return run;
  const gap = time - last;
  if (gap > RESTART_GAP_MS) return { taps: [time], tooSlow: taps.length === 1 };
  if (taps.length >= 2) {
    const mean = meanInterval(taps);
    if (gap < mean / 2 || gap > mean * 2) return { taps: [time], tooSlow: false };
  }
  return { taps: [...taps, time].slice(-MAX_TAPS), tooSlow: false };
}

export function readTaps(run: TapRun): TapReading {
  if (run.tooSlow) return { kind: "out-of-range", bpm: null };
  const n = run.taps.length;
  if (n < 3) return { kind: "waiting", tapsNeeded: (3 - n) as 1 | 2 | 3 };
  const bpm = Math.round(60000 / meanInterval(run.taps));
  return bpm >= TAP_TEMPO_MIN && bpm <= TAP_TEMPO_MAX
    ? { kind: "reading", bpm }
    : { kind: "out-of-range", bpm };
}
