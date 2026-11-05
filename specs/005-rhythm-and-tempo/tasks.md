---

description: "Task list for Durations, tap tempo and a click"
---

# Tasks: Durations, tap tempo and a click

**Input**: Design documents from `/specs/005-rhythm-and-tempo/` (plan.md, spec.md, research.md, data-model.md, quickstart.md, contracts/notation.md, click.md, writes.md, components.md)

**Tests**: The spec does not ask for TDD, but plan.md § Invariants makes a probe task mandatory for each invariant. Probes are the FIRST tasks of their phase, live in the project's suites (`src/lib/rhythm/__tests__/`, `src/components/**/__tests__/`, `e2e/`), and **must FAIL on the pre-change code** (a probe whose interface does not yet exist fails by import error or missing test id, which counts). New unit tests go in `src/lib/rhythm/__tests__/`, never `src/lib/tab/__tests__/` (research R16).

**No browser in implement**: every e2e task below is a Playwright spec run with `npm run test:e2e -- <file>` (production build, projects `mobile` and `desktop`). Nobody starts a dev server or uses `curl`. Never run the build or e2e suite while a dev server holds `.next`. Sync scenarios need Postgres and skip without it; a skip is not a pass.

**Line endings**: `TabStaff.tsx` and `SongView.tsx` are CRLF. `PlayView.tsx`, `CaptureScreen.tsx`, `ColumnInspector.tsx`, `properties.ts`, `layout.ts`, `editing.ts` are LF. Keep each file's endings.

**Phase order note**: `ClickBar` (US1) renders `TempoControl` (US2), so Phase 3 is US2 and Phase 4 is US1. Both are P1.

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup

- [x] T001 [P] Create `scripts/untouched-by-rhythm.sh` (model on `scripts/untouched-by-import.sh`): `git diff main --stat -- <paths>` prints nothing for every path in INV-043 (`src/lib/tab/ascii.ts`, `parse.ts`, `reading.ts`, `src/lib/export/text.ts`, `src/lib/sync/`, `src/lib/server/`, `src/app/api/`, `src/db/`, `drizzle/`, `src/lib/model.ts`, `src/lib/local/db.ts`, `clipboard.ts`, `importing.ts`, `src/components/ui/index.tsx`, `public/sw.js`, `src/lib/tab/__tests__/ascii.test.ts`, `src/lib/export/__tests__/text.test.ts`, `src/lib/tab/__tests__/round-trip.test.ts`) and exits non-zero otherwise. Add `"check:untouched-rhythm": "bash scripts/untouched-by-rhythm.sh"` to `package.json`.

---

## Phase 2: Foundational (blocking)

**Purpose**: the shared tables and readings every story calls. No story starts until done.

### Invariant probes (FIRST — each must FAIL on the pre-change code)

- [x] T002 [P] Probe INV-005 and INV-043 (wire half) in `src/lib/rhythm/__tests__/durations.test.ts`: `readDuration` over D = `w h q 8 16 32` returns the table entry and over U = `"64"`, `""`, `"Q"`, `7`, `true`, `undefined`, `null` returns null; `nextDuration` toggle rules; each of D passes and each of U fails `eventRowSchema` (read-only import from `src/lib/sync/protocol.ts`). Fails before: `durations.ts` does not exist.
- [x] T003 [P] Probe INV-018 and INV-042 in `src/lib/rhythm/__tests__/tempo.test.ts`: `usableTempo` over T = `null 0 -1 1 19 20 120 400 401 999 1000 120.5 NaN "120"` exactly per data-model.md; pinned against `songRowSchema` at 0, 1, 999, 1000, 120.5; every integer 20 to 400 passes `songRowSchema`. Fails before: `tempo.ts` does not exist.
- [x] T004 [P] Probe INV-032 in `src/lib/arrangement/__tests__/passes.test.ts`: `drawnPasses(steps, eventsByPart)` gives, for a repeat, a variant on the last pass, a bar range on a part, a bar range on a variant, a section ×2 holding those, a deleted part, a text entry and an unterminated section, exactly what `PlayView` draws today via `eventsInBars` (capture the expected arrays from the current `PlayView.tsx` logic first); plus a source assertion that `src/components/app/PlayView.tsx` does not import `eventsInBars`. Fails before: `passes.ts` missing and `PlayView` still imports it.
- [x] T005 [P] Probe INV-001/INV-002/INV-012 in `src/lib/rhythm/__tests__/fixtures-gain-durations.test.ts`: over H (every recorded `layoutPart` fixture × expanded, compact, recorded as `src/lib/tab/__tests__/harvest.test.ts` does) × each of D on every column, and D cycled across columns: `toAscii` and `songToText` byte-identical to the same fixture without durations; `width`, `barNumber`, `cells`, `connectors`, `repeat` deep-equal column by column; `countBars` and `expandedLength` equal; `description` carries `, <words>` when set (after `repeated N times`, and after `Empty column`) and equals today's string when null. Fails before: `TabColumn.duration` does not exist.

### Implementation

