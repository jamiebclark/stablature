# Research: Tab playback

Phase 0 for [plan.md](./plan.md). Each item gives the decision, why, and what else was weighed. Everything here was read
from the code on `main` at `023faa2`. No question from the spec is left open.

## R1. What exists, and what this entry reuses

| Piece | Where | What it does today | Reused how |
|---|---|---|---|
| Engine | `src/lib/rhythm/scheduler.ts` `createEngine` | Pulls `StreamClick`s from an iterator, queues each `LOOKAHEAD_S` (0.75 s) ahead on the port, tops up every `TOP_UP_MS` (25 ms). `timeOf(tick)` is computed from an anchor, so error does not accumulate. `setTempo` re-anchors at the next item not yet queued. A stream that runs dry stops with `fell-behind`. | **Generalised, not copied.** It pulls a union of items (click, note, mark, end). Click items take exactly today's path. |
| Sound port | `src/lib/rhythm/audio.ts` `ClickClock`, `audioClock`, `silentClock` | `schedule(time, level)` queues one square-wave click. `close()` stops every live oscillator and closes the context. | Gains an **optional** `note(time, end, voice)`. The click graph (square, `VOICES`, `master` → destination) is byte-identical when no note is ever queued. |
| Click stream | `src/lib/rhythm/stream.ts` `clickStream(score, follow)` | Count-in of 4, then the score's clicks, then a plain beat forever. | **Called, not restated**: one round's clicks are `clickStream`'s items after the count-in, cut at the round's end (R5). `stream.ts` has zero diff. |
| Notation reader | `src/lib/rhythm/notation.ts` | `census` (which groups read), `readBar` (each hit's ticks, `fitFor` ratio), `walk`, `notationColumns`. All private but the last few. | Two helpers are exported unchanged in behaviour: `readGroups` (today's `census`) and `hitTicks(duration, group)` (the one line `readBar` uses to shorten a counted hit). `readBar` calls `hitTicks`, so the click and playback share one piece of arithmetic (R3). |
| Drawn passes | `src/lib/arrangement/passes.ts` `drawnPasses` | The only caller of `eventsInBars` for the play view. | Playback reads the same `passes` array `PlayView` hands to the cards and the bar. A new `partPass(part, events)` builds part playback's one pass beside it (R9). |
| Reading position | `src/components/reading/useReadingPosition.ts` `place({pass,key})` | Writes `tab-column-reading` onto the column, the card's live `pass k of n` words, and scrolls under `mayFollow`. | Called with playback's marks instead of the click's `columnAt`. No change to the hook. |
| Click hook and bar | `src/components/rhythm/useClick.ts`, `ClickBar.tsx` | One engine per bar; wake lock; hidden and pagehide stop; rAF loop for the beat box and highlight; `CLICK_WORDS` with ghosts for the held height. | Extended: an optional `notes` run, a gate for Click, a speed factor, new words in `CLICK_WORDS` (so they get ghosts), cluster controls. |
| Pitch | `src/lib/tunings.ts` `fretToMidi` | Throws for a missing string or a bad fret. | Called once per note after a `tuning.strings[s]` existence check (R7). |
| Techniques | `src/lib/tab/techniques.ts` `drawnTransition` | The priority order the staff draws when a string holds two transitions. | Called, so playback's transition is the drawn one (FR-011, spec edge case). `src/lib/tab/` has zero diff. |
| Part menu | `src/components/app/SongView.tsx` `OverflowMenu` | Edit, `+ variant` (base parts only), Delete. Items render only while open. | Gains **Play** as the first item, a link (R9). The closed card's markup is unchanged. |

## R2. The stream items and the engine change

**Decision.** The engine pulls `StreamItem = StreamClick | StreamNote | StreamMark | StreamEnd`:

- `StreamClick` is today's shape. It has no `kind` field, so every existing stream, fake and test still type-checks and
  takes the same path.
- `StreamNote { kind: "note"; tick; endTick; voice }` → `clock.note?.(timeOf(tick), timeOf(endTick), voice)`. A port with
  no `note` (the silent clock, every existing fake) ignores it.
