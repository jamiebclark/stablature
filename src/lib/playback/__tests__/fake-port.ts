/** A fake `ClickClock` for spec 011's engine tests: it records every `schedule` and every `note`, in call order. */
import type { ClickClock } from "@/lib/rhythm/audio";
import type { ClickLevel } from "@/lib/rhythm/notation";

export interface RecordedNote {
  time: number;
  end: number;
  /** The `Voice` the engine handed over, untouched. */
  voice: unknown;
}

export interface FakePort extends ClickClock {
  clicks: { time: number; level: ClickLevel }[];
  notes: RecordedNote[];
  closed: number;
  lose: () => void;
  settle: (ready: boolean) => void;
  advance: (to: number) => void;
}

export function fakePort(start = 10, opts: { notes?: boolean } = {}): FakePort {
  let now = start;
  let lost = () => {};
  let settle!: (ready: boolean) => void;
  const ready = new Promise<boolean>((res) => (settle = res));
  const port: FakePort = {
    now: () => now,
    audible: true,
    ready: () => ready,
    schedule(time, level) {
      port.clicks.push({ time, level });
    },
    close() {
      port.closed += 1;
    },
    onLost(fn) {
      lost = fn;
    },
    clicks: [],
    notes: [],
    closed: 0,
    lose: () => lost(),
    settle: (r) => settle(r),
    advance: (to) => void (now = to),
  };
  if (opts.notes !== false) {
    // `note` is optional on the port in contracts/engine-and-port.md §2; the fake has it unless asked not to.
    (port as unknown as { note: (time: number, end: number, voice: unknown) => void }).note = (time, end, voice) =>
      void port.notes.push({ time, end, voice });
  }
  return port;
}
