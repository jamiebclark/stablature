"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ClickPhase, Score } from "@/lib/rhythm/notation";
import {
  createEngine,
  PULSE_MS,
  type ClickEngine,
  type EngineState,
} from "@/lib/rhythm/scheduler";
import { clickStream } from "@/lib/rhythm/stream";
import { usableTempo } from "@/lib/rhythm/tempo";

export interface UseClickOptions {
  bpm: unknown;
  score: Score;
  follow: boolean;
}

/** The reasons that leave a line on screen until the next start. */
export type StoppedWhy = "hidden" | "audio-lost" | "fell-behind";

interface WakeHeld {
  wanted: boolean;
  sentinel: WakeLockSentinel | null;
}

function setWakeLock(held: WakeHeld, on: boolean) {
  held.wanted = on;
  if (on) {
    try {
      const asked = navigator.wakeLock?.request("screen");
      asked?.then(
        (sentinel) => {
          // A lock that arrives after the run ended is let go at once.
          if (held.wanted) held.sentinel = sentinel;
          else void sentinel.release().catch(() => {});
        },
        () => {},
      );
    } catch {
      // No wake lock here: the screen may dim, and the click carries on.
    }
  } else if (held.sentinel) {
    const sentinel = held.sentinel;
    held.sentinel = null;
    try {
      void sentinel.release().catch(() => {});
    } catch {
      // Already released.
    }
  }
}

export function useClick({ bpm, score, follow }: UseClickOptions) {
  const [state, setState] = useState<EngineState>("idle");
  const [phase, setPhase] = useState<ClickPhase | null>(null);
  const [soundless, setSoundless] = useState(false);
  const [stopped, setStopped] = useState<StoppedWhy | null>(null);
  const beatRef = useRef<HTMLDivElement>(null);
  const [lock] = useState<WakeHeld>(() => ({ wanted: false, sentinel: null }));

  const [engine] = useState<ClickEngine>(() =>
    createEngine({
      onChange(change) {
        if (change.kind === "soundless") setSoundless(true);
        else if (change.kind === "stopped") {
          if (change.reason !== "tap" && change.reason !== "left") setStopped(change.reason);
        } else {
          setState(change.state);
          if (change.state === "running") setWakeLock(lock, true);
          if (change.state === "idle") {
            setWakeLock(lock, false);
            setPhase(null);
          }
        }
      },
    }),
  );

  const usable = usableTempo(bpm);

  // The tap itself: nothing asynchronous comes first.
  const start = useCallback(() => {
    if (usable === null) return;
    setStopped(null);
    setSoundless(false);
    engine.start({ bpm: usable, stream: clickStream(score, follow) });
  }, [engine, usable, score, follow]);

  const stop = useCallback(() => engine.stop("tap"), [engine]);

  useEffect(() => {
    if (usable !== null && engine.state === "running") engine.setTempo(usable);
  }, [engine, usable]);

  useEffect(() => {
    const hide = () => engine.stop("hidden");
    const onVisibility = () => {
      if (document.visibilityState === "hidden") hide();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", hide);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", hide);
      engine.stop("left");
    };
  }, [engine]);

  useEffect(() => {
    if (state !== "running") return;
    let frame = 0;
    let pulse: ReturnType<typeof setTimeout> | null = null;
    let shownPhase: ClickPhase | null = null;
    const clear = () => {
      const el = beatRef.current;
      if (!el) return;
      el.dataset.level = "";
      const count = el.querySelector("[data-role=count]");
      if (count) count.textContent = "";
    };
    const tick = () => {
      const due = engine.due();
      const latest = due[due.length - 1];
      const el = beatRef.current;
      if (latest && el) {
        el.dataset.level = latest.level;
        const count = el.querySelector("[data-role=count]");
        if (count) count.textContent = latest.count === null ? "" : String(latest.count);
        if (pulse !== null) clearTimeout(pulse);
        pulse = setTimeout(clear, PULSE_MS);
      }
      if (latest && latest.phase !== shownPhase) {
        shownPhase = latest.phase;
        setPhase(latest.phase);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      if (pulse !== null) clearTimeout(pulse);
      clear();
    };
  }, [engine, state]);

  return { state, phase, soundless, stopped, usable, start, stop, beatRef };
}