- `StreamMark { kind: "mark"; tick; mark: { pass, eventId, repetition } }` → pushed to a second display queue that
  `dueMarks()` drains, the way `due()` drains clicks. The outline reads marks, so it follows the time the note was
  queued for, not a re-derived one (R11).
- `StreamEnd { kind: "end"; tick }` → once queued, the engine stops pulling. On the first top-up at or after
  `timeOf(tick)` it stops with the new reason **`ended`**.

Each item updates `last` and is queued under the same `time >= now + LOOKAHEAD_S` / `time < now` tests as a click, so a
note can fell-behind exactly as a click can. `setTempo` re-anchors at `pending.tick`, which every item has.

`start({ bpm, stream, audible?, voices? })`:
- `audible(click)` decides at **queue time** whether a click is sent to the port. A click it refuses is still pushed to
  the display queue, so the beat box and the phase words carry on with Click off (R6).
- `voices: true` is passed to `makeClock({ voices })`, so the port builds its note bus only for a notes run (R12). The
  existing fakes ignore the argument.

`StopReason` gains `"ended"`. `useClick` treats it like `tap`: no stopped line (FR-033).

**Why.** FR-029 forbids a second timing loop, and SC-003 wants a note and a click at one tick to be scheduled for the same
instant. One iterator converted by one `timeOf` gives both by construction. Keeping `StreamClick` field-for-field means
the click's path through `topUp` is the same code with the same arithmetic. SC-010 requires `scheduler.test.ts`,
`engine-seams.test.ts` and `tables.test.ts` to pass unedited.

**Alternatives.**
- *A second engine for notes, slaved to the click's clock.* Two loops, two lookaheads and two `setTempo` re-anchors that
  must agree. Rejected by FR-029.
- *Notes as clicks with extra fields.* This would change `QueuedClick` and what `due()` returns, which the click tests
  read. Rejected.
- *Leave `done` → `fell-behind` and make looping streams infinite.* A run with Loop off has to end, and FR-033 says the
  end is not a failure. `done` without an `end` item still reads as `fell-behind`, so a broken stream is still reported.

## R3. One arithmetic for the click and the notes

**Decision.** `notation.ts` exports two functions and changes no behaviour:

- `readGroups(events)`, today's `census`, renamed by an exported alias. The private name stays, so the diff is one line.
- `hitTicks(duration, group)`, which returns `duration.ticks × fit / n` for a counted group that reads and
  `duration.ticks` otherwise. `readBar` calls it in place of its inline expression.

`src/lib/playback/timeline.ts` walks each pass's playable rows in order. For each hit it calls `hitTicks(set ?? carried
?? QUARTER, readGroups(pass.events).get(e.tupletId))`. A set column updates `carried`, and `carried` resets at each
pass.

**Why.** FR-014 says "computed with the same arithmetic the click uses", and SC-003 says the notes start on exactly the
click's ticks wherever the notation is timed. If the shortening rule were written twice, the two copies could drift
apart. With `hitTicks` there is one copy.

The agreement holds by induction. In a timed prefix, every hit's ticks are `hitTicks(set, group)` in both walks. Bars
add with no gap in both: `walk` advances `offset` by `read.length`, which is the sum of the bar's hits. Passes add with
no gap in both. So the k-th timed hit has the same tick in both walks. The rhythm corpus test (SC-003) confirms it
rather than assumes it.

All ticks are integers. `TICKS_PER_BEAT` = 360360 = 2³·3²·5·7·11·13, and for every n from 2 to 16 and every one of
the six durations, `ticks × fit / n` is a whole number. The 32nd note is the tightest case: 45045 = 3²·5·7·11·13, and
n = 15 gives 24024. So "exactly" means integer equality, with no tolerance.

**Alternatives.** Copying `fitFor` into playback (rejected: two copies). Making `walk` itself length-rule aware with a
flag (rejected: it changes the click's reader for no gain, and the reader ends at the first untimed bar by design).

## R4. The length rule, as an algorithm

**Decision.** For each pass, in order (`carried` starts null):

```
for each event e in pass.events:
  barline            → no time
  notes | rest       → d = readDuration(e.durationHint)          // the table; unknown → null
                       if d: carried = d
                       len = d ?? carried ?? QUARTER                // rules 1, 2, 3
                       group = e.tupletId ? groups.get(e.tupletId) : undefined
                       hit = hitTicks(len, group ?? null)          // rule 5: carried lengths keep a reading group's ratio
                       repeat max(1, e.repeat) times: one column hit of `hit` ticks
