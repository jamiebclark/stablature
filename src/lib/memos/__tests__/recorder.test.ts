import { beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_BYTES, MAX_DURATION_MS } from "../limits";
import { createRecorder, prefixWithin } from "../recorder";
import { resetSound } from "../sound";
import { fakePorts } from "./recorder-fakes";

/** INV-009: the limits (L1-L5), on a fake clock and fake chunk sizes. The ending table E1-E16 comes with US3. */
const part = { id: "p1", bandId: "b1", songId: "s1", label: "A" };
const MiB = 1024 * 1024;

async function started(opts: Parameters<typeof fakePorts>[0] = {}) {
  const f = fakePorts(opts);
  const r = createRecorder(f.ports);
  r.start(part);
  await f.settle();
  return { f, r };
}

describe("recorder limits", () => {
  beforeEach(resetSound);

  it("L1: stops at exactly 3:00 and keeps the memo", async () => {
    const { f, r } = await started();
    for (let s = 1; s <= 179; s++) {
      await f.advance(1000);
      await f.chunk(12_000);
    }
    expect(f.saves).toHaveLength(0);
    await f.advance(1000);
    await f.settle();
    expect(f.saves).toHaveLength(1);
    expect(f.saves[0].durationMs).toBe(MAX_DURATION_MS);
    expect(f.notices.at(-1)?.words).toBe("Stopped at the 3-minute limit. The memo is saved.");
    expect(r.snapshot().phase).toBe("idle");
    expect(f.track.stopped).toBeGreaterThan(0);
    expect(f.analyserClose).toHaveBeenCalled();
  });

  it("L2: 1 MiB chunks stop after the 7th, and the saved size is within the cap", async () => {
    const { f, r } = await started({ finalChunk: MiB });
    for (let i = 1; i <= 6; i++) {
      await f.advance(1000);
      await f.chunk(MiB);
      expect(r.snapshot().phase).toBe("recording");
    }
    await f.advance(1000);
    await f.chunk(MiB);
    await f.advance(0);
    await f.settle();
    expect(f.saves).toHaveLength(1);
    expect(f.saves[0].bytes.byteLength).toBeLessThanOrEqual(MAX_BYTES);
    expect(f.notices.at(-1)?.words).toBe("Stopped at the 8 MB limit. The memo is saved.");
  });

  it("L3: an oversized final chunk cannot push the saved size past the cap", async () => {
    const { f } = await started({ finalChunk: 6 * MiB });
    for (let i = 1; i <= 5; i++) {
      await f.advance(1000);
      await f.chunk(MiB);
    }
    expect(f.saves).toHaveLength(0);
    await f.advance(1000);
    await f.chunk(2 * MiB); // 7 held, largest 2: 7 + 4 > 8, so it stops; the flush adds 6 MiB more
    await f.advance(0);
    await f.settle();
    expect(f.saves).toHaveLength(1);
    expect(f.saves[0].bytes.byteLength).toBeLessThanOrEqual(MAX_BYTES);
    expect(f.saves[0].durationMs).toBeLessThan(6000);
    expect(f.notices.at(-1)?.words).toBe("Stopped at the 8 MB limit. The memo is saved.");
  });

  it("prefixWithin: the longest run of whole chunks that fits", () => {
    expect(prefixWithin([4 * MiB, 4 * MiB, MiB], MAX_BYTES)).toBe(2);
    expect(prefixWithin([MiB, 8 * MiB], MAX_BYTES)).toBe(1);
    expect(prefixWithin([9 * MiB], MAX_BYTES)).toBe(0);
  });

  it("L4: the countdown warns at 15 000 ms left, not at 15 001", async () => {
    const { f, r } = await started();
    await f.advance(MAX_DURATION_MS - 15_001);
    expect(r.snapshot().leftMs).toBe(15_001);
    expect(r.snapshot().warn).toBe(false);
    await f.advance(1);
    expect(r.snapshot().leftMs).toBe(15_000);
    expect(r.snapshot().warn).toBe(true);
  });

  it("L5: announces at 60, 30 and 10 seconds left, once each, and never otherwise", async () => {
    const { f, r } = await started();
    const seen: number[][] = [];
    for (let s = 0; s < 179; s++) {
      await f.advance(1000);
      await f.chunk(1000);
      seen.push([...r.snapshot().announced]);
    }
    const at = (left: number) => seen[MAX_DURATION_MS / 1000 - left - 1];
    expect(at(61)).toEqual([]);
    expect(at(60)).toEqual([60_000]);
    expect(at(31)).toEqual([60_000]);
    expect(at(30)).toEqual([60_000, 30_000]);
    expect(at(11)).toEqual([60_000, 30_000]);
    expect(at(10)).toEqual([60_000, 30_000, 10_000]);
    expect(r.snapshot().announced).toEqual([60_000, 30_000, 10_000]);
  });
});

