# Implementation Plan: Tab playback, a part or the whole song as sound

**Branch**: `011-tab-playback` | **Date**: 2026-11-16 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/011-tab-playback/spec.md`

## Summary

A part's card menu gains **Play**, which opens `/songs/{id}/play/{partId}`: the play view with one card, Notes on and
Loop on. In the whole-song play view, the cluster gains Notes, Click, Loop and a speed stepper. With Notes on, Play
counts in and plays every drawn pass. Pitches come from the tuning, lengths from a stated rule for unset durations,
articulation from a technique table, and the sound is a synthesised plucked voice. The outline follows the note being
played. Nothing is stored, synced or exported.

The design has five parts. In each, two things that must agree are kept in agreement because one **calls** the other:

- **One engine, one clock.**
  - `createEngine` pulls a union of stream items: today's `StreamClick` unchanged, plus `note`, `mark` and `end`.
  - Every item's time comes from the one `timeOf(tick)`. A note and a click at one tick get the same audio time by
    construction (SC-003).
  - A run with an end stops with a new reason, `ended`, which is never `fell-behind` (FR-033) (research R2).
- **One arithmetic.**
  - `readBar` (the click) and `playTimeline` (the notes) both call the newly exported `hitTicks(duration, group)` and
    `readGroups(events)`.
  - Playback never restates `fitFor` (research R3). The length rule only chooses *which* duration goes in: set, then
    carried, then a quarter (R4).
- **One click.** A round's clicks are `clickStream(score, follow)`'s own items after the count-in, cut at the round's
  end (R5). The count-in is the same four items.
- **One list of passes.**
  - The whole song plays `drawnPasses(...)`, the value `PlayView` already draws.
  - Part playback plays `[partPass(part, events)]`, built beside `drawnPasses` in `passes.ts`.
  - Cards, keys, the outline and the sound all receive the same array (R9).
- **One outline.**
  - The stream emits a `mark` per column hit, scheduled at the hit's audio time. The hook drains `dueMarks()` into the
    existing `place()`.
  - Nothing re-derives a column from a tick in Notes mode (R11). With Notes off, the click path is unedited.

The voice is built from built-in Web Audio nodes: a custom periodic wave, a lowpass pluck, gain envelopes, a noise
thud, a vibrato LFO, and a limiter on the notes bus and the master. It has no worklet and no file, so `public/sw.js` has
zero diff. Its spectrum is a pure function, so SC-012 is a unit property (R12). With Notes off, the port builds
exactly today's click graph.

There is no migration, no new dependency, and no change to `src/lib/tab/`, the export, sync, the model, capture or
`public/sw.js`.

## Technical Context

**Language/Version**: TypeScript 5 (strict), React 19.3, Next.js 16.4.3 (App Router; `params` is a `Promise`, awaited in
an async server page, per `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/dynamic-routes.md`).

**Primary Dependencies**: The Web Audio API (`OscillatorNode` with `PeriodicWave`, `BiquadFilterNode`, `GainNode`,
`AudioBufferSourceNode`, `DynamicsCompressorNode`), Tailwind CSS 4, Dexie 4 (read only) and `lucide-react` (the `Play`
icon). **No new dependency.**

**Storage**: None new. One device-local boolean (`localStorage["stablature.play"]`, the Notes choice) through a
`panels.ts`-shaped module. Speed, Click and Loop live in module memory. Dexie, Postgres and sync are untouched.

**Testing**: Vitest (`npm test`; node by default, jsdom by docblock). It uses the scheduler tests' fake-clock `rig`
pattern for the engine and a fake port that records `note()`. Playwright 1.64 (`npm run test:e2e`) runs against a
production build on the `mobile` and `desktop` projects. Audio is checked with a recorder that patches source
`start`, frequency automation and an analyser tap on the destination (contracts/transport.md §7). A person-level
browser check and real-phone items follow.

**Target Platform**: An installable, offline PWA in mobile Safari and Chrome, and desktop Chromium and Firefox.
Budgeted sizes: 375×667, 412×915, 1280×800.

**Project Type**: Next.js web application, single package.

**Performance Goals**:
- The first count-in click within 200 ms of the tap on a 2,000-hit song (SC-006). The timeline is memoised before the
  tap, and `start()` stays synchronous up to `engine.start`.
- Every note and click within 1 ms of its ideal time over ten minutes on the fake clock (SC-004).
- The outline changes within 50 ms of its mark's audio time (FR-040). One rAF frame is about 16 ms.
- Stop is silent within 50 ms (FR-031).

**Constraints**:
- `stream.ts`, `durations.ts` and `tempo.ts` in `src/lib/rhythm/` have **zero diff**. `notation.ts` gains exports only,
  and `readBar` calls `hitTicks`.
- Every existing scheduler, stream, notation, click-bar and click e2e test passes **unedited** (FR-034).
- `click-double-tap.spec.ts`, `click-bar-fit.spec.ts` and `wide-narrow-unchanged.spec.ts` are unedited and pass.
- With Notes off, the audio graph, the words, the labels and the bar geometry are today's.
- Capture has zero diff (FR-006).
- Nothing loads on demand: no `import(` under `src/lib/playback/` or in the bar (FR-053).
- Never run the build or the e2e suite while a dev server holds `.next`. Keep each file's line endings.

**Scale/Scope**:
- About 7 new source files (≈700 LOC) and 9 modified.
- 6 new unit spec files and 1 new golden test.
- 11 new e2e specs plus a helper.
- 2 guard scripts.
- 1 existing e2e spec re-pinned on purpose.

**Story dependencies**: US1 and US2 share the engine, timeline, stream and voice. US3 (speed) and US4 (outline) need the
running stream. US5 (techniques) is the timeline's table plus the synth's articulations. The order is: foundations
(engine, timeline, stream, synth) → US1 → US2 → US4 → US3 → US5.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` is still **the unfilled scaffold template**, so there is no ratified constitution to
gate against. As in entries 1 to 10, the gates are the project's working rules from `docs/DECISIONS.md`, `AGENTS.md`
and the code's own headers.

| Gate | Source | Status | How this plan satisfies it |
|------|--------|--------|----------------------------|
| **Browser testing is part of done**, at actual size, in both themes. | `docs/DECISIONS.md` | PASS (owed) | quickstart §5; INV-021. |
| **Real-device claims are not ticked from a desktop.** | spec "Owed to a real phone"; DECISIONS entry 5 | PASS (owed) | quickstart §6, carried as human tasks (INV-021). |
| **A visual tier is never opacity over a surface.** | `docs/DECISIONS.md` | PASS | The speed mark is `bg-bg` with a border and a text token. The switches' state is a word. |
| **Nothing relies on colour alone.** | DECISIONS, chord-tone lesson | PASS | The switches use a state word and `aria-pressed`. The outline is the existing box (FR-042). |
| **A size is never set by a width breakpoint** (density follows the pointer). | `globals.css` density header | PASS | The new controls use `Button` and the `--control` floors. Nothing new is width-gated. |
| **Domain rules live in `src/lib/`, React-free.** | `editing.ts` header | PASS | The length rule, the technique table, the stream, the voice numbers and the choices are all in `src/lib/playback/`. |
| **Every write goes through `mutate.ts`.** | `mutate.ts` header | PASS | No write is added. Speed never calls `setSongTempo` (INV-011). |
| **The SQL schema cannot drift from `model.ts`.** | `assert-model.ts` | PASS | Neither changes. |
| **Offline first: nothing fetched; `public/sw.js` read before touching audio.** | `public/sw.js` header; spec 005 FR-041/FR-042 | PASS | The voice is synthesised. There is no worklet, no `import(`, and `sw.js` has zero diff (INV-016). |
| **Audio starts only inside the tap.** | spec 005 FR-028 | PASS | `start()` is synchronous to `createClock`. Opening part playback creates no context (INV-015). |
| **One timing loop.** | spec 005; roadmap brief | PASS | The engine is generalised, not duplicated (research R2). |
| **Tests must be able to fail for the right reason.** | entry 4 to 10 reviews | PASS | The corpora are hand oracles, never the code under test. The golden engine list is recorded from `main` before any change. No check passes by skipping. |
| **Never reuse a server, never share `.next`.** | `playwright.config.ts` | PASS | No harness change. |
| **Earlier requirements stay true.** | spec 007 FR-064 practice | PASS | Spec 005's Out of Scope line is amended in place (FR-056), pinned by `check:playback-amendments` (INV-020). |
| **Simplicity.** | `ui/index.tsx` header | PASS | No library, no worklet, no second engine. There is one new route, and it mirrors `capture/[partId]`. |

**Post-design re-check (after Phase 1)**: PASS. Nothing is stored. Every pair that must agree is closed by one calling
the other (*Agreement is structural*), except the voice's audibility on a real phone speaker, which no desktop can
prove and is owed (quickstart §6). No gate needs a Complexity Tracking entry.

### Deviations from the spec's wording

1. **A transition that starts a part connects across the loop seam, so round 1 can differ from later rounds** (research
   R8). AS-9 says "each round sounds the same as the first". The spec's own edge case says a hammer-on, pull-off or
   slide that starts a pass connects across the loop seam. Both cannot hold for a part whose first note is a
   transition. The edge case wins. Rounds 2, 3, … are byte-equal to each other (T18), and every other part's rounds are
   identical to round 1. This is recorded in DECISIONS as **worth your eye**.
2. **"Loop is read at the run's end" means "when the end is queued"**, up to `LOOKAHEAD_S` (0.75 s) before it sounds
   (research R6). A later read would need the port to cancel queued audio. This is recorded in DECISIONS.
3. **With Click off, the beat box still pulses** (research R2). Off clicks are not sounded but stay on the display
   queue, so the visual beat and the phase words carry on. The spec says nothing about the beat box with Click off. A
   still box would read as "not running".
4. **The release at the end, and at Stop, is a 5 ms-time-constant fade.** FR-019 asks that ringing notes "fade out
   rather than cut off with a click". FR-031 caps silence at 50 ms. The fade meets both, and it is short.

## Invariants — what must never happen *(mandatory)*

The probes go through the real interfaces: e2e on a production build with the recorder in
[contracts/transport.md](./contracts/transport.md) §7, and the public exports `playTimeline`, `playRounds`,
`playStream`, `roundClicks`, `audibleFor`, `lengthRule`, `waveFor`, `voicePlan`, `energyAbove`, `createEngine` (with
a fake port) and the `choices.ts` store.

Named sets:

- **W**, sizes: 375×667, 412×915, 1280×800.
- **Ptr**: mouse (`desktop`), touch (`mobile`).
- **Th**: dark, light.
- **Sc**, scope: whole song (`/play`), part (`/play/{partId}`), part of a variant.
- **Mode**: Notes off; Notes on × Click {on, off} × Loop {on, off}.
- **Len**: length corpus L1 to L21 ([contracts/playback-stream.md](./contracts/playback-stream.md) §3).
- **Tech**: technique corpus T1 to T19 (§4).
- **Tun**: every member of `TUNING_PRESETS`, all 17: `bass4-e`, `bass4-drop-d`, `bass4-d`, `bass4-drop-c`, `bass4-c`,
  `bass4-drop-b`, `bass5-b`, `bass5-drop-a`, `bass5-a`, `bass5-drop-g`, `bass5-g`, `bass5-drop-f`, `bass6-b`,
  `bass6-drop-a`, `guitar6-e`, `guitar6-drop-c`, `guitar7-b`.
- **Corpus**: the rhythm corpus, i.e. the 11 `BARS` × 5 `ARR` of `positions-vs-click.test.ts` plus `notation-oracle.test.ts`
  section G's seeded arrangements.
- **Stop**: tap Stop, Space, `r` (restart), leaving (the back link), leaving (browser back), `hidden`, `audio-lost`,
  `fell-behind`, `ended`.
- **When**: during the count-in, mid-note, mid-let-ring, mid-glide, at a loop seam.
- **BarN**, the bar's states with Notes on: no tempo; no tuning; nothing to play; `written`; `some`; `none`; counting
  in; playing; stopped `hidden`, `audio-lost`, `fell-behind`; each running state with sound and soundless.
- **Clu**: cluster closed, open.
- **Spd**: 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100.
- **Song**:
  - *playback*: data-model §5;
  - *none*: no arrangement;
  - *untuned*: no tuning;
  - *empty-part*: a part of barlines only;
  - *timed*: the fit song with every duration set;
  - *mid-untimed*: timed, with one untimed bar in pass 3.

| ID | Invariant (never …) | Probe (real interface) | Holds over (enumerate every member) |
|----|---------------------|------------------------|-------------------------------------|
| INV-001 | Never does anything about the click differ with Notes off: its audio graph, the clicks it schedules, its count-in, words, start label, highlight, stop words or the bar's geometry. | Unit `engine-golden.test.ts`: the engine's `schedule()` and `due()` calls for three click streams (plain, following, following then plain) at 40/120/240 bpm equal `engine-golden.json`, which T001 recorded on `main`. Every existing `src/lib/rhythm/__tests__/*` and `click-bar.test.tsx` passes unedited. e2e: every `click-*`, `wide-click-*`, `reading-*` and `wide-narrow-unchanged` spec passes unedited (scope fence pins them). `play-notes-off.spec.ts`: with `playback` present and Notes off, the recorder sees no `custom`/`sine`/buffer source and no compressor node, and `click-start` reads `Start click`. | {plain, following, following→plain} × {40, 120, 240} (unit); **W** × **Ptr** × **Th** (e2e) × {*playback*, *timed*, *none*}. |
| INV-002 | Never does a note sound at a pitch other than its string and fret in the song's tuning (or the harmonic table). Never does a string the tuning lacks sound, and never does it throw. | Unit `timeline.test.ts` pitch corpus: for each voice, `midi` equals a hand table of open-string MIDI numbers plus the fret. T9 for harmonics, T19 for bad strings and frets. e2e `play-part.spec.ts`: the `custom` oscillator `hz` values of part T's round 1 equal `440 × 2^((midi−69)/12)` ±0.01 for the expected list. | **Tun** × every string × frets {0, 1, 5, 12, 24}; harmonic frets {12, 7, 19, 5, 24, 4, 9, 16, 3}; T19's four bad inputs. |
| INV-003 | Never does a hit start or last other than **When a note has no length** gives, and never does the rule write or display a length. | Unit `timeline.test.ts`: every **Len** row's starts and lengths, in ticks, against the hand oracle in beats × 360360. e2e `play-nothing-written.spec.ts`: after runs, the inspector's duration row, the rhythm row's DOM and the export text equal those from before the run. | **Len** (unit); *playback* × {inspector of 3 unset columns, rhythm row, export} (e2e). |
| INV-004 | Never does a note start off the tick the click's notation reading gives its column, wherever the notation is timed, and never do a note and a click at one tick get different audio times. | Unit `stream.test.ts` S4: for every `ColumnTick` of `notationColumns(passes)`, the timeline hit with the same `(pass, eventId, repetition)` has `tick ===`. S5: through `createEngine` with the fake port, a note and a click at one tick give `===` times. e2e `play-agree.spec.ts`: on *timed* with Notes, Click and following on, every `custom` start `when` equals a `square` start `when` (±1e-9) where the expected list says they coincide. | **Corpus** (unit); *timed*, *mid-untimed* × desktop (e2e). |
| INV-005 | Never does a technique sound other than its row of the table: `bend` and `tap` change nothing, a dead note never glides or connects, and the drawn transition wins. | Unit `techniques.test.ts`: each **Tech** row's `Voice`, written out in full in the test. e2e `play-techniques.spec.ts` on part T: no new `custom` start at T1/T3/T4/T11's second note (connected), a `freq` ramp ending at T4's start, a `sine` LFO at T6, buffer sources for the thuds, and T10's `bend`/`tap` notes' frequency events equal to a plain `7`'s. | **Tech** (unit); the rows of part T (e2e, desktop). |
| INV-006 | Never is a column played that the screen does not draw for that run, and never is one skipped: the run plays exactly `passes`, the value the cards are drawn from. | Unit `timeline.test.ts`: `hits` mapped to `(pass, columnKey)` equals `readingStops(passes, offsets)` minus `bar`, for every **Len** row and for the playback song's passes built by `drawnPasses` and by `partPass`. e2e `play-outline.spec.ts` (INV-010's run): the outlined `(data-card, data-column)` sequence equals the drawn page's own columns, read from the DOM in document order and expanded per card by its pass count (`data-first-pass`…`data-last-pass`), with no extra and none missing. | **Len** ∪ {*playback*} × **Sc**. |
| INV-007 | Never do notes and clicks drift from their ideal times, and never does the error grow over a long run, at any tempo or speed. | Unit `engine.test.ts` E1, E2, E5 (fake clock, jitter up to 20 ms). | {40, 120, 240} bpm effective × {Click on, off} × 10 minutes; L1 looped 10 minutes; **Spd** members {50, 70, 100} mid-run. |
| INV-008 | Never does reaching the end read as `fell-behind`, leave a stopped line, leave sound running, or strand focus. Never does a loop seam have a gap, an overlap or a count-in. | Unit E3, E2, S2. e2e `play-end.spec.ts`: with Loop off, `click-state` returns to the idle rule words (never a `Stopped because …` line), `click-start` is focused when Stop had focus, and the analyser RMS is below −60 dBFS 100 ms after the end. With Loop on, the first `custom` start of round 2 is at round 1's end ±1e-6 s, and no `square` start falls between the seams beyond the round's clicks. | **Sc** × {Loop on, off} × {Click on, off}. |
| INV-009 | Never does anything sound more than 50 ms after a stop, whatever stopped it and whenever. | Unit E6: `close()` is called synchronously inside every `stop`, once. e2e `play-stop.spec.ts`: for each **Stop** × **When**, read `ctx.currentTime` at the stop, then (a) every recorded source has a `stop` `when` ≤ t + 0.05 or the context is closed by t + 0.05, and (b) the analyser's RMS over [t + 0.05, t + 0.15] is below −60 dBFS (when the context is still open). SC-007: 100 stops at seeded random times on part T (desktop). | **Stop** × **When**; 100 random. |
| INV-010 | Never does the outline sit on a column other than the one sounding, skip one, repeat one out of turn, or change later than 50 ms after its mark. Never does it show after a stop. With Notes off it is today's. | e2e `play-outline.spec.ts`: a `MutationObserver` logs `(data-card, data-column, ctx.currentTime)` for each class change. The sequence equals the hits of `playTimeline` mapped to keys, every column of every pass, and loops twice for part playback. Each change happens at or after its expected time and ≤ 0.05 s after. The live `pass k of n` words are right on drawn-once cards. No `tab-column-reading` remains after any **Stop**. Notes off: `reading-*` and `usability-highlight-timing` unedited. | **W** × **Th** × {*playback* whole song, part T} × {Click on, off}; drawn-once cards of the fit song. |
| INV-011 | Never does playback, a switch or speed write anything: no Dexie row, no outbox entry, no `bpm`, and nothing in storage but the Notes boolean. | e2e `play-nothing-written.spec.ts`: `dumpDb` before and after 3 runs, 11 speed changes and every switch toggle are identical. The outbox count is unchanged. `localStorage` gains only `stablature.play`. After a reload, the speed reads 100% and Notes keeps its value. Unit `choices.test.ts`: with an injected storage spy, every setter writes at most the one key `stablature.play`, and `setSpeed`/`setClick`/`setLoop` write none. `no-dynamic-import.test.ts` also asserts that no file under `src/lib/playback/` has an `import` line naming `@/lib/local`, `@/lib/sync`, `@/lib/server` or `dexie` (read as text). | **Spd** × **Mode** × **Sc**. |
| INV-012 | Never do the count-in, notes or clicks run at anything but stored tempo × speed. Never does the speed carry to another song or survive an app reopen. | e2e `play-speed.spec.ts`: at 160 bpm × 50%, count-in `square` starts are 0.75 s apart (±1 ms). Set 100% mid-run: the next unqueued interval is 0.375 s, with no new count-in. Song B opens at 100%; back to song A it is 50%; after a reload, 100%. A tap-tempo change mid-run applies × speed. | **Spd** × {Notes off, Notes on} (unit table over `effective`); {50, 70, 100} (e2e). |
| INV-013 | Never do Start/Play, Stop, the beat box, the tempo control or More move by more than 0.5 px, and never does the bar's height change, when a run starts or stops, the cluster opens or closes, the speed changes, or Notes is toggled. Never does the page scroll sideways. | e2e `play-bar.spec.ts`: bounding boxes before and after each transition, and the bar height in every **BarN** state equal to the Notes-off rest height ±0.5. `scrollWidth ≤ innerWidth`. `click-bar-fit.spec.ts`, `click-double-tap.spec.ts` and `wide-narrow-unchanged.spec.ts` unedited (the held height 97 at 375 and 412). | **BarN** × **W** × **Ptr** × **Th** × **Clu** × {speed 100, 70}. |
| INV-014 | Never is a new control under spec 007's floor, never is a switch's state carried by colour alone, never can Notes change while running, and never are Click or Loop offered with Notes off. | e2e `play-controls.spec.ts`: each of `play-notes`, `play-click`, `play-loop`, `play-slower`, `play-faster` is ≥ 44 × 44 on touch and meets the fine floor on a mouse, with `aria-pressed` and a visible `on`/`off` word. `play-notes` is `disabled` while running. `play-click` and `play-loop` are absent with Notes off. Slower and Faster are disabled at 50 and 100. | **W** × **Ptr** × {idle, running} × {Notes on, off}. |
| INV-015 | Never does audio start before a tap on Play or Start, and never does a double tap start two runs. | e2e `play-part.spec.ts`: after the menu's Play navigates and the view settles, `__rec.contexts.length === 0`. `play-double-tap.spec.ts`: two taps 30 ms apart on `click-start` with Notes on give one context, one count-in and one run. `click-double-tap.spec.ts` unedited. | **Sc** × **Ptr**. |
| INV-016 | Never does playback make a network request, fetch a file, load code on demand, or change the service worker. | e2e `play-offline.spec.ts` (production build): with `context.setOffline(true)` after the view loads, a full run of part playback and of arrangement playback completes. `__play.requests` counts zero calls made after the tap. Scope fence: `public/sw.js` has zero diff against `main`. Unit `no-dynamic-import.test.ts`: no file under `src/lib/playback/`, nor `ClickBar.tsx`, `useClick.ts`, `scheduler.ts` or `audio.ts`, contains `import(`. | **Sc** × desktop; the six named files plus every file in `src/lib/playback/`. |
| INV-017 | Never does the part card's Play start sound, change the card's or song page's layout, or change the whole-song Notes choice. Never is a part without Play. | e2e `play-part.spec.ts`: every card (base and variant) has a `Play part {label}` menuitem first. The closed card's rect is unchanged against `narrow-before.json` (via `wide-narrow-unchanged`, unedited). After part playback with Notes on, `/play` still shows Notes off when it was off. Going back lands on `/songs/{id}` with the context closed. Part playback with no arrangement plays. An unknown part shows `That part is not on this device.` | {base named, base unnamed, variant} × **Ptr**; *none*. |
| INV-018 | Never does a pitched note keep less than half its energy above 200 Hz, and never does the mix clip, at the worst case. | Unit `voice.test.ts`: `energyAbove(hz, voicePlan(v), "floor") ≥ 0.5` and the same at `"start"`. e2e `play-mix.spec.ts`: during part T's let-ring chord plus three more notes plus an accent click, the analyser's peak sample is ≤ 1.0. During F0 on `bass5-drop-f`, analyser energy above 200 Hz is ≥ 0.45 of the total (the unit test is the gate; the e2e allows for FFT leakage). | {`plain`, `muted`, `harmonic`} × the lowest string of every **Tun** member × {open, +12, +19, +24, +28} (unit); {chord, F0} (e2e, desktop). |
| INV-019 | Never does a stored row, the sync, the export, the parser, capture, the click's stream, or the service worker change. | `npm run check:untouched-playback` (*Scope fence*). `npm run test:spec004`, export and parser tests, and every capture spec pass unedited. | The paths in *Scope fence*. |
| INV-020 | Never is an earlier requirement left saying something untrue, a decision left unrecorded, or a test pin moved in silence. | `npm run check:playback-amendments`: spec 005's Out of Scope line `Pitched playback of the notes.` carries `Amended by spec 011`. DECISIONS has "011 — decisions" naming each of the spec's 11 decisions and this plan's 4 deviations, and "011 — re-pinned tests" naming each file in *Existing tests this changes on purpose*. | spec 005's line; the 11 + 4 decisions; the re-pin table. |
| INV-021 | Never is a claim that needs a person or a real phone marked done. | `tasks.md` carries quickstart §5 (browser check, SC-013 by ear) and §6 (six phone items) as human tasks, `🛑 BLOCKED` until done. | §5's nine scenarios × **W** × **Th**; §6's six items. |
| INV-022 | Never does Space or `r` do anything but start or stop the run in the current mode, and never does the help overlay describe only one mode. | e2e `play-keys.spec.ts`: with Notes on, Space starts (count-in, then `custom` sources) and Space stops. `r` while running restarts with a fresh count-in and one context. With Notes off, both do today's (`usability-keys.spec.ts` unedited). The help overlay's Space row reads the new words. | {Space, `r`} × {Notes on, off} × {idle, running} × **Sc**. |
| INV-023 | Never do the bar's words disagree with what plays: the length-rule message is always `timeline.rule`'s, and Play is never enabled when there is nothing to play. | Unit `click-bar.notes.test.tsx` (jsdom, new file): for each **BarN** idle state, `click-state` text and `click-start.disabled`. e2e `play-words.spec.ts`: *playback* (none), *timed* (written), a part with one set length (some), *empty-part*, *untuned*, and no tempo. | **BarN** idle states × **Sc**. |
| INV-024 | Never does hiding the page, the device taking the audio, or falling behind leave notes playing or say anything but the existing words. | e2e `play-every-ending.spec.ts`: the patterns of `click-every-ending.spec.ts` with Notes on. `visibilitychange` gives the `hidden` line, a forced `statechange` gives the `audio-lost` line, and a stalled main thread gives the `fell-behind` line. Each is silent within 50 ms (INV-009) and Play works again. | {`hidden`, `pagehide`, `audio-lost`, `fell-behind`} × **Sc**. |
| INV-025 | Never does leaving the view keep audio or wake lock, and never do repeated runs exhaust audio resources. | e2e `play-cycles.spec.ts`: 50 cycles of open part playback → Play → Stop → back → reopen. Each cycle creates exactly one context and closes it (`__rec.closes` equals `contexts`). The wake lock is released each time. The 50th run's count-in sounds. | 50 × {part, whole song} × desktop. |