```

`groups` is `readGroups(pass.events)`. A group that does not read maps to `null`, so `hitTicks` gives the plain length
(FR-016). A plain group (`counted: null`) also gives the plain length.

Rule 4 resets at a loop round because each round re-reads the same precomputed pass list from the start. The timeline is
built once per run, and a round replays it at an offset.

The rule's **summary** for the words (FR-044), over every playable column in scope:

| Summary | When |
|---|---|
| `written` | every column has a set length |
| `some` | at least one set, at least one unset |
| `none` | none is set |
| `empty` | no playable column at all |

The worked example (spec) is the contract's corpus row L1 ([contracts/playback-stream.md](./contracts/playback-stream.md) §3).

**Why.** This is the spec's rules 1 to 5, read literally. Carrying the `Duration` rather than the hit's ticks is what
makes the worked example's space after a triplet last ½ beat, not ⅓.

## R5. A round's clicks are the click's own clicks

**Decision.** `roundClicks(score, follow, roundTicks)` reads `clickStream(score, follow)`, drops the four count-in
items, rebases the rest by `−COUNT_IN_CLICKS × TICKS_PER_BEAT`, and stops before the first item with
`tick >= roundTicks`. `playStream` yields the count-in from the same `clickStream` call. Then, round after round, it
yields the round's clicks offset by `round × roundTicks`, merged by tick with the round's notes and marks.

Within a round, items are ordered by tick, and ties go click, then mark, then note. The order only matters to the
engine's "first item past the lookahead stops the top-up" test, and that test is tick-monotone either way.

**Why.** FR-020 says "the click in each round is the click of the first round, cut at the round's end", and AS-6 says a
note starts on the click's notation moment. Reading `clickStream` keeps spec 005's following and plain rules: the switch
to a plain beat at the first untimed bar, and the plain beat from `lengthTicks`. There is no second account of when the
click clicks.

**Alternative.** Restating the following/plain logic in playback was rejected, because it is two copies.

## R6. Click, Loop and Notes while running

**Decision.**

- **Click.** It is read through `audible`, at the moment each click is queued. Clicks already queued keep sounding. The
  next one queued after the switch obeys it. The count-in always sounds (decision 9): count-in items carry
  `phase: "count-in"`, and `audible` passes them unconditionally.
- **Loop.** `playStream` reads `controls.loop()` when it reaches a round's end. That is when the engine pulls the item
  after the round's last one, which is up to `LOOKAHEAD_S` (0.75 s) plus one top-up before the end sounds. If Loop is
  on, it yields the next round. Otherwise it yields `end`.
- **Notes.** It is disabled while running (FR-023).

**Why.** The spec says "Loop is read at the run's end" and "Click from the next click not yet queued". A switch that
changed something already queued would need the port to cancel scheduled audio, and the click port cannot do that by
design. The 0.75 s window is the engine's lookahead, and it is recorded in `docs/DECISIONS.md` as the meaning of "at the
run's end".

## R7. Pitch, strings and harmonics

**Decision.**

- **Pitch.** It is `fretToMidi(tuning, s, fret)` for a numeric fret. Before the call, a string index with no entry in
  `tuning.strings` is skipped, which makes the note silent and never throws (FR-018). Fret values are read with
  `fretAt`. A key that is not a whole number, and a fret that is not a non-negative integer or `"x"`, are skipped the
  same way.
- **Harmonic.** At frets 12, 7, 19, 5, 24, 4, 9 and 16 the pitch is `open + {12, 19, 19, 24, 24, 28, 28, 28}`. Any
  other fret keeps the fretted pitch with the harmonic tone.
- **Dead note.** `x`, or `dead_note` on a numeric fret, is a **thud**. Its "pitch" is the open string's MIDI number,
  used only to place the noise band lower on lower strings.

**Why.** These are the spec's FR-009 and FR-018, plus the table's harmonic row. Checking the string first is cheaper and
clearer than catching `RangeError`.

## R8. The technique table, resolved per note

**Decision.** The timeline resolves each sounding string of each hit into one `Voice` (fields in
[data-model.md](./data-model.md) §2). The port then does what the voice says, with no musical decisions of its own:

| Stored (after `drawnTransition` picks one transition) | `attack` | `glideFrom` | `tone` | `sustain` | Notes |
|---|---|---|---|---|---|
| none | `pick` | null | `plain` | `length` | |
| `hammer_on`, `pull_off`, string sounding | `none` | null | as the note | as the note | The port moves the live voice's pitch. |
| `hammer_on`, `pull_off`, nothing sounding | `soft` | null | | | |
| `slide_up`, `slide_down`, string sounding | `none` | previous pitch | | | The glide arrives at the note's start. |
| `slide_up`, nothing sounding | `soft` | pitch − 3 | | | The glide starts at the note's start. |
| `slide_down`, nothing sounding | `soft` | pitch + 3 | | | |
| `vibrato` | | | | | `vibrato: true` (±25 cents, 5.5 Hz) |
| `palm_mute` | | | `muted` | `half` | Sounds for at most half its length; darker filter. |
| `let_ring` | | | | `ring` | Rings until the same string plays again or the run ends. |
| `harmonic` | | | `harmonic` | `long` | Pitch per R7. |
| `bend`, `tap` | ignored: the voice is byte-equal to the same note without them | | | | |
| `dead_note`, fret `x` | `pick` | null | `dead` | `thud` (`thud-muted` with `palm_mute`) | Every other technique, transitions included, is ignored. |

"The string's previous note is still sounding at t" is decided in the timeline. The previous voice on that string (in
this round, or the last round across the seam, or the last pass across a pass boundary) has a sounding end ≥ t. The
sounding end is start + length for `length`, start + length/2 for `half`, ∞ for `ring` (until replaced) and `long`
(until replaced or its natural decay), and start + 60 ms for a thud. Since the inequality includes equality, `5h7` in
adjacent columns connects. A dead note never takes a transition, and a note after a dead note never connects to it.

**Why.** Deciding articulation in a pure function makes the whole table testable with no audio (FR-054, US5's
independent test). The port can only be checked by ear and by the browser recorder.

**The loop seam.** The spec's edge cases say a transition that starts a pass connects across the seam if the string is
still sounding. AS-9 says each round sounds the same as the first. These conflict for exactly one case, a part whose
first note is a hammer-on, pull-off or slide. **Decision: the edge case wins.** Round 1 gets the "nothing sounding"
attack. Later rounds connect when the last round's voice on that string is still sounding. This is recorded in
DECISIONS. The test pins round 2 and later as identical to one another.

## R9. Part playback: the route and its pass

**Decision.**

- **Route.** It is `/songs/[songId]/play/[partId]`, a new page beside `play/page.tsx` that renders
  `<PlayView songId partId />`. This mirrors `capture/[partId]` ("Linkable, and survives a reload"). It uses the same
  Next 16 convention, `params: Promise<…>`, awaited in an async server component (from
  `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/dynamic-routes.md`; this app does not enable
  Cache Components, so no Suspense requirement). `screenFor` already maps `/songs/x/play/…` to `"play"`, so the keys
  and help work unchanged.
- **The pass.** `partPass(part, events)` lives in `src/lib/arrangement/passes.ts`, beside `drawnPasses`. It returns one
  `DrawnPass` with `step = { partId, entryId: "part:" + id, pass: 1, passes: 1, fromBar: null, toBar: null, sections:
  [], visits: [] }` and `events` equal to the part's own events. Part playback hands `[partPass(...)]` to `drawnCards`,
  `ClickBar`, `readingStops` and `useReadingPosition`, the same consumers the whole song uses. So card, outline, keys and
  sound all read one value.
- **The page.** Its heading is `PageHeader title={song.title}` with the subtitle `Part B, main riff` (label and name)
  and a `Whole song` link to `/songs/{id}/play` (FR-004). Back goes to `/songs/{id}`. An unknown or deleted part says
  `That part is not on this device.` with the back link.
- **Menu.** The **Play** item is a link (`href`), the first item on every part, base or variant, with the accessible
  name `Play part B`. It is a link so that opening it can never start audio (FR-002, FR-028).

**Offline.** A new URL behaves like `capture/[partId]` today. The service worker serves a route offline once it has
been visited, and `ServiceWorker.tsx` warms each pathname on arrival. `public/sw.js` must not change (FR-052). The real
phone item "airplane mode … reached by tapping through the app" is owed and is not claimed here.

**Alternatives.**
- *`?part=` on the play route.* The offline properties are the same: a new key for both the page cache and the RSC
  cache. It also gives no linkable path segment like capture's.
- *`#part=` in the hash.* It would share the play route's cache entry, but Next's router fires no event when only the
  hash changes on a `<Link>` back to the whole song, so the view could not tell it had switched. Too fragile.
