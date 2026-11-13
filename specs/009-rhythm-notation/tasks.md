# Tasks: Rhythm notation under the tab

**Input**: Design documents from `/specs/009-rhythm-notation/` (plan.md, spec.md, research.md, data-model.md, quickstart.md, contracts/beaming.md, contracts/rhythm-row.md, contracts/duration-buttons.md)

**Tests**: Invariant probes are mandatory (plan.md § Invariants) and are the FIRST tasks of their phase. Each probe lives in the project's test suite and must FAIL on the pre-change code. Where an invariant is "nothing changes" (INV-001, INV-015, INV-016) the probe cannot fail on unchanged code by nature; the task says so and says what makes it able to fail (a deliberate mutation check).

**Organization**: By user story. **US1 and US2 must land together** (brackets move with the rhythm row); US3 depends on both; US4 is independent.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: parallelizable (different files, no dependency on an incomplete task)
- Headless rules: no dev server, no curl. Browser checks are Playwright specs (`npm run build < /dev/null && npx playwright test <file> < /dev/null`, run in the foreground, never while a dev server holds `.next`). Every command takes `< /dev/null`.
- Every file touched is LF. `tsconfig.json` includes `specs/`, so anything under `specs/009-rhythm-notation/` must pass `npm run typecheck`.

## Phase 1: Setup (measure and record on the UNEDITED tree)

**Purpose**: Record the "before" figures and fixtures. These must be done before any source edit, because after the first edit the pre-change state is gone.

- [X] T001 Write a Playwright spec `e2e/notation-measure-before.spec.ts` that, on the unedited production build at 375×667 touch and 1280×800 fine, measures quickstart §1 (band outer/content/line heights for six strings with chord row and bracket row; lowest string span mask bottom and digit Range rect; a 12px numeral with `line-height: 9px` box) and writes `specs/009-rhythm-notation/research-probes/measure-before.json`. Run it with `npm run build < /dev/null && npx playwright test e2e/notation-measure-before.spec.ts < /dev/null`. If any figure differs from research R1/R2 by more than 0.5px, adjust `--rhythm-row` and `--rhythm-lead` per research R2's fallback and note it for T040.
- [X] T002 [P] Write `e2e/notation-paste.spec.ts` in record mode first and record `e2e/fixtures/paste-preview-before.json` (the paste preview `outerHTML` for each import fixture) on the unedited tree via `npx playwright test e2e/notation-paste.spec.ts < /dev/null`; then switch it to compare mode (INV-001, paste). Do this before any `TabStaff` edit. Probe note: it passes on unchanged code by design; it can fail only when the preview markup moves, which T017's mutation check shows.
- [X] T003 [P] Create `scripts/untouched-by-notation.sh` and add `"check:untouched-notation": "bash scripts/untouched-by-notation.sh"` to `package.json`. It prints `zero diff` for every path in plan.md § Scope fence against `main` (tracked and untracked), fails otherwise, and also checks `src/lib/rhythm/notation.ts` changes by addition only apart from the `hit` callback signature in `readBar` and its two call sites (INV-015). Verify it can fail by touching a fenced path in a scratch copy and confirming a non-zero exit, then reverting.
- [X] T004 [P] Create `scripts/check-notation-amendments.sh` and add `"check:notation-amendments"` to `package.json`. It checks each file in plan.md "Existing tests this changes on purpose" is named in `docs/DECISIONS.md` under "009 — re-pinned tests", and each FR-035 requirement (spec 005 FR-013/014/015/016/SC-011; spec 003 FR-020/SC-009/FR-032; spec 007 FR-064; spec 008 FR-003) carries `Amended by spec 009` on its own line with a note (INV-016). It must FAIL now, because none of those amendments exist yet; run it and confirm the failure.

---

## Phase 2: Foundational (pure rules; blocks all stories)

**Purpose**: `barPositions`, `rhythmMarks`, `groupLabels`, with the FR-036 corpus. React-free.

### Invariant probes (FIRST — each must FAIL on the pre-change code)

- [X] T005 [P] Probe INV-003 in new `src/lib/rhythm/__tests__/positions.test.ts`: through the public export `barPositions(events)`, for every pass in `src/lib/reading/notation-baseline.json`'s inputs and the **Corp** rows in `contracts/beaming.md`, for every bar `walk` times, `barPositions(events).get(key).tick` equals `notationColumns(...)`'s tick less the bar's start. Also the FR-006 (a bar after an untimeable bar) and FR-008 (position known up to first unset column or unreadable group) rows. Fails now because `barPositions` does not exist.
- [X] T006 [P] Probe INV-002 and INV-019 in new `src/lib/rhythm/__tests__/beams.test.ts`: through `rhythmMarks(columns, positions, density)` over every **Corp** row and L1–L4 against the hand table in `contracts/beaming.md` (a hand table, not a second implementation), asserting `out[i].right === out[i+1].left` for every `i`; no beam across any **Brk** member; rows 15 and 16 (compact repeat is never beamed; both densities read the same position map so columns after a repeat have identical `positions.get(eventId:0)`); `groupLabels` gives one label per counted group and none for plain, for L1–L4. Fails now because `beams.ts` does not exist.

### Implementation

