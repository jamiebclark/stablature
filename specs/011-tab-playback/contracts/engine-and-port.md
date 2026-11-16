# Contract: the engine and the sound port

Files: `src/lib/rhythm/scheduler.ts`, `src/lib/rhythm/audio.ts`, and the new `src/lib/playback/synth.ts`.

## 1. Engine (`createEngine`): what changes and what does not

```ts
export type StopReason = "tap" | "left" | "hidden" | "audio-lost" | "fell-behind" | "ended"; // + "ended"

export type StreamItem = StreamClick | StreamNote | StreamMark | StreamEnd;
export interface StreamNote { readonly kind: "note"; readonly tick: number; readonly endTick: number; readonly voice: Voice }
export interface StreamMark { readonly kind: "mark"; readonly tick: number; readonly mark: PlayMark }
export interface StreamEnd  { readonly kind: "end";  readonly tick: number }
export interface PlayMark   { readonly pass: number; readonly eventId: string; readonly repetition: number }

export interface ClickEngine {
  readonly state: EngineState;
  start(run: {
    bpm: number;
    stream: Iterator<StreamItem>;              // Iterator<StreamClick> still fits
    audible?: (click: StreamClick) => boolean; // default: every click
    voices?: boolean;                          // default false; passed to makeClock
  }): void;
  stop(reason: StopReason): void;
  setTempo(bpm: number): void;
  due(): readonly QueuedClick[];               // unchanged: clicks only
  playhead(): number | null;                   // unchanged: from the click queue
  dueMarks(): readonly { time: number; mark: PlayMark }[]; // new: marks whose time has arrived, oldest first
}

export interface EngineDeps {
  makeClock?: (opts?: { voices?: boolean }) => ClickClock; // `() => ClickClock` still fits
  // …unchanged
}
```

**Unchanged, and pinned by the existing tests run unedited:**
- `LOOKAHEAD_S`, `TOP_UP_MS`, `START_LEAD_S`, `AUDIO_START_TIMEOUT_MS` and `PULSE_MS`;
- `timeOf`, the anchor, and `setTempo`'s re-anchor;
- the `starting` → `running` path and the silent fallback;
- `stop`'s order: generation, timers, clock, close, idle, stopped;
- for a click item: the `time < now` → `fell-behind` test, `clock.schedule(time, level)`, and the `QueuedClick` pushed;
- a stream that is `done` with no `end` → `fell-behind`.

**New, in `topUp`'s loop, per item:**

| Item | Action |
|---|---|
| click | if `audible?.(item) ?? true` then `clock.schedule(time, level)`. Always push the `QueuedClick` to the display queue. |
| note | `clock.note?.(time, timeOf(item.endTick), item.voice)` |
| mark | `marks.push({ time, mark })` |
| end | `endAt = time`; stop pulling (`ended = true`) |

After the loop, if `ended && now >= endAt` then `stop("ended")`. Otherwise the timer is re-armed as today. While
`ended`, the loop does not call `stream.next()`.

`stop()` also clears `marks`, `endAt` and `ended`.

## 2. Sound port (`ClickClock`)

```ts
export interface ClickClock {
  now(): number;
  readonly audible: boolean;
  ready(): Promise<boolean>;
  schedule(time: number, level: ClickLevel): void;   // unchanged
  /** Queue one note. Never called for a time already past. Absent on ports that cannot play notes. */
  note?(time: number, end: number, voice: Voice): void;
  close(): void;                                     // must silence everything, notes included, within 50 ms
  onLost(listener: () => void): void;
}
export function createClock(opts?: { voices?: boolean }): ClickClock;
export function audioClock(context: AudioContext, opts?: { voices?: boolean }): ClickClock;
```

- `silentClock()` has no `note`. A device with no audio still runs the marks, the beat box and the outline (spec 005
  behaviour).
- With `voices` unset or false, `audioClock` builds today's graph exactly: `master` → `destination`, the square
  oscillators, and `close()` as today. INV-001's engine golden list (E7) and the click e2e recorder tests check this.
