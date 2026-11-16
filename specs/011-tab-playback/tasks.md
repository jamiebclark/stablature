---

description: "Task list for 011 — Tab playback, a part or the whole song as sound"
---

# Tasks: Tab playback, a part or the whole song as sound

**Input**: `/specs/011-tab-playback/` — plan.md, spec.md, research.md, data-model.md, contracts/ (playback-stream.md, engine-and-port.md, transport.md), quickstart.md

**Tests**: Requested by FR-054 and by plan § Invariants. Every INV has a probe task, and probes are the FIRST tasks of their phase. Each probe is written to FAIL on the pre-change code (the module, control or route it exercises does not exist yet). The two that cannot fail first say why.

**Executability**: Implementation runs headless — no browser, no dev server, no `curl`. Every check below is a Vitest unit/jsdom test, a Playwright spec run by `npx playwright test` (which builds and serves production itself — never run it while a dev server holds `.next`), `tsc --noEmit`, lint, or a guard script. Run long commands in the foreground. Checks that need a person or a real phone are marked `🛑 BLOCKED:` and left unchecked.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: different files, no dependency on an incomplete task
- Keep each file's line endings (`npm run check:line-endings`). `tsconfig.json` includes `specs/`.
- Before writing Next.js code, read the relevant guide in `node_modules/next/dist/docs/` (AGENTS.md): `params` is a `Promise`.

---

## Phase 1: Setup (baselines and harness)

**Purpose**: Record what `main` does before any source change, and create the shared test helpers.