### Requirements to invariants

| Requirements | Invariants |
|---|---|
| FR-001, FR-002, FR-003, FR-004, FR-005 | INV-017, INV-015 |
| FR-006 | INV-019 |
| FR-007, FR-008 | INV-006 |
| FR-009, FR-018 | INV-002 |
| FR-010, FR-011, FR-012, FR-013 | INV-003, INV-005, INV-006 |
| FR-014, FR-016 | INV-003, INV-004 |
| FR-015 | INV-003, INV-011 |
| FR-017 | INV-005 |
| FR-019, FR-020, FR-021 | INV-008, INV-001 |
| FR-022, FR-023, FR-024 | INV-014, INV-013, INV-001 |
| FR-025, FR-026, FR-027 | INV-018, INV-002 |
| FR-028, FR-029, FR-030 | INV-015, INV-004, INV-007, INV-012 |
| FR-031, FR-032, FR-033 | INV-009, INV-024, INV-008 |
| FR-034 | INV-001, INV-020 |
| FR-035, FR-036, FR-037, FR-038, FR-039 | INV-012, INV-011, INV-013 |
| FR-040, FR-041, FR-042, FR-043 | INV-010 |
| FR-044, FR-045, FR-046 | INV-023, INV-013 |
| FR-047, FR-048 | INV-022, INV-015 |
| FR-049, FR-050 | INV-025 |
| FR-051 | INV-011 |
| FR-052, FR-053 | INV-016 |
| FR-054 | INV-002 to INV-009 (unit) |
| FR-055 | INV-021 |
| FR-056 | INV-020 |
| SC-001 | INV-017 (three taps: menu, Play, Play) |
| SC-002 | INV-002, INV-003, INV-006 on *playback* |
| SC-003 | INV-004 |
| SC-004 | INV-007, INV-008 |
| SC-005 | INV-010 |
| SC-006 | `play-part.spec.ts`: first `square` start `when` − tap ≤ 0.2 s on a 2,000-hit part |
| SC-007 | INV-009 |
| SC-008 | INV-011, INV-012 |
| SC-009 | INV-016 |
| SC-010 | INV-001, INV-019 |
| SC-011 | INV-013 |
| SC-012 | INV-018 |
| SC-013 | INV-021 |
| Edge: no arrangement | INV-017, INV-023 |
| Edge: no tuning; a missing string | INV-023, INV-002 |
| Edge: 1 bpm and 999 bpm | INV-003 (L21), INV-009 |
| Edge: barline-only, trailing or double barlines | INV-003 (L17 to L19) |
| Edge: repeat ×8 | INV-003 (L8), INV-010 |
| Edge: transitions at a pass start or the loop seam | INV-005 (T17, T18) |
| Edge: a group that does not read, or cut by a slice | INV-003 (L12 to L14) |
| Edge: an edit mid-run, a part deleted mid-run | `play-sync-midrun.spec.ts`: a remote edit and a part deletion arriving mid-run change nothing until the next start |
| Edge: a double tap, Stop during the count-in | INV-015, INV-009 (**When** = count-in) |
| Edge: hidden, lock, call, audio taken, falling behind | INV-024 |
| Edge: no audio device | `play-every-ending.spec.ts` with `audio: "absent"`: the outline and beat still run, and the soundless line shows |
| Edge: print | `play-part.spec.ts` with print emulation: one card, no bar |

