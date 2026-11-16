# Contract: the transport (the bar, the cluster, part playback, keys)

The DOM hooks are what the e2e specs drive. Every `data-testid` that exists today keeps its element and meaning.

## 1. Routes

| Path | Page | Renders |
|---|---|---|
| `/songs/[songId]/play` | unchanged | `<PlayView songId />` |
| `/songs/[songId]/play/[partId]` | **new**, `src/app/songs/[songId]/play/[partId]/page.tsx` | `<PlayView songId partId />` |

The new page is an async server component that awaits `params: Promise<{ songId: string; partId: string }>`, exactly
like `capture/[partId]/page.tsx`.

## 2. Part card menu (`SongView.tsx` `PartCard`)

The items, in order:

1. **`Play`**, a link to `/songs/{songId}/play/{partId}`, with the accessible name `Play part {label}`. Its icon is
   lucide `Play`, `aria-hidden`.
2. `Edit` (unchanged)
3. `+ variant` (base parts only; unchanged)
4. `Delete` (unchanged)

So a base part has 4 items and a variant has 3. Nothing else on the card changes, and while the menu is closed the
card's markup is identical to `main`.

## 3. `PlayView` with `partId`

- `passes = part ? [partPass(part, eventsByPart[part.id] ?? [])] : []`. Everything downstream is the same code path
  as the whole song: `drawnCards`, `readingStops`, `useReadingPosition` and `ClickBar`.
- **Header.** `PageHeader title={song.title}` with `back={{ href: /songs/{id}, label: "Song" }}`. Under it, a line
  `data-testid="part-playback"` reads `Part {label}` (plus `, {name}` when named), followed by a link `Whole song` to
  `/songs/{id}/play`.
- **The card.** One `li[data-card="0"]` with today's card markup: card number `1`, label, name, heading, and the staff
  with `barNumbers={{ offset: 0 }}`. There are no section words and no slice words.
- **An unknown part.** `<p>That part is not on this device.</p>` with the back link, and the bar does not render.
- **No arrangement.** This has no effect: part playback never reads `entries` for its passes.
- `ClickBar` receives `scope="part"`, so Notes and Loop start on in component state (§4).

## 4. `ClickBar` props and controls

```ts
export interface ClickBarProps {
  // …every existing prop, unchanged
  /** New. Absent → Notes is never offered and the bar is exactly today's. */
  playback?: {
    readonly scope: "song" | "part";
    readonly tuning: Tuning | null | undefined;
  };
}
```

With `playback` absent (the existing unit test, and any other caller), the bar renders and behaves byte-for-byte as on
`main`.

**Cluster body** (`panel-play-cluster-body`). The order is:

| testid | Kind | Shown | Label / state | Notes |
|---|---|---|---|---|
| `click-follow` | button, `aria-pressed` | unchanged rule | unchanged | |
| `play-notes` | button, `aria-pressed` | always with `playback` | `Notes` + aria-hidden `on`/`off` | `disabled` while not idle |
| `play-click` | button, `aria-pressed` | Notes on | `Click` + `on`/`off` | live while running |
| `play-loop` | button, `aria-pressed` | Notes on | `Loop` + `on`/`off` | live while running |
| `play-slower` | button | always with `playback` | `−`, `aria-label="Slower"` | disabled at 50 |
| `play-speed` | `output`, `aria-live="polite"` | always with `playback` | `70% · 84 bpm`, or `100%` with no tempo | |
| `play-faster` | button | always with `playback` | `+`, `aria-label="Faster"` | disabled at 100 |
| (existing `cluster` children) | | | | |

Every control meets spec 007's floors: at least 44 × 44 on a coarse pointer, and the fine floor on a mouse.

**Lead.** The start button `click-start` reads `Start click` when Notes is off and `Play` when Notes is on, in the
same `h-11 w-[86px]` box. `click-beat` and `click-stop` are unchanged.

**Tempo control in the bar.** `TempoControl variant="bar" speed={speed}`. Below 100 it renders
`<span data-testid="speed-mark" aria-hidden="true" class="absolute …">70%</span>` inside the button. The button gains
the classes `relative` and `aria-label="Tempo: {n} bpm, playing at 70%"`. At 100, the markup is today's.

**Words.** `click-state` picks its text as follows:

| Condition | Text |
|---|---|
| Notes off | exactly today's logic |
| Notes on, no usable tempo | `CLICK_WORDS.notes.noTempo` |
| Notes on, idle, stopped | `CLICK_WORDS.stopped[reason]` (unchanged words) |
| Notes on, idle, no tuning | `notes.noTuning` |
| Notes on, idle | `notes[timeline.rule]` |
| running, phase `count-in` | `running.counting` |
| running, otherwise | `running.playing` |

`click-help` is unchanged and shows while running. While idle with nothing to report and the panel closed, the words are
read aloud only (`sr-only`), as today. This applies only to the four rule messages. `noTempo`, `noTuning`, `empty` and
the stopped lines always show.

`Play` is disabled when there is no usable tempo, `notationReady` is false, there is no tuning, or the rule is `empty`.

**Held height.** `IDLE_GHOSTS` gains the six `notes` messages. `RUNNING_GHOSTS` gains `running.playing` × each help
line.

**Focus.** After a stop with reason `ended`, if Stop had focus, `click-start` gets focus.

## 5. Keys (`src/lib/keys/shortcuts.ts`)

| id | key | Words (help overlay) |
|---|---|---|
| `toggle-click` | Space | `Start or stop the click, or the notes when they are on` |
| `restart` | `r` | `Start again from the top, with the count-in` (unchanged) |

The handlers in `ClickBar` are unchanged. They call `begin`, `stop` and `restart`, which already mean playback when Notes
is on.

## 6. DOM hooks for the outline

These are unchanged. `useReadingPosition` writes `tab-column-reading` on `[data-card] [data-column]`, sets
`li[data-reading]`, and writes `card-passes-live`. The e2e specs observe the class with a `MutationObserver` and read
`AudioContext.currentTime` in the same callback.

## 7. Recorder (`e2e/play-helpers.ts`)

`installPlayRecorder(page)` calls `installRecorder` (unchanged) and also patches:

- `OscillatorNode.prototype.start`, to record `{ when, hz, type }` in `__play.osc`;
- `AudioBufferSourceNode.prototype.start`, to record `{ when }` in `__play.thuds`;
- `AudioParam.prototype.setValueAtTime` and `exponentialRampToValueAtTime` on oscillator `frequency` params, to record
  `{ when, value }` in `__play.freq`;
- `AudioNode.prototype.connect`, so that a connection to `context.destination` goes through an `AnalyserNode`
  (`__play.analyser`) whose output connects onward, so the analyser sees the summed output. The analyser's own
  connection goes through the saved original `connect`, so the patch does not recurse;
- `window.fetch`, `XMLHttpRequest.prototype.open` and the `Request` constructor, to count calls after a mark
  (`__play.requests`) for INV-016.

It also exports `seedPlaybackSong(page)`, `partT` (the text of [data-model.md](../data-model.md) §5), `noteStarts(rec)`
(the `custom` oscillators), `clickStarts(rec)` (the `square` ones) and `outlineLog(page)` (installs the
`MutationObserver`).
