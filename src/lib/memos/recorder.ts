/**
 * The recorder (contracts/recorder.md). React-free: every browser API arrives through `RecorderPorts`.
 *
 * One recorder, one way out: every ending goes through `finish(ending)`, which always releases the microphone
 * first, then applies the ending's save rule, then says one thing. A second trigger after the first is a no-op.
 */

import { newId } from "../ids";
import type { MemoDraft, MemoNotice } from "../local/db";
import {
  ANNOUNCE_AT_MS,
  BITRATE,
  DURATION_SLACK_MS,
  MAX_BYTES,
  MAX_DURATION_MS,
  MIN_DURATION_MS,
  TIMESLICE_MS,
  WARN_LAST_MS,
} from "./limits";
import { chooseFormat, normaliseFormat } from "./formats";
import * as sound from "./sound";
import { EXTRA_NOTICE_WORDS, noticeWords, type EndingKind } from "./words";

export interface BlobLike {
  size: number;
  arrayBuffer(): Promise<ArrayBuffer>;
}

export interface MediaRecorderLike {
  mimeType: string;
  start(timesliceMs: number): void;
  stop(): void;
  ondataavailable: ((e: { data: BlobLike }) => void) | null;
  onstart: (() => void) | null;
  onstop: (() => void) | null;
  onerror: (() => void) | null;
}

export interface TrackLike {
  stop(): void;
  onended: (() => void) | null;
  onmute: (() => void) | null;
}

export interface StreamLike {
  getTracks(): TrackLike[];
}

export interface DraftStore {
  create(draft: MemoDraft): Promise<void>;
  addChunk(draftId: string, index: number, bytes: ArrayBuffer): Promise<void>;
  discard(draftId: string): Promise<void>;
}

export interface RecorderPorts {
  getUserMedia(c: { audio: true }): Promise<StreamLike>;
  isTypeSupported(type: string): boolean;
  makeRecorder(stream: StreamLike, opts: { mimeType: string; audioBitsPerSecond: number }): MediaRecorderLike;
  makeAnalyser(stream: StreamLike): { level(): number; close(): Promise<void> } | null;
  now(): number;
  setTimer(fn: () => void, ms: number): () => void;
  drafts: DraftStore;
  save(draft: MemoDraft, bytes: ArrayBuffer, durationMs: number): Promise<void>;
  notice(n: Omit<MemoNotice, "id" | "at">): Promise<void>;
  visibility: { onHidden(fn: () => void): () => void };
}

export interface PartRef {
  id: string;
  bandId: string;
  songId: string;
  label: string;
}

export type RecorderPhase = "idle" | "asking" | "recording" | "ending" | "held";

export interface RecorderSnapshot {
  phase: RecorderPhase;
  partId: string | null;
  elapsedMs: number;
  leftMs: number;
  level: number;
  /** Within the last `WARN_LAST_MS`. */
  warn: boolean;
  /** The `leftMs` thresholds announced so far, in order. */
  announced: readonly number[];
  /** The latest announcement words, for the live region. */
  announce: string | null;
  held: { durationMs: number; format: string } | null;
}

export interface Recorder {
  start(part: PartRef): void;
  stop(): void;
  discard(): void;
  leave(): void;
  retrySave(): Promise<void>;
  downloadHeld(): { bytes: ArrayBuffer; format: string; durationMs: number } | null;
  subscribe(fn: () => void): () => void;
  snapshot(): RecorderSnapshot;
}

const TICK_MS = 200;
const FLUSH_WAIT_MS = 1_000;

const KEEP: readonly EndingKind[] = ["stopped", "limit-time", "limit-size", "cut-short", "hidden", "left", "recorder-error"];

/** The save rule of each ending: kept (if long enough), dropped, nothing started, or held. */
export const ENDINGS: Record<EndingKind, { save: "keep" | "drop" | "none" | "hold" | "recover" }> = {
  stopped: { save: "keep" },
  "limit-time": { save: "keep" },
  "limit-size": { save: "keep" },
  discarded: { save: "drop" },
  refused: { save: "none" },
  "no-device": { save: "none" },
  "cut-short": { save: "keep" },
  hidden: { save: "keep" },
  left: { save: "keep" },
  "recorder-error": { save: "keep" },
  "too-short": { save: "drop" },
  "out-of-room": { save: "hold" },
  recovered: { save: "recover" },
  unrecoverable: { save: "drop" },
  unsupported: { save: "none" },
  "save-failed": { save: "hold" },
};

/** The longest run of whole chunks that fits in `max` bytes. Returns how many chunks. */
export function prefixWithin(sizes: readonly number[], max: number): number {
  let total = 0;
  let n = 0;
  for (const size of sizes) {
    if (total + size > max) break;
    total += size;
    n++;
  }
  return n;
}

function isQuota(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { name?: string }).name === "QuotaExceededError";
}