- [x] T006 Create `src/lib/rhythm/durations.ts` per data-model.md: `DURATIONS` (id, mark, words, ticks 1,441,440 / 720,720 / 360,360 / 180,180 / 90,090 / 45,045), `readDuration(unknown)`, `nextDuration(stored, tapped)`, `TICKS_PER_BEAT = 360360`. Makes T002 pass.
- [x] T007 [P] Create `src/lib/rhythm/tempo.ts`: `TAP_TEMPO_MIN/MAX` 20/400, `STORED_TEMPO_MIN/MAX` 1/999, `usableTempo(unknown): number | null`. Makes T003 pass.
- [x] T008 [P] Create `src/lib/arrangement/passes.ts`: lift `drawnPasses` (and the `DrawnPass` type) out of `src/components/app/PlayView.tsx`, same `eventsInBars` logic.
- [x] T009 Modify `src/components/app/PlayView.tsx` (LF): `const passes = useMemo(() => drawnPasses(steps, eventsByPart ?? {}), [steps, eventsByPart])` above the early returns, map the list over `passes`, drop the `eventsInBars` import. No behaviour change. Makes T004 pass. (Depends on T008.)
- [x] T010 Modify `src/lib/tab/layout.ts` (LF): add `duration` to `TabColumn` via `readDuration(event.durationHint)`; `describeColumn` takes a last parameter, the duration's words, appended as `, ${words}`; nothing in layout reads a duration for position, width or barlines. Makes T005 pass. (Depends on T006.)
- [x] T011 [P] Create `src/lib/rhythm/notation.ts` with only the exported types (`Score`, `ScoreClick`, `ClickLevel` = `accent|beat|soft`, `StreamClick`) and `EMPTY_SCORE` (`timedFromStart: false`, `lengthTicks: 0`, no clicks), per contracts/notation.md; `readNotation` returns `EMPTY_SCORE` until Phase 6 implements it.

**Checkpoint**: `npm run typecheck` and `npx vitest run src/lib/rhythm src/lib/arrangement src/lib/tab` green.

---

## Phase 3: User Story 2 - What tempo was that? (Priority: P1)

**Goal**: tap tempo from one shared sheet on the capture screen (and, via the bar variant, the play view), setting the song's tempo with one write. Also lands the duration property in the inspector, which shares the same write file.

**Independent Test**: on the capture screen with a latch armed and the cursor mid-part, open the tempo sheet, tap steadily, set, close: tempo changed everywhere, cursor and latch untouched; closing without set writes nothing.

### Invariant probes for User Story 2 (FIRST — each must FAIL on the pre-change code)

- [x] T012 [P] [US2] Probe INV-013 in `src/lib/rhythm/__tests__/tap.test.ts`: the tap reducer, exact readings from tap times: no reading at 1 and 2 taps; reading at 3; 500 ms gives 120; 9 and 20 taps use the last 8 intervals; gap 3,000 stays and 3,001 restarts; interval exactly half and double stays, either side restarts; 150 ms gives 400 and is settable; 149 ms out of range; 3,000 ms gives 20; two taps 3,500 ms apart say `tooSlow` (plan Deviation 1); equal timestamps; ±15 ms seeded jitter over 8 taps within 2 bpm of 120. Fails before: `tap.ts` missing.
- [x] T013 [P] [US2] Probe INV-003/INV-004/INV-015 in `src/lib/local/__tests__/rhythm-writes.test.ts` (jsdom docblock, `fake-indexeddb`): `setColumnDuration` writes only `durationHint` and moves only that field's clock; null after `insertNote`, `insertRest`, `insertBarline`, `appendNote`, `appendBarline`, `importTab` with a duration on the neighbouring column; kept after copy-paste, cut-paste and `createVariant` × D; pasted text with a rhythm line stays commentary; unchanged by `bumpColumnRepeat` both ways, `stackNote`, `unstackNote`, `toggleDecoration`, `setChord`, `groupSelection` both kinds, `ungroupTuplet`, `groupRunEndingAt`; two replicas through `mergeRow` in both orders keep duration alongside repeat, frets, techniques and `tupletCount`; `setSongTempo` returns true with one outbox row for a new value, false with none for the stored value, true on a song with no tempo. Fails before: neither function exists.
- [x] T014 [P] [US2] Probe INV-007/INV-008 in `src/components/capture/__tests__/duration-row.test.tsx` (jsdom, the real property): every pair from {null, D} × tap on D (42 cases) leaves the lit position equal to the stored value; two taps in one tick; `aria-pressed` per position; U lights nothing; `TOOLBAR_CONTROLS` has no duration. Fails before: no `duration` property.
- [x] T015 [P] [US2] Probe INV-014/INV-016 jsdom halves in `src/components/rhythm/__tests__/tempo-control.test.tsx`: press held 400 ms counts once from press time; two overlapping pointers; `keydown` with `repeat` ignored; Space and Enter once each; `detail === 0` click; right mouse button ignored; set button absent unless reading is `reading`, slot reserved; every word in contracts/components.md's reading table. Fails before: `TempoControl.tsx` missing.
- [x] T016 [P] [US2] Probe INV-014/015/016/017/042 in `e2e/tempo.spec.ts` (new): synthetic events with `timeStamp`, `visualViewport.scale` stays 1, pad ≥ 96px; tap then close by close button, Esc and backdrop writes nothing (outbox count and song row before/after); set a new value writes exactly one outbox row; capture × {cursor mid-part, latch armed, selection open, chord draft open} × {closed without set, set} leaves cursor, latches, selection, part and URL unchanged; a set tempo shows on the header control, song page field, band list, play view subtitle and export heading. Fails before: no `tempo-control` test id.

