# Contract: the click

`src/lib/rhythm/scheduler.ts` and `src/lib/rhythm/audio.ts`, driven by `src/components/rhythm/useClick.ts`.

## Constants

| Name | Value | Why |
|---|---|---|
| `LOOKAHEAD_S` | 0.75 | Covers a 200 ms stall with margin (research R2) |
| `TOP_UP_MS` | 25 | How often the queue is looked at |
| `START_LEAD_S` | 0.05 | Time from the clock being ready to the first click |
| `AUDIO_START_TIMEOUT_MS` | 1000 | How long `resume()` gets before the run goes silent |
| `PULSE_MS` | 100 | How long the indicator holds a click's shape |

## The clock port

```ts
interface ClickClock {
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
```

`createClock()` in `audio.ts` is called **synchronously inside the tap**. It makes the context and
calls `resume()` before returning. It catches a missing or throwing constructor and returns
`silentClock()`.

`audioClock`:

- `schedule`: one oscillator into a gain into a master gain, with the voices in research R5. Each is
  tracked until `onended`, then disconnected, so a long run holds only what is still queued.
- `close`: `.stop()` on each tracked oscillator, disconnect the master gain, then `context.close()`.
- `onLost`: fires on `statechange` when the state is anything but `running` and `close` has not been
  called. This covers `suspended`, `interrupted` and `closed`.

`silentClock`: `now()` is `performance.now() / 1000`, `audible` is false, `ready()` resolves true at
once, and `schedule` and `close` do nothing.

## The engine

```ts
interface ClickEngine {
  readonly state: "idle" | "starting" | "running";
  /** Synchronous up to and including making the clock. Does nothing unless idle. */
  start(run: { bpm: number; stream: Iterator<StreamClick> }): void;
  stop(reason: StopReason): void;
  /** Takes effect at the next click not yet queued. */
  setTempo(bpm: number): void;
  /** Clicks whose time has arrived, oldest first, removed from the display queue. */
  due(): readonly QueuedClick[];
}
```

Dependencies are injected, so a test can hand it a fake clock and a fake timer: `makeClock`,
`setTimer`, `clearTimer`, and `onChange` for state, `soundless` and stop reasons.

### Start

1. If not `idle`, return. This, with the state changing synchronously, is what makes a double start
   one start.
2. `clock = makeClock()`, state `starting`.
3. Wait for `clock.ready()`, raced with `AUDIO_START_TIMEOUT_MS`. If it fails, close it, take a
   `silentClock`, and report `soundless`.
4. If `stop` ran meanwhile, do nothing further.
5. Anchor the first click at `clock.now() + START_LEAD_S`, state `running`, and top up.

### Top-up

Until the next click's time is at least `LOOKAHEAD_S` past `now`:

- Compute its time from the anchor, at the tempo now in force.
- If that time is before `now`, stop with `fell-behind`, and queue nothing.
- Otherwise call `clock.schedule(time, level)`, and put the **same entry** on the display queue.

### Tempo change

`setTempo` with the current value does nothing. Otherwise, with `next` the first unqueued click and
`last` the most recently queued one:

- `nextTime = last.time + (next.tick − last.tick) / TICKS_PER_BEAT × 60 / bpm`
- The anchor becomes `next.tick` at `max(nextTime, now + START_LEAD_S)`.

With nothing yet queued, only the tempo changes. Clicks already queued sound where they were put.

### Stop

Synchronously: clear the timer, `clock.close()`, empty both queues, state `idle`, tell listeners the
reason. `stop` when `idle` does nothing, so unmounting a screen that never started is safe.

## The hook

`useClick({ bpm, score, follow })` in `src/components/rhythm/useClick.ts` owns one engine per mounted
`ClickBar`.

| Trigger | What happens |
|---|---|
| The tap on start | `engine.start` with `clickStream(score, follow)`, from values already in hand. **Nothing asynchronous comes first.** |
| `bpm` changes to a usable value while running | `engine.setTempo(bpm)` |
| `bpm` becomes unusable while running | Nothing. The click keeps its last usable tempo (Deviation 4). |
| `score` changes while running | Nothing (FR-051). The run holds its own stream. |
| `visibilitychange` to hidden, or `pagehide` | `stop("hidden")` |
| Clock reports lost | `stop("audio-lost")` |
| Unmount | `stop("left")` |
| State becomes `running` | `navigator.wakeLock?.request("screen")`, in a `try`. A lock that resolves after the run stopped is released at once. |
| State becomes `idle` | Release any lock held. |

A `requestAnimationFrame` loop runs only while `running`. Each frame it takes `engine.due()`, writes
`data-level` and the count to the indicator through a ref, clears the shape `PULSE_MS` later, and sets
React state only when `phase` changes. A click's phase takes effect when that click is **due**, not
when it is queued, so the words change as the sound does.

## What it must not do

| Never | Enforced by |
|---|---|
| Make a context before the tap, or after an `await` | `createClock` is only called from `engine.start`. INV-019. |
| Set `navigator.audioSession.type`, or use `<audio>` | INV-027 traps both |
| Fetch anything | INV-031 |
| Write to Dexie | `src/lib/rhythm/` imports nothing from `src/lib/local/`. INV-030 dumps the store. |
| Use `next/dynamic`, `React.lazy` or `import()` | INV-031 |
