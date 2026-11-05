# Contract: screens

## `ColumnInspector.tsx`

One new `case "segments"` in `Control`, rendering a `SegmentRow`. Like every other case it reads the
descriptor and never an id.

```text
duration
[ w ][ h ][ q ][ 8 ][ 16 ][ 32 ]
```

- `grid w-full grid-cols-6 gap-1`, each `min-h-11`, on the wrapped second line of the row.
- `aria-pressed={on}`, `aria-label` in words, `data-testid="duration-row"` on the grid.
- Styled exactly as `ToggleGrid`'s buttons, so lit is `bg-accent text-accent-text`, plus
  `font-mono` because the labels are marks. Lit is not colour alone: `aria-pressed` for assistive
  tech, and the fill for sight, which is the existing pattern.
- `commit` is not awaited and the sheet stays open.

## `TabStaff.tsx` (CRLF)

New prop `showRhythm?: boolean`, default false. `const hasRhythm = showRhythm &&
layout.columns.some((c) => c.duration !== null)`.

When `hasRhythm`, `Column`'s body gains one last child, after the cells:

```text
<div class="h-[1.1rem] ... text-[0.65rem] text-text-dim" data-testid="tab-rhythm">{mark}</div>
```

Empty for a column with no duration, and for a barline, so the row stays aligned. It sits below the
strings, so `offsetFor` and the string labels do not change. `Gap` needs no filler, because the row is
below the cells and the flex row stretches. When `hasRhythm` is false, the DOM is the same as before.

Only `SongView` and `PlayView` pass `showRhythm`. `CaptureScreen` and `PasteTab` do not, which is FR-016.

## `layout.ts`

Per [data-model.md](../data-model.md). `describeColumn` gains a last parameter, the duration's words,
appended as `, ${words}` after any `repeated N times`, and after `Empty column`.

## `CaptureScreen.tsx`

Two additions, and nothing else moves.

**Header**, between the title and the sync status: `<TempoControl song={song} variant="header" />`.

**Status row**, after the chord spans and before the start and end buttons, when `!refused` and the
column at the cursor has a duration:

```text
<span data-testid="cursor-duration" class="shrink-0 font-mono text-text-dim">eighth note</span>
```

The row is `overflow-hidden whitespace-nowrap`, and the status and chord spans already truncate, so
this takes width from them and adds no height.

## `TempoControl.tsx`

`src/components/rhythm/TempoControl.tsx`. Props: `song: Pick<SongRow, "id" | "bpm">`, and `variant:
"header" | "bar"`. Holds its own `open` state and renders the shared `Sheet`, so the screen that hosts
it holds no state for it.

| Variant | Size | Text with a tempo | Text with none |
|---|---|---|---|
| `header` | `-my-2 py-2`, `text-[0.7rem]`, `font-mono`, `shrink-0` | `118 bpm` | `no tempo` |
| `bar` | `h-11` | `118 bpm` | `no tempo` |

Accessible name: `Tempo: 118 bpm` or `Tempo: none set`. `aria-haspopup="dialog"`. `data-testid="tempo-control"`.

## The tempo sheet

Same file, shown inside `Sheet` with label `Tempo`. Its state is the `TapRun`, and because `Sheet`
renders children only while open, it is gone on close.

```text
Tempo                                   close
This song: 96 bpm                       <- data-testid="tempo-stored"
118                                     <- data-testid="tempo-reading", role="status"
┌──────────────────────────────────────────┐
│                 Tap here                  │ <- data-testid="tap-pad", at least 96px
└──────────────────────────────────────────┘
[ Set 118 bpm ]                         <- data-testid="tempo-set", slot always reserved
```

The pad is a `<button>` with `touch-none select-none`, focused on open, with the handlers in research
R11. Set writes through `setSongTempo` and closes the sheet. Close, Esc and the backdrop close it with
no write. The set button is absent, not disabled, unless the reading is `reading`, and its slot stays
reserved so nothing moves under the finger.

| State | `tempo-reading` says |
|---|---|
| `waiting`, 3 | `Tap in time` |
| `waiting`, 2 | `Keep tapping` |
| `waiting`, 1 | `Once more` |
| `reading` | `118` |
| `out-of-range`, with a number | `403 is out of range. Tempo runs from 20 to 400.` |
| `out-of-range`, `tooSlow` | `Too slow to read. Tempo runs from 20 to 400.` |