### Implementation for User Story 2

- [x] T017 [P] [US2] Create `src/lib/rhythm/tap.ts`: the tap-run reducer (`waiting` with count, `reading`, `out-of-range` with a number or `tooSlow`) per research R11 and spec FR-020 to FR-023. Makes T012 pass.
- [x] T018 [US2] Add `setColumnDuration` and `setSongTempo` to `src/lib/local/editing.ts` per contracts/writes.md (one `patchRow` each; `setSongTempo` returns false and writes nothing when the value is already stored). No other write. Makes T013 pass.
- [x] T019 [US2] Add the `duration` property to `COLUMN_PROPERTIES` in `src/lib/capture/properties.ts`, second after `repeat`, control `"segments"` with `segments(ctx)`, `ColumnPropertyId` gaining `"duration"`, commit via `nextDuration` → `setColumnDuration`. No entry in `TOOLBAR_CONTROLS`. Update the three pins named in plan.md: `src/lib/capture/__tests__/properties.test.ts:65` and `:84`, `src/lib/capture/__tests__/properties-decorations.test.ts:44`. Report any other pin tripped; do not change it silently.
- [x] T020 [US2] Add `case "segments"` to `src/components/capture/ColumnInspector.tsx` per contracts/components.md (`grid w-full grid-cols-6 gap-1`, `min-h-11`, `aria-pressed`, words `aria-label`, `data-testid="duration-row"`, `font-mono`, styled like `ToggleGrid`, commit not awaited, never branches on an id so `no-id-branch.test.tsx` stays unedited). Makes T014 pass. (Depends on T019.)
- [x] T021 [US2] Create `src/components/rhythm/TempoControl.tsx` per contracts/components.md: `variant` `header|bar`, shared `Sheet` unchanged, tap pad (`touch-none select-none`, focused on open, ≥96px), `tempo-stored`, `tempo-reading` with `role=status`, `tempo-set` with a reserved slot, accessible names `Tempo: 118 bpm` / `Tempo: none set`, text from `usableTempo`. Close, Esc and backdrop never write. Makes T015 pass. (Depends on T017, T018.)
- [x] T022 [US2] Modify `src/components/capture/CaptureScreen.tsx` (LF): `<TempoControl song={song} variant="header" />` between title and sync status; `cursor-duration` span in the status row (after chord spans, when not refused and the cursor column has a duration), adding no height. Update `e2e/capture-surface.spec.ts:1912` from 3 rows to 4 rows.
- [x] T023 [US2] Run `npx vitest run src/lib/rhythm src/lib/local src/components/capture src/components/rhythm src/lib/capture`, then `npm run build` and `npm run test:e2e -- e2e/tempo.spec.ts e2e/techniques-sheet-reach.spec.ts e2e/capture-surface.spec.ts`; fix failures.

**Checkpoint**: tap tempo works end to end; the duration row exists in the inspector.

---

## Phase 4: User Story 1 - Play along with a click (Priority: P1) 🎯 MVP

**Goal**: start/stop a count-in then plain click on the play view, offline, with a visual beat and safe endings.

**Independent Test**: song with a tempo and no durations, network off, play view, start: four numbered count-in clicks then a steady beat; stop silences it at once.

### Invariant probes for User Story 1 (FIRST — each must FAIL on the pre-change code)

- [x] T024 [P] [US1] Probe INV-020/INV-036 (plain half) in `src/lib/rhythm/__tests__/stream.test.ts`: `clickStream(EMPTY_SCORE, follow)` gives count-in at 0,1,2,3 beats level `beat` phase `count-in` count 1 to 4, then plain beats from 4 beats forever with no gap; phases never go backwards; 1,000 clicks past the end; `COUNT_IN_CLICKS` is the only literal 4 in `notation.ts` and `stream.ts`. Fails before: `stream.ts` missing.
- [x] T025 [P] [US1] Probe INV-021/022/023/024/025/026 in `src/lib/rhythm/__tests__/scheduler.test.ts` on a fake clock and fake timer: every `when` within 1 ms of `k × 60 / bpm` computed independently over 10 simulated minutes at 40, 120, 240 bpm with timer jitter 0 to 200 ms (SC-003); a 200 ms timer gap moves or drops nothing; stop closes the clock synchronously, empties both queues, and a later start counts from one; 100 seeded random stops; double start in one tick is one start; start/stop/start in one tick; `fell-behind` stop; tempo change 240→60, 60→240, 10→120 with the last click 5.9 s old (not `fell-behind`), same value does nothing, queued clicks keep their times; a dry queue stops with a reason. Fails before: `scheduler.ts` missing.
- [x] T026 [P] [US1] Probe INV-038/INV-041 jsdom halves in `src/components/rhythm/__tests__/click-bar.test.tsx`: every row of the status-line and help tables in contracts/components.md; `click-beat` is `aria-hidden`; `click-follow` absent when `timedFromStart` is false; start disabled without a usable tempo or with `notationReady` false; status text changes only on a state change. Fails before: `ClickBar.tsx` missing.
- [x] T027 [P] [US1] Create the recorder `e2e/click-helpers.ts` per contracts/components.md (AudioContext subclass counting constructions, `AudioScheduledSourceNode.prototype.start/stop` wrappers, frequency at start, `close` calls, `audioSession.type` trap, `HTMLMediaElement.play`/`new Audio` wraps, `wakeLock` stub; installed with `addInitScript`, must `goto` a real URL) plus a helper that seeds a song with tempo and arrangement via Dexie. Then probe INV-019/020/021/022/023/024/026/027/028/029/030/031/039/040/041 in `e2e/click.spec.ts`, `e2e/click-offline.spec.ts` and `e2e/click-layout.spec.ts`: contexts made is 0 after load, scroll and opening the tempo sheet, and construction plus `resume()` happen in the tap's task; recorder `when` values and screen numbers for the count-in; stop closes within the tap's task; 50 start/stop/leave/return cycles (SC-012); `visibilitychange`, `pagehide` and each context state drive `click-state` words with no auto-restart; `AudioContext` removed/throwing/never resuming still shows the beat and `click-help` says so; `data-level` changes within 50 ms of recorded `when`, `getAnimations()` empty, `transition-duration` 0, reduced-motion both ways; wake lock requested only while running and released on every ending, including `request` rejecting and resolving late; Dexie dump and sync requests identical before and after a run; offline (`context.setOffline(true)`) in-app arrival makes no requests, and no `next/dynamic`, `React.lazy` or `import(` under `src/lib/rhythm` and `src/components/rhythm`; mid-run Dexie edits change nothing until next start; `elementFromPoint` reaches each control at top/middle/end of a 40-pass song, the last staff is clear of the bar, at 375×667 and desktop, 2 themes, print emulation `display:none`, 44px minimum, no horizontal scroll; `role=status` mutations per run. Fails before: no `click-bar` test id.