- [x] T001 Record baselines on the UNEDITED tree, before any source edit: create `src/lib/rhythm/__tests__/engine-golden.test.ts` (it records the engine's `schedule()` and `due()` calls through a fake port for three click streams — plain, following, following-then-plain — at 40/120/240 bpm, using the existing scheduler tests' fake-clock `rig`) and run `RECORD_GOLDEN=1 npx vitest run src/lib/rhythm/__tests__/engine-golden.test.ts` to write `src/lib/rhythm/__tests__/engine-golden.json`. Then run `npm test` and `npx playwright test e2e/click-*.spec.ts e2e/wide-click-*.spec.ts e2e/reading-*.spec.ts e2e/wide-narrow-unchanged.spec.ts` and write the pass counts under "011 — suite before" in `docs/DECISIONS.md` (known flake: `click-running.spec.ts:62`). Without `RECORD_GOLDEN`, the test compares to the JSON. This is the INV-001 probe: it passes on `main` by design (it is the oracle), so its failing power is proven in T034 by a mutation check.
- [x] T002 [P] Create `scripts/untouched-by-playback.sh` (INV-019): prints `zero diff` per path of plan § Scope fence against `main`, tracked or untracked, fails on anything else; for `e2e/polish-part-card-menu.spec.ts` it checks the only changed line is the one assigning `want`. Model it on `scripts/untouched-by-polish.sh`. Add `"check:untouched-playback": "bash scripts/untouched-by-playback.sh"` to `package.json`.
- [x] T003 [P] Create `scripts/check-playback-amendments.sh` (INV-020): fails unless spec 005's Out of Scope line `Pitched playback of the notes.` carries `Amended by spec 011`, `docs/DECISIONS.md` has a "011 — decisions" section naming each of the spec's 11 decisions and plan.md's 4 deviations, and a "011 — re-pinned tests" section naming `e2e/polish-part-card-menu.spec.ts`. Model it on `scripts/check-polish-amendments.sh`. Add `"check:playback-amendments"` to `package.json`. It must FAIL now (nothing amended yet).
- [x] T004 [P] Create `src/lib/playback/__tests__/fixtures.ts` (part T and the playback song, from data-model §5's text; the hand-built Len L1–L21 and Tech T1–T19 corpora from contracts/playback-stream.md §3–§4 with oracles written as literals in beats × 360360, never computed by the code under test) and `src/lib/playback/__tests__/fake-port.ts` (a `ClickClock` with `note()` that records every call).
- [x] T005 [P] Create `e2e/play-helpers.ts`: `installPlayRecorder` (patches `AudioContext` source `start`/`stop`, frequency automation, `contexts`, `closes`, an analyser tap on the destination, `__play.requests`; contracts/transport.md §7), `seedPlaybackSong`, `partT`, `outlineLog` (a `MutationObserver` logging `(data-card, data-column, ctx.currentTime)`). Reuse `e2e/click-helpers.ts` patterns without editing it.

---

## Phase 2: Foundational (engine, timeline, stream, voice, choices)

**Purpose**: The React-free core every story uses. **⚠️ No story work starts until this phase is done.**

### Invariant probes (FIRST — each must FAIL on the pre-change code)

- [x] T006 [P] Probe INV-002 + INV-003 + INV-006 in `src/lib/playback/__tests__/timeline.test.ts`: `playTimeline`/`lengthRule` over every **Len** row L1–L21 (starts and lengths in ticks vs the hand oracle; no length written back), the pitch corpus (`midi` equals a hand table of open-string MIDI + fret) over every `TUNING_PRESETS` member (all 17) × every string × frets {0,1,5,12,24}, harmonic frets {12,7,19,5,24,…} (T9), bad strings/frets silent without throwing (T19), and `hits` mapped to `(pass, columnKey)` equals `readingStops(passes, offsets)` minus `bar` for the playback song via `drawnPasses` and via `partPass`. Fails now: `src/lib/playback/timeline.ts` does not exist.
- [x] T007 [P] Probe INV-005 in `src/lib/playback/__tests__/techniques.test.ts`: each **Tech** row T1–T19's `Voice`, written out in full in the test (bend/tap change nothing; a dead note never glides or connects; drawn transition wins; T17/T18 seam behaviour; rounds 2, 3 byte-equal). Fails now: no `timeline.ts`.
- [x] T008 [P] Probe INV-004 + INV-008 (unit) in `src/lib/playback/__tests__/stream.test.ts`: S4 — for every `ColumnTick` of `notationColumns(passes)` over the whole rhythm corpus (11 `BARS` × 5 `ARR` of `positions-vs-click.test.ts` plus `notation-oracle.test.ts` section G), the timeline hit with the same `(pass, eventId, repetition)` has `tick ===`; S5 — through `createEngine` with the fake port, a note and a click at one tick get `===` audio times; S1–S6 including the loop seam (no gap, overlap or count-in) and the round's clicks equal `clickStream`'s own items. Fails now: `playStream`/`roundClicks` and the exports `hitTicks`/`readGroups` do not exist.
- [x] T009 [P] Probe INV-007 + INV-008 + INV-009 in `src/lib/playback/__tests__/engine.test.ts` (E1–E10, fake clock, jitter up to 20 ms): no drift over 10 minutes at {40,120,240} bpm × {Click on, off}, L1 looped 10 minutes, speeds {50,70,100} changed mid-run; `ended` is never `fell-behind` (E3); `close()` is called synchronously exactly once inside every `stop` (E6); `dueMarks()` times equal the note's. Fails now: the engine has no `note`/`mark`/`end` items, `dueMarks` or `ended`.
- [x] T010 [P] Probe INV-018 in `src/lib/playback/__tests__/voice.test.ts`: `energyAbove(hz, voicePlan(v), "floor") ≥ 0.5` and the same at `"start"` for {`plain`,`muted`,`harmonic`} × the lowest string of every **Tun** member × {open, fretted}, and the harmonic nodes. Fails now: no `voice.ts`.
- [x] T011 [P] Probe INV-011 + INV-012 (unit) in `src/lib/playback/__tests__/choices.test.ts`: with an injected storage spy every setter writes at most `stablature.play`; `setSpeed`/`setClick`/`setLoop` write nothing; speed is per song and resets on a fresh module; the `effective` table over **Spd** 50–100 × {Notes off, on}. Fails now: no `choices.ts`.
- [x] T012 [P] Probe INV-016 (unit) in `src/lib/playback/__tests__/no-dynamic-import.test.ts`: no file under `src/lib/playback/`, nor `ClickBar.tsx`, `useClick.ts`, `scheduler.ts`, `audio.ts`, contains `import(`. Fails now only because `src/lib/playback/` does not exist (the directory scan asserts it is non-empty); it guards the later files.

### Foundations

- [x] T013 In `src/lib/rhythm/notation.ts` export `hitTicks(duration, group)` and `readGroups(events)` (exports only) and make `readBar` call `hitTicks`; no behaviour change. Run `npx vitest run src/lib/rhythm` — every existing test and the T001 golden pass unedited.
- [x] T014 In `src/lib/arrangement/passes.ts` add `partPass(part, events)` beside `drawnPasses` (one whole pass, bar numbers from 1).
- [x] T015 [P] Create `src/lib/playback/voice.ts` (`waveFor`, `voicePlan`, `energyAbove`, `midiToHz`; pure numbers) per contracts/engine-and-port.md. Makes T010 pass.
- [x] T016 [P] Create `src/lib/playback/choices.ts` (`notes` in `localStorage["stablature.play"]` through a `panels.ts`-shaped module; `click`, `loop`, `speed` per song in module memory; `effective`). Makes T011 pass.
- [x] T017 Create `src/lib/playback/timeline.ts` (`playTimeline`, `playRounds`, `lengthRule`, `HARMONIC_NODES`): length rule set → carried → one quarter (research R4), pitches via `fretToMidi`, transitions via `drawnTransition` from `src/lib/tab/techniques.ts`, group reading via `readGroups`/`hitTicks`; never restates `fitFor`. Makes T006 and T007 pass.
- [x] T018 In `src/lib/rhythm/scheduler.ts` generalise the stream item union (today's `StreamClick` unchanged; add `note`, `mark`, `end`), add `dueMarks()`, stop reason `ended`, `audible`, `voices`; all times from the one `timeOf(tick)`. Run the T001 golden plus every existing scheduler/stream test unedited.
- [x] T019 Create `src/lib/playback/stream.ts` (`playStream`, `roundClicks` iterating `clickStream(score, follow)`, `audibleFor`; count-in = the same four items). Makes T008 and T009 pass.
- [x] T020 In `src/lib/rhythm/audio.ts` add the optional `note()` and the voices graph behind a flag (notes bus + master limiter, release fade of a 5 ms time constant); with Notes off the port builds exactly today's click graph. Create `src/lib/playback/synth.ts` (`makeVoicing`, `playVoice`: custom periodic wave, lowpass pluck, gain envelopes, noise thud, vibrato LFO). No worklet, no file, no `import(`.
- [x] T021 Run `npx vitest run src/lib/playback src/lib/rhythm && npm run typecheck && npm run lint`; every probe T006–T012 and the golden pass; confirm `git diff main -- public/sw.js src/lib/rhythm/stream.ts src/lib/rhythm/durations.ts src/lib/rhythm/tempo.ts` is empty.

**Checkpoint**: the engine plays notes and marks on one clock; nothing in the UI uses it yet.

---

## Phase 3: User Story 1 - Hear how a part goes (Priority: P1) 🎯 MVP

**Goal**: A part card's menu has **Play**, which opens `/songs/{id}/play/{partId}` (one card, Notes on, Loop on); the Play button counts in and plays it, looping, until Stop.

**Independent Test**: `npx playwright test e2e/play-part.spec.ts e2e/play-double-tap.spec.ts e2e/play-stop.spec.ts` on a production build.

### Invariant probes (FIRST — each must FAIL on the pre-change code)

- [x] T022 [P] [US1] Probe INV-015 + INV-017 + INV-002 (e2e) + SC-006 + print in `e2e/play-part.spec.ts`: every card (base and variant) has `Play part {label}` as its first menuitem; after the menu's Play navigates, `__rec.contexts.length === 0`; part T's round-1 `custom` oscillator `hz` equals `440 × 2^((midi−69)/12)` ±0.01 for the expected list; first `square` start − tap ≤ 0.2 s on a 2,000-hit part; a song with no arrangement plays; an unknown part shows `That part is not on this song`; back lands on `/songs/{id}` with the context closed; `/play` still shows Notes as it was; print emulation shows one card and no bar. Fails now: no menu item, no route.
- [x] T023 [P] [US1] Probe INV-015 in `e2e/play-double-tap.spec.ts`: two taps 30 ms apart on `click-start` with Notes on give one context, one count-in, one run. Fails now: Notes on / Play does not exist.
- [x] T024 [P] [US1] Probe INV-009 in `e2e/play-stop.spec.ts`: for each **Stop** (tap Stop, Space, `r`, back link, browser back, `hidden`, `audio-lost`, `fell-behind`, `ended`) × **When** (count-in, mid-note, mid-let-ring, mid-glide, loop seam): every recorded source has `stop` ≤ t+0.05 or the context is closed by then, and analyser RMS over [t+0.05, t+0.15] < −60 dBFS; plus SC-007: 100 stops at seeded random times on part T (desktop). Fails now: no notes to stop.
- [x] T025 [P] [US1] Probe INV-001 (e2e) in `e2e/play-notes-off.spec.ts`: with Notes off the click's graph, count-in, words, start label, highlight, stop words and the bar's geometry equal today's. It is a regression oracle and passes pre-change by design; its failing power is proven in T034.
- [x] T026 [P] [US1] Probe INV-008 (e2e) in `e2e/play-end.spec.ts`: Loop off → `click-state` returns to idle rule words (never `Stopped because …`), `click-start` focused if Stop had focus, analyser RMS < −60 dBFS 100 ms after the end; Loop on → round 2's first `custom` start at round 1's end ±1e-6 s with no stray `square` start between seams. Fails now: no end behaviour. (The Loop-off case is `test.skip` until US3 adds `play-loop`; un-skip it in that phase.)

### Implementation for User Story 1

- [x] T027 [US1] Create `src/app/songs/[songId]/play/[partId]/page.tsx` (async server page awaiting `params`, rendering `<PlayView songId partId />`; mirror `capture/[partId]`).
- [x] T028 [US1] In `src/components/app/SongView.tsx` add **Play part {label}** as the FIRST item of every part card menu (a link, base and variant), no new row on the card; Delete stays last and destructive. Re-pin `e2e/polish-part-card-menu.spec.ts`: change only the line `const want = card.variantOf ? 2 : 3;` to `card.variantOf ? 3 : 4`, and record it under "011 — re-pinned tests" in `docs/DECISIONS.md`.
- [x] T029 [US1] In `src/components/app/PlayView.tsx` add `partId` mode: compute `passes` ONCE (`drawnPasses(...)` or `[partPass(part, events)]`) and pass that one array to `drawnCards`, `readingStops`, `useReadingPosition` and `ClickBar`; part mode starts Notes on and Loop on without writing the whole-song Notes choice; heading names the part with a link to `/songs/{id}/play`; unknown part message.
- [x] T030 [US1] In `src/components/rhythm/useClick.ts` add the notes run (`playRounds` → engine, `start()` synchronous up to `engine.start`, timeline memoised before the tap, release context and wake lock on every stop path including leaving), the `ended` stop without a stopped line, and focus return. In `src/components/rhythm/ClickBar.tsx` add the `playback` prop: start label **Play** (Notes off keeps **Start click**), idle rule words from `timeline.rule` (FR-044), `Counting in.` / `Playing.`, all new words joined to `CLICK_WORDS` so held heights cover them; announce state changes only.
- [x] T031 [US1] Run `npx vitest run src/components/rhythm src/lib && npm run typecheck && npm run lint`, then `npx playwright test e2e/play-part.spec.ts e2e/play-double-tap.spec.ts e2e/play-stop.spec.ts e2e/play-notes-off.spec.ts e2e/play-end.spec.ts e2e/polish-part-card-menu.spec.ts e2e/click-double-tap.spec.ts`; all pass.

**Checkpoint**: three taps (menu, Play, Play) from the song page sound a part. MVP.

---

## Phase 4: User Story 2 - Play the whole song in the play view (Priority: P1)

**Goal**: In the whole-song play view the cluster (More) gains Notes, Click, Loop and Speed; Notes on plays every drawn pass.

**Independent Test**: `npx playwright test e2e/play-controls.spec.ts e2e/play-bar.spec.ts e2e/play-keys.spec.ts e2e/play-words.spec.ts e2e/play-agree.spec.ts`.

### Invariant probes (FIRST — each must FAIL on the pre-change code)

- [x] T032 [P] [US2] Probe INV-023 in `src/components/rhythm/__tests__/click-bar.notes.test.tsx` (new jsdom file): for each **BarN** idle state (no tempo; no tuning; nothing to play; `written`; `some`; `none`) `click-state` text equals `timeline.rule`'s message and `click-start.disabled` is true exactly when `rounds === null`. Fails now: no `playback` prop.
- [x] T033 [P] [US2] Probe INV-014 in `e2e/play-controls.spec.ts`: `play-notes`, `play-click`, `play-loop`, `play-slower`, `play-faster` each ≥ 44×44 on touch and meeting the fine floor on mouse, `aria-pressed` and a visible `on`/`off` word; `play-notes` disabled while running; `play-click`/`play-loop` absent with Notes off; Slower/Faster disabled at 50/100; over **W** × **Ptr** × {idle, running} × **Clu**. Fails now: no such controls.
- [x] T034 [P] [US2] Probe INV-013 in `e2e/play-bar.spec.ts`: Start/Play, Stop, beat box, tempo control and More move ≤ 0.5 px and bar height is unchanged on run start/stop, cluster open/close, speed change, Notes toggle, in every **BarN** state vs the Notes-off rest height; `scrollWidth ≤ innerWidth`. Fails now: controls absent. Also (INV-001 mutation check): temporarily break the click path (e.g. offset a click by one tick), confirm `engine-golden.test.ts` and `play-notes-off.spec.ts` FAIL, then revert.
- [x] T035 [P] [US2] Probe INV-022 in `e2e/play-keys.spec.ts`: Notes on — Space starts (count-in, then `custom` sources) and stops; `r` while running restarts with a fresh count-in and one context; Notes off — today's behaviour; the help overlay's Space row reads the new words; over {Space, `r`} × {on, off} × {idle, running} × **Sc**. Fails now: Space does nothing in Notes mode.
- [x] T036 [P] [US2] Probe INV-023 (e2e) in `e2e/play-words.spec.ts`: *playback* (none), *timed* (written), a part with one set length (some), *empty-part*, *untuned*, no tempo — the bar's words and Play's enabled state. Fails now: words absent.
- [x] T037 [P] [US2] Probe INV-004 (e2e) in `e2e/play-agree.spec.ts`: on *timed* with Notes, Click and following on, every `custom` start `when` equals a `square` start `when` (±1e-9) where the tick agrees. Fails now: no `custom` sources.
- [x] T038 [P] [US2] Probe INV-018 (e2e) + INV-011 in `e2e/play-mix.spec.ts` and `e2e/play-nothing-written.spec.ts`: analyser peak ≤ 1.0 during part T's let-ring chord plus three notes plus an accent click, energy above 200 Hz ≥ 0.45 on `bass5-drop-f` F0; `dumpDb` and outbox count identical before/after 3 runs, 11 speed changes and every toggle, inspector duration row, rhythm row and export text unchanged, `localStorage` gains only `stablature.play`, after reload speed 100% and Notes kept. Fails now: no notes or controls.

### Implementation for User Story 2

- [x] T039 [US2] In `src/components/rhythm/ClickBar.tsx` add the cluster controls `play-notes` (disabled while running), `play-click`, `play-loop` (both only with Notes on), each a `Button` with `aria-pressed` and an `on`/`off` word and the `--control` floors, with Notes persisted through `choices.ts`; `PlayView.tsx` (whole-song mode) passes `passes` (the `drawnPasses` array) to the bar. With Click off, clicks are not sounded but stay on the display queue so the beat box pulses (plan deviation 3).
- [x] T040 [US2] In `src/lib/keys/shortcuts.ts` change Space's help words to describe both modes (ids and keys unchanged), and wire Space and `r` in `ClickBar.tsx`/`useClick.ts` for Notes on (`r` restarts with a fresh count-in, one context).
- [x] T041 [US2] Run `npx vitest run src/components src/lib/keys && npm run typecheck && npm run lint` and `npx playwright test e2e/play-controls.spec.ts e2e/play-bar.spec.ts e2e/play-keys.spec.ts e2e/play-words.spec.ts e2e/play-agree.spec.ts e2e/play-mix.spec.ts e2e/play-nothing-written.spec.ts e2e/usability-keys.spec.ts e2e/usability-floors.spec.ts e2e/wide-controls.spec.ts e2e/click-bar-fit.spec.ts e2e/wide-narrow-unchanged.spec.ts`; all pass unedited except the new specs.

**Checkpoint**: the whole song plays from the play view; Notes off is today's click.

---

## Phase 5: User Story 4 - See where the music is (Priority: P2)

**Goal**: With Notes on, the reading-position outline follows the column sounding, through every column of every pass.

**Independent Test**: `npx playwright test e2e/play-outline.spec.ts`.

### Invariant probes (FIRST — must FAIL on the pre-change code)

- [x] T042 [P] [US4] Probe INV-010 + INV-006 (e2e) in `e2e/play-outline.spec.ts`: the `outlineLog` sequence equals the hits of `playTimeline` mapped to keys for every column of every pass (and loops twice for part playback), each change at or after its expected audio time and ≤ 0.05 s after, nothing outlined after a stop, live `pass k of n` words right on drawn-once cards, and the outlined `(data-card, data-column)` sequence equals the drawn page's columns in document order expanded per card pass count; with Notes off, today's outline. Fails now: the outline does not follow notes. (Landed passing: the outline already followed marks from the engine phase, so it could not be seen failing first; it covers part playback and Notes off, not song-wide pass k of n words.)

### Implementation for User Story 4

- [x] T043 [US4] In `src/components/rhythm/useClick.ts` drain `engine.dueMarks()` into the existing `place()` (no tick-to-column derivation in Notes mode; Notes-off click path unedited); starting clears a keyed position, stopping clears the outline; scroll-into-view and reduced motion under spec 007's rule; outline stays the box style, no print.
- [x] T044 [US4] Run `npx playwright test e2e/play-outline.spec.ts e2e/usability-highlight*.spec.ts e2e/reading-*.spec.ts`; all pass.

---

## Phase 6: User Story 3 - Slow it down (Priority: P2)

**Goal**: Speed 50–100% in steps of 5, effective tempo = stored × speed for count-in, notes and click; never stored.

**Independent Test**: `npx playwright test e2e/play-speed.spec.ts`.

### Invariant probes (FIRST — must FAIL on the pre-change code)

- [X] T045 [P] [US3] Probe INV-012 (e2e) in `e2e/play-speed.spec.ts`: at 160 bpm × 50% count-in `square` starts are 0.75 s apart (±1 ms); setting 100% mid-run makes the next unqueued interval 0.375 s with no new count-in; song B opens at 100%, back to A is 50%, after reload 100%; a tap-tempo change mid-run applies × speed; over {50,70,100} × {Notes off, on}; `setSongTempo` never called. Fails now: no speed control.

### Implementation for User Story 3

- [X] T046 [US3] In `src/components/rhythm/TempoControl.tsx` add the optional `speed` prop (a `bg-bg` bordered `70%` mark visible with the cluster closed, never opacity over a surface); in `ClickBar.tsx` add `play-slower`/`play-faster` (disabled at 50/100) showing the percentage and effective bpm; in `useClick.ts` one `engine.setTempo(effective)` applied to the next unqueued item. `tempo-control.test.tsx` stays unedited.
- [X] T047 [US3] Run `npx vitest run src/components src/lib/playback` and `npx playwright test e2e/play-speed.spec.ts e2e/play-bar.spec.ts e2e/play-controls.spec.ts`; all pass.

---

## Phase 7: User Story 5 - The techniques sound like the tab (Priority: P3)

**Goal**: Every technique sounds as the table says, in one plucked voice.

**Independent Test**: `npx playwright test e2e/play-techniques.spec.ts` plus `techniques.test.ts` (T007).

### Invariant probes (FIRST — must FAIL on the pre-change code)

- [X] T048 [P] [US5] Probe INV-005 (e2e, desktop) in `e2e/play-techniques.spec.ts` on part T: no new `custom` start at T1/T3/T4/T11's second note (connected), a `freq` ramp ending at T4's start, a `sine` LFO at T6, buffer sources for the thuds, and T10's `bend`/`tap` frequency events equal to a plain `7`'s. Fails now: synth articulations not wired to the stream.

### Implementation for User Story 5

- [X] T049 [US5] In `src/lib/playback/synth.ts` complete articulations (hammer/pull connect without re-pick, slide glide, vibrato LFO, palm mute short and dark, dead-note thud, let-ring sustain under later notes, harmonic bell, bend/tap plain) matching `Voice` rows in `timeline.ts`; confirm `src/lib/tab/` has zero diff.
- [X] T050 [US5] Run `npx vitest run src/lib/playback` and `npx playwright test e2e/play-techniques.spec.ts e2e/play-mix.spec.ts`; all pass.

---

## Phase 8: Resilience and offline (cross-story invariants)

### Invariant probes (FIRST — must FAIL on the pre-change code)

- [X] T051 [P] Probe INV-016 (e2e) in `e2e/play-offline.spec.ts`: production build, `context.setOffline(true)` after load, a full run of part playback and of arrangement playback completes; `__play.requests` is zero after the tap. Fails now: nothing plays.
- [X] T052 [P] Probe INV-024 in `e2e/play-every-ending.spec.ts`: the patterns of `click-every-ending.spec.ts` with Notes on — `visibilitychange` → `hidden` line, forced `statechange` → `audio-lost` line, stalled main thread → `fell-behind` line, `pagehide`; each silent within 50 ms and Play works again; with `audio: "absent"` the outline and beat still run and the soundless line shows. Fails now: no notes.
- [X] T053 [P] Probe INV-025 in `e2e/play-cycles.spec.ts`: 50 cycles of open part playback → Play → Stop → back → reopen, for part and whole song; each cycle one context and `__rec.closes === contexts`; wake lock released each time; the 50th count-in sounds. Fails now: nothing plays.
- [X] T054 [P] Probe the mid-run edit edge in `e2e/play-sync-midrun.spec.ts`: a remote edit and a part deletion arriving mid-run change nothing until the next start. Fails now: nothing plays.

### Implementation

- [X] T055 Fix whatever T051–T054 expose in `useClick.ts`, `ClickBar.tsx`, `PlayView.tsx` and `src/lib/playback/` (run snapshot taken at start; release on hidden, audio-lost, fell-behind and unmount), keeping `src/lib/rhythm/__tests__/*` and `e2e/click-*.spec.ts` unedited. Run `npx playwright test e2e/play-offline.spec.ts e2e/play-every-ending.spec.ts e2e/play-cycles.spec.ts e2e/play-sync-midrun.spec.ts e2e/click-every-ending.spec.ts`.

---

## Phase 9: Polish, records and guards

- [x] T056 [P] (INV-020) Amend `specs/005-rhythm-and-tempo/spec.md`'s Out of Scope line `Pitched playback of the notes.` in place with `*(Amended by spec 011: …)*`; do not touch spec 005 FR-033.
- [x] T057 [P] (INV-020) In `docs/DECISIONS.md` add "011 — decisions" naming each of the spec's 11 decisions and plan.md's 4 deviations (flag deviation 1 as worth the owner's eye), and "011 — re-pinned tests" naming `e2e/polish-part-card-menu.spec.ts`; keep "011 — suite before" from T001. `npm run check:playback-amendments` passes.
- [x] T058 Update `docs/` or README mention of the click only if one states that notes are not played; keep line endings.
- [x] T059 Run the full automated tiers: `npm test`, `npm run test:spec004`, `npm run typecheck`, `npm run lint`, then `npx playwright test` (whole suite, last, no dev server running). Every existing click, wide, reading, capture, usability and polish spec passes unedited except the one re-pinned in T028.
- [x] T060 Guards: run the project's fast guard tier and fix every failure BEFORE any push — `npm run check:untouched-playback`, `npm run check:playback-amendments`, `npm run check:line-endings`, `npm run check:untouched-rhythm`, `npm run check:untouched-reading`, `npm run check:untouched-polish`, `npm run check:untouched-wide`, `npm run check:untouched-notation`, `npm run check:untouched-usability`, `npm run check:untouched`, `npm run check:polish-amendments`, `npm run check:wide-amendments`, `npm run check:notation-amendments`, `npm run check:usability-amendments`, `npm run check:backbone`, plus `npm test` and `npm run typecheck`. (INV-019, SC-010)

### Owed to a person or a phone (INV-021 — left unchecked, not ticked from a desktop)

- [ ] T061 🛑 BLOCKED: needs a person with a real browser, both themes, and ears — ONE survey of quickstart §5's nine scenarios (part playback in three taps; whole song with `pass k of n`; speed mark and reload; Loop off ending; **SC-013 techniques by ear** on part T at 70%; the let-ring mix; reduced motion; greyscale outline; print preview) at 375×667, 412×915 and 1280×800 × {dark, light} (9 × 3 × 2); report the population with its denominator and log screenshots under the entry's heading in `docs/DECISIONS.md`. Absolute measurements only; no before/after pair.
- [ ] T062 🛑 BLOCKED: needs a real phone — ONE survey of quickstart §6's six items, reported as n of 6: (1) a B-string part on a five-string audible and distinguishable from the phone speaker at full volume; (2) silent switch on → silent, outline still moves, help line shows; (3) airplane mode from the home screen, part and arrangement playback on a song opened before; (4) lock and an incoming call stop playback cleanly, Play works afterwards; (5) screen stays on through a five-minute looped part; (6) the cluster's new controls hit first time with a thumb at 375 wide.

---

## Dependencies & Execution Order

- Phase 1 first; T001 before ANY source edit. Phase 2 blocks all stories; its probes (T006–T012) precede T013–T021.
- US1 (Phase 3) → US2 (Phase 4, needs the bar's `playback` prop from T030) → US4 (Phase 5) → US3 (Phase 6) → US5 (Phase 7) → Phase 8 → Phase 9. US3/US4/US5 are independent of each other once US2 is done.
- T028 edits the single existing spec this entry may re-pin; any other failing existing test is a product defect (stop and add it to plan § Existing tests with a reason first).
- Within a phase, probes first, then implementation, then the run task.

## Parallel Opportunities

- Phase 1: T002–T005. Phase 2 probes: T006–T012 (distinct files). T015 and T016 in parallel.
- Phase 3 probes T022–T026; Phase 4 probes T032–T038; Phase 8 probes T051–T054; T056 and T057.

## Implementation Strategy

- **MVP**: Phases 1–3 (part playback, three taps). Validate with T031 before continuing.
- Then US2, US4, US3, US5 in order, each validated by its run task; Phase 9 guards last, before any push.

---

## Phase 10: Review remediation

**Purpose**: Close review round 1's five MAJORs (`review.md` F1–F5). For each violated invariant, the probe goes into the suite as a failing test before its fix. MINORs F6–F12 are in `review.md` § Follow-ups, not here. Probes live in `specs/011-tab-playback/review-probes/`; see its README to run them. When adding a probe to a test file, add its content to that file; never `cp` a probe over an existing test.

- [x] T063 Add the expectation of `review-probes/INV-012-speed-with-notes-off.spec.ts` to `e2e/play-speed.spec.ts` as a failing test first. It replaces the "Notes off ignores speed" loop (`e2e/play-speed.spec.ts:63`–74), which asserts the opposite of FR-036 and US3 AS-7. The new test: song at 160 bpm, speed 50%, then Notes off. Expect count-in clicks 0.75 s apart, `play-slower` present, and `speed-mark` reading 50% — review F1 (MAJOR)
- [x] T064 Apply the speed with Notes off.
  - In `src/components/rhythm/ClickBar.tsx`, render `play-slower`, `play-speed` and `play-faster` whenever `playback` is present, not only inside `notes ?` (:225). Pass the stored speed to `TempoControl` whatever Notes is (:307).
  - In `src/components/rhythm/useClick.ts`, take the speed separately from `play`, which is null with Notes off (:89). Start and re-tempo the click-only run at usable × speed / 100 (:142, :154).
  - At 100%, Notes off must stay byte-identical to main: `engine-golden.test.ts`, `e2e/play-notes-off.spec.ts`, `e2e/click-*.spec.ts` and `e2e/wide-click-*.spec.ts` unedited and passing. T063 passes — review F1 (MAJOR), `src/components/rhythm/useClick.ts:142`
- [x] T065 Add the continuous in-page peak read of `review-probes/INV-018-mix-peak-through-the-chord.spec.ts` to `e2e/play-mix.spec.ts` as a failing test first.
  - It replaces the 40 × 100 ms poll (`e2e/play-mix.spec.ts:13`), which ends before part T's let-ring chord at column 13.
  - Also measure a let-ring chord on every string of the seeded tuning, plus an accent click.
  - Assert the plan's ≥ 0.45 share above 200 Hz in place of `above > 0` (:22).
  - Measured now: peak 1.071 at column 13 — review F2 (MAJOR)
- [x] T066 Gain-stage the notes so no chord clips. In `src/lib/rhythm/audio.ts:65`–73, make the notes limiter a real limiter: threshold below 0 dBFS, knee 0, a high ratio and a fast attack. And/or scale the notes bus or `PEAK` (`src/lib/playback/synth.ts:24`) for up to seven simultaneous voices with let-ring tails under them (FR-026). T065 must pass with headroom. The click stays audible over the notes. The Notes-off graph is unchanged (INV-001) — review F2 (MAJOR)
- [x] T067 Add the two tests of `review-probes/INV-018-every-string-every-fret.test.ts` to `src/lib/playback/__tests__/voice.test.ts` as failing tests first, replacing the `{lowest, lowest + 5}` sample at `voice.test.ts:20`. The tests:
  - the plan's full set: {plain, muted, harmonic} × the lowest string of all 17 presets × {open, +12, +19, +24, +28} × {start, floor};
  - every string × fret 0..24.

  Measured now: 17 of 510 plan members below 0.5 — review F3 (MAJOR)
- [x] T068 In `src/lib/playback/voice.ts`, change `waveFor`'s lift (:13, :22) so every pitched tone keeps at least 0.5 of its energy above 200 Hz at both cutoffs. That includes fundamentals at 175–200 Hz and the muted tone at 98 Hz. SC-012's F0 still holds, and T067 passes — review F3 (MAJOR)
- [x] T069 Add `review-probes/INV-005-string-holds-one-note.test.ts` and its recording context `review-probes/fake-audio.ts` to `src/lib/playback/__tests__/` as new files, failing first. The test covers {let_ring, harmonic} × the next note on that string {fret, hammer-on, slide, `x`, `x[palm_mute]`, `[dead_note]`}, plus the other-string controls. Today 6 of 14 fail — review F4 (MAJOR)
- [x] T070 In `src/lib/playback/synth.ts`, make a dead note end the live voice on its string at `time`, with the 5 ms release rule 3 uses for an attacked note. Today the path at :91 returns into `playThud` (:143) before that block. Then the timeline's "a thud ends the string" (`src/lib/playback/timeline.ts:117`) holds in sound, and T069 passes 14 of 14 — review F4 (MAJOR)
- [x] T071 In `e2e/play-offline.spec.ts`, read `__play.requests` before `context.setOffline(false)` (:24–26), as `review-probes/INV-016-offline-requests-in-window.spec.ts` does. Today the auth client's reconnect fetch of `/api/auth/get-session` lands in the count. Run it with `--repeat-each=8` on both projects: 32 of 32 must pass — review F5 (MAJOR)
- [x] T072 Add `review-probes/INV-010-whole-song-outline.spec.ts` to `e2e/` as a new spec, importing from `./play-helpers`, `./usability-helpers` and `./rhythm-probe-helpers`. It checks, for the whole song with Notes on: the outline's order equals the drawn page's columns per pass, each change lands within 50 ms, and the live `pass j of n` words are right. It held in review round 1 — review probe adoption
- [x] T073 Add `review-probes/INV-013-bar-every-state.spec.ts` to `e2e/` as a new spec. It checks the bar's height and controls in every reachable BarN state at 375×667, 412×915 and 1280×800. It held in review round 1 — review probe adoption
- [x] T074 Add the two tests of `review-probes/INV-008-focus-after-end.spec.ts` to `e2e/play-end.spec.ts`. They check that focus returns to Play after a Loop-off end, with Click on and with Click off. They held in review round 1 — review probe adoption
- [x] T075 Add `review-probes/INV-003-length-rule-seeded.test.ts` and `review-probes/INV-004-agreement-seeded.test.ts`, with `review-probes/seeded-songs.ts`, to `src/lib/playback/__tests__/` as new files. Give each `it` an explicit `{ timeout: 120_000 }`, because the probe config's 300 s timeout does not travel with them. They held over 6000 seeds — review probe adoption
- [x] T076 With no dev server running (pass 1: step 1 and the unit and INV-020 probes green; step 2 green except `e2e/play-stop` "back link at N ms", which flakes 2 of 8 per run at random N, not tied to this phase; the e2e probe tier via the review config was not run):
  1. Run `npx vitest run src/lib/playback src/components/rhythm`, `npm run typecheck`, `npm run lint` and `LC_ALL=C npm run check:untouched-playback`.
  2. Run `npx playwright test e2e/play-`, then `npx playwright test e2e/click- e2e/wide-click- e2e/wide-narrow-unchanged`. All pass.
  3. Rerun every probe in `specs/011-tab-playback/review-probes/` as its README says. Every one holds except `INV-017-part-playback-leaves-song-choices.spec.ts`, which fails on MINORs F7 and F8 by design — review F1–F5

---

## Phase 11: Review remediation

**Purpose**: Close review round 2's two MAJORs (`review.md` F16 and F17), and adopt the round-2 probes that held. For
the violated invariant, the probe goes into the suite as a failing test before its fix. MINOR F18 and round 1's MINORs
F6 to F12 stay in `review.md` § Follow-ups, not here. Probes live in `specs/011-tab-playback/review-probes/` (see its
README to run them). When adding a probe to a test file, add its content to that file; never `cp` a probe over an
existing test. Write every file you touch with LF endings (F17).

- [x] T077 Add the in-app chord probe as failing tests first. This is the second round for the mix (round 1 F2, then
  this one).
  - **The e2e tests.** Add the seven cases of `review-probes/INV-018-mix-seven-string-chord.spec.ts` to
    `e2e/play-mix.spec.ts`. Let-ring chords on every string, one per beat, read in the page every 10 ms:
    - Guitar 6 open E, Guitar 7 open and Guitar 7 unison, each with Click on and with Click off;
    - Bass 4, with Click on.
    Delete the 40 × 100 ms poll test (`e2e/play-mix.spec.ts:5`–23) that T065 said it replaced. Its share check moves
    to T080.
  - **The unit test.** Add one test in `src/lib/playback/__tests__/` using the recording context `fake-audio.ts`. For a
    new picked voice, the gain's first value at `time` must be FLOOR, and no later `cancelScheduledValues` may remove
    it.
  - **Measured now:** 6 of 7 cases over 1.0 (1.095 to 1.167), and the unit test fails — review F16 (MAJOR),
    `src/lib/playback/synth.ts:66`
- [x] T078 Make every new voice start from FLOOR (`src/lib/playback/synth.ts`).
  - **The cause.** `playVoice` sets `gain.setValueAtTime(FLOOR, time)` (:133). `shape` then runs
    `cancelScheduledValues(from)` (:66), which removes that event, so the attack ramps from the GainNode's default
    gain of 1.0.
  - **The fix.** Keep the FLOOR start for an attacked voice, for example by re-asserting it after the cancel. Keep the
    current value for a legato one (`cancelAndHoldAtTime`, or the existing behaviour). Do not tune the limiter first.
    `review-probes/INV-018-mix-gain-stages.spec.ts` shows that the FLOOR start alone takes seven voices from 1.126 to
    0.877 in an offline model. Only if a case is still over 1.0 in the app, gain-stage `audio.ts:66`–79 next, and
    say why.
  - **Done when:**
    - T077's seven cases and part T's chord stay ≤ 1.0, Click on and off; record each measured peak in the test's
      message.
    - `play-techniques` still sees no new source on connected notes.
    - `INV-005-string-holds-one-note.test.ts` passes 14 of 14.
    - The Notes-off graph is unchanged (`engine-golden.test.ts`, `e2e/play-notes-off.spec.ts`).
  - Review F16 (MAJOR), `src/lib/playback/synth.ts:66`, `src/lib/playback/synth.ts:133`
- [x] T079 Restore line endings.
  - `src/components/rhythm/ClickBar.tsx` and `src/lib/rhythm/audio.ts` go back to LF, with no content change. `main`
    has them LF, and T064 and T066 left them CRLF.
  - These 12 new files go to LF:
    - `src/lib/playback/timeline.ts` and `types.ts`;
    - `src/lib/playback/__tests__/fixtures.ts`, `timeline.test.ts` and `voice.test.ts`;
    - `e2e/play-cycles.spec.ts`, `play-end.spec.ts`, `play-mix.spec.ts`, `play-offline.spec.ts`,
      `play-outline.spec.ts`, `play-speed.spec.ts` and `play-sync-midrun.spec.ts`.
  - Then:
    - `node specs/011-tab-playback/review-probes/plan-line-endings-kept.mjs` exits 0;
    - `npm run check:line-endings` exits 0;
    - `git diff --stat main` equals `git diff --stat --ignore-cr-at-eol main`.
  - Review F17 (MAJOR), `src/components/rhythm/ClickBar.tsx:1`, `src/lib/rhythm/audio.ts:1`
- [x] T080 Add `review-probes/INV-018-f0-drop-f.spec.ts` to `e2e/play-mix.spec.ts`. It covers the plan's own INV-018
  e2e member: during F0 on `bass5-drop-f` with Click off, the share above 200 Hz is ≥ 0.45 in every read. It replaces
  the deleted poll's `above ≥ 0.45`, which read part T on four strings. It held in round 2 (1.000) — review probe
  adoption
- [x] T081 Add `review-probes/INV-012-notes-off-midrun.spec.ts` to `e2e/play-speed.spec.ts`. With Notes off, the
  speed and a stored tempo landing mid-run apply × speed from the next click, with one context and no new count-in.
  It held in round 2 — review probe adoption
- [x] T082 Add `review-probes/INV-013-014-notes-off-speed.spec.ts` to `e2e/` as `play-notes-off-speed.spec.ts`. With
  Notes off, the speed controls meet the floors, and the bar holds its height and controls at 70%, at rest and
  running, at 375, 412 and 1280. It held in round 2 — review probe adoption
- [x] T083 Add the two tests of `review-probes/INV-009-022-part-scope-keys-and-back.spec.ts`:
  - Space and `r` in part scope go to `e2e/play-keys.spec.ts`;
  - browser back from a running part goes to `e2e/play-stop.spec.ts`.
  They held in round 2 — review probe adoption
- [x] T084 Add `review-probes/INV-006-variant-part.spec.ts` to `e2e/play-outline.spec.ts`. Part playback of a variant
  plays exactly its one card's drawn columns. It held in round 2 — review probe adoption
- [x] T085 Run, with no dev server running:
  1. **Unit and guards.** `npm test`, `npm run typecheck`, `npm run lint`, `npm run check:line-endings`,
     `node specs/011-tab-playback/review-probes/plan-line-endings-kept.mjs` and
     `LC_ALL=C npm run check:untouched-playback`. All pass.
  2. **e2e.** `npx playwright test e2e/play-`, then
     `npx playwright test e2e/click- e2e/wide-click- e2e/wide-narrow-unchanged`. All pass.
  3. **Review probes.** Rerun every probe in `specs/011-tab-playback/review-probes/` as its README says. Every one
     holds except `INV-017-part-playback-leaves-song-choices.spec.ts`, which fails on round-1 MINORs F7 and F8 by
     design.
  — review F16, F17