- With `voices: true`, `audioClock` also builds the notes bus and the limiter (research R12), and `note` calls
  `playVoice` from `src/lib/playback/synth.ts`. `close()` first ramps the notes bus to 0 (5 ms time constant), stops
  every live source at `now + 0.03`, disconnects them, and closes the context after 40 ms.

## 3. The synth (`src/lib/playback/synth.ts`)

```ts
export interface Voicing {
  /** Live voice per string, so legato and glides move it and a new note on the string ends it. */
  readonly strings: Map<number, LiveVoice>;
  readonly sources: Set<AudioScheduledSourceNode>;
}
export function makeVoicing(context: BaseAudioContext, bus: AudioNode): Voicing;
export function playVoice(v: Voicing, context: BaseAudioContext, time: number, end: number, voice: Voice): void;
```

Rules the synth must keep:

1. **One pitched source per attacked note.** That is one `OscillatorNode` with a custom periodic wave from
   `waveFor(voice.tone, midiToHz(voice.midi))`. The e2e recorder counts these by `type === "custom"`.
2. **`attack: "none"`.** If `strings.get(voice.string)` is live at `time`, its frequency moves: `setValueAtTime(hz,
   time)` for legato, or `setValueAtTime(fromHz, time − glide)` then `exponentialRampToValueAtTime(hz, time)` for a
   glide. Its gain end and `stop()` are rescheduled to the new `end`. **No new source starts.** If nothing is live
   (for example a stop in between), it falls back to `soft`.
3. **A new attacked note on a string** ends the live voice on that string at `time`, with a 5 ms release.
4. **`sustain`.** Each value maps to an end and a decay: `length` and `half` end at `end`. `ring` and `long` decay
   naturally (time constants of about 1.5 s and 2 s) and are ended only by rule 3 or by `close()`. `thud` lasts 60 ms
   and `thud-muted` 35 ms.
5. **Every gain change is a ramp or a `setTargetAtTime`.** Nothing steps, so there are no clicks or pops (FR-026). The
   one exception is the thud's noise onset, which is the intended attack.
6. **`tone: "dead"`** plays 1 `AudioBufferSourceNode`, the noise buffer made once per `Voicing`, through a bandpass.
7. **`vibrato`** adds one sine LFO source into the voice's `frequency` through a depth gain, for the note's sounding
   time.
8. **Every source is added to `sources`.** `onended` removes and disconnects it. `close()` stops all of them.

## 4. What the hook does with it (`src/components/rhythm/useClick.ts`)

```ts
export interface UseClickOptions {
  bpm: unknown; score: Score; follow: boolean; columns?: readonly ColumnTick[];
  onColumn?: (column: ColumnTick | null) => void;
  /** New: when present and `notes.on`, start() runs playback instead of the click alone. */
  notes?: {
    readonly on: boolean;
    readonly rounds: PlayRounds | null;        // null: nothing playable (no tuning or rule "empty")
    readonly controls: PlayControls;           // click() and loop(), read live
  };
  /** New: 50..100; the engine runs at usableTempo(bpm) × speed / 100. Default 100. */
  speed?: number;
}
```

- `start()` is unchanged in shape and still synchronous up to `engine.start`. With `notes?.on && rounds`, it calls
  `engine.start({ bpm: effective, stream: playStream(rounds, score, follow, controls), audible:
  audibleFor(controls), voices: true })`. Otherwise it makes today's call, with `bpm: effective`.
- The rAF loop in a notes run takes the latest `dueMarks()` and calls `onColumnRef.current?.({ tick: 0, pass,
  eventId, repetition })` through the same `place` and `sameColumn` dedupe. In a click run it does exactly today's
  `columnAt` call.
- `"ended"` is handled like `tap`: no `stopped` value. The hook also returns `endedFromStop` (a one-shot flag) so the
  bar can move focus (research R13).
- The tempo effect becomes `engine.setTempo(effective)` whenever `usable` or `speed` changes while running.