### Implementation for User Story 1

- [x] T028 [P] [US1] Create `src/lib/rhythm/stream.ts`: `COUNT_IN_CLICKS = 4`, `clickStream(score, follow)` generator per contracts/notation.md § The stream (count-in, following, plain; plain starts at `4 beats + score.lengthTicks`). Makes T024 pass.
- [x] T029 [P] [US1] Create `src/lib/rhythm/audio.ts`: `createClock` (synchronous, makes the context and calls `resume()` before returning, catches a missing or throwing constructor), `audioClock` (tracked oscillator → gain → master gain, voices per research R5, `onended` cleanup, `close` stops and closes, `onLost` on `statechange` not running), `silentClock`. No `<audio>`, no `audioSession`.
- [x] T030 [US1] Create `src/lib/rhythm/scheduler.ts`: the engine per contracts/click.md (constants `LOOKAHEAD_S` 0.75, `TOP_UP_MS` 25, `START_LEAD_S` 0.05, `AUDIO_START_TIMEOUT_MS` 1000, `PULSE_MS` 100; injected `makeClock`, `setTimer`, `clearTimer`, `onChange`; start/top-up/setTempo/stop/due). Imports nothing from `src/lib/local/`. Makes T025 pass. (Depends on T028, T029.)
- [x] T031 [US1] Create `src/components/rhythm/useClick.ts` per contracts/click.md § The hook: one engine per mounted `ClickBar`, start inside the tap with nothing async first, live `setTempo` only for usable values, `visibilitychange`/`pagehide` → `stop("hidden")`, lost → `stop("audio-lost")`, unmount → `stop("left")`, wake lock in a `try` and released on every ending, a `requestAnimationFrame` loop only while running that writes `data-level` and the count through a ref and sets state only on a phase change. (Depends on T030.)
- [x] T032 [US1] Create `src/components/rhythm/ClickBar.tsx` per contracts/components.md (sticky bottom bar, `click-start`, `click-follow`, `click-stop` taking focus, `click-beat` shapes with no transition or keyframes, `click-state` and `click-help` words exact, `TempoControl variant="bar"`, `no-print`, `h-11` targets, nothing colour-only). Makes T026 pass. (Depends on T031, T021.)
- [x] T033 [US1] Modify `src/components/app/PlayView.tsx` (LF): render `<ClickBar song={song} passes={passes} notationReady={eventsByPart !== undefined} />` as the last child of `<main>` for either branch (a song with no arrangement has it too); `readNotation(passes)` is the Phase 2 placeholder until Phase 6.
- [x] T034 [US1] Run `npx vitest run src/lib/rhythm src/components/rhythm`, then `npm run build` and `npm run test:e2e -- e2e/click.spec.ts e2e/click-offline.spec.ts e2e/click-layout.spec.ts`; fix failures.

**Checkpoint**: Story 1 works on its own with a plain beat; MVP complete.

---

## Phase 5: User Story 3 - Say how long a note is (Priority: P2)

**Goal**: durations appear as a mark row under the staff on the song page and play view; the capture staff and the export are unchanged.

**Independent Test**: set durations on some columns, see marks under them on the song page and play view; copy and make variants and they travel; clear all and the staff matches a part that never had any.

### Invariant probes for User Story 3 (FIRST — each must FAIL on the pre-change code)

