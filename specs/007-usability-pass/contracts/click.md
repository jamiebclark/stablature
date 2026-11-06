# Contract: the cluster and the reading position

**Normative** for `src/components/rhythm/ClickBar.tsx`, `src/components/rhythm/useClick.ts`, `src/lib/rhythm/notation.ts`,
`src/lib/rhythm/scheduler.ts` and `src/lib/reading/position.ts`.

Nothing here changes when any click sounds. `clickStream`, `createClock` and `audio.ts` have **zero diff**.

## 1. `notation.ts`

`readNotation`'s signature and result do not change. Its loop moves into one internal walker with a sink, and two exports read it:

```ts
export function readNotation(passes: readonly DrawnPass[]): Score;              // as now
export function notationColumns(passes: readonly DrawnPass[]): ColumnTick[];    // new
export function beatsPerBar(events: readonly EventRow[]): number | null;        // new
```

`ColumnTick` and `beatsPerBar` are in [data-model.md](../data-model.md). `readBar` reports each hit to the sink at the moment it
advances `at`, so a column's tick is the same number the bar's length is built from.

## 2. `scheduler.ts`

One addition:

```ts
export interface ClickEngine {
  // ...as now...
  /** The tick now, between the last click shown and the next one queued. Null before the first click. Reads only. */
  playhead(): number | null;
}
```

- `due()` keeps the last click it removed as `shown`.
- With `shown` and `queue[0]`: `shown.tick + (now - shown.time) / (next.time - shown.time) * (next.tick - shown.tick)`, clamped to the
  two ticks.
- With `shown` and an empty queue: `shown.tick`.
- `stop` clears `shown`.
- It schedules nothing, moves nothing and removes nothing from the queue.

## 3. `position.ts`

```ts
export function columnKey(eventId: string, repetition: number): string;
export function columnAt(columns: readonly ColumnTick[], tick: number): ColumnTick | null;
export function readingStops(passes: readonly DrawnPass[], offsets: readonly number[]): ReadingStop[];
export function stepColumn(stops: readonly ReadingStop[], at: ReadingStop | null, by: -1 | 1): ReadingStop | null;
export function stepBar(stops: readonly ReadingStop[], at: ReadingStop | null, by: -1 | 1): ReadingStop | null;
export const FOLLOW_REST_MS = 4000;
export function mayFollow(lastReaderScroll: number | null, now: number): boolean;
```

- `columnAt` takes a tick from the first moment of the first bar. It returns null below 0, at or past the score's `lengthTicks`, and
  on an empty list. Otherwise it returns the last column at or before the tick, by binary search.
- `stepColumn` and `stepBar` stop at the ends, and do not wrap. From null, forward gives the first stop and back gives null.
- `stepBar` back goes to the start of the current bar, unless already there, then the previous bar's.

## 4. `useClick`

- The run's `score`, `notationColumns` and `follow` are captured at `start`, with the stream, so the highlight can never read a
  different score from the one sounding.
- In the existing `tick`, right after `due()` and the beat's write: read `playhead()`, subtract the count-in's ticks, call `columnAt`,
  and if the column has changed, call `onColumn(column | null)`. With `follow` false, it never calls it with a column.
- `restart()`: `engine.stop("tap")`, then `start()`, synchronously in the key's own event, so the audio still has its gesture.
- `onColumn` is a ref, so it adds no dependency to the effect.

`useClick`'s result gains `restart`. Its other fields do not change.

## 5. `useReadingPosition`

In `src/components/reading/useReadingPosition.ts`. It owns the one highlighted element.

- `place(position | null)`: removes `.tab-column-reading` from the last element, finds
  `[data-pass="<pass>"] [data-column="<key>"]`, adds the class, and follows if allowed.
- It remembers the last reader scroll from `wheel`, `touchmove`, a `pointerdown` whose target is the document element, and PageUp,
  PageDown, Home, End, Up and Down when no shortcut used them.
- Following is `el.scrollIntoView({ block: "nearest", inline: "nearest", behavior })`, with `smooth` unless reduced motion is set.
- `document.documentElement.style.scrollPaddingBottom` follows the cluster's height while the page is mounted.
- After any commit of the passes, it reapplies the class to the current key. A column that has gone leaves nothing highlighted.

## 6. `ClickBar`

Props gain `cluster?: ReactNode`, drawn in the open panel, and `onColumn`. `PlayView` passes `ViewControl` and the Capture link in as
`cluster`, so `ClickBar` stays free of reading code.

**Collapsed**, one row, 44px controls, `py-1.5`, a 1px border, so **57px**:

| Left | | Right |
|---|---|---|
| Start, or the beat box then Stop | | Tempo, then `panel-play-cluster` |

The start button's `w-[86px]`, the beat box and `ClickBar`'s test ids stay as they are.

**Open**: adds the follow choice, `ViewControl` and the way to capture, above the row.

**Messages.** `click-state` stays one element, `role="status"`, always in the DOM.

| State | Text | Shown when collapsed |
|---|---|---|
| No usable tempo | `Set a tempo to use the click.` | Yes |
| Stopped by itself | The `STOPPED_WORDS` | Yes |
| Running | `Following the notation.`, and so on | Yes |
| Idle, nothing to say | `Click follows the notation.`, `Click is a plain beat.` | `sr-only`. Visible when open |

`click-help` shows while running, in both states.

The cluster stays `sticky bottom-0`, in the flow, `no-print`. Open or running, it is taller and pushes nothing off screen, because the
page scrolls.

## 7. Keys on the play view

From [keys.md](./keys.md).

| Key | Does |
|---|---|
| Space | `start()` when idle, `stop()` when not. Does nothing with no usable tempo or notation not ready, like the disabled button |
| `r` | `restart()`, with the same conditions |
| Left, Right | `stepColumn` from the keyed position. Rests while the click runs |
| `[`, `]` | `stepBar`, on the same terms |

Start clears a keyed position. After a stop, the position is none.