- *A transport on the song page.* Decision 1.

## R10. Speed, Notes, Click and Loop: where each lives

| Choice | Default | Held | Why |
|---|---|---|---|
| Notes (whole-song view) | off | `localStorage` key `stablature.play`, `{ notes: boolean }`, through a module shaped like `panels.ts` (untrusted storage, memory wins after a set, server snapshot off) | FR-023: "remembered on this device … as the panels and the view control are". |
| Notes (part playback) | on | component state, per mount | FR-003. It never touches the stored whole-song choice. |
| Loop (whole song) | off | module memory for the app session | Spec: not stored. Off matches the click's "carry on until stopped" expectation. |
| Loop (part playback) | on, every time it opens | component state | FR-003. |
| Click | on | module memory for the session, global | FR-003: "Click and speed keep their current values". |
| Speed | 100 | module memory, `Map<songId, percent>`, for the app session | FR-037: per song, reset on the next app open, never stored or synced. |

`src/lib/playback/choices.ts` is React-free. It exposes `get`/`set`/`subscribe` for the four values, and the components
use them through `useSyncExternalStore`, exactly as `usePanel` wraps `panels.ts`.

The **effective tempo** is `usableTempo(song.bpm) × speed / 100`, a plain number, not rounded. Only the displayed bpm is
rounded (FR-035). `useClick`'s existing effect calls `engine.setTempo(effective)` whenever either factor changes while
running (FR-038). This covers a tap-tempo change and a synced tempo change arriving mid-run (US3 AS-6).