### Agreement is structural

| Two things that must agree | How |
|---|---|
| A note's start, and the click's tick for its column | Both walks call `hitTicks` and `readGroups` from `notation.ts`. Playback has no copy of `fitFor`. |
| A note's audio time, and a click's at the same tick | Both go through the engine's one `timeOf`. |
| The clicks in a notes round, and the click's own clicks | `roundClicks` iterates `clickStream(score, follow)`. |
| The passes played, drawn, stepped by keys, and outlined | `PlayView` computes `passes` once (`drawnPasses` or `[partPass]`) and passes the one array to `drawnCards`, `readingStops`, `useReadingPosition` and `ClickBar`. |
| The outline, and the note sounding | The outline reads `dueMarks()`, whose times the engine set in the same `topUp` pass as the note's. |
| The bar's length-rule words, and the lengths played | Both read `lengthRule(passes)`, which `playTimeline` calls. |
| Play's availability, and whether anything would play | `disabled` reads `rounds === null`, which is null exactly when `rule === "empty"` or there is no tuning. |
| The held height, and the words the bar can say | The ghosts and the live words both read `CLICK_WORDS`. |
| The pitch, and the fretboard's pitch | `fretToMidi`. |
| The transition played, and the one drawn | `drawnTransition` from `src/lib/tab/techniques.ts`. |
| The effective tempo for count-in, notes and click | One `engine.setTempo(effective)` and one `bpm` in `start`. |
| The voice's spectrum, and SC-012's measurement | `energyAbove` reads the same `voicePlan` the synth applies. **Not fully structural**: the RBJ filter formula stands in for the browser's `BiquadFilterNode`, so `play-mix.spec.ts` measures the real output too. |

