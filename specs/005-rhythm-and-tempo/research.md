# Research: Durations, tap tempo and a click

Phase 0 for [plan.md](./plan.md). Every unknown in Technical Context is resolved. Each
entry is a decision, why it was made, and what else was weighed. **Ran** marks a claim that was
measured for this plan, not reasoned.

## What was run

Throwaway probes, deleted afterwards. Nothing here touched the app or `.next`.

| Question | Result |
|---|---|
| Does Web Audio run in the suite's headless Chromium at Pixel 7 emulation? | Yes. `resume()` resolved in 34 ms, and `currentTime` went from 0 to 0.45 in about half a second. |
| Can a page-level recorder see what was scheduled? | Yes, from `addInitScript` on a real navigation: a subclass of `AudioContext` counted constructions, and wrapping `AudioScheduledSourceNode.prototype.start` and `.stop` recorded `[0.05, 5]`. It does **not** run under `page.setContent` on `about:blank`, so probes must `goto` a real URL. |
| Does headless Chromium enforce the autoplay rule? | **No.** A context made with no gesture reports `running`. So a probe of FR-028 must count constructions before the tap. It cannot read `state`. |
| What does `close()` do to queued sound? | `state` reads `closed` synchronously, in the same task as the call. |
| Can a page make 60 contexts one after another, closing each? | Yes, 60 of 60 reached `running`. |
| Is `navigator.wakeLock` present on `localhost`? `navigator.audioSession`? | `wakeLock` yes, in a secure context. `audioSession` no, so a probe has to define a trap for it. |
| Does the widest mark fit the narrowest column? | `32` at `0.65rem` measured 11.4 px in a `calc(1ch + 0.6rem)` column of 18.4 px, with the fallback monospace. The app's JetBrains Mono has a 0.6em advance, so this needs re-reading in the real page (INV-010). |
| What contrast do the token pairs give? | `--text-dim`: 7.07 and 6.54 dark, 6.38 and 6.61 light, on `--bg` and `--bg-raised`. `--text-faint`: 3.30 to 3.74, which fails 4.5:1 on every surface. |
| What is the smallest exact unit of time? | Least common multiple of the table's odd denominators is 45,045, so 360,360 ticks to a beat. |

## R1. Time is an integer, not a float

**Decision**: Beats are counted in integer ticks, `TICKS_PER_BEAT = 360360`. Every length in the
spec's tables is a whole number of ticks. Seconds appear only in the scheduler.

**Rationale**: "Strongest wins where two land together" depends on an exact comparison. In floats,
`1/3 + 1/3 + 1/3` need not equal `1`, so the third hit of a triplet would be a Soft a hair before a
Beat, and the listener would get a flam on the beat. 360,360 is `8 × 3² × 5 × 7 × 11 × 13`: eight
for the 32nd note, and the odd part covers every denominator from 3 to 15. The largest realistic
song stays near 10¹³ ticks, well inside `Number.MAX_SAFE_INTEGER`.

**Alternatives**: floats with an epsilon, which needs a tolerance that some tuplet at some position
will defeat. BigInt rationals, which are correct and slow, and are what the test oracle uses so that
the two share nothing (R15).

## R2. Scheduling

**Decision**: A `setInterval` of 25 ms tops up a queue reaching 750 ms ahead on the audio clock.
Times come from an anchor: `time = anchorTime + (tick − anchorTick) / TICKS_PER_BEAT × 60 / bpm`. A
click's time is computed only as it enters the queue and is never recomputed afterwards.

**Rationale**:

- The anchor form means error cannot accumulate, which is what SC-003 asks. Summing an interval onto
  the previous time would drift.
- 750 ms covers SC-004's 200 ms stall with a wide margin, and also a re-render of a long play view.
  Its cost is that a tempo change takes up to 750 ms to be heard, which FR-032 allows.
- A timer decides only *when to look*. It never decides when a click sounds (FR-030).
- If a top-up finds the next click already in the past, the queue ran dry and time is lost. That
  stops the click with `fell-behind` (FR-037), so it never plays late.

