import { createClock, silentClock, type ClickClock } from "./audio";
import { TICKS_PER_BEAT } from "./durations";
import type { ClickLevel, ClickPhase, StreamClick } from "./notation";

export const LOOKAHEAD_S = 0.75;
export const TOP_UP_MS = 25;
export const START_LEAD_S = 0.05;
export const AUDIO_START_TIMEOUT_MS = 1000;
export const PULSE_MS = 100;

export type StopReason = "tap" | "left" | "hidden" | "audio-lost" | "fell-behind";
export type EngineState = "idle" | "starting" | "running";

export interface QueuedClick {
  readonly time: number;
  readonly tick: number;
  readonly level: ClickLevel;
  readonly phase: ClickPhase;
  readonly count: number | null;
}

export type EngineChange =
  | { kind: "state"; state: EngineState }
  | { kind: "soundless" }
  | { kind: "stopped"; reason: StopReason };

export interface ClickEngine {
  readonly state: EngineState;
  /** Synchronous up to and including making the clock. Does nothing unless idle. */
  start(run: { bpm: number; stream: Iterator<StreamClick> }): void;
  stop(reason: StopReason): void;
  /** Takes effect at the next click not yet queued. */
  setTempo(bpm: number): void;
  /** Clicks whose time has arrived, oldest first, removed from the display queue. */
  due(): readonly QueuedClick[];
}

export interface EngineDeps {
  makeClock?: () => ClickClock;
  makeSilentClock?: () => ClickClock;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
  onChange?: (change: EngineChange) => void;
}

export function createEngine(deps: EngineDeps = {}): ClickEngine {
  const makeClock = deps.makeClock ?? createClock;
  const makeSilent = deps.makeSilentClock ?? silentClock;
  const setTimer = deps.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
  const clearTimer = deps.clearTimer ?? ((h) => clearTimeout(h as ReturnType<typeof setTimeout>));
  const emit = (change: EngineChange) => deps.onChange?.(change);

  let state: EngineState = "idle";
  let clock: ClickClock | null = null;
  let stream: Iterator<StreamClick> | null = null;
  let bpm = 0;
  let anchor = { tick: 0, time: 0 };
  let pending: StreamClick | null = null;
  let last: { tick: number; time: number } | null = null;
  let queue: QueuedClick[] = [];
  let timer: unknown = null;
  let startTimer: unknown = null;
  let generation = 0;

  const timeOf = (tick: number) =>
    anchor.time + ((tick - anchor.tick) / TICKS_PER_BEAT) * (60 / bpm);

  const setState = (next: EngineState) => {
    state = next;
    emit({ kind: "state", state: next });
  };

  function clearTimers() {
    if (timer !== null) clearTimer(timer);
    if (startTimer !== null) clearTimer(startTimer);
    timer = null;
    startTimer = null;
  }

  function stop(reason: StopReason) {
    if (state === "idle") return;
    generation++;
    clearTimers();
    const closing = clock;
    clock = null;
    stream = null;
    pending = null;
    last = null;
    queue = [];
    closing?.close();
    setState("idle");
    emit({ kind: "stopped", reason });
  }

  function topUp() {
    timer = null;
    if (state !== "running" || !clock || !stream) return;
    const now = clock.now();
    for (;;) {
      if (!pending) {
        const step = stream.next();
        if (step.done) {
          // A dry queue is a failure to keep time, and says so.
          stop("fell-behind");
          return;
        }
        pending = step.value;
      }
      const time = timeOf(pending.tick);
      if (time >= now + LOOKAHEAD_S) break;
      if (time < now) {
        stop("fell-behind");
        return;
      }
      clock.schedule(time, pending.level);
      queue.push({
        time,
        tick: pending.tick,
        level: pending.level,
        phase: pending.phase,
        count: pending.count,
      });
      last = { tick: pending.tick, time };
      pending = null;
    }
    timer = setTimer(topUp, TOP_UP_MS);
  }

  function begin(token: number, ready: boolean, from: ClickClock) {
    if (token !== generation || state !== "starting") return;
    if (startTimer !== null) clearTimer(startTimer);
    startTimer = null;
    if (!ready) {
      from.close();
      clock = makeSilent();
      emit({ kind: "soundless" });
    }
    anchor = { tick: 0, time: clock!.now() + START_LEAD_S };
    setState("running");
    topUp();
  }

  return {
    get state() {
      return state;
    },
    start(run) {
      if (state !== "idle") return;
      const made = makeClock();
      clock = made;
      stream = run.stream;
      bpm = run.bpm;
      pending = null;
      last = null;
      queue = [];
      const token = ++generation;
      setState("starting");
      made.onLost(() => {
        if (token === generation) stop("audio-lost");
      });
      if (!made.audible) emit({ kind: "soundless" });
      let settled = false;
      const settle = (ready: boolean) => {
        if (settled) return;
        settled = true;
        begin(token, ready, made);
      };
      startTimer = setTimer(() => settle(false), AUDIO_START_TIMEOUT_MS);
      made.ready().then(settle, () => settle(false));
    },
    stop,
    setTempo(next) {
      if (next === bpm) return;
      if (state === "running" && last && pending && clock) {
        const nextTime = last.time + ((pending.tick - last.tick) / TICKS_PER_BEAT) * (60 / next);
        anchor = { tick: pending.tick, time: Math.max(nextTime, clock.now() + START_LEAD_S) };
      }
      bpm = next;
    },
    due() {
      if (!clock || queue.length === 0) return [];
      const now = clock.now();
      let n = 0;
      while (n < queue.length && queue[n].time <= now) n++;
      return n === 0 ? [] : queue.splice(0, n);
    },
  };
}