- [X] T035 [P] [US3] (reduced: core surface + layout halves; contrast, print, sync and U-value probes not written) Probe INV-001/005/006/009/010/011/012 (surface halves) in `e2e/durations.spec.ts` and `e2e/durations-layout.spec.ts`: no `tab-rhythm` for a part with no durations on S = song page expanded, song page compact, play view, and none on capture or the paste preview; at 375×667 the inspector row reads `w h q 8 16 32` in order with equal `y`, each ≥44px high, `x + width ≤ 375`, page does not scroll, for note, chord of 5, repeated, grouped, space, all-technique column, chord symbol × 4/5/6 strings, absent on a barline, both themes; each `tab-column` mark text equals the stored value with `scrollWidth <= clientWidth` and column width equal to the same part without durations (D under a one-digit fret, two-digit fret and space; `x8` expanded 8 marks and compact 1; mixed set and unset; print emulation); six distinct texts and computed contrast ≥4.5:1 on `--bg` and `--bg-raised` × 2 themes with no ancestor `opacity` below 1; staff `aria-label` includes the words; capture staff box and header height identical with and without a duration and against values pinned from `main`, `cursor-duration` text present, status row DOM unchanged without a duration; controls in `toolbar-stable`, `toolbar-contextual`, `toolbar-selection` and `latch-strip` unchanged; U values seeded in IndexedDB light nothing and draw nothing with row and outbox unchanged, and tapping `8` then writes `8`; a change from another device while the sheet is open leaves `aria-pressed` equal to the stored value. Fails before: no `tab-rhythm` test id.
- [X] T036 [P] [US3] Probe INV-001 (markup half) in `src/components/tab/__tests__/tab-staff-rhythm.test.tsx`: `renderToStaticMarkup(TabStaff)` with `showRhythm` on equals it with `showRhythm` off when no column has a duration, over H; with durations and `showRhythm` on, one `tab-rhythm` row with a mark per set column, empty for unset columns and barlines. Fails before: no `showRhythm` prop.

### Implementation for User Story 3

- [X] T037 [US3] Modify `src/components/tab/TabStaff.tsx` (CRLF): prop `showRhythm?: boolean` default false; `hasRhythm = showRhythm && layout.columns.some(c => c.duration !== null)`; when true each `Column` gains a final `h-[1.1rem] text-[0.65rem] text-text-dim` `data-testid="tab-rhythm"` child below the strings (empty for unset columns and barlines); when false the DOM is as before. Makes T036 pass.
- [X] T038 [P] [US3] Modify `src/components/app/SongView.tsx` (CRLF): pass `showRhythm` on its one `TabStaff`. Nothing else.
- [X] T039 [US3] In `src/components/app/PlayView.tsx` (LF) pass `showRhythm` to its `TabStaff`.
- [X] T040 [P] [US3] Amend the Out of Scope line at `specs/004-ascii-import/spec.md:350` to say FR-017 of entry 005 answered it (plan Deviation 14). One line only.
- [X] T041 [US3] Run `npx vitest run src/components src/lib/rhythm`, then `npm run build` and `npm run test:e2e -- e2e/durations.spec.ts e2e/durations-layout.spec.ts e2e/capture-surface.spec.ts e2e/techniques-sheet-reach.spec.ts`; fix failures.

**Checkpoint**: Stories 2, 1 and 3 each work independently.

---

## Phase 6: User Story 4 - A click that knows the rhythm (Priority: P3)

**Goal**: the click follows the notation's bars and counted groups and falls to a plain beat without breaking time.

**Independent Test**: build the worked example (four `q`, barline, triplet `8 q h`), start, compare the clicks with the table; clear one duration in bar 2 and it turns plain from that bar.

### Invariant probes for User Story 4 (FIRST — each must FAIL on the pre-change code)