### Blast-radius decisions

| Decision | Choice | Why | Invariants it sets |
|----------|--------|-----|--------------------|
| **Data rewrite**: existing rows. | None. No migration, backfill or normalisation. The length rule is never written. | Spec FR-015, FR-051. | INV-003, INV-011, INV-019 |
| **Data write**: what playback may persist. | One device-local boolean, `localStorage["stablature.play"].notes`. Nothing else, anywhere. Speed, Click and Loop live in memory. | FR-023, FR-037, FR-051. | INV-011 |
| **The song's tempo**. | Read only. Speed never calls `setSongTempo`. The tempo sheet in the bar still writes the stored tempo as today, which is spec 005's existing authority, unchanged. | FR-037. | INV-011, INV-012 |
| **Authority**: who may play. | Everyone who can open the song, viewers included. No role check is added. | Playback writes nothing (spec Assumptions). | INV-011 |
| **Device authority**: the audio hardware and the wake lock. | Taken only inside a tap on Play or Start. Released on every stop path, on leaving, and on hiding. The silent switch is never circumvented: no `audioSession` write and no `<audio>` element. | FR-028, FR-031, FR-049, FR-050; spec 005. | INV-015, INV-009, INV-024, INV-025 |
| **Deletion**: could anything be removed? | No. The part menu's Delete is unchanged: still last, still `destructive`, same handler. Play is a link added first, so it cannot run an action. | FR-001. | INV-017 |
| **Publishing**: what leaves the device. | Nothing. No request is made by playback, and nothing is synced or exported. | FR-051, FR-052. | INV-016, INV-011 |
| **Network and cache authority**. | `public/sw.js` and its `VERSION` are unchanged. No worklet and no file. The new route relies on the existing "visited routes work offline" rule. | FR-052; research R9. | INV-016, INV-019 |
| **Code authority**: which shared modules change. | `scheduler.ts` (additive: item kinds, `dueMarks`, `ended`, `audible`, `voices`), `audio.ts` (additive: optional `note`, the voices graph behind a flag), `notation.ts` (exports only; `readBar` calls `hitTicks`), `passes.ts` (adds `partPass`), `ClickBar.tsx`, `useClick.ts`, `TempoControl.tsx` (an optional `speed` prop), `PlayView.tsx`, `SongView.tsx` (one menu item), `shortcuts.ts` (one string). Nothing else outside the new files. | research R1. | INV-001, INV-019 |
| **Earlier spec text**: what may be rewritten. | Spec 005's Out of Scope line `Pitched playback of the notes.` only, amended in place with `*(Amended by spec 011: …)*`. Spec 005 FR-033 (the click is not pitched) stays true and is not touched. | FR-056. | INV-020 |
| **Existing tests**: what may be edited. | Only the files in *Existing tests this changes on purpose*, each re-pinned to an equal or stronger check, never deleted, and named in DECISIONS. A test outside the table that fails is a product defect. If implement finds a test that pins the bar's Notes-off markup *on purpose* and cannot pass, it stops and adds the file to the table with its reason **before** editing it. | FR-034. | INV-020 |
| **Money** | None involved. | | |

