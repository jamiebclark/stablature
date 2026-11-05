# Data model: Durations, tap tempo and a click

**Nothing stored changes.** No table, field, wire shape, migration or IndexedDB version. `durationHint`
and `bpm` already exist, already merge per field, and are already validated on the wire. Everything
below is either a reading of those two fields or a value that lives only in memory.

## Stored, and unchanged

| Field | Where | Values | Notes |
|---|---|---|---|
| `EventRow.durationHint` | `src/lib/model.ts:145` | `"w" "h" "q" "8" "16" "32"` or `null` | In `MERGEABLE_FIELDS.events`, so it has its own clock. Wire enum at `protocol.ts:109`. |
| `SongRow.bpm` | `src/lib/model.ts:100` | number or `null` | In `MERGEABLE_FIELDS.songs`. Wire: integer from 1 to 999, nullable, at `protocol.ts:81`. The song page's field can store other numbers locally. |

Read but not changed: `EventRow.kind`, `repeat`, `tupletId`, `tupletCount`, `groupKind`.

## Duration

`src/lib/rhythm/durations.ts`. The one table of the six values. Every surface reads it, so a position,
a mark, the words and a length cannot disagree.

| `id` | `mark` | `words` | `ticks` |
|---|---|---|---|
| `w` | `w` | whole note | 1,441,440 |
| `h` | `h` | half note | 720,720 |
| `q` | `q` | quarter note | 360,360 |
| `8` | `8` | eighth note | 180,180 |
| `16` | `16` | sixteenth note | 90,090 |
| `32` | `32` | thirty-second note | 45,045 |

Rules:

- `readDuration(value: unknown)` returns the table's entry or `null`. **Every read goes through it**,
  which is how FR-007 holds: an unknown value reads as unset on every surface.
- `nextDuration(stored, tapped)` returns `null` when `tapped` equals the readable stored value, and
  `tapped` otherwise.
- The stored value is written only by `setColumnDuration`, which is reached only by a tap on a
  position.

## Tempo

`src/lib/rhythm/tempo.ts`.

| Name | Value | Meaning |
|---|---|---|
| `TAP_TEMPO_MIN`, `TAP_TEMPO_MAX` | 20, 400 | What a reading may offer to set |
| `STORED_TEMPO_MIN`, `STORED_TEMPO_MAX` | 1, 999 | What the click accepts, which is what sync accepts |

`usableTempo(bpm: unknown): number | null` is the integer if it is whole and in the stored range, and
otherwise `null`. Start, the control's text, the sheet's stored line and a live tempo change all call
it. A stored `120.5` is therefore no tempo everywhere at once.

| Stored | `usableTempo` |
|---|---|
| `null`, `undefined`, `0`, `-1`, `1000`, `120.5`, `NaN`, `"120"` | `null` |
| `1`, `19`, `20`, `120`, `400`, `401`, `999` | that number |

## Tap run

`src/lib/rhythm/tap.ts`. Held only in the open sheet's state, and lost when it closes.

```ts
interface TapRun {
  /** Tap times in ms, the most recent nine. */
  readonly taps: readonly number[];
  /** The last tap restarted a run of one after a gap: two taps too far apart to read. */
  readonly tooSlow: boolean;
}

type TapReading =
  | { kind: "waiting"; tapsNeeded: 1 | 2 | 3 }
  | { kind: "reading"; bpm: number }
  | { kind: "out-of-range"; bpm: number | null };
```

Transitions, with `gap` the time since the last tap and `mean` the mean of the retained intervals:

| Condition on a new tap | Result |
|---|---|
| Time not later than the last tap | Run unchanged |
| No taps yet | Run of this tap |
| `gap > 3000`, run held one tap | Run of this tap, `tooSlow: true` |
| `gap > 3000`, run held more | Run of this tap, `tooSlow: false` |
| At least one interval, and `gap < mean / 2` or `gap > mean × 2` | Run of this tap, `tooSlow: false` |
| Otherwise | Tap appended, oldest dropped past nine, `tooSlow: false` |

Reading, from the run:

| Run | Reading |
|---|---|
| `tooSlow` | `out-of-range`, `bpm: null` |
| 0, 1 or 2 taps | `waiting`, needing 3, 2 or 1 |
| 3 or more taps, rounded value in 20 to 400 | `reading` |
| 3 or more taps, otherwise | `out-of-range` with that value |

## Drawn pass

`src/lib/arrangement/passes.ts`.

```ts
interface DrawnPass {
  readonly step: ArrangementStep;
  /** The columns this pass draws, already sliced to its bars. */
  readonly events: readonly EventRow[];
}
```

`drawnPasses(steps, eventsByPart)` is the only caller of `eventsInBars` for the play view. `PlayView`
draws from it and `readNotation` reads from it.

## Score

`src/lib/rhythm/notation.ts`. Derived at start, and on a change of notation for the screen's choice.
Never stored.

```ts
type ClickLevel = "accent" | "beat" | "soft";

interface ScoreClick {
  /** From the first moment of the first bar. */
  readonly tick: number;
  readonly level: ClickLevel;
}

interface Score {
  readonly clicks: readonly ScoreClick[];
  /** Where the last timed bar ended. The plain beat carries on from here. */
  readonly lengthTicks: number;
  /** True when the first bar with any length is timed. Drives the choice in FR-050. */
  readonly timedFromStart: boolean;
}
```

Words used by the rules, exact in [contracts/notation.md](./contracts/notation.md):

- **Bar**: the columns between two barlines, or a barline and the edge of a pass.
- **Hit**: one repetition of a playable column. A column with `repeat: 8` is eight hits.
- **Group census**: per pass, per `tupletId`, the stored columns, whether any is repeated, and the
  numbers its rows give.

## Stream

`src/lib/rhythm/stream.ts`.

```ts
type ClickPhase = "count-in" | "following" | "plain";

interface StreamClick {
  readonly tick: number;
  readonly level: ClickLevel;
  readonly phase: ClickPhase;
  /** 1 to 4 during the count-in, otherwise null. */
  readonly count: number | null;
}
```

`clickStream(score, follow)` is an endless generator: four count-in clicks, then the score's clicks if
`follow`, then plain beats forever. `COUNT_IN_CLICKS = 4` is the only fixed number of beats anywhere.

## Click run

`src/lib/rhythm/scheduler.ts`. One object per screen, never stored or synced.

```text
         start (tap)                 clock ready
  idle ───────────────▶ starting ─────────────────▶ running
   ▲                       │                           │
   │                       │ stop                      │ stop, hidden, audio lost, fell behind
   └───────────────────────┴───────────────────────────┘
```

| State | Meaning | `phase` |
|---|---|---|
| `idle` | Nothing queued, no context held | None |
| `starting` | Context made in the tap, waiting for it to run | None |
| `running` | Clicks queued against the clock | `count-in`, then `following` and/or `plain` |

`StopReason` is `"tap" | "left" | "hidden" | "audio-lost" | "fell-behind"`. The first two say nothing.
The other three leave a line on screen until the next start.

Phase moves forward only: `count-in` → `following` → `plain`, or `count-in` → `plain`. It never goes
back within a run.

## Derived on `TabColumn`

`src/lib/tab/layout.ts`. One new field, and one change to a string.

| Field | Change |
|---|---|
| `duration: Duration \| null` | New. `readDuration(event.durationHint)`, null on a barline. |
| `description` | Gains `, eighth note` at the end when `duration` is set. Unchanged otherwise. |

`width`, `barNumber`, `cells`, `connectors` and every other field do not read it. `ascii.ts` reads
neither of these, so it has zero diff.
