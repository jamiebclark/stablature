"use client";

/**
 * The real browser behind `RecorderPorts`, and the page's one recorder (contracts/recorder.md §1).
 *
 * Nothing here asks for the microphone at import: `getUserMedia` is only reached through `recorder.start`, which
 * only a chosen "Record memo" calls (INV-013). The analyser reads a level and is never connected to a destination,
 * so it makes no sound.
 */

import { db } from "../local/db";
import { addMemoNotice, saveMemo } from "../local/memos";
import { createRecorder, type MediaRecorderLike, type Recorder, type RecorderPorts, type StreamLike } from "./recorder";
import { ensurePersisted } from "./storage";

function makeAnalyser(stream: StreamLike): { level(): number; close(): Promise<void> } | null {
  try {
    const Ctx: typeof AudioContext | undefined =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return null;
    const ctx = new Ctx();
    const source = ctx.createMediaStreamSource(stream as unknown as MediaStream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);
    const data = new Uint8Array(analyser.fftSize);
    return {
      level() {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (const v of data) sum += ((v - 128) / 128) ** 2;
        return Math.min(1, Math.sqrt(sum / data.length) * 3);
      },
      close: () => ctx.close().catch(() => undefined),
    };
  } catch {
    return null;
  }
}

export function realPorts(): RecorderPorts {
  return {
    getUserMedia: (c) => navigator.mediaDevices.getUserMedia(c) as unknown as Promise<StreamLike>,
    isTypeSupported: (t) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t),
    makeRecorder: (stream, opts) =>
      new MediaRecorder(stream as unknown as MediaStream, opts) as unknown as MediaRecorderLike,
    makeAnalyser,
    now: () => performance.now(),
    setTimer(fn, ms) {
      const id = setTimeout(fn, ms);
      return () => clearTimeout(id);
    },
    drafts: {
      async create(draft) {
        await db.memoDrafts.put(draft);
      },
      async addChunk(draftId, index, bytes) {
        await db.memoDraftChunks.put({ draftId, index, bytes });
      },
      async discard(draftId) {
        await db.transaction("rw", db.memoDrafts, db.memoDraftChunks, async () => {
          await db.memoDraftChunks.where("draftId").equals(draftId).delete();
          await db.memoDrafts.delete(draftId);
        });
      },
    },
    async save(draft, bytes, durationMs) {
      await saveMemo(draft, bytes, durationMs);
      // The first saved memo is when the device first has something worth keeping (FR-070).
      void ensurePersisted((words) => addMemoNotice({ partId: draft.partId, kind: "persist", words })).catch(
        () => undefined,
      );
    },
    notice: (n) => addMemoNotice(n),
    visibility: {
      onHidden(fn) {
        const onVisibility = () => {
          if (document.visibilityState === "hidden") fn();
        };
        document.addEventListener("visibilitychange", onVisibility);
        window.addEventListener("pagehide", fn);
        return () => {
          document.removeEventListener("visibilitychange", onVisibility);
          window.removeEventListener("pagehide", fn);
        };
      },
    },
  };
}

let instance: Recorder | null = null;

/** The page's one recorder. */
export function getRecorder(): Recorder {
  instance ??= createRecorder(realPorts());
  return instance;
}