### Scope fence

`scripts/untouched-by-playback.sh`, run as `npm run check:untouched-playback`, prints `zero diff` for every path below
against `main`, tracked or untracked, and fails on any other result:

- **Storage, sync and server**: `src/db/`, `drizzle/`, `src/lib/server/`, `src/lib/sync/`, `src/app/api/`,
  `src/lib/model.ts`, `src/lib/local/`.
- **Notation, layout, export, capture**: `src/lib/tab/`, `src/lib/export/`, `src/lib/capture/`, `src/lib/chords.ts`,
  `src/lib/tunings.ts`, `src/lib/pitch.ts`, `src/lib/arrangement/expand.ts`.
- **The click's stream and tables**: `src/lib/rhythm/stream.ts`, `durations.ts`, `tempo.ts`, `tap.ts`, `beams.ts`.
- **Every existing rhythm test**: each file in `src/lib/rhythm/__tests__/` that exists on `main`, by name. New files
  there are allowed.
- **Reading**: `src/lib/reading/` (all of it), `src/components/reading/` (all of it).
- **Components**: `src/components/capture/`, `src/components/tab/`, `src/components/ui/`,
  `src/components/rhythm/__tests__/click-bar.test.tsx`, `src/components/rhythm/__tests__/tempo-control.test.tsx`.
