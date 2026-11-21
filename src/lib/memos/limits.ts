/**
 * Every limit a voice memo is held to, in one place.
 *
 * The recorder, the wire schema, the server route and the words all import
 * from here, so a limit cannot be changed in one and forgotten in another.
 */

/** The recorder stops itself here. */
export const MAX_DURATION_MS = 180_000;
/** Shorter than this is not kept. */
export const MIN_DURATION_MS = 1_000;
/** Timer jitter at stop: a row may claim a little over the limit. */
export const DURATION_SLACK_MS = 5_000;
export const MAX_BYTES = 8 * 1024 * 1024;
/** What one band may keep on the server. */
export const BAND_TOTAL_BYTES = 500 * 1024 * 1024;
/** `MediaRecorder.start(TIMESLICE_MS)`, so chunks reach storage as they are made. */
export const TIMESLICE_MS = 250;
export const BITRATE = 96_000;
/** The countdown changes style at this many ms left. */
export const WARN_LAST_MS = 15_000;
/** Live announcements, by ms left. */
export const ANNOUNCE_AT_MS = [60_000, 30_000, 10_000] as const;
/** Newest memos shown before "Show N earlier". */
export const LIST_VISIBLE = 3;
/** The shortest wait before asking again about a memo that was not uploaded yet. */
export const WAITING_RECHECK_MS = 5_000;
/** Upload and fetch retry waits. The last one repeats. */
export const BACKOFF_MS = [5_000, 15_000, 45_000, 120_000, 300_000] as const;
export const LABEL_MAX = 120;
/** The most a stamped recorder name may be; the server cuts a longer account name to this. */
export const RECORDER_NAME_MAX = 200;