`tempo-stored` says `This song: 96 bpm`, or `This song has no tempo`.

## `ClickBar.tsx`

`src/components/rhythm/ClickBar.tsx`, rendered by `PlayView` as the last child of `<main>`, for any song
that exists. Props: `song`, `passes`, `notationReady`.

`sticky bottom-0 z-10 -mx-4 border-t border-border-subtle bg-bg px-4 py-2 no-print`, in the flow after
the list. So it stays in reach while scrolling, and sits below the last staff, covering nothing, at
the end of the scroll. `data-testid="click-bar"`.

```text
Idle     [ Start click ] [ Follow notation ]        [ 118 bpm ]
Running  (beat)          [ Stop ]                   [ 118 bpm ]
         status line, and help while running
```

| Slot | Idle | Running or starting |
|---|---|---|
| 1 | `click-start`, `h-11`, primary | `click-beat`, inert, `aria-hidden`, same size |
| 2 | `click-follow`, `aria-pressed`, `h-11`, only when `score.timedFromStart` | `click-stop`, `h-11`, takes focus on start |
| 3 | `TempoControl`, `variant="bar"` | The same control, the same node |

Start is `disabled` until `usableTempo(song.bpm)` is not null and `notationReady` is true.

`click-beat` is a box holding one shape, set by `data-level`, or the number during the count-in. No
transition, no keyframes.

| `data-level` | Shape |
|---|---|
| empty | Small hollow ring |
| `soft` | Small filled dot |
| `beat` | Medium filled dot |
| `accent` | Large filled square |

### The status line

`data-testid="click-state"`, `role="status"`, `text-xs text-text-dim`. It changes on a state change
only, never per click.

| Situation | Words |
|---|---|
| No usable tempo | `Set a tempo to use the click.` |
| Idle, will follow | `Click follows the notation.` |
| Idle, plain | `Click is a plain beat.` |
| Count-in | `Counting in.` |
| Following | `Following the notation.` |
| Plain | `Plain beat.` |
| Stopped, `hidden` | `Stopped because the screen was hidden. Start again when you are ready.` |
| Stopped, `audio-lost` | `Stopped because the device took the audio. Start again when you are ready.` |
| Stopped, `fell-behind` | `Stopped because the click could not keep time. Start again when you are ready.` |

A second line, `data-testid="click-help"`, shows while starting or running:

| Situation | Words |
|---|---|
| Sound is on | `Can't hear it? Check the silent switch and volume.` |
| `soundless` | `No sound on this device. The beat is still shown.` |

## `PlayView.tsx`

- `const passes = useMemo(() => drawnPasses(steps, eventsByPart ?? {}), [steps, eventsByPart])`, above
  the early returns.
- The list maps over `passes`. `eventsInBars` is no longer imported here.
- `showRhythm` on its `TabStaff`.
- `<ClickBar song={song} passes={passes} notationReady={eventsByPart !== undefined} />` at the end of
  `<main>`, after either branch, so a song with no arrangement has it too.

## `SongView.tsx` (CRLF)

`showRhythm` on its one `TabStaff`. Nothing else.

## Test hooks

`duration-row`, `tab-rhythm`, `cursor-duration`, `tempo-control`, `tempo-stored`, `tempo-reading`,
`tap-pad`, `tempo-set`, `click-bar`, `click-start`, `click-stop`, `click-follow`, `click-beat`,
`click-state`, `click-help`.

## The recorder

`e2e/click-helpers.ts`, installed with `addInitScript` before any navigation. It must `goto` a real
URL, because it does not run under `setContent`.

| Records | How |
|---|---|
| Contexts made, and when | `window.AudioContext` subclass |
| Every source's `when`, and every `stop` | Wrapping `AudioScheduledSourceNode.prototype.start` and `.stop` |
| Oscillator frequency, for the level | Reading `frequency.value` at `start` |
| `close()` calls and context state | The same subclass |
| Any `audioSession.type` write | A trap defined on `navigator` |
| Any `HTMLMediaElement.play`, or `new Audio` | Wrapping them |
| `wakeLock.request` and `release` | A stub on `navigator.wakeLock`, because headless may refuse a real one |