**A tempo change** re-anchors on the last queued click. The trap is a slow tempo: at 10 bpm the last
click can be 5.9 s old, and moving to 120 puts the next click 5.4 s in the past, which would read as
`fell-behind`. So the re-anchored time is `max(last + newInterval, now + START_LEAD)`.

**Alternatives**: `setInterval` deciding the click, which the brief rejects. An `AudioWorklet`, which
is precise and needs a module file fetched at runtime, which FR-041 forbids.

## R3. One AudioContext per run

**Decision**: Start makes a new `AudioContext` inside the tap, and stop calls `close()` on it.

**Rationale**: `close()` silences everything queued at once, and was measured to take effect
synchronously, so FR-031 and SC-006 do not depend on finding every node. It also releases the
hardware each time, which is FR-039. A stale or interrupted context cannot be carried into a new run.
Stop still calls `.stop()` on each queued node first, so a browser that closes asynchronously is
silent regardless.

**Alternatives**: one context per screen, suspended between runs. It saves a few tens of
milliseconds, and it has to handle resuming an `interrupted` context and clearing nodes by hand. The
measured 34 ms leaves room inside SC-005's 200 ms. If a real phone proves slow to start, this is the
first thing to revisit.

## R4. Two clocks, one engine

**Decision**: The scheduler talks to a `ClickClock` port with two implementations. `audioClock` wraps
the context. `silentClock` uses `performance.now()` and makes no sound. If there is no `AudioContext`
constructor, the constructor throws, or `resume()` has not reached `running` within 1 s, the run
carries on with `silentClock` and says so.

**Rationale**: FR-036 requires a visual beat when sound fails, and a suspended context's `currentTime`
does not advance, so the audio clock cannot drive it. A second engine would be a second account of
the count-in, so the port is the seam, and it is also what lets a fake clock drive SC-003's ten-minute
runs in a fraction of a second.

## R5. The sound

**Decision**: Per click, one `OscillatorNode` into a `GainNode` into a master gain, with a fast attack
and an exponential decay over about 30 ms. Square wave for its harmonics. Accent 2,000 Hz at gain
1.0, Beat 1,300 Hz at 0.7, Soft 800 Hz at 0.35.

**Rationale**: Phone speakers fall away below about 400 Hz and are strongest around 1 to 3 kHz, and a
bass guitar occupies the range below that. The three levels differ in both pitch and loudness, so
they do not rest on one cue. These are starting values: whether they cut through a played bass is
owed to a real phone and cannot be settled here.

**Alternatives**: an embedded sample, which the brief allows. It adds decoding to the start path and
gives no gain over a synthesised tick.

## R6. Silent means silent

**Decision**: Nothing sets `navigator.audioSession.type`, and nothing plays an `<audio>` element.

**Rationale**: Both are the known ways to make iOS ignore the ringer switch: `audioSession.type =
"playback"`, and the silent looping `<audio>` trick. FR-035 forbids getting around the switch. Plain
Web Audio on iOS obeys it. The probe traps both (INV-027).

## R7. The visual beat

**Decision**: A `requestAnimationFrame` loop compares the clock with the queue, and writes
`data-level` and the count-in number straight to the indicator through a ref. React state changes
only when the phase changes, which happens a handful of times per run. The indicator returns to rest
100 ms after each click. Nothing animates: there is no CSS transition or keyframe, only a discrete
change of shape.

**Rationale**:

- A state update per click would re-render a screen of staves up to several times a second, which is
  the stall FR-030 worries about.
- A frame is 16 ms, well inside FR-034's 50 ms.
- With no motion at all, reduced motion is honoured by construction, and the small dot cannot flash
  the screen.
- The return to rest is needed because a steady plain beat would otherwise show no change at all.
- Accent, Beat and Soft differ in size and in fill, so colour is not carrying them.

Audio and visual read the **same queue entry**, so they cannot disagree about a click's time.

## R8. The rhythm mark is the position's own label

**Decision**: The mark under a column is the text of its inspector position, `w h q 8 16 32`, in the
staff's monospace at `0.65rem` in `text-text-dim`.

**Rationale**: FR-015 wants six marks told apart at actual size without colour. Different characters
do that by construction, and FR-008 wants positions learned, so one vocabulary serves both. `32`
measured 11.4 px in an 18.4 px column, so FR-014 holds with room. `text-text-dim` measures at least
6.38:1 on every surface and prints as `#333`.