- **Offline**: `public/sw.js`, `src/components/app/ServiceWorker.tsx`.
- **e2e**: `e2e/click-*.spec.ts`, `e2e/click-helpers.ts`, `e2e/wide-*.spec.ts`, `e2e/wide-helpers.ts`,
  `e2e/reading-*.spec.ts`, `e2e/capture-*.spec.ts`, `e2e/capture.spec.ts`, `e2e/notation-*.spec.ts`,
  `e2e/usability-*.spec.ts`, `e2e/polish-*.spec.ts` except `e2e/polish-part-card-menu.spec.ts`, `e2e/fixtures/`.

For `e2e/polish-part-card-menu.spec.ts`, the script checks that the only changed line is the one assigning `want`.

### Existing tests this changes on purpose

Each file is re-pinned, never deleted. Each is named in `docs/DECISIONS.md` under "011 — re-pinned tests".

| File | What it pins today | Re-pinned to |
|---|---|---|
| `e2e/polish-part-card-menu.spec.ts` | `const want = card.variantOf ? 2 : 3;`: a variant's menu has 2 items and a base part's 3 | `card.variantOf ? 3 : 4`. FR-001 adds **Play** to every card. The walk (ArrowDown to each item, Home, End, focus return) is unchanged and now covers one more item. |

