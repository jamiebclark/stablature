import { vi } from "vitest";
import type { MemoDraft } from "../../local/db";
import type { MediaRecorderLike, RecorderPorts, StreamLike, TrackLike } from "../recorder";

/** Fake ports on a fake clock, shared by the recorder's probes. */
export function fakePorts(opts: { mime?: string; finalChunk?: number } = {}) {
  let clock = 0;
  const timers: { at: number; fn: () => void; live: boolean }[] = [];
  const track: TrackLike & { stopped: number } = { stopped: 0, stop() { this.stopped++; }, onended: null, onmute: null };
  const stream: StreamLike = { getTracks: () => [track] };
  const analyserClose = vi.fn(async () => {});
  let rec!: MediaRecorderLike;
  let finalChunk = opts.finalChunk ?? 0;
  let hidden: (() => void) | null = null;

  const saves: { draft: MemoDraft; bytes: ArrayBuffer; durationMs: number }[] = [];
  const notices: { partId: string; kind: string; words: string }[] = [];
  const discards: string[] = [];

  const blob = (size: number) => ({ size, arrayBuffer: async () => new ArrayBuffer(size) });

  const ports: RecorderPorts = {
    getUserMedia: vi.fn(async () => stream),
    isTypeSupported: () => true,
    makeRecorder: () => {
      rec = {
        mimeType: opts.mime ?? "audio/webm;codecs=opus",
        start() {
          rec.onstart?.();
        },
        stop() {
          if (finalChunk > 0) rec.ondataavailable?.({ data: blob(finalChunk) });
          else rec.ondataavailable?.({ data: blob(0) });
          rec.onstop?.();
        },
        ondataavailable: null,
        onstart: null,
        onstop: null,
        onerror: null,
      };
      return rec;
    },
    makeAnalyser: () => ({ level: () => 0.5, close: analyserClose }),
    now: () => clock,
    setTimer(fn, ms) {
      const t = { at: clock + ms, fn, live: true };
      timers.push(t);
      return () => {
        t.live = false;
      };
    },
    drafts: {
      create: vi.fn(async () => {}),
      addChunk: vi.fn(async () => {}),
      discard: vi.fn(async (id: string) => {
        discards.push(id);
      }),
    },
    save: vi.fn(async (draft, bytes, durationMs) => {
      saves.push({ draft, bytes, durationMs });
    }),
    notice: vi.fn(async (n) => {
      notices.push(n);
    }),
    visibility: {
      onHidden(fn) {
        hidden = fn;
        return () => {
          hidden = null;
        };
      },
    },
  };

  const settle = async () => {
    for (let i = 0; i < 8; i++) await Promise.resolve();
  };

  return {
    ports,
    track,
    analyserClose,
    saves,
    notices,
    discards,
    settle,
    setFinalChunk(n: number) {
      finalChunk = n;
    },
    get recorder() {
      return rec;
    },
    fireHidden: () => hidden?.(),
    /** Move the fake clock, running every due timer in order. */
    async advance(ms: number) {
      const target = clock + ms;
      for (;;) {
        const due = timers.filter((t) => t.live && t.at <= target).sort((a, b) => a.at - b.at)[0];
        if (!due) break;
        clock = Math.max(clock, due.at);
        due.live = false;
        due.fn();
        await settle();
      }
      clock = target;
    },
    /** A chunk arrives from the recorder. */
    async chunk(size: number) {
      rec.ondataavailable?.({ data: blob(size) });
      await settle();
    },
  };
}