- [x] T042 [P] [US4] Probe INV-033/034/035/037 in `src/lib/rhythm/__tests__/notation.test.ts`: `readNotation` exact in integer ticks against the literal tables in contracts/notation.md: worked example (length 8; accents at 0 and 4, softs at 4⅓ and 4⅔), five eighths + three quarters (accents 0 and 2½, length 5½), N = every size 2 to 16 × D, plain group × D, repeat of 1, 2, 8, 512 (`7x8` marked `8` = one column, four beats), pickup, no barlines, trailing and double barlines, a part with no columns, plain group first hit on / off / over a barline, a triplet landing on a beat; untimed cases per INV-034 (null on a note/space/last column, U values, number above/below its columns, repeat in a counted group, repeat in a plain group still timed, legacy null kind and count, rows disagreeing on the number, counted/plain mix, number with no fraction, group split over a barline that adds up and one that does not, group cut by a bar range, two groups in one bar); positions strictly increase; a bar's clicks relative to its start are independent of the bars before it (metamorphic, bars shuffled), lengths ⅛ to 32 beats, 5/8 beside 4/4. Fails before: `readNotation` returns the empty score.
- [x] T043 [P] [US4] Probe G in `src/lib/rhythm/__tests__/notation-oracle.test.ts`: 500 seeded arrangements of sections, repeats, variants, bar ranges, groups, spaces and gaps compared with an independent BigInt reference walker that shares no code with `notation.ts` (research R15); the reference lives in the test file. Fails before: placeholder `readNotation`.
- [x] T044 [P] [US4] Probe INV-036 (notated half) in `src/lib/rhythm/__tests__/stream.test.ts` (append): a gap in bar 1, 2, 4; ending off the beat (first `plain` tick equals the score's end plus the count-in); a notated part after an unnotated one stays plain; the end of the arrangement carries on plain; fall-to-plain fixture (three timed bars of four `q`, then a bar with one null: score length 12, last click at 11, next click a `plain` `beat` at 16). Fails before: empty score.
- [x] T045 [P] [US4] (bar-range/variant/section×2 vs staves not separately covered; passes case covered) Probe INV-032 (audible), INV-035, INV-038, INV-039 in `e2e/click.spec.ts` (append): worked example recorded frequencies and `when` against the table; `click-state` at each of K = starting, count-in, following, plain after a gap, plain after the end, plain from first click, with `click-follow` present only when the first bar is timed and absent with no arrangement, no durations or a leading empty bar; follow off gives plain from the first click; the choice resets on returning; the click's bars and lengths match the staves on screen for a repeat, a variant on the last pass, bar ranges and a section ×2. Fails before: no `following` phase.

### Implementation for User Story 4

- [x] T046 [US4] Implement `readNotation(passes)` in `src/lib/rhythm/notation.ts` per contracts/notation.md: per-pass census of groups via `groupNumber` from `layout.ts`, split at barlines, skip bars with no playable column, end the walk at the first untimed bar, fractions table (`hitTicks = ticks × fit / n`), hits `Math.max(1, repeat)`, levels accent/beat/soft with strongest-wins by integer tick, `lengthTicks`, `timedFromStart`. Pure: no React, Dexie or audio imports. Makes T042 and T043 pass. (Depends on T011.)
- [x] T047 [US4] Confirm `clickStream` (T028) handles a non-empty score; change `src/lib/rhythm/stream.ts` only if T044 fails. Makes T044 pass.
- [x] T048 [US4] In `src/components/app/PlayView.tsx` (LF) compute `score = useMemo(() => readNotation(passes), [passes])` from the same `passes`; give `ClickBar` the `score`, with the follow choice defaulting on when `timedFromStart`, and the `click-follow` toggle (`aria-pressed`) and status words per contracts/components.md. A run holds its own stream so later edits do nothing until the next start. Makes T045 pass.
- [x] T049 [US4] Run `npx vitest run src/lib/rhythm`, then `npm run build` and `npm run test:e2e -- e2e/click.spec.ts`; fix failures.

---

## Phase 7: Cross-device and owed checks

- [x] T050 [P] Probe INV-017 across devices in `e2e/tempo-sync.spec.ts` (new): two browser contexts, a tempo set by tap on A reaches B in the same stored shape as a typed one; skip when no Postgres is configured (same pattern as the existing sync e2e specs). A skip is reported as a skip, not a pass.
- [ ] T051 🛑 BLOCKED: needs a person at a screen — INV-044 person-level pass at actual size, 375×667, both themes, per `specs/005-rhythm-and-tempo/quickstart.md` §8 (rhythm row, greyscale capture, inspector row, header tempo control, click bar, beat indicator, tempo sheet); log findings on the `verify-log` branch of the verify worktree. Owed after merge.
- [ ] T052 🛑 BLOCKED: needs a real phone — INV-045: the click is audible over a played bass from the phone's own speaker at full volume.
- [ ] T053 🛑 BLOCKED: needs a real phone — INV-045: with the silent switch on the app stays silent, the beat shows and the help is there.
- [ ] T054 🛑 BLOCKED: needs a real phone in airplane mode — INV-045: the click and tempo sheet work from the home-screen app on a song opened before, reached by tapping through the app.
- [ ] T055 🛑 BLOCKED: needs a real phone — INV-045: the screen stays on for a five-minute run on a phone that would otherwise sleep.
- [ ] T056 🛑 BLOCKED: needs a real phone — INV-045: locking the phone and an incoming call both stop the click cleanly, and start works afterwards.
- [ ] T057 🛑 BLOCKED: needs a real phone — INV-045: quick tapping on the tap pad neither zooms the page nor drops taps.

---

## Phase 8: Polish & Cross-Cutting

- [x] T058 Run `npm run typecheck` (it includes `specs/` and test files) and `npm run lint`; fix every error.
- [x] T059 Run `npm run check:untouched-rhythm`; it must print nothing for every INV-043 path. (`npm run check:untouched` is expected to fail on this branch and is left alone, plan Deviation 13.)
- [x] T060 Guards: run the project's fast guard tier — `npm test` (full Vitest, including `src/lib/tab/__tests__/round-trip.test.ts`, `harvest.test.ts`, `ascii.test.ts`, `text.test.ts`, `no-id-branch.test.tsx` and every inventory, exhaustiveness and golden test) plus `npm run typecheck` and `npm run lint` — and fix every failure BEFORE any push. Report any pre-existing pin tripped beyond the four listed in plan.md rather than editing it quietly.
- [x] T061 Run `npm run build` then the full `npm run test:e2e` (no dev server on `.next`) on `mobile` and `desktop`; fix failures; report skips (Postgres) honestly.

---

## Dependencies & Execution Order

- Phase 1 → Phase 2 (blocks all) → Phase 3 (US2) → Phase 4 (US1, needs `TempoControl`) → Phase 5 (US3, needs T019/T020 for the inspector row) → Phase 6 (US4, needs T011, T028, T033) → Phase 7 → Phase 8.
- Phases 4 and 5 could run in parallel by two workers, but both edit `PlayView.tsx` (T033, T039, T048), so sequence those edits.
- Within a phase: probes first, then libs, then components, then the screen edit, then the run task.

### Parallel opportunities

- Phase 2 probes T002 to T005 are all `[P]`; T007, T008, T011 are `[P]` after T006.
- Phase 3 probes T012 to T016 are `[P]`; T017 is `[P]` with T018.
- Phase 4 probes T024 to T027 are `[P]`; T028 and T029 are `[P]`.
- Phase 5: T035, T036 are `[P]`; T038 and T040 are `[P]`.
- Phase 6 probes T042 to T045 are `[P]`.

## Implementation Strategy

### MVP first

Phases 1, 2, 3 (tap tempo and the shared sheet), then 4 (the click). Stop and validate with the Phase 4 e2e specs. That covers Stories 1 and 2, both P1.

### Incremental

Then US3 (marks, P2), then US4 (notation following, P3). Phase 7's BLOCKED tasks stay open and are never ticked to pass a gate.

## Notes

- Nothing under `src/app/`, `src/lib/sync/`, `src/lib/server/`, `src/db/`, `drizzle/` or `public/` changes.
- Every create path keeps writing `durationHint: null`; copy, cut, paste and `createVariant` keep carrying it.
- No new dependency, no colour token, no migration.

## Phase 9: Review remediation

From `review.md`, round 1. Probes live in `specs/005-rhythm-and-tempo/review-probes/`, and `run-probes.sh` re-runs them all. Adopting a probe means moving it into the suite named and keeping what it asserts. A `test.fail` line in a probe marks a MINOR from § Follow-ups: keep it as it is, it is not work for this phase. MINORs have no tasks here.

- [x] T062 Move the probe helpers in `review-probes/helpers.ts` into `e2e/rhythm-probe-helpers.ts`, so the specs adopted below can import them — review F1, F2, F4
- [x] T063 Adopt review-probes/INV-024-double-tap-start.spec.ts into `e2e/` as a failing test first — review F1
- [x] T064 Give the `click-beat` slot the footprint of `click-start`, so `click-stop` is clear of everywhere Start was and a double tap at any point on Start leaves one click running; contracts/components.md:119 already says "same size" — review F1 (MAJOR), src/components/rhythm/ClickBar.tsx:80, src/components/rhythm/ClickBar.tsx:101
- [x] T065 Adopt review-probes/INV-006-row-every-column.spec.ts into `e2e/` as a failing test first — review F2
- [x] T066 Hold the duration row at one `y` across every playable shape at 375×667, on 4, 5 and 6 strings, for instance by leaving only the constant `delete` row below it, then update the property-order pins. `src/components/ui/index.tsx` stays zero-diff. The sheet is bottom-anchored, so what matters is what sits below the row, which research R9 and plan Deviation 11 had the wrong way round — review F2 (MAJOR), src/lib/capture/properties.ts:100, src/components/capture/ColumnInspector.tsx:138
- [x] T067 Make `seedPlayable` wait for each write to land before it navigates, so "Each part once" and "One more repeat" cannot be lost to `page.goto`. Check with `review-probes/INV-038-seed-lands.spec.ts --repeat-each=8` (every run shows the repeat asked for), with `e2e/click.spec.ts --repeat-each=3` (no failures), and that `passes: 12` and `passes: 40` seed that many — review F3 (MAJOR), e2e/click-helpers.ts:178, e2e/click-helpers.ts:184
- [x] T068 Rewrite the test at `e2e/click.spec.ts:217` to the spec: each pass of a part with no barlines is one bar with one accent, so two passes play `[2000, 1300, 2000, 1300]` (spec.md:63, spec.md:189, contracts/notation.md:119). `notation.ts` is right and does not change — review F3 (MAJOR), e2e/click.spec.ts:217
- [x] T069 Adopt review-probes/INV-001-002-harvest.test.ts in place of the hand fixture in `src/lib/rhythm/__tests__/fixtures-gain-durations.test.ts`, so T005's H, `toAscii` and `songToText` are real — review F4 (MAJOR), src/lib/rhythm/__tests__/fixtures-gain-durations.test.ts:55
- [x] T070 Adopt review-probes/INV-003-004-every-path.test.ts into `src/lib/local/__tests__/rhythm-writes.test.ts`, replacing the merge test that is named for four fields and tries one — review F4 (MAJOR), src/lib/local/__tests__/rhythm-writes.test.ts:141
- [x] T071 Adopt review-probes/INV-033-034-037-arrangements.test.ts into `src/lib/rhythm/__tests__/notation-oracle.test.ts`, so G goes through `parseArrangement`, `expandArrangement` and `drawnPasses` with U in it, as T043 says — review F4 (MAJOR), src/lib/rhythm/__tests__/notation-oracle.test.ts:101
- [x] T072 Adopt review-probes/INV-013-018-021-tables.test.ts into `src/lib/rhythm/__tests__/` — review F4
- [x] T073 Adopt review-probes/INV-024-025-engine-seams.test.ts into `src/lib/rhythm/__tests__/`. Check with `review-probes/run-mutants.sh`: only `tap-floor-is-stored`, `stop-keeps-queue` and `time-rounds-to-ms` may survive the suite, and each of those is equivalent or inside tolerance — review F4
- [x] T074 Rewrite the mid-run edit test so it can fail: `tempoBpm` is not a field and raw IDB is invisible to Dexie. Land a duration and a barline where a live query sees them, as `review-probes/INV-025-027-028-030-running.spec.ts:245` does — review F4 (MAJOR), e2e/click-state.spec.ts:81
- [x] T075 Split the test at `e2e/click.spec.ts:172`: a real leading empty bar is offered the choice (INV-038), and a partly noted first bar is not — review F4 (MAJOR), e2e/click.spec.ts:172
- [x] T076 [P] Adopt review-probes/INV-001-006-010-016-members.spec.ts into `e2e/` — review probes
- [x] T077 [P] Adopt review-probes/INV-005-unknown-values.spec.ts into `e2e/` — review probes
- [x] T078 [P] Adopt review-probes/INV-007-008-lit-and-nowhere-else.spec.ts into `e2e/` — review probes
- [x] T079 [P] Adopt review-probes/INV-009-capture-height.spec.ts into `e2e/` — review probes
- [x] T080 [P] Adopt review-probes/INV-010-011-012-marks.spec.ts into `e2e/` — review probes
- [x] T081 [P] Adopt review-probes/INV-014-015-tap-pad-and-set.spec.ts into `e2e/` — review probes
- [x] T082 [P] Adopt review-probes/INV-016-017-018-sheet-and-tempo.spec.ts into `e2e/` — review probes
- [x] T083 [P] Adopt review-probes/INV-019-020-021-022-timing.spec.ts into `e2e/` — review probes
- [x] T084 [P] Adopt review-probes/INV-023-026-029-every-ending.spec.ts into `e2e/` — review probes
- [x] T085 [P] Adopt review-probes/INV-025-027-028-030-running.spec.ts into `e2e/` — review probes
- [x] T086 [P] Adopt review-probes/INV-031-offline-arrivals.spec.ts into `e2e/` — review probes
- [x] T087 [P] Adopt review-probes/INV-032-036-038-following.spec.ts into `e2e/` — review probes
- [x] T088 [P] Adopt review-probes/INV-040-bar-at-size.spec.ts into `e2e/` — review probes

## Phase 10: Review remediation

From `review.md`, round 2. Probes live in `specs/005-rhythm-and-tempo/review-probes/`. Adopting a probe means adding it to the suite and keeping what it asserts. A `CANDIDATE` branch in a probe is a review tool, so leave it out of the adopted copy, and keep any `test.fail` line, which marks a MINOR from § Follow-ups. **Never copy a probe over an existing test file.** These files are untracked, so nothing can bring one back: T070 lost tests that way. A probe that adopts into an existing file is added to it. MINORs have no tasks here.

- [x] T089 Adopt review-probes/INV-006-tall-sheets.spec.ts into `e2e/durations-row-tall-sheets.spec.ts` as a failing test first — review F15
- [x] T090 Hold the duration row at one `y` on sheets taller than the screen as well: pin the last two rows as a footer of the sheet, chosen by a field on the property descriptor and never by id, so `no-id-branch.test.tsx` stays unedited. The target is y 532 on all 33 shape and tuning pairs at 375×667, in both themes. `src/components/ui/index.tsx` stays zero-diff. `e2e/techniques-sheet-reach.spec.ts` must stay green, because a footer covers part of the scrolling area — review F15 (MAJOR), src/components/capture/ColumnInspector.tsx:27, src/lib/capture/properties.ts:164
- [x] T091 Adopt review-probes/INV-040-bar-fit.spec.ts into `e2e/click-bar-fit.spec.ts` as a failing test first — review F16
- [x] T092 Set `click-start` and `click-beat` to one width of 86 px, Start's natural width, in place of `w-36`, so every state of the bar fits at 375 and `click-stop` stays clear of Start, which `e2e/click-double-tap.spec.ts` checks. 88 and 96 still wrap `no tempo` — review F16 (MAJOR), src/components/rhythm/ClickBar.tsx:68, src/components/rhythm/ClickBar.tsx:80
- [x] T093 Make `noSideways` compare `scrollWidth` with the viewport the test set, not `innerWidth`, which grows with the page on a phone. Add no tempo beside the follow chip to what the spec runs — review F16 (MAJOR), e2e/click-bar-at-size.spec.ts:27
- [x] T094 Give the tests in `describe("over H, after every harvested file has run")` a timeout, as `src/lib/tab/__tests__/harvest.test.ts:306` does. Check with five green runs of `review-probes/INV-001-suite-stays-green.sh` — review F17 (MAJOR), src/lib/rhythm/__tests__/fixtures-gain-durations.test.ts:127, src/lib/rhythm/__tests__/fixtures-gain-durations.test.ts:99
- [x] T095 Add the tests in review-probes/INV-003-004-015-lost-writes.test.ts to `src/lib/local/__tests__/rhythm-writes.test.ts`, keeping every test already there. Check with `review-probes/run-mutants.sh duration` and `review-probes/run-mutants.sh tempo-`: every write mutant in `mutants-round-2.txt` must read `suite=KILLED`, and a row reading `BROKEN` is not a kill — review F18 (MAJOR), src/lib/local/__tests__/rhythm-writes.test.ts:1
- [x] T096 Adopt review-probes/INV-028-no-motion-at-any-beat.spec.ts in place of the test at `e2e/click-state.spec.ts:45`, as a failing test first. It reads on each beat through an observer, so it needs neither the poll at line 51 nor luck at line 52 — review F19, e2e/click-state.spec.ts:45
- [x] T097 Set `transition-none` on the beat box and its children, so the reduced-motion rule in `globals.css` has nothing to run. `globals.css` does not change. Check that the adopted spec reads 0 on every beat under `reduce` — review F19 (MAJOR), src/components/rhythm/ClickBar.tsx:24