- [X] T007 Add `barPositions(events)` to `src/lib/rhythm/notation.ts` by calling `readBar` one bar at a time, and give `readBar`'s `hit` callback its fourth `counted` argument (addition only, plus the signature change and its two call sites; research R3). Make T005's tests pass. Run `npx vitest run src/lib/rhythm/__tests__/notation-baseline.test.ts src/lib/rhythm/__tests__/notation-oracle.test.ts src/lib/rhythm/__tests__/notation.test.ts < /dev/null` and confirm they pass UNEDITED.
- [X] T008 Create `src/lib/rhythm/beams.ts` exporting `rhythmMarks` and `groupLabels` per `contracts/beaming.md` and data-model.md (one mark per column; `left`/`right` from one `join(i, i+1)`; unit = beat or the counted group that reads; barlines are columns). Make T006 pass.
- [X] T009 [P] Add the `--rhythm-*` tokens (touch and fine; `--rhythm-row` ≤ 2 × `--staff-row` on both pointers) and the `.tab-rhythm` part rules (beam, stub, stem, flag, rest, oval, bracket under the tab) to `src/app/globals.css` per `contracts/rhythm-row.md` § Geometry and Colour. Solid `currentColor`, never opacity or `color-mix`. Add a jsdom check in `src/components/tab/__tests__/rhythm-tokens.test.ts` (`@vitest-environment jsdom` docblock) that parses the CSS and asserts the 2× bound (FR-020).
- [X] T010 [P] Create `src/components/rhythm/glyphs.ts` (SVG path data for flags, six rests, oval, noteheads) per `contracts/duration-buttons.md` § The symbols. One table, shared by staff and buttons.

**Checkpoint**: `npx vitest run src/lib/rhythm < /dev/null` green; `src/lib/tab/` has zero diff.

---

## Phase 3: User Story 1 - Read rhythm at a glance on the song page and play view (Priority: P1) 🎯 MVP

**Goal**: Stems, flags, beams and rests replace the letters on every staff with durations (song expanded/compact, play, print).

**Independent Test**: A part with the spec's US1 bars on song and play at 375×667 and 1280×800 in both themes: marks match the hand table, symbols are pairwise distinct in greyscale, and a part with no durations is byte-identical.

### Invariant probes for User Story 1 (FIRST — each must FAIL on the pre-change code)

- [X] T011 [P] [US1] Probe INV-001 in `src/lib/reading/__tests__/frets-unchanged.test.ts` (run UNEDITED, with `baseline.json` unedited) and the no-duration case of `src/components/tab/__tests__/tab-staff-rhythm.test.tsx` (unedited): `renderToStaticMarkup(TabStaff)` for no-duration parts is byte-identical on every **Grp** shape. This passes on unchanged code by nature; it is the regression net. Prove it can fail: after T015, temporarily make `TabStaff` emit an extra attribute for a no-duration part, confirm the test fails, then revert.
- [X] T012 [P] [US1] Probe INV-002 and INV-006 in new `e2e/notation-beams.spec.ts`: for each **Corp** bar from `contracts/beaming.md` seeded via `rhythm-probe-helpers.ts`'s `seed`/`writeColumns`, on song expanded, song compact, play, capture single, capture wrapped and print of the play view: every cell's `data-beams-left`/`data-beams-right` match the table; no beam element in a barline, rest or unset cell; `data-beams-right` is 0 at each wrapped line's last column; every `beam`/`stub` edge is within 1px of its stem centre and the other edge within 1px of the column edge; across **Gapk** gaps the beam ends touch both neighbours' halves within 1px; view switched with no reload. Fails now because no cell carries `data-beams-*`.
- [X] T013 [P] [US1] Probe INV-007, INV-009 and INV-018 in new `e2e/notation-alignment.spec.ts`: stem centre and rest/oval centre within 1px of the note centre across **Sym** × **Wid** × **View** × **Dens** × {single, wrapped} × **Sz**; beam, stub and stem rects ≥ 2px/2px/1px and stacked gaps ≥ thickness; column rects (x, width) and bar numbers equal the same part with every duration cleared. Fails now because there are no stems.
- [X] T014 [P] [US1] Probe INV-010 in new `e2e/notation-symbols.spec.ts`: contrast ≥ 4.5 via `contrast()` from `e2e/rhythm-probe-helpers.ts` on each part against its column background for **Sym** × {`--bg`, `--bg-raised`, `--selection`} × **Th** × **Sz** × print; computed `opacity` is 1 up to the staff; greyscale crops of the 13 states differ pairwise by ≥ 2% of pixels. Fails now because the marks are letters, so the 13 states are not distinct crops.

### Implementation for User Story 1

