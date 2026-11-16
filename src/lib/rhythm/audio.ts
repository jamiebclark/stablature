import { makeVoicing, playVoice } from "@/lib/playback/synth";
import type { Voice } from "@/lib/playback/types";
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
  /** Queue one note. Never called for a time already past. Absent on ports that cannot play notes. */
  note?(time: number, end: number, voice: Voice): void;
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
export function createClock(opts: { voices?: boolean } = {}): ClickClock {
  try {
    const Ctor: typeof AudioContext | undefined =
      typeof window === "undefined"
        ? undefined
        : (window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
    if (!Ctor) return silentClock();
    return audioClock(new Ctor(), opts);
  } catch {
    return silentClock();
  }
}

export function audioClock(context: AudioContext, opts: { voices?: boolean } = {}): ClickClock {
  const master = context.createGain();
  // With voices, the notes bus and the master both pass a limiter, so a click plus several notes cannot clip.
  // Without them this is today's graph exactly: master -> destination.
  let notes: { bus: GainNode; voicing: ReturnType<typeof makeVoicing> } | null = null;
  if (opts.voices) {
    const limiter = context.createDynamicsCompressor();
    // A real limiter: up to seven let-ring voices stack under the click, so it acts well below 0 dBFS, at once.
    limiter.threshold.value = -12;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0;
    limiter.release.value = 0.1;
    const bus = context.createGain();
    bus.connect(limiter);
    limiter.connect(master);
    const out = context.createDynamicsCompressor();
    master.connect(out);
    out.connect(context.destination);
    notes = { bus, voicing: makeVoicing(context, bus) };
  } else {
    master.connect(context.destination);
  }
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

  const clock: ClickClock = {
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
      if (notes) {
        // Fade the notes over a few milliseconds rather than cut them with a click, stop every source inside
        // 50 ms, and let the context go once the fade is done.
        const at = context.currentTime;
        notes.bus.gain.setTargetAtTime(0, at, 0.005);
        for (const source of notes.voicing.sources) {
          try {
            source.stop(at + 0.03);
          } catch {
            // Not yet started or already stopped.
          }
        }
        for (const osc of live) {
          try {
            osc.stop();
          } catch {
            // Not yet started or already stopped.
          }
        }
        live.clear();
        setTimeout(() => {
          try {
            master.disconnect();
            void context.close().catch(() => {});
          } catch {
            // Already closed.
          }
        }, 40);
        return;
      }
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
  if (notes) {
    const { voicing } = notes;
    clock.note = (time, end, voice) => playVoice(voicing, context, time, end, voice);
  }
  return clock;
}