## R11. The outline with Notes on

**Decision.** `playStream` emits one `StreamMark` per column hit: every playable column, each repeat hit, spaces
included, barlines not. Its tick is the hit's start. `useClick`'s rAF loop, in a notes run, calls
`engine.dueMarks()`, takes the latest and calls `onColumn({ pass, eventId, repetition })`. Nothing else changes:
`PlayView`'s `onColumn` → `place` → `useReadingPosition`, which writes the class, the live pass words and the scroll.

With Notes off, the loop runs exactly today's `columnAt(columns, playhead − countIn, lengthTicks)` path, unedited.

**Why.** FR-040 asks for "within 50 ms of its column's moment on the audio clock". The mark's time is the note's time,
set by the same `timeOf` call. A rAF frame is about 16 ms, so the outline changes 0 to 17 ms after `clock.now()` passes
it. Re-deriving the column from a tick through `columnAt` would be a second account. It would also mis-place the outline
for up to 0.75 s after a speed change, because already-queued notes keep their old times while a re-anchored tick would
not.

## R12. The voice

**Decision.** It is built from built-in nodes only: no worklet, no file, no fetch (FR-052).

| Part | Nodes | Detail |
|---|---|---|
| Pitched note | 1 `OscillatorNode` (`setPeriodicWave`) → `BiquadFilterNode` lowpass → `GainNode` → notes bus | Amplitudes from a pure `waveFor(tone, hz)`: `aₙ = base(n) × lift(n·hz)`. `base` is 1/n for plain and muted tones and 1/n² for harmonic. `lift(f)` raises harmonics below 200 Hz to a power curve so that low strings keep at least half their energy above 200 Hz (FR-025, SC-012). |
| Pluck | the filter's cutoff and the gain | Cutoff starts at about 2.5 kHz (plain) or 500 Hz (muted) and falls exponentially toward a floor. Gain attack is 3 ms for `pick` and 12 ms for `soft`, then an exponential decay with a time constant per `sustain`. |
| Legato or glide (`attack: none`) | the live voice on that string | `cancelScheduledValues` and a new `stop(time)` on that oscillator. The frequency steps at the note's time (legato) or ramps over `min(previous length / 2, ½ beat)` ending at it (glide). The end is rescheduled. |
| Vibrato | 1 sine `OscillatorNode` at 5.5 Hz → `GainNode` (depth `hz × (2^(25/1200) − 1)`) → the voice's `frequency` | |
| Thud | 1 `AudioBufferSourceNode` playing a 0.2 s white-noise buffer, made once per context in code → bandpass at about 2.5 × the open string's Hz (clamped 150 to 1500 Hz) → `GainNode` | 60 ms; 35 ms with palm mute. |
| Mix | notes bus `GainNode` → `DynamicsCompressorNode` (limiter) → `master` | Exists only when `makeClock({ voices: true })`. Then `master` itself goes through a final limiter to the destination, so a click (accent gain 1) plus seven notes cannot clip. With Notes off, none of this is built and the click graph is today's. |
| Stop | `close()` | The notes bus's gain goes to 0 with a 5 ms time constant. Every live source is stopped at `now + 0.03`. `context.close()` runs after 40 ms. All of it is well inside 50 ms (FR-031), and it does not pop. |
| End | `stop("ended")` | The same `close()`. Ringing notes fade over its 5 ms time constant. That is short, but no step ("fade out rather than cut off with a click", FR-019). |

