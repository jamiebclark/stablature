"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DrawnPass } from "@/lib/arrangement/passes";
import { getClick, getLoop } from "@/lib/playback/choices";
import { audibleFor, playRounds, playStream } from "@/lib/playback/stream";
import type { Tuning } from "@/lib/tunings";
import { columnAt } from "@/lib/reading/position";
import type { ClickPhase, ColumnTick, Score } from "@/lib/rhythm/notation";
import {
  createEngine,
  PULSE_MS,
  type ClickEngine,
  type EngineState,
} from "@/lib/rhythm/scheduler";
import { clickStream, COUNT_IN_CLICKS } from "@/lib/rhythm/stream";
import { TICKS_PER_BEAT } from "@/lib/rhythm/durations";
import { usableTempo } from "@/lib/rhythm/tempo";

export interface UseClickOptions {
  bpm: unknown;
  score: Score;
  follow: boolean;
  /** `notationColumns(passes)`, from the same passes as `score`. */
  columns?: readonly ColumnTick[];
  /** Called when the column under the click changes. Never with a column while `follow` is false. */
  onColumn?: (column: ColumnTick | null) => void;
  /** Notes on: the passes and tuning the notes are read from, and the tempo as a percentage. Absent or null: the click alone. */
  play?: { passes: readonly DrawnPass[]; tuning: Tuning | null | undefined } | null;
  /** The tempo as a percentage, for the click alone as for the notes. One clock serves both. */
  speed?: number;
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

const NO_COLUMNS: readonly ColumnTick[] = [];

interface Run {
  readonly columns: readonly ColumnTick[];
  readonly lengthTicks: number;
  readonly follow: boolean;
  /** A notes run: the highlight reads the marks. */
  readonly notes: boolean;
}

const sameColumn = (a: ColumnTick | null, b: ColumnTick | null) =>
  a === b || (!!a && !!b && a.pass === b.pass && a.eventId === b.eventId && a.repetition === b.repetition);

export function useClick({ bpm, score, follow, columns = NO_COLUMNS, onColumn, play, speed = 100 }: UseClickOptions) {
  const playPasses = play?.passes;
  const playTuning = play?.tuning;
  // Built before the tap, so starting does no more than hand the engine a stream.
  const rounds = useMemo(
    () => (playPasses && playTuning ? playRounds(playPasses, playTuning) : null),
    [playPasses, playTuning],
  );
  const notesOn = !!play && rounds !== null;
  const onColumnRef = useRef(onColumn);
  useEffect(() => {
    onColumnRef.current = onColumn;
  });
  const runRef = useRef<Run | null>(null);
  const [state, setState] = useState<EngineState>("idle");
  const [phase, setPhase] = useState<ClickPhase | null>(null);
  const [soundless, setSoundless] = useState(false);
  const [stopped, setStopped] = useState<StoppedWhy | null>(null);
  const [ended, setEnded] = useState(false);
  const beatRef = useRef<HTMLDivElement>(null);
  const [lock] = useState<WakeHeld>(() => ({ wanted: false, sentinel: null }));

  const [engine] = useState<ClickEngine>(() =>
    createEngine({
      onChange(change) {
        if (change.kind === "soundless") setSoundless(true);
        else if (change.kind === "stopped") {
          setEnded(change.reason === "ended");
          if (change.reason !== "tap" && change.reason !== "left" && change.reason !== "ended") setStopped(change.reason);
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
    setEnded(false);
    setSoundless(false);
    // The score, its columns and the choice are held together, so the highlight reads what is sounding.
    if (rounds && notesOn) {
      runRef.current = { columns, lengthTicks: rounds.first.lengthTicks, follow: false, notes: true };
      engine.start({
        bpm: (usable * speed) / 100,
        stream: playStream(rounds, score, follow, { loop: getLoop }),
        audible: audibleFor({ click: getClick }),
        voices: true,
      });
      return;
    }
    runRef.current = { columns, lengthTicks: score.lengthTicks, follow, notes: false };
    engine.start({ bpm: (usable * speed) / 100, stream: clickStream(score, follow) });
  }, [engine, usable, score, follow, columns, rounds, notesOn, speed]);

  const stop = useCallback(() => engine.stop("tap"), [engine]);

  // Stop and start in the same event, so the audio still has its gesture.
  const restart = useCallback(() => {
    engine.stop("tap");
    start();
  }, [engine, start]);

  useEffect(() => {
    if (usable !== null && engine.state === "running") engine.setTempo((usable * speed) / 100);
  }, [engine, usable, speed]);

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
    let shownColumn: ColumnTick | null = null;
    const place = (column: ColumnTick | null) => {
      if (sameColumn(column, shownColumn)) return;
      shownColumn = column;
      onColumnRef.current?.(column);
    };
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
      const run = runRef.current;
      const head = engine.playhead();
      const marks = engine.dueMarks();
      if (run?.notes) {
        // Notes run: the highlight reads the marks, which are on the notes' own clock.
        const last = marks[marks.length - 1];
        if (last) place({ tick: 0, pass: last.mark.pass, eventId: last.mark.eventId, repetition: last.mark.repetition });
      } else if (!run || !run.follow || head === null) place(null);
      else place(columnAt(run.columns, head - COUNT_IN_CLICKS * TICKS_PER_BEAT, run.lengthTicks));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      place(null);
      cancelAnimationFrame(frame);
      if (pulse !== null) clearTimeout(pulse);
      clear();
    };
  }, [engine, state]);

  return { state, phase, soundless, stopped, ended, usable, notesOn, rule: rounds?.first.rule ?? null, start, stop, restart, beatRef };
}