const quota = () => Object.assign(new Error("full"), { name: "QuotaExceededError" });
const reject = (name: string) => Object.assign(new Error(name), { name });
type Run = Awaited<ReturnType<typeof started>>;

describe("endings E1-E16 (INV-007)", () => {
  beforeEach(resetSound);

  /** Record `ms` of audio (whole seconds, 10 kB each), then run `trigger`. */
  async function after(ms: number, trigger: (x: Run) => void | Promise<void>, opts = {}) {
    const x = await started(opts);
    for (let s = 0; s < ms / 1000; s++) {
      await x.f.advance(1000);
      await x.f.chunk(10_000);
    }
    await trigger(x);
    await x.f.advance(0);
    await x.f.settle();
    return x;
  }

  const released = (x: Run) => {
    expect(x.f.track.stopped).toBeGreaterThan(0);
    expect(x.f.analyserClose).toHaveBeenCalled();
  };

  const kept: [string, (x: Run) => void, string][] = [
    ["E1 stopped", (x) => x.r.stop(), ""],
    ["E7 cut-short", (x) => x.f.track.onended?.(), "The recording was cut short. The first 0:03 was kept."],
    ["E8 hidden", (x) => x.f.fireHidden(), "Recording stopped when you left the app. The first 0:03 was kept."],
    ["E9 left", (x) => x.r.leave(), "Recording stopped when you left the song. The first 0:03 was kept."],
    ["E10 recorder-error", (x) => x.f.recorder.onerror?.(), "The recording stopped because of an error. The first 0:03 was kept."],
  ];
  for (const [name, trigger, words] of kept) {
    it(`${name}: saved once, words, microphone released`, async () => {
      const x = await after(3000, trigger);
      expect(x.f.saves).toHaveLength(1);
      expect(Math.abs(x.f.saves[0].durationMs - 3000)).toBeLessThanOrEqual(50);
      if (words === "") expect(x.f.notices).toHaveLength(0);
      else expect(x.f.notices.at(-1)?.words).toBe(words);
      released(x);
      expect(x.r.snapshot().phase).toBe("idle");
    });
  }

  const tooShort = "Too short to keep. Recordings need at least 1 second.";
  const short: [string, (x: Run) => void][] = [
    ["E1", (x) => x.r.stop()],
    ["E7", (x) => x.f.track.onended?.()],
    ["E8", (x) => x.f.fireHidden()],
    ["E9", (x) => x.r.leave()],
    ["E10", (x) => x.f.recorder.onerror?.()],
  ];
  for (const [name, trigger] of short) {
    it(`E11 too-short via ${name}: dropped, words, released`, async () => {
      const x = await after(0, trigger);
      expect(x.f.saves).toHaveLength(0);
      expect(x.f.notices.at(-1)?.words).toBe(tooShort);
      released(x);
      expect(x.r.snapshot().phase).toBe("idle");
    });
  }

  it("E4 discarded: dropped, words, released", async () => {
    const x = await after(3000, (y) => y.r.discard());
    expect(x.f.saves).toHaveLength(0);
    expect(x.f.notices.at(-1)?.words).toBe("Recording discarded. Nothing was saved.");
    released(x);
    expect(x.r.snapshot().phase).toBe("idle");
  });

  const refusedWords =
    "The microphone was refused. To record, allow the microphone for this site in your browser's settings, then try again.";
  const noDevice = "No microphone could be opened on this device.";
  const refusals: [string, string, string][] = [
    ["E5 refused (NotAllowedError)", "NotAllowedError", refusedWords],
    ["E5 refused (SecurityError)", "SecurityError", refusedWords],
    ["E6 no-device (NotFoundError)", "NotFoundError", noDevice],
    ["E6 no-device (NotReadableError)", "NotReadableError", noDevice],
    ["E6 no-device (OverconstrainedError)", "OverconstrainedError", noDevice],
  ];
  for (const [name, err, words] of refusals) {
    it(`${name}: nothing started, words, idle`, async () => {
      const f = fakePorts();
      f.ports.getUserMedia = vi.fn(async () => {
        throw reject(err);
      });
      const r = createRecorder(f.ports);
      r.start(part);
      await f.settle();
      expect(f.saves).toHaveLength(0);
      expect(f.notices.at(-1)?.words).toBe(words);
      expect(r.snapshot().phase).toBe("idle");
    });
  }

  const unsupported = "This browser can't record audio here. Memos recorded elsewhere still play.";
  it("E15 unsupported: no format, words, no microphone asked", async () => {
    const f = fakePorts();
    f.ports.isTypeSupported = () => false;
    const r = createRecorder(f.ports);
    r.start(part);
    await f.settle();
    expect(f.ports.getUserMedia).not.toHaveBeenCalled();
    expect(f.notices.at(-1)?.words).toBe(unsupported);
    expect(r.snapshot().phase).toBe("idle");
  });

  it("E15 unsupported: a recorder.mimeType that fails parseFormat, microphone released", async () => {
    const x = await started({ mime: "video/mp4" });
    expect(x.f.notices.at(-1)?.words).toBe(unsupported);
    released(x);
    expect(x.r.snapshot().phase).toBe("idle");
  });

  const heldCases: [string, () => Error, string][] = [
    ["E12 out-of-room", quota, "This device is out of room, so the recording isn't saved yet. Try again, or download the clip."],
    ["E16 save-failed", () => new Error("boom"), "The recording couldn't be saved. Try again, or download the clip."],
  ];
  for (const [name, err, words] of heldCases) {
    it(`${name}: held, words, released, retry saves`, async () => {
      const x = await started();
      let fail = true;
      x.f.ports.save = vi.fn(async (draft, bytes, durationMs) => {
        if (fail) throw err();
        x.f.saves.push({ draft, bytes, durationMs });
      });
      for (let s = 0; s < 4; s++) {
        await x.f.advance(1000);
        await x.f.chunk(10_000);
      }
      x.r.stop();
      await x.f.advance(0);
      await x.f.settle();
      expect(x.r.snapshot().phase).toBe("held");
      expect(x.f.notices.at(-1)?.words).toBe(words);
      released(x);
      expect(x.r.downloadHeld()?.bytes.byteLength).toBe(40_000);
      fail = false;
      await x.r.retrySave();
      expect(x.f.saves).toHaveLength(1);
      expect(x.f.saves[0].durationMs).toBe(4000);
      expect(x.f.notices.at(-1)?.words).toBe("Saved.");
      expect(x.r.snapshot().phase).toBe("idle");
    });
  }

  it("a held clip is dropped only by Discard, with E4's words", async () => {
    const x = await started();
    x.f.ports.save = vi.fn(async () => {
      throw quota();
    });
    await x.f.advance(2000);
    await x.f.chunk(10_000);
    x.r.stop();
    await x.f.advance(0);
    await x.f.settle();
    expect(x.r.snapshot().phase).toBe("held");
    x.r.discard();
    await x.f.settle();
    expect(x.r.snapshot().phase).toBe("idle");
    expect(x.r.downloadHeld()).toBeNull();
    expect(x.f.notices.at(-1)?.words).toBe("Recording discarded. Nothing was saved.");
  });

  it("a second trigger after the first is a no-op", async () => {
    const x = await after(3000, (y) => {
      y.r.stop();
      y.r.stop();
      y.f.fireHidden();
      y.f.track.onended?.();
    });
    expect(x.f.saves).toHaveLength(1);
    expect(x.f.notices).toHaveLength(0);
  });

  it("the draft is written a chunk at a time while recording", async () => {
    const x = await after(3000, () => undefined);
    expect(x.f.ports.drafts.create).toHaveBeenCalledTimes(1);
    expect(x.f.ports.drafts.addChunk).toHaveBeenCalledTimes(3);
  });
});