**SC-012 is pinned as a property.** For every pitched tone (`plain`, `muted`, `harmonic`), at the lowest string of every
preset in `TUNING_PRESETS` (F0 at 21.8 Hz is the worst), open and at each harmonic node, compute the energy fraction
above 200 Hz from `waveFor` through the RBJ lowpass magnitude at the filter's **floor** cutoff (its darkest moment). It
must be at least 0.5. The exact `lift` exponent is the implementer's to pick. The unit test is the gate, and a browser
analyser tap confirms it on the real output (quickstart §5).

Checked by hand for the plain tone with `lift(f) = min(1, (f/200)²)` at F0: harmonics 1 to 9 hold about 0.041 of the
energy and 10 to 64 hold about 0.090, which is 69% above 200 Hz. Through a 600 Hz floor it is still about 63%. The
harmonic tone (1/n²) needs a steeper lift, around (f/200)³, which gives about 53% at F0 + 12.

**Why not Karplus-Strong with a `DelayNode` loop?** Web Audio clamps a delay inside a cycle to at least one render
quantum (128 frames), which is at most 375 Hz at 48 kHz. Guitar tunings and harmonics go far above that.

**Why not samples?** They are out of scope, and they would need fetched files (FR-052).

## R13. The bar: words, labels, speed mark, focus

**Decision.**

- **`CLICK_WORDS` gains a `notes` block** with the six idle messages of FR-044, plus `running.playing: "Playing."`. Every
  new message goes into `IDLE_GHOSTS` or `RUNNING_GHOSTS`, so the held height covers it (FR-045). The longest new idle
  message (56 characters) is shorter than the longest existing ghost (the 78-character `fell-behind` line), so the held
  height with Notes off is unchanged. `wide-narrow-unchanged.spec.ts` pins it exactly (97 at 375 and 412) and runs
  unedited.