**Must pass unedited**:
- **Click and engine.** Every file in `src/lib/rhythm/__tests__/` from `main`, `src/components/rhythm/__tests__/*`,
  `e2e/click-*.spec.ts` and `e2e/wide-click-*.spec.ts`.
- **Layout and reading.** `e2e/reading-*.spec.ts`, `e2e/wide-*.spec.ts` (including `wide-narrow-unchanged`, the held
  bar height), `e2e/usability-highlight*.spec.ts` and `e2e/usability-keys.spec.ts`.
- **Capture and cards.** Every capture spec, `e2e/polish-part-card.spec.ts`, `e2e/usability-floors.spec.ts` (it walks
  every menu item's floor, so Play must meet it) and `e2e/wide-controls.spec.ts`.
- **Unit.** Every unit test in `src/`, including `src/lib/keys/__tests__/shortcuts.test.ts` (ids and keys, not words).

If one of these fails, the product is wrong, not the test. The exception is the rule in *Blast-radius decisions*: add it
to the table first, with its reason.

## Project Structure

### Documentation (this feature)

```text
specs/011-tab-playback/
├── plan.md              # This file
├── research.md          # Phase 0: R1–R17
├── data-model.md        # Phase 1: run, timeline, stream items, choices, the playback song, words
├── quickstart.md        # Phase 1: validation guide
├── contracts/
│   ├── playback-stream.md   # timeline, length rule, technique table, stream; corpora L, T, S, E
│   ├── engine-and-port.md   # engine items, port `note`, synth rules, useClick
│   └── transport.md         # routes, menu, PlayView part mode, ClickBar controls and words, keys, recorder
├── checklists/          # from /speckit-specify
└── tasks.md             # Phase 2 (/speckit-tasks, not created here)
```

### Source Code (repository root)

```text
src/
├── app/songs/[songId]/play/[partId]/
│   └── page.tsx                     # NEW: <PlayView songId partId />
├── lib/
│   ├── playback/                    # NEW, React-free
│   │   ├── timeline.ts              # playTimeline, playRounds, lengthRule, HARMONIC_NODES
│   │   ├── stream.ts                # playStream, roundClicks, audibleFor
│   │   ├── voice.ts                 # waveFor, voicePlan, energyAbove, midiToHz (pure numbers)
│   │   ├── synth.ts                 # makeVoicing, playVoice (Web Audio; no tests in node)
│   │   ├── choices.ts               # notes (localStorage), click, loop, speed (memory)
│   │   └── __tests__/
│   │       ├── fixtures.ts          # part T and the playback song, from data-model §5's text
│   │       ├── fake-port.ts         # a ClickClock with note(), recording calls
│   │       ├── timeline.test.ts     # INV-002, INV-003, INV-006 (L1–L21, pitch corpus)
│   │       ├── techniques.test.ts   # INV-005 (T1–T19)
│   │       ├── stream.test.ts       # INV-004, INV-008 (S1–S6, the rhythm corpus)
│   │       ├── engine.test.ts       # INV-007, INV-008, INV-009 (E1–E10)
│   │       ├── voice.test.ts        # INV-018
│   │       ├── choices.test.ts      # INV-011, INV-012
│   │       └── no-dynamic-import.test.ts  # INV-016
│   ├── rhythm/
│   │   ├── scheduler.ts             # StreamItem union, dueMarks, "ended", audible, voices
│   │   ├── audio.ts                 # optional note(); voices graph behind a flag
│   │   ├── notation.ts              # export readGroups, hitTicks; readBar calls hitTicks
│   │   └── __tests__/
│   │       ├── engine-golden.test.ts    # NEW: INV-001 (records on main with RECORD_GOLDEN=1)
│   │       └── engine-golden.json       # NEW: recorded at T001
│   ├── arrangement/passes.ts        # + partPass
│   └── keys/shortcuts.ts            # Space's words
├── components/
│   ├── app/
│   │   ├── PlayView.tsx             # partId mode; passes once; playback prop to ClickBar
│   │   └── SongView.tsx             # Play item in the part menu
│   └── rhythm/
│       ├── ClickBar.tsx             # playback prop; cluster controls; words; focus on ended
│       ├── useClick.ts              # notes run, speed, dueMarks, "ended"
│       ├── TempoControl.tsx         # optional speed → speed mark
│       └── __tests__/click-bar.notes.test.tsx   # NEW: INV-023

scripts/
├── untouched-by-playback.sh         # NEW: INV-019
└── check-playback-amendments.sh     # NEW: INV-020

e2e/
├── play-helpers.ts                  # NEW: installPlayRecorder, seedPlaybackSong, partT, outlineLog
├── play-notes-off.spec.ts           # INV-001
├── play-part.spec.ts                # INV-002 (e2e), INV-015, INV-017, SC-006, print
├── play-agree.spec.ts               # INV-004
├── play-techniques.spec.ts          # INV-005
├── play-end.spec.ts                 # INV-008
├── play-stop.spec.ts                # INV-009
├── play-outline.spec.ts             # INV-010
├── play-nothing-written.spec.ts     # INV-003 (e2e), INV-011
├── play-speed.spec.ts               # INV-012
├── play-bar.spec.ts                 # INV-013
├── play-controls.spec.ts            # INV-014
├── play-double-tap.spec.ts          # INV-015
├── play-offline.spec.ts             # INV-016
├── play-mix.spec.ts                 # INV-018
├── play-keys.spec.ts                # INV-022
├── play-words.spec.ts               # INV-023
├── play-every-ending.spec.ts        # INV-024, no-audio edge
├── play-cycles.spec.ts              # INV-025
└── play-sync-midrun.spec.ts         # edge: edits and deletions mid-run

docs/DECISIONS.md                    # "011 — suite before", "011 — decisions", "011 — re-pinned tests", browser check
specs/005-rhythm-and-tempo/spec.md   # Out of Scope line amended in place
package.json                         # check:untouched-playback, check:playback-amendments
```

**Structure Decision**: single Next.js package, as before. The new domain code goes in one new React-free directory,
`src/lib/playback/`, beside `src/lib/rhythm/`, whose engine and port it extends rather than copies. The one new route
mirrors `capture/[partId]`.

## Complexity Tracking

No gate is violated. Nothing to justify.