**Alternatives**: stems and flags, as in engraved rhythm tab. They are the more familiar notation, but
at 11 px high, one, two and three flags close into a blob, and the difference between `8`, `16` and
`32` is exactly the distinction that has to survive a phone in a dim room. Worth revisiting with an
SVG set if the text reads as noise. This is one function to swap.

## R9. The row in the inspector

**Decision**: A new property, `id: "duration"`, scope `column-property`, with a new control kind
`"segments"`. It sits second in `COLUMN_PROPERTIES`, right after `repeat`.

**Rationale**:

- The scope already means "playable, not a barline", so FR-004 needs no new rule, and a space is
  playable.
- The inspector is written to never branch on ids (spec 001 INV-025), so a new control kind keeps
  that true. Reusing `toggles` would force a fake string group.
- Second place is the highest row whose position depends on nothing above it, because `repeat` has a
  fixed height. Below `decorations` it would move with the string count, and FR-008 says positions
  must not move.
- FR-011: it gets no entry in `TOOLBAR_CONTROLS`, so no toolbar sees it.

The commit is computed from what was on screen at the tap, and written as an absolute value, never
read-modify-write. So two fast taps on an unlit `8` store `8`, and a tap after the row has caught up
clears it. In both cases the stored value is what the last tap asked for, given what the person could
see.

## R10. The tempo control

**Decision**: One `TempoControl` component holds its own open state and renders the shared `Sheet`.
In the capture header it sits between the title and the sync status, as `-my-2 py-2` so that it adds
nothing to the header's height. In the click bar it is 44 px high.

**Rationale**: Owning its open state means no `CaptureScreen` state is touched by opening it, which
is FR-019 by construction. The header works out at 37 px from its classes, which INV-009 pins. A 44 px target there would either grow the
header, which FR-018 forbids, or overlap the part chips and steal their taps. FR-026's 44 px is
written for the click's controls, so the header's shorter target does not break it. See Deviation 7.

## R11. Timing a tap

**Decision**: `onPointerDown`, reading `event.timeStamp`. `touch-none select-none` on the pad. Every
pointer counts, not only the primary one. `onKeyDown` for Space and Enter with `!event.repeat`, also
reading `event.timeStamp`. `onClick` counts only `detail === 0` activations that no key press has
already counted, which is how a screen reader's activate arrives.

**Rationale**: `timeStamp` is the moment the browser received the input, so a busy main thread does
not shift it. Reading `performance.now()` in the handler would. `touch-action: none` stops double-tap
zoom and stops the sheet taking the gesture as a scroll, which would fire `pointercancel`. Two thumbs
alternating fast make the second pointer non-primary, and FR-020 says quick taps must not be lost.

## R12. The tap rules, and a tempo slower than 20

**Decision**: A pure reducer over tap times. It keeps the last nine taps, which is eight intervals,
and the reading is `round(60000 / mean)`. A later tap resets the run on a gap over 3,000 ms, or an
interval strictly under half or over double the running mean. A time not later than the last tap is
ignored.

**The spec's rules collide at the slow end.** FR-022 restarts on any gap over three seconds, and
three seconds is exactly 20 bpm, so no run can ever produce a reading below 20. Story 2 scenario 8
still asks that taps slower than 20 say the tempo is out of range. So the reducer carries one flag,
`tooSlow`, set when a gap restart lands on a run of a single tap: that is, two taps in a row more than
three seconds apart. The sheet then says the tempo is out of range. See Deviation 1.

## R13. One account of the passes

**Decision**: A new `drawnPasses(steps, eventsByPart)` in `src/lib/arrangement/passes.ts` returns each
step with its sliced events. `PlayView` maps over it to draw, and `readNotation` takes its output.
Neither calls `eventsInBars` for itself.

**Rationale**: FR-043 forbids a second account, and the plan's rule is that one must call the other.
`expandArrangement`'s own docblock already names "a future playback" as a caller. A lift of the
loop body out of `PlayView` is the smallest change that makes the agreement structural.

## R14. Reading a group

