import type { ClickLevel } from "./notation";

/** The sound port the scheduler drives. The real one is Web Audio; tests hand in a fake. */
export interface ClickClock {
  /** Seconds. Must be monotonic while running. */
  now(): number;
  readonly audible: boolean;
  /** Resolves true when the clock is advancing, false if it will not. */
  ready(): Promise<boolean>;
  /** Queue one voice. Never called for a time already past. */
  schedule(time: number, level: ClickLevel): void;
  /** Silence everything queued, synchronously, and release the hardware. */
  close(): void;
  /** Called if the device takes the audio away from a running clock. */
  onLost(listener: () => void): void;
}

/** Starting values: pitch and loudness both differ, so no level rests on one cue. */
const VOICES: Record<ClickLevel, { hz: number; gain: number }> = {
  accent: { hz: 2000, gain: 1 },
  beat: { hz: 1300, gain: 0.7 },
  soft: { hz: 800, gain: 0.35 },
};
const DECAY_S = 0.03;
const ATTACK_S = 0.002;

export function silentClock(): ClickClock {
  return {
    now: () => performance.now() / 1000,
    audible: false,
    ready: () => Promise.resolve(true),
    schedule() {},
    close() {},
    onLost() {},
  };
}

/**
 * Called synchronously inside the tap: makes the context and calls resume()
 * before returning. A missing or throwing constructor gives a silent clock.
 */
export function createClock(): ClickClock {
  try {
    const Ctor: typeof AudioContext | undefined =
      typeof window === "undefined"
        ? undefined
        : (window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
    if (!Ctor) return silentClock();
    return audioClock(new Ctor());
  } catch {
    return silentClock();
  }
}

export function audioClock(context: AudioContext): ClickClock {
  const master = context.createGain();
  master.connect(context.destination);
  const live = new Set<OscillatorNode>();
  let closed = false;
  let lost: (() => void) | null = null;

  let resumed: Promise<unknown>;
  try {
    resumed = Promise.resolve(context.resume());
  } catch {
    resumed = Promise.reject(new Error("resume failed"));
  }

  context.addEventListener("statechange", () => {
    if (!closed && context.state !== "running") lost?.();
  });

  return {
    now: () => context.currentTime,
    audible: true,
    ready: () =>
      resumed.then(
        () => context.state === "running",
        () => false,
      ),
    schedule(time, level) {
      const voice = VOICES[level];
      const osc = context.createOscillator();
      const gain = context.createGain();
      osc.type = "square";
      osc.frequency.value = voice.hz;
      gain.gain.setValueAtTime(0.0001, time);
      gain.gain.exponentialRampToValueAtTime(voice.gain, time + ATTACK_S);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + ATTACK_S + DECAY_S);
      osc.connect(gain);
      gain.connect(master);
      live.add(osc);
      osc.onended = () => {
        live.delete(osc);
        osc.disconnect();
        gain.disconnect();
      };
      osc.start(time);
      osc.stop(time + ATTACK_S + DECAY_S + 0.01);
    },
    close() {
      if (closed) return;
      closed = true;
      for (const osc of live) {
        try {
          osc.stop();
        } catch {
          // Not yet started or already stopped: nothing to silence.
        }
      }
      live.clear();
      try {
        master.disconnect();
      } catch {
        // Already disconnected.
      }
      try {
        void context.close().catch(() => {});
      } catch {
        // Already closed.
      }
    },
    onLost(listener) {
      lost = listener;
    },
  };
}