export function createRecorder(ports: RecorderPorts): Recorder {
  let phase: RecorderPhase = "idle";
  let part: PartRef | null = null;
  let draft: MemoDraft | null = null;
  let stream: StreamLike | null = null;
  let analyser: { level(): number; close(): Promise<void> } | null = null;
  let recorder: MediaRecorderLike | null = null;
  let chunks: ArrayBuffer[] = [];
  let startedAt: number | null = null;
  let cancelTimers: (() => void)[] = [];
  let unwatch: (() => void) | null = null;
  let endingNow = false;
  let early: EndingKind | null = null; // an ending asked for while the microphone was still being asked for
  let announced: number[] = [];
  let announce: string | null = null;
  let held: { draft: MemoDraft; bytes: ArrayBuffer; durationMs: number } | null = null;
  let finalChunk: (() => void) | null = null;
  const listeners = new Set<() => void>();

  const emit = () => {
    for (const l of [...listeners]) l();
  };

  const elapsed = () => (startedAt === null ? 0 : Math.max(0, ports.now() - startedAt));

  function checkAnnounce() {
    if (phase !== "recording") return;
    const left = MAX_DURATION_MS - elapsed();
    for (const at of ANNOUNCE_AT_MS) {
      if (left <= at && !announced.includes(at)) {
        announced = [...announced, at];
        announce = `${Math.round(at / 1000)} seconds left`;
      }
    }
  }

  function snapshot(): RecorderSnapshot {
    checkAnnounce();
    const e = elapsed();
    const left = Math.max(0, MAX_DURATION_MS - e);
    return {
      phase,
      partId: part?.id ?? held?.draft.partId ?? null,
      elapsedMs: Math.min(e, MAX_DURATION_MS),
      leftMs: left,
      level: phase === "recording" ? (analyser?.level() ?? 0) : 0,
      warn: phase === "recording" && left <= WARN_LAST_MS,
      announced,
      announce,
      held: held ? { durationMs: held.durationMs, format: held.draft.format } : null,
    };
  }

  function say(kind: EndingKind | "saved", partId: string, keptMs = 0) {
    const words = kind === "saved" ? EXTRA_NOTICE_WORDS.saved : noticeWords(kind, keptMs);
    if (words === null) return Promise.resolve();
    return ports.notice({ partId, kind, words }).catch(() => undefined);
  }

  function reset() {
    part = null;
    draft = null;
    stream = null;
    analyser = null;
    recorder = null;
    chunks = [];
    startedAt = null;
    announced = [];
    announce = null;
    endingNow = false;
    early = null;
    finalChunk = null;
  }

  /** Steps 1-5 of every ending: nothing can leave the microphone open. */
  function release() {
    for (const track of stream?.getTracks() ?? []) {
      track.onended = null;
      track.onmute = null;
      try {
        track.stop();
      } catch {
        // already stopped
      }
    }
    void analyser?.close().catch(() => undefined);
    for (const cancel of cancelTimers) cancel();
    cancelTimers = [];
    unwatch?.();
    unwatch = null;
    sound.release("recorder");
  }

  async function holdOrSave(d: MemoDraft, bytes: ArrayBuffer, durationMs: number, partId: string) {
    try {
      await ports.save(d, bytes, durationMs);
      held = null;
      phase = "idle";
      reset();
      emit();
      return true;
    } catch (e) {
      held = { draft: d, bytes, durationMs };
      phase = "held";
      const p = part;
      reset();
      part = p;
      emit();
      await say(isQuota(e) ? "out-of-room" : "save-failed", partId);
      return false;
    }
  }

  async function finish(ending: EndingKind): Promise<void> {
    if (endingNow || phase === "idle" || phase === "held") return;
    endingNow = true;
    const current = part;
    if (!current) return;
    const wasRecording = phase === "recording";
    phase = "ending";
    emit();

    const keeping = KEEP.includes(ending);
    const d = draft;
    const live = recorder;
    // Flush: stop the recorder and wait (at most 1 s) for its final chunk before the microphone goes.
    let flushed: Promise<void> = Promise.resolve();
    if (keeping && wasRecording && live) {
      flushed = new Promise<void>((resolve) => {
        const cancel = ports.setTimer(resolve, FLUSH_WAIT_MS);
        finalChunk = () => {
          cancel();
          resolve();
        };
      });
      try {
        live.stop();
      } catch {
        finalChunk?.();
      }
    }
    const measured = elapsed();
    release();
    await flushed;

    const sizes = chunks.map((c) => c.byteLength);
    const total = sizes.reduce((a, b) => a + b, 0);
    const spoken = Math.min(measured, MAX_DURATION_MS + DURATION_SLACK_MS);

    if (!keeping || !wasRecording || !d) {
      if (d) await ports.drafts.discard(d.id).catch(() => undefined);
      phase = "idle";
      reset();
      emit();
      await say(ending, current.id);
      return;
    }

    if (spoken < MIN_DURATION_MS || total === 0) {
      await ports.drafts.discard(d.id).catch(() => undefined);
      phase = "idle";
      reset();
      emit();
      await say("too-short", current.id);
      return;
    }

    let kept = chunks.length;
    let durationMs = ending === "limit-time" ? MAX_DURATION_MS : spoken;
    if (total > MAX_BYTES) {
      kept = prefixWithin(sizes, MAX_BYTES);
      const keptBytes = sizes.slice(0, kept).reduce((a, b) => a + b, 0);
      durationMs = Math.max(1, Math.floor((durationMs * keptBytes) / total));
    }
    const out = new Uint8Array(sizes.slice(0, kept).reduce((a, b) => a + b, 0));
    let at = 0;
    for (const chunk of chunks.slice(0, kept)) {
      out.set(new Uint8Array(chunk), at);
      at += chunk.byteLength;
    }
    const ok = await holdOrSave(d, out.buffer, durationMs, current.id);
    if (ok) await say(ending, current.id, durationMs);
  }

  function schedule() {
    const tick = () => {
      if (phase !== "recording") return;
      checkAnnounce();
      emit();
      cancelTimers.push(ports.setTimer(tick, TICK_MS));
    };
    cancelTimers.push(ports.setTimer(tick, TICK_MS));
    cancelTimers.push(ports.setTimer(() => void finish("limit-time"), MAX_DURATION_MS));
  }

  async function begin(target: PartRef) {
    const format = chooseFormat((t) => ports.isTypeSupported(t));
    if (format === null) {
      await finish("unsupported");
      return;
    }
    let got: StreamLike;
    try {
      got = await ports.getUserMedia({ audio: true });
    } catch (e) {
      const name = (e as { name?: string } | null)?.name;
      await finish(name === "NotAllowedError" || name === "SecurityError" ? "refused" : "no-device");
      return;
    }
    stream = got;
    if (early) {
      // Stopped or left before the microphone opened: nothing was recorded.
      const why = early;
      early = null;
      phase = "recording";
      await finish(why === "discarded" ? "discarded" : "too-short");
      return;
    }
    analyser = ports.makeAnalyser(got);
    const rec = ports.makeRecorder(got, { mimeType: format, audioBitsPerSecond: BITRATE });
    recorder = rec;
    const actual = normaliseFormat(rec.mimeType || format);
    if (actual === null) {
      phase = "recording";
      await finish("unsupported");
      return;
    }
    const d: MemoDraft = {
      id: newId(),
      memoId: newId(),
      partId: target.id,
      bandId: target.bandId,
      songId: target.songId,
      format: actual,
      startedAt: Date.now(),
    };
    draft = d;
    try {
      await ports.drafts.create(d);
    } catch {
      // The draft is a safety net; recording still works without it.
    }
    let index = 0;
    // The final chunk is only in once the recorder has stopped AND every chunk read has landed; an earlier chunk
    // still being read must not release the flush.
    const reading: Promise<unknown>[] = [];
    rec.onstop = () => void Promise.all(reading).then(() => finalChunk?.());
    rec.ondataavailable = (e) => {
      if (e.data.size === 0) return;
      reading.push(e.data.arrayBuffer().then((bytes) => {
        chunks.push(bytes);
        const i = index++;
        void ports.drafts.addChunk(d.id, i, bytes).catch(() => undefined);
        const total = chunks.reduce((a, c) => a + c.byteLength, 0);
        const largest = chunks.reduce((a, c) => Math.max(a, c.byteLength), 0);
        if (phase === "recording" && total + 2 * largest > MAX_BYTES) void finish("limit-size");
      }));
    };
    rec.onerror = () => void finish("recorder-error");
    rec.onstart = () => {
      startedAt = ports.now();
      schedule();
      emit();
    };
    for (const track of got.getTracks()) {
      track.onended = () => void finish("cut-short");
      track.onmute = () => void finish("cut-short");
    }
    unwatch = ports.visibility.onHidden(() => void finish("hidden"));
    phase = "recording";
    emit();
    try {
      rec.start(TIMESLICE_MS);
    } catch {
      await finish("recorder-error");
    }
  }

  const api: Recorder = {
    start(target) {
      if (phase !== "idle") return;
      sound.claim("recorder", () => api.stop());
      part = target;
      phase = "asking";
      emit();
      void begin(target);
    },
    stop() {
      if (phase === "asking") early = "stopped";
      else void finish("stopped");
    },
    discard() {
      if (phase === "asking") early = "discarded";
      else if (phase === "held") {
        const d = held;
        const partId = d?.draft.partId ?? part?.id;
        held = null;
        phase = "idle";
        reset();
        emit();
        if (d) void ports.drafts.discard(d.draft.id).catch(() => undefined);
        if (partId) void say("discarded", partId);
      } else void finish("discarded");
    },
    leave() {
      if (phase === "asking") early = "left";
      else void finish("left");
    },
    async retrySave() {
      if (phase !== "held" || !held) return;
      const h = held;
      try {
        await ports.save(h.draft, h.bytes, h.durationMs);
      } catch (e) {
        await say(isQuota(e) ? "out-of-room" : "save-failed", h.draft.partId);
        return;
      }
      held = null;
      phase = "idle";
      reset();
      emit();
      await say("saved", h.draft.partId);
    },
    downloadHeld() {
      return held ? { bytes: held.bytes, format: held.draft.format, durationMs: held.durationMs } : null;
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    snapshot,
  };
  return api;
}