- **Start label.** `Start click` with Notes off, `Play` with Notes on, in the same `h-11 w-[86px]` button with the same
  `data-testid="click-start"` (FR-024).
- **Speed mark** (FR-039). Below 100%, the bar's `TempoControl` (`variant="bar"`) draws a small `70%` badge, absolutely
  positioned inside its own border box. The button gains `relative`, so the badge takes no layout space and nothing
  moves. The accessible name becomes `Tempo: 120 bpm, playing at 70%`. The capture header's tempo control does not get
  the prop, so capture is untouched.
- **Cluster** (open). The order is: `click-follow` (unchanged rule), `Notes`, `Click` and `Loop` (the last two only with
  Notes on), the speed stepper (`Slower`, the readout `70% · 84 bpm`, `Faster`; 50 to 100 in steps of 5; each button is
  disabled at its end), then the existing `cluster` children (view control, Capture). Each switch is a `Button` with
  `aria-pressed`. Its visible name is fixed (`Notes`), followed by an `aria-hidden` state word (`on`/`off`), so the
  state is read by text and by assistive technology, never by colour (FR-022).
- **Focus at the end** (FR-033). In `onChange`, when the reason is `ended` and `document.activeElement` is the Stop
  button, `ClickBar` focuses `click-start` after the idle render. Only `ended` does this, so a Stop tap with Notes off
  behaves exactly as today.

## R14. Keys

`toggle-click` (Space) and `restart` (`r`) keep their ids and handlers. The handlers call the bar's `start`, `stop` and
`restart`, and those already mean "playback" when Notes is on. Only the help words in `src/lib/keys/shortcuts.ts`
change:

- Space: `Start or stop the click, or the notes when they are on`
- `r`: `Start again from the top, with the count-in`, unchanged, because it is already true of both

`shortcuts.test.ts` pins ids and keys, not words.

## R15. Existing tests

- **Must pass unedited.** Every `src/lib/rhythm/__tests__/*`, `click-bar.test.tsx`, `tempo-control.test.tsx`, every
  `e2e/click-*.spec.ts`, `e2e/wide-click-*.spec.ts`, `e2e/reading-*.spec.ts`, `e2e/wide-narrow-unchanged.spec.ts`, every
  capture spec, and `positions-vs-click.test.ts`.
- **One file changes on purpose.** `e2e/polish-part-card-menu.spec.ts` counts the menu's items (`want = variantOf ? 2 :
  3`). FR-001 adds **Play** to every card, so this becomes 3 and 4. Every other assertion in it, including ArrowDown
  reaching each item and Home/End, is unchanged, and it now walks one more item. It is named in DECISIONS under "011 —
  re-pinned tests" (FR-034).
- `click-helpers.ts` is not edited. The notes recorder lives in a new `e2e/play-helpers.ts`, which wraps `installRecorder`
  and also records each source's `type`, so square clicks, `custom` notes, `sine` vibrato LFOs and buffer-source thuds can
  be told apart.

## R16. The playback song (SC-002, SC-005)

`seedPlaybackSong` in `e2e/play-helpers.ts` calls `seedFitSong` (`e2e/wide-helpers.ts`), clears every duration, sets
120 bpm, and adds part **T** plus an arrangement entry for it. Its unit twin is
`src/lib/playback/__tests__/fixtures.ts`, which builds the same passes in memory from the same table
([data-model.md](./data-model.md) §5). Part T's columns cover every row of the technique table, each in both its
"sounding" and "nothing sounding" case where the row has both.

## R17. Things checked and found not to matter

- `OverflowMenu` renders items only while open, so adding **Play** leaves the closed song page's markup unchanged
  (`narrow-before.json` holds).
- `useScreenKeys("play", …)` is mounted once per bar, so part playback gets the keys for free.
- Print: part playback renders one ordinary `print-keep` card, and the bar is `no-print`.
- Viewers: playback writes nothing, so there is no role check (spec Assumptions).
- `drawnCards` on a one-pass list returns one card at offset 0, so bar numbers start at 1 (FR-002).