**Decision**: Group facts are a census over each pass: for each `tupletId`, its stored column count,
whether any is repeated, and the set of `groupNumber` values its rows give. A bar is untimed if any
counted group it touches has a number that differs from its count, has a repeated column, has rows
that disagree on the number, or has a number with no row in the fractions table.

**Rationale**: `groupNumber` is what the bracket prints, so the click agrees with the page. A census
per pass is what makes both the spec's edge cases fall out: a group split across a barline adds up
across the pass, and a group cut by a bar range does not. Field-level merging means two rows of a
group can hold different numbers, because each field is clocked alone. The spec does not cover that,
and "no knowable length" is the honest reading (Deviation 3).

## R15. Testing what cannot be heard

**Decision**: Three layers.

| Layer | What it proves | How |
|---|---|---|
| Pure | Lengths, levels, bars, taps | Vitest over `readNotation`, `clickStream`, the tap reducer |
| Fake clock | Timing, stalls, stops, tempo changes, including ten-minute runs | Vitest over the scheduler with a hand-advanced clock and timer |
| Real page | That the page really does it | Playwright with a recorder from `addInitScript`, reading the `when` of every source |

**Independent oracle.** Entry 4 taught that a sweep whose filter is the rule's own test passes by
construction. So the walk's seeded property test compares it with a reference written from the
spec's text in BigInt fractions, sharing no code with `notation.ts`: no ticks, no `fit` table import,
no census. The hand tables in SC-009 are written out as literals.

## R16. Where new tests live

**Decision**: New unit tests go in `src/lib/rhythm/__tests__/`, not `src/lib/tab/__tests__/`.

**Rationale**: `round-trip.test.ts` lists that folder and fails on any `*.test.ts` that is neither
harvested nor excluded. A new file there would fail it, or force an edit to it. The test that gives
every fixture a duration uses the same `vi.mock` harvest as `harvest.test.ts`, from the new folder.

## R17. Start and stop are not in the same place

**Decision**: While running, the slot that held Start shows the beat indicator, which takes no input,
and Stop sits in the next slot along.

**Rationale**: "Start tapped twice quickly starts one click." If Stop replaced Start in place, the
second tap of a double tap would stop the click, and any time window to ignore it would also ignore a
real stop, which FR-031 forbids and SC-006's random stops would catch. Moving the control needs no
timing rule at all. A second tap landing before React commits hits Start again, and `start()` does
nothing unless idle.

## R18. Keeping the screen on

**Decision**: `navigator.wakeLock?.request("screen")` after the run starts, inside a `try`. If it
resolves after the run has already stopped, it is released at once.

**Rationale**: FR-038. The lock is dropped by the browser when the page hides, and the click stops
then anyway, so nothing needs re-acquiring.

## R19. Offline

**Decision**: Static imports only for everything the click and the tempo sheet need. No `next/dynamic`
or `React.lazy`. `public/sw.js` is not changed.

**Rationale**: `node_modules/next/dist/docs/01-app/02-guides/lazy-loading.md` describes those two as
the way to defer a Client Component. A chunk first asked for in a rehearsal room with no signal does
not exist, and awaiting it would also lose the gesture. Without either, the code ships in the route's
own chunks, which the service worker already caches as hashed assets. `next.config.ts` has no
`cacheComponents`, so a route that is left unmounts normally and the effect cleanup stops the click.

**FU25.** specs/004's review saw the song screen lose its controls after in-app navigation offline,
undiagnosed. It is not fixed here, but the offline scenario in INV-031 must arrive through in-app
links as well as a direct open, so that if it reaches the play view the suite fails and says so.

## R20. What an unknown stored value can and cannot do

**Finding**: `applyRemoteRows` parses each pulled row and silently drops a failure, so an unknown
duration cannot arrive through sync. It can only be a row already in the local store, for example
from a later version of the app. FR-007 is therefore a read-side guarantee, and the probe has to seed
IndexedDB directly.

**A limit worth knowing**: `patchRow` queues the whole row, and the wire's enum refuses an unknown
value. So editing another field of such a column would push a row that sync refuses. That is existing
behaviour and is not made worse here. It stays out of scope, because the row cannot arise through any
path this app has today.