- [X] T015 [US1] Create `src/components/tab/RhythmCell.tsx` (stem at 50%, left/right beam halves from edge to 50%, stubs, flags, rest, oval; `data-duration`, `data-rhythm`, `data-beams-left`, `data-beams-right`, `data-flags`; `aria-hidden`) per `contracts/rhythm-row.md` § The rhythm cell, using `glyphs.ts`.
- [X] T016 [US1] Edit `src/components/tab/TabStaff.tsx`: compute `rhythmMarks` once with the layout (memoised), draw `RhythmCell` in `Column`, `Gap` and `RemovalGap` (the gap draws the arriving column's `left` levels), write `data-rhythm` from its own `hasRhythm`, and leave the no-duration markup byte-identical. Run `npx vitest run src/lib/reading/__tests__/frets-unchanged.test.ts < /dev/null` after each step.
- [X] T017 [US1] Make the compact `7x8` repeat draw one stem with its own flags and no beams, and expanded repeats draw each hit as its own note (FR-010). Mutation check for T011: add a stray attribute on a no-duration part, see `frets-unchanged` and `notation-paste.spec.ts` fail, revert.
- [X] T018 [US1] Re-pin the unit tests in plan.md "Existing tests this changes on purpose" for this story: `src/components/tab/__tests__/tab-staff-rhythm.test.tsx` (cells' `data-duration` `"8"`, none, none, `"q"`; no-duration case unedited) and `src/components/tab/__tests__/TabStaff.test.tsx` (stems, beams, flags meet FR-027 sizes; numeral stays 12px). Add the match-line entry for each to `docs/DECISIONS.md` under "009 — re-pinned tests".
- [X] T019 [US1] Re-pin the e2e specs for the staff's marks (each to read `data-duration`, stem rects and contrast, never text; never skip silently): `e2e/rhythm-marks.spec.ts`, `e2e/rhythm-members.spec.ts`, `e2e/durations.spec.ts` (capture draws it; first cell `data-duration="8"`), `e2e/click-following.spec.ts`, `e2e/click-running.spec.ts`, `e2e/click-state.spec.ts`, `e2e/usability-neck.spec.ts`, `e2e/usability-contrast.spec.ts`, `e2e/usability-surfaces.spec.ts`, `e2e/usability-staff.spec.ts`, `e2e/usability-staves.spec.ts`. Name each in `docs/DECISIONS.md`.
- [X] T020 [US1] Run `npm run build < /dev/null && npx playwright test e2e/notation-beams.spec.ts e2e/notation-alignment.spec.ts e2e/notation-symbols.spec.ts --project=mobile --project=desktop < /dev/null` and fix until green (together with Phase 4 where brackets are involved).

**Checkpoint**: US1 unit and e2e probes green; no-duration markup unchanged.

---

## Phase 4: User Story 2 - Tuplets and groups with their rhythm (Priority: P1)

**Goal**: With rhythm, group brackets and numbers sit under the tab, below the beams; without rhythm they stay above, exactly as today.

**Independent Test**: A part with a triplet, a counted five, a plain four, a counted group ending at a barline and a plain group with a repeat: brackets under the tab, each number once; clearing all durations returns brackets above.

### Invariant probes for User Story 2 (FIRST — each must FAIL on the pre-change code)

- [x] T021 [P] [US2] Probe INV-004 in new `src/components/tab/__tests__/brackets-under.test.tsx` (jsdom) and `e2e/notation-brackets.spec.ts`: count `.tab-bracket-label` per group id (1 per counted group, 0 plain); each `tab-bracket` is inside `tab-rhythm` iff the staff has `data-rhythm`; on a staff with rhythm no column has a row above the cells; **Grp** × {rhythm, none} × **Surf** (paste: none only). Fails now because brackets are always in the row above.

### Implementation for User Story 2

- [x] T022 [US2] In `src/components/tab/TabStaff.tsx` add the single `bracketRow` value (`"above"` with no rhythm, `"under"` with it), read by `offsetFor`, the gutter, `Caret`, `EmptyStaff`, `Gap` and `RemovalGap`; draw the one bracket element in either place from one `tuplet` computation and one `groupLabels` call (number drawn once per group id, FR-014). Keep the open right end, selection text colour and wrapped-line coverage (FR-015).
- [x] T023 [US2] Check no-duration, group-bearing parts stay byte-identical (`frets-unchanged.test.ts` unedited) and that research R6's "0 of 3,394" still holds: `npx vitest run --config specs/009-rhythm-notation/research-probes/vitest.probe.config.ts < /dev/null`.
- [x] T024 [US2] Run `npx vitest run src/components/tab < /dev/null` and `npm run build < /dev/null && npx playwright test e2e/notation-brackets.spec.ts e2e/grouping-*.spec.ts --project=mobile --project=desktop < /dev/null`; the `grouping-*` specs must pass unedited.

**Checkpoint**: US1 and US2 land together; song and play fully working.

---

## Phase 5: User Story 3 - See the rhythm while capturing (Priority: P2)

**Goal**: Capture draws the same rhythm row, within the 375×667 height budget.

**Independent Test**: Six strings, chord row, counted group and durations at 375×667 touch: everything in view, no page scroll, band ≥ 189px; four strings wrap and each line has its own row.

### Invariant probes for User Story 3 (FIRST — each must FAIL on the pre-change code)

- [X] T025 [P] [US3] Probe INV-005 and INV-008 in new `e2e/notation-capture-height.spec.ts`: for **Str** × **Cap** × **Th** × {cursor at the end, on a group's labelled column, a selection across the group} at 375×667 touch: every `.tab-cell`, the chord row and the `tab-rhythm` cells (with stem rects) lie inside the band's content rect; `scrollHeight − innerHeight ≤ 0`; band ≥ 189; a stem's top ≥ the lowest cell span's bottom; beam stack bottom ≤ bracket line top − 1; bracket bottom ≤ numeral top; numeral bottom ≤ column bottom − 2; numeral `font-size` ≥ 12. Writes before/after figures. Fails now because capture draws no rhythm row.
- [X] T026 [P] [US3] Probe INV-011 and INV-013 in new `e2e/notation-capture.spec.ts`: setting the first duration shows the row, moves brackets under, strings stay in view; clearing the last restores brackets above with `outerHTML` equal to the earlier no-duration markup; a new group off-screen is scrolled into view; selected columns' parts compute to `--text`; wrapped lines each have their own `tab-rhythm` and no beam crosses `.tab-bar-run`s; `cursor-duration` text equals `words` for each **D**; the accessibility snapshot with rhythm equals the same staff's without, except words already in descriptions; `baseline.json` `descriptions` hashes unedited. Fails now because capture never draws rhythm.

### Implementation for User Story 3

- [X] T027 [US3] Pass `showRhythm` from `src/components/capture/CaptureScreen.tsx`; make `useCaptureBand` read the computed padding; add the band rule in `src/app/globals.css` that drops `pt-1` only while `data-rhythm` is set (research R1: content 189.6, rows 188.0, band outer unchanged). Update `docs/DECISIONS.md` with the before/after figures from T001's JSON and the new spec's output.
- [X] T028 [US3] Pass `showRhythm` from `src/components/app/PasteTab.tsx` (FR-024); confirm `notation-paste.spec.ts` (T002) still equals the recorded fixture.
- [X] T029 [US3] Re-pin `e2e/rhythm-capture-height.spec.ts` (capture draws the row; height follows research R1's table; strings in view) and amend `docs/DECISIONS.md`.
- [X] T030 [US3] Run `npm run build < /dev/null && npx playwright test e2e/notation-capture-height.spec.ts e2e/notation-capture.spec.ts e2e/usability-height-budget.spec.ts e2e/usability-wrap.spec.ts e2e/polish-band-unchanged.spec.ts --project=mobile --project=desktop < /dev/null`. The last three must pass UNEDITED; if one fails, the product is wrong.

**Checkpoint**: US3 works with the height spec green.

---

## Phase 6: User Story 4 - Pick a duration by its symbol (Priority: P2)

**Goal**: The inspector's six buttons show note symbols, with names in words.

**Independent Test**: At 375×667 touch and 1280×800 mouse: six symbols on one line, ≥ 54×44 on touch, named/titled in words, lit state visible in greyscale.

### Invariant probes for User Story 4 (FIRST — each must FAIL on the pre-change code)

- [x] T031 [P] [US4] Probe INV-012 in `src/components/capture/__tests__/duration-row.test.tsx` (jsdom, re-pinned) and new `e2e/notation-buttons.spec.ts`: order by `data-duration`; `aria-label` and `title` equal `words`; `aria-pressed` matches the stored value (null, each of **D**, `"64"`); `textContent` empty; all six share one `top`; each ≥ 54×44 on touch and meets spec 007's fine floor on desktop; greyscale crop of lit vs unlit differs, **Th** × **Sz**. Fails now because buttons show letters.

### Implementation for User Story 4

- [x] T032 [P] [US4] Create `src/components/rhythm/NoteSymbol.tsx` (six symbols from `glyphs.ts`) per `contracts/duration-buttons.md`.
- [x] T033 [US4] Add `ColumnSegment.symbol` to `src/lib/capture/properties.ts` (duration segments set it) and draw `NoteSymbol` plus a `title` in `src/components/capture/ColumnInspector.tsx`'s `SegmentRow`; the commit path stays `property.commit` with `nextDuration`. Make T031 pass.
- [x] T034 [US4] Re-pin `e2e/rhythm-lit-and-nowhere-else.spec.ts`, `e2e/durations-layout.spec.ts`, `e2e/durations-row-every-column.spec.ts` (by `data-duration`, empty text) and name them in `docs/DECISIONS.md`. `e2e/durations-row-tall-sheets.spec.ts` must pass unedited.
- [x] T035 [US4] Run `npm run build < /dev/null && npx playwright test e2e/notation-buttons.spec.ts e2e/durations-*.spec.ts e2e/rhythm-lit-and-nowhere-else.spec.ts --project=mobile --project=desktop < /dev/null`.

---

## Phase 7: Polish & Cross-Cutting Concerns

### Invariant probes (run first in this phase; each must FAIL on the pre-change code)

- [X] T036 [P] Probe INV-014 in new `e2e/notation-offline.spec.ts`: a context with no network after one warm load on song page, play view and capture; notation drawn, and `page.on("request")` sees no font, image or cross-origin request beyond the warm-load list. Probe note: this holds trivially on pre-change code for song and play (they already draw letters) but fails for capture, which drew no rhythm; the cold-offline capture case is the discriminating one. `public/sw.js` has zero diff.

### Tasks

- [X] T037 Write the in-place amendments with before and after wording, each with an `Amended by spec 009` line: `specs/005-*/spec.md` (FR-013, FR-014, FR-015, FR-016, SC-011), `specs/003-*/spec.md` (FR-020, SC-009, FR-032), `specs/007-*/spec.md` (FR-064), `specs/008-*/spec.md` (FR-003). Add the 009 sections to `docs/DECISIONS.md` (height figures, re-pinned tests, amendments). Run `npm run check:notation-amendments < /dev/null` and confirm it now passes (it failed in T004).
- [X] T038 Add the 009 research-probe config check: `npm run typecheck < /dev/null` must pass including `specs/009-rhythm-notation/research-probes/`.
- [X] T046 Re-pin `e2e/polish-band-interactions.spec.ts` INV-004 "stills the implementation's spec does not cover", member "an inspector write", per plan.md's *Existing tests this changes on purpose* row (decided 2026-11-13 by the supervisor under Jamie's standing "decide and log" instruction). Cause, measured: the still's `/dead|ghost|x/i` clicks `sixteenth note`; `longPart` seeds `durationHint: null`, so that write is the part's first duration and adds the capture rhythm row, every `.tab-bar-run` growing 184→188px (on `main` capture drew no rhythm row, 184→184). Before `before` is taken, give the part one duration on a different column through the inspector and wait 800ms, so the measured write is an ordinary one. Keep every other still and both lines unchanged; do not touch `polish-long-part.ts`. Log it in `docs/DECISIONS.md` under "009 — re-pinned tests" with the reason and the rejected option (reserving the row on every capture staff, which spends height on parts with no rhythm). Run `npm run check:notation-amendments`, then this spec alone on `--project=mobile`: it must pass, and must fail if the setup write is removed. — PASS 3 PROGRESS: setup write added (click col 1, wait 800, touchHold col 1, click `quarter note`, Escape, wait 800) and DECISIONS entry written, `check:notation-amendments` ok; but with the setup the still "ungroup (bottom)" then stalls ~540s (a click auto-waiting; baseline without setup finished under 300s and failed only at the final assertion), so the spec still fails. Needs investigation of why ungroup-bottom hangs once a duration exists (INV-004 mobile; not a human task). **Supervisor follow-up, 2026-11-13 (measured with a timed copy of the test):** the setup write is in and correct; with it, `an inspector write` passes on both lines (709ms, 726ms) and every other still passes except `ungroup (bottom)`, which times out on `locator.click`: there is no Ungroup button, because `pickColumn(page, "bottom")` is re-run for each still and, once the part holds a duration, lands on a different column from the one `group from a selection (bottom)` just grouped. In isolation group-then-ungroup on one column works with and without a duration. Fix the test, not the app: make `ungroup` select the same columns the preceding `group from a selection` grouped on that line (carry the index from that still), and give the selection-toolbar clicks in this test `{ timeout: 5000 }` so a missing button fails at once instead of running out the 300s test timeout. Name this in the same DECISIONS entry.
- [X] T039 After T046, run the full browser suite in the foreground: `npm run build < /dev/null && npx playwright test < /dev/null`. Known flakes (spec 006 FU19 sync, `durations.spec.ts:7` under load): rerun alone and record. Everything else green. — PASS 4 RESULT: build ok; full suite run in 8 shards, all green except three load flakes that passed alone on rerun (`capture-surface.spec.ts:1089` light, `durations.spec.ts:7`, `notation-measure-before.spec.ts:19`); shard 3 timed out in a first run and passed (254) on rerun; `polish-band-interactions.spec.ts:363` now passes. Earlier — PASS 2 RESULT: 1749 passed; 4 of 5 failures were flakes (pass on rerun); `polish-band-interactions.spec.ts:363` (mobile, "an inspector write (top line)") fails deterministically: a `.tab-bar-run` top moves after the write. Needs investigation (likely a 009 layout shift).
- [X] T040 [P] Record, in `docs/DECISIONS.md`, T001's before figures beside the after figures from `notation-capture-height.spec.ts`, plus any `--rhythm-row`/`--rhythm-lead` adjustment (FR-018, Deviation 1).
- [X] T041 [P] Write `e2e/notation-screens.spec.ts`, a Playwright script that screenshots the US1 part (song expanded and compact, play wrapped, play print emulation, capture six-string and four-string wrapped, inspector row) at 375×667 and 1280×800 in dark, light and greyscale to `test-results/notation/` and asserts each file is non-empty. This is the automated artifact for the human pass in T044.
- [X] T042 Guards: run the project's fast guard tier and fix every failure BEFORE any push: `npm run typecheck < /dev/null`, `npm run lint < /dev/null`, `npm test < /dev/null`, `npm run test:spec004 < /dev/null`, `npm run check:untouched-notation < /dev/null`, `npm run check:notation-amendments < /dev/null`, `npm run check:polish-amendments < /dev/null`, `npm run check:usability-amendments < /dev/null`. `check:untouched-notation` must print `zero diff` for every fenced path; `frets-unchanged.test.ts` and every "Must pass unedited" file stay unedited.

### Human-owned (🛑, unchecked until a person does them; INV-017)

- [ ] T043 🛑 BLOCKED: needs a person with a real browser — quickstart §6 pass at 375×667 and 1280×800 in dark, light and greyscale (song expanded/compact, play wrapped and print preview, capture six-string and wrapped four-string, paste preview unchanged, inspector row with touch and mouse), looking at the screenshots `e2e/notation-screens.spec.ts` writes to `test-results/notation/` and the live `npm run dev:clean` app; record what was seen in `docs/DECISIONS.md` (SC-002, SC-009).
- [ ] T044 🛑 BLOCKED: needs a real phone — confirm 2px beams and three stacked flags read as three (not a smudge) at arm's length and on a music stand in the play view (quickstart §7).
- [ ] T045 🛑 BLOCKED: needs a real phone — confirm the capture rhythm row does not crowd the neck under a resting thumb (quickstart §7).

---

## Dependencies & Execution Order

- Phase 1 first and before any source edit (T001–T002 record "before" state). T003, T004 parallel.
- Phase 2 (T005, T006 probes → T007, T008; T009, T010 parallel) blocks all stories.
- US1 (Phase 3) and US2 (Phase 4) land together; US3 (Phase 5) depends on both; US4 (Phase 6) depends only on Phase 2 (T010) and can run in parallel with US1–US3.
- Phase 7 after the stories. T042 is the last automated task; T043–T045 are owed to a person.

## Parallel Examples

- Phase 2 probes: T005 ‖ T006. Phase 3 probes: T011 ‖ T012 ‖ T013 ‖ T014.
- US4 (T031–T035) can run beside US3 once T010 is done.

## Implementation Strategy

- **MVP**: Phases 1–4 (US1 + US2 together). Stop and validate: unit probes, `notation-beams`, `notation-alignment`, `notation-symbols`, `notation-brackets` and `frets-unchanged` green.
- Then US3 (capture), then US4 (buttons), then Polish and guards.
- Keep `frets-unchanged.test.ts` green after every edit to `TabStaff.tsx`.

---

## Phase 8: Review remediation

**Purpose**: Close the blocking findings of `review.md` (round 1). Each task carries its finding id and location. For a violated invariant, the probe is adopted as a failing test before the fix. Run every command with `< /dev/null`, in the foreground, and never while a dev server holds `.next`.

- [x] T047 Adopt review-probes/INV-005-INV-008-capture-height-every-row.spec.ts into `e2e/notation-capture-height.spec.ts` as a failing test first: replace the vacuous selectors `[data-part=bracket-line]`, `[data-part=numeral]` and `[data-testid=tab-chord]` (e2e/notation-capture-height.spec.ts:37,43,45) with the real `.tab-bracket`, `.tab-bracket-label` and `[data-testid=tab-column] > div.text-accent`, and enumerate Str {4, 5, 6} × all six Cap rows × Th {dark, light} × cursor {end, labelled column, selection}, each with a chord row. Confirm it FAILS today on "numeral bottom within 2px of column bottom" — review F1, F5 (MAJOR), e2e/notation-capture-height.spec.ts:37
- [x] T048 Place the group's bracket line and numeral under the tab as research R2's band table says (line just below the stem band; numeral below the line; the numeral's box ending at least 2px above the rhythm row's bottom, clear of `.tab-column-active::after` and the selection's inset edge), so no line crosses a digit (spec 007 FR-030). Keep the band ≥ 189px and every row in view; T047 must pass — review F1 (MAJOR), src/app/globals.css:464-480
- [x] T049 Adopt review-probes/INV-006-gap-beams.test.tsx into `src/components/tab/__tests__/` (jsdom) as a failing test first: connector and removal gap × {single, wrapped} × levels 1–3; the six removal-gap cases must fail today — review F2 (MAJOR), src/components/tab/TabStaff.tsx:290
- [x] T050 Give the in-line `RemovalGap` the arriving column's `left` beam levels (as `Gap` gets `arriving`), leaving the end-of-staff removal at 0, so a beam runs through a variant's removal gap unbroken (FR-017, spec edge case). T049 must pass — review F2 (MAJOR), src/components/tab/TabStaff.tsx:290
- [x] T051 Adopt review-probes/INV-009-flag-gaps.spec.ts into `e2e/` as a failing test first: the least gap between adjacent flag strokes of a lone 16th and a lone 32nd, sampled along each path in screen space, is at least one beam (2px). It fails today at −0.56px — review F3 (MAJOR), src/components/rhythm/glyphs.ts:53
- [x] T052 Re-shape or re-space the staff flag (`STAFF_FLAG`, and the flag level step in `.tab-rhythm [data-part="flag"]`) so stacked flags keep at least 2px between strokes everywhere off the stem (FR-027), within the stem band and without crossing a fret label (INV-008's stem/label check). Re-run T047 and T051 — review F3 (MAJOR), src/components/rhythm/glyphs.ts:53, src/app/globals.css:444-462
- [x] T053 Remove the `git diff main -- public/sw.js` test from the browser suite (`check:untouched-notation` already pins `public/sw.js`), or make it skip when `main` does not resolve. A PR's CI e2e checkout has no `main` ref, so today it throws on both projects — review F4 (MAJOR), e2e/notation-offline.spec.ts:43-45
- [x] T054 Rewrite the spec 009 amendment notes so none says anything untrue: spec 005 FR-013 and FR-015 (no "dots": there are no dotted notes), spec 003 FR-032 (brackets move under the tab only on a staff that draws rhythm, inside the rhythm row below the beams; above otherwise), spec 008 FR-003 (say that "exactly as today" now holds for parts with no durations, and that the band's `pt-1` is dropped while rhythm is drawn, per Deviation 1). Fix every doubled `))`. Run `npm run check:notation-amendments` — review F6 (MAJOR), specs/005-rhythm-and-tempo/spec.md:228, specs/003-generalised-grouping/spec.md:217, specs/008-usability-polish/spec.md:176
- [x] T055 Adopt review-probes/INV-002-INV-019-beam-breaks-exhaustive.test.ts into `src/lib/rhythm/__tests__/` (it takes about 25s; trim the alphabet or the overlays if it slows `npm test` and the pre-commit hook noticeably, keeping every Brk member and both densities) — review INV-002, INV-019 (held)
- [x] T056 Adopt review-probes/INV-003-positions-vs-click.test.ts into `src/lib/rhythm/__tests__/` so INV-003 runs over every `notation-baseline` input as T005 promised — review INV-003 (held), FU4
- [x] T057 Adopt review-probes/INV-004-brackets-every-group-shape.test.tsx into `src/components/tab/__tests__/` (9 Grp shapes × rhythm/none × densities × single/wrapped, plus `aria-hidden` on every rhythm part) — review INV-004, INV-013 (held)
- [x] T058 Adopt review-probes/INV-010-symbol-contrast-tokens.test.ts into `src/components/tab/__tests__/` (`--text` against `--bg`, `--bg-raised` and `--selection` in both themes, and print) — review INV-010 (held)
- [x] T059 Adopt review-probes/INV-006-INV-007-INV-013-song-page.spec.ts into `e2e/` (Wid × View switched with no reload × Dens × Sz, beams across a connector gap, and the aria snapshot with and without durations). Keep its checks that a beamed connector and a widened column were actually measured — review INV-006, INV-007, INV-013 (held members)
- [x] T060 Adopt review-probes/INV-011-capture-transition-with-group.spec.ts into `e2e/` (first and last duration with a tuplet and with a plain group × Th; wrapped runs; columns' x and width unchanged) — review INV-011, INV-018 (held)
- [x] T061 After every other task in this phase, restore each file this branch modified to the line ending it has at HEAD (`git ls-files --eol` shows which: e.g. `TabStaff.tsx`, `ColumnInspector.tsx`, `duration-row.test.tsx` and eight e2e specs LF; `durations.spec.ts`, `usability-contrast.spec.ts`, `specs/007-usability-pass/spec.md` and `specs/003-generalised-grouping/spec.md` CRLF; `globals.css` LF and `CaptureScreen.tsx` CRLF, no longer mixed), and make the new files LF (`RhythmCell.tsx`, `glyphs.ts` and the CRLF `e2e/notation-*.ts`). Done when `git diff --stat` equals `git diff --stat --ignore-cr-at-eol` — review F7 (MAJOR), src/components/tab/TabStaff.tsx:1
- [x] T062 Guards: `npm run typecheck`, `npm run lint`, `npm test`, `npm run check:untouched-notation`, `npm run check:notation-amendments`, `npm run check:polish-amendments`, `npm run check:usability-amendments`, then `npm run build && npx playwright test e2e/notation-*.spec.ts e2e/polish-band-unchanged.spec.ts e2e/usability-height-budget.spec.ts --project=mobile --project=desktop`, plus the adopted specs. All green; then re-run `review-probes/` with `npx vitest run --config specs/009-rhythm-notation/review-probes/vitest.review.config.ts` and `npx playwright test --config specs/009-rhythm-notation/review-probes/playwright.review.config.ts`, which must now pass in full — review F1–F7

---

## Phase 9: Review remediation

**Purpose**: Close the one blocking finding of `review.md` (round 2). Round 1's fix for stacked flags (T052) kept a 2px gap between flags
(INV-009), but it pushed a thirty-second's flag stack out of the stem band at both ends (INV-008). Fix the flag geometry once, against both
invariants together. Do not trade one for the other again: a third round that fails either invariant will re-plan the flag geometry. Run every
command with `< /dev/null`, in the foreground, and never while a dev server holds `.next`.

- [x] T063 Adopt review-probes/INV-008-flags-clear-label-and-bracket.spec.ts into `e2e/` as a failing test first. Keep all three tests:
      - the song page on `mobile` and `desktop`;
      - capture on `mobile`, with the cursor at the end and on each labelled column;
      - the lowest fret label's pixel crop, 8/16/32 against a quarter.

      Keep its set: every Sym member alone under a two-digit fret on every string; a counted group still being built for each flag count;
      and the shuffle triplet (q, 8). Keep its stroke-inclusive ink measure, not the svg box. Confirm it FAILS today on "flag3 ink top …
      above the stem band" and "flag1 ink bottom … within 1px of bracket line top". Name the file in `docs/DECISIONS.md` under "009 —
      re-pinned tests". Review F1 (MAJOR), src/app/globals.css:445-456.
- [x] T064 Re-shape and re-space the staff flag as one change, so that a thirty-second's whole flag stack, strokes included, lies inside the
      stem band, from the lowest fret label's mask bottom to the stem's end (11.6px touch, 11.4px fine). The stack must also end at least
      1px above the bracket line (INV-008), and adjacent flags must keep at least 2px between strokes everywhere off the stem (INV-009,
      FR-027).

      The places to change:
      - `STAFF_FLAG` (src/components/rhythm/glyphs.ts:53): its path starts on the box's bottom edge, so half the stroke hangs below the
        stem;
      - `--rhythm-flag-step` (src/app/globals.css:83);
      - the `[data-part="flag"]` rule (src/app/globals.css:445-456).

      The measured budget: today's curve at a 6px step needs 18.5px. A straight flag 6px long that rises no more than about 1.2px, at a
      step of about 4.1px, fits in 11.6px. Do not lengthen the stem band in capture: there is 1.6px of slack (research R1).

      Then re-run, all green on `mobile` and `desktop`:
      - T063's spec;
      - `e2e/notation-flag-gaps.spec.ts`;
      - `e2e/notation-capture-height.spec.ts`;
      - `e2e/notation-symbols.spec.ts` (13 greyscale crops still pairwise distinct);
      - `e2e/notation-alignment.spec.ts`;
      - `e2e/notation-buttons.spec.ts`;
      - `npm test`, `npm run typecheck`, `npm run lint` and `npm run check:untouched-notation`;
      - both `review-probes/` configs:
        - `npx vitest run --config specs/009-rhythm-notation/review-probes/vitest.review.config.ts`;
        - `npx playwright test --config specs/009-rhythm-notation/review-probes/playwright.review.config.ts`.

      Record the new flag figures in `docs/DECISIONS.md` (009 T040's section). Review F1 (MAJOR), src/components/rhythm/glyphs.ts:53,
      src/app/globals.css:83, src/app/globals.css:445-456.

---

## Phase 10: Review remediation

**Purpose**: Close the one blocking finding of `review.md` (round 3). Round 2's flag fix holds (INV-008 and INV-009 on every surface), but
Phase 9 rewrote `docs/DECISIONS.md` from LF to CRLF, which undoes round 1's F7 fix (T061). Make line endings a guard that fails a command,
then restore the file. Write every file with LF: never through a text-mode Python `open(..., "w")` on Windows, and never with
`sed 's/$/\r/'`. Run every command with `< /dev/null`, in the foreground, and never while a dev server holds `.next`.

- [x] T065 Adopt review-probes/PLAN-line-endings-kept.sh as a project guard, as a failing check first. Either add it as
      `scripts/check-line-endings.sh` with `npm run check:line-endings`, or make it a step of `scripts/untouched-by-notation.sh`.
      It fails when:
      - a modified tracked file's working-tree ending differs from its index ending;
      - a new file under `src/`, `e2e/` or `scripts/` holds a CR;
      - `git diff --stat` differs from `git diff --stat --ignore-cr-at-eol`.

      Confirm it FAILS today on `docs/DECISIONS.md` (index lf, working tree crlf). Name it in `docs/DECISIONS.md` under "009 —
      re-pinned tests" as a new guard. Review F1 (MAJOR), docs/DECISIONS.md:1.
- [x] T066 Restore `docs/DECISIONS.md` to LF. Remove the CR from every line and change nothing else, e.g.
      `sed -i 's/\r$//' docs/DECISIONS.md`. Done when:
      - `git ls-files --eol docs/DECISIONS.md` shows `i/lf w/lf`;
      - `git diff --stat docs/DECISIONS.md` shows 43 insertions and 0 deletions;
      - `git diff --stat` equals `git diff --stat --ignore-cr-at-eol`;
      - T065's guard and `npm run check:notation-amendments` pass.

      Review F1 (MAJOR), docs/DECISIONS.md:1, tasks.md T061.
- [x] T067 Adopt review-probes/INV-008-INV-009-flags-every-surface.spec.ts into `e2e/` (e.g. as `e2e/notation-flags-every-surface.spec.ts`).
      Its set:
      - song expanded and compact, the play view, print of the song page and of the play view, and capture with the cursor at the end
        and on each labelled column;
      - each × `mobile` and `desktop`.

      Keep its counts: they prove flags under a bracket, stacked flags, and both lowest-label cases were measured. Review INV-008,
      INV-009 (held).
- [x] T068 Add review-probes/INV-010-lone-symbols-screens.spec.ts's set to `e2e/notation-screens.spec.ts`: every Sym member alone in its
      beat, and a beamed pair beside each flagged duration. Then the screenshots T043 and T044 read show a flag. Today every 8th, 16th and
      32nd that spec draws is beamed. Review INV-010 (held), NOTE F2.
- [x] T069 Guards, all green on `mobile` and `desktop`:
      - `npm run typecheck`, `npm run lint`, `npm test`;
      - `npm run check:untouched-notation`, `npm run check:notation-amendments`, `npm run check:polish-amendments`,
        `npm run check:usability-amendments`, and T065's guard;
      - `npm run build`, then `npx playwright test e2e/notation-*.spec.ts e2e/polish-band-unchanged.spec.ts
        e2e/usability-height-budget.spec.ts --project=mobile --project=desktop`;
      - both `review-probes/` configs, and `bash specs/009-rhythm-notation/review-probes/PLAN-line-endings-kept.sh`, which must now exit 0.

      Review F1.
