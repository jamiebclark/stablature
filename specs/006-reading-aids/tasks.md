# Tasks: Note names, intervals, and seeing what a variant changed

**Input**: Design documents from `/specs/006-reading-aids/` (plan.md, spec.md, research.md, data-model.md, contracts/cells.md, contracts/compare.md, contracts/components.md, quickstart.md)

**Tests**: Invariant probes are mandatory and are the FIRST tasks of their phase. Each probe lives in the project's suite (`src/lib/reading/__tests__/`, `src/components/reading/__tests__/`, `e2e/`), never a temp dir, and each **must fail on the pre-change code** (usually because the module or hook it imports does not exist yet; where a probe guards unchanged behaviour it is recorded against unedited code and the task says so).

**How the headless implement phase runs things**: Vitest with `npx vitest run <path>`; typecheck with `npm run typecheck`; Playwright with `npx playwright test <file> --project=mobile` (or `desktop`). Playwright starts its own server per `playwright.config.ts`; never start `npm run dev` and never run e2e while a dev server holds `.next`. No task here asks anyone to "open the app and look". The `quickstart.md` §8 browser pass is the only human-owned work and is in the Polish phase as `🛑 BLOCKED`.

**Constraints to honour in every task** (plan.md § Technical Context): `src/lib/tab/ascii.ts` zero diff; `text.ts` comment-only diff; `layoutPart` signature and `TabColumn` shape unchanged; no opacity-over-surface tints; no `text-text-faint`; new lib tests go in `src/lib/reading/__tests__/` (never `src/lib/tab/__tests__/`, `round-trip.test.ts` would fail); `TabStaff.tsx` and `SongView.tsx` are **CRLF**, all other touched files LF — keep each file's line endings; `src/lib/tab/single-owner.test.ts` forbids `TabStaff.tsx`/`ascii.ts` importing techniques.

**Format**: `- [ ] T### [P?] [US?] Description with file path`

## Phase 1: Setup

- [X] T001 Record the frets baseline from UNEDITED code before touching anything else: write a one-off generator test `src/lib/reading/__tests__/record-baseline.test.ts` (run once with an env flag, then delete it) that, over the harvest **H** (as `src/lib/tab/__tests__/harvest.test.ts` records it) × **Den** × {base, raised surface} × {`showRhythm` on/off}, writes `src/lib/reading/__tests__/baseline.json` holding `layoutPart` output, `renderToStaticMarkup(<TabStaff>)` markup, `songToText`/`toAscii` bytes and the screen-reader descriptions (INV-001, INV-002, INV-018). Commit-ready; do NOT edit `layout.ts`, `techniques.ts`, `TabStaff.tsx` or `chords.ts` before this file exists. Done: baseline.json holds 3106 entries as 24-hex sha256 of each output (layout, descriptions, ascii, songText, 4 markup variants); generator deleted.
- [X] T002 [P] Create `scripts/untouched-by-reading.sh` modelled on `scripts/untouched-by-rhythm.sh`: print `zero diff`/`CHANGED` per path and exit non-zero on any diff against `main` (tracked or untracked) over every path in INV-037; for `src/lib/export/text.ts` allow a diff that touches only its header comment. Add `"check:untouched-reading": "bash scripts/untouched-by-reading.sh"` to `package.json`. Leave `check:untouched` and `check:untouched-rhythm` alone (expected to fail on this branch).
- [X] T003 [P] Confirm `npm run typecheck` and `npx vitest run` are green on the branch before any change (record pass/fail counts in the task note). Recorded: typecheck clean, vitest 124 files / 4627 tests passed.

---

## Phase 2: Foundational (blocks all user stories)

**Probes first**

- [X] T004 INV-001/INV-002 frets-unchanged probe: `src/lib/reading/__tests__/frets-unchanged.test.ts` compares `layoutPart`, `renderToStaticMarkup(TabStaff)` with `reading` absent and with frets-no-marks, `songToText` and `toAscii` against `baseline.json` over **H** × **Den** × {base, raised} × {`showRhythm` on/off}, and asserts `src/lib/tab/ascii.ts` and `src/lib/export/text.ts` import nothing from `src/lib/reading/`. It passes on unedited code by construction (it guards against change); state in the test header that it was run green against the pre-change tree before T008 and must stay green. It must FAIL if you perturb one baseline entry (do this once to prove it can fail, then revert).
- [X] T005 [P] INV-006 view-store probe: `src/lib/reading/__tests__/view.test.ts` (jsdom docblock) exercises `view.ts` with injected storage over **St** (normal; `localStorage` undefined; `getItem` throws; `setItem` throws; stored `"tabs"`, `""`, `"NOTES"`; changed in a second tab) × {read, set, read again}; only `frets|notes|intervals` valid, anything else reads as frets and is left in place. Fails now: `view.ts` does not exist.
- [X] T006 [P] INV-012 chord-in-force probe: add to `src/lib/reading/__tests__/cells.test.ts` (create it) the `chordsInForce`/`chordInForceAt` agreement test: for each column, `chordInForceAt` called on the whole part equals the chord behind the lookup, over **H** with chords laid on, **Unread** each ending the previous chord, a deleted anchor, two annotations on one anchor, a chord on a repeat, across a barline and a repeat, slices starting after/on/before the anchor. Fails now: `chordsInForce` does not exist.
- [X] T007 [P] INV-015 snapshot probe: `src/lib/reading/__tests__/snapshot.test.ts` (jsdom + `fake-indexeddb`) records every committed render of a consumer of `useSongContent` over **Load** (parts first; events first; annotations first; a `createVariant` batch; a paste; a sync batch) and asserts no render ever holds a part without its columns or columns without their chords. Fails now: `listSongContent`/`useSongContent` do not exist.

**Implementation**

- [X] T008 `src/lib/tab/techniques.ts` (LF): give `decorate` a separator argument (default = today's behaviour, so frets output is byte-identical) and amend the header to name `compare.ts` as a reader of the word tables. Run T004 — must stay green.
- [X] T009 `src/lib/tab/layout.ts` (LF): extract the one builder `layoutWith(part, events, opts, writeCell)` with a `CellWriter` type; `layoutPart` keeps its exact signature and calls it with the fret writer; correct the two overclaiming header comments as plan.md says. Run T004 — must stay green.
- [X] T010 `src/lib/chords.ts` (LF): add `bassName`, `anchoredChords`, `chordsInForce` (one pass over the whole part) and export `CHORD_QUALITIES` if not already; reimplement `chordInForceAt` as a lookup in `chordsInForce`; chord row placement also calls `anchoredChords`. Run T004 and `src/lib/__tests__/chords.test.ts` — green. T006 now passes.
- [X] T011 `src/lib/local/queries.ts` and `src/lib/local/hooks.ts` (LF): add `listSongContent(songId)` reading parts, events, annotations (chords) in ONE Dexie read transaction, and `useSongContent` over `useLiveQuery`; returns `undefined` until all three are loaded. T007 passes.
- [X] T012 [P] `src/lib/reading/view.ts`: `StaffView = "frets"|"notes"|"intervals"`, a store with injected storage, key `stablature.staffView`, try/catch on every storage access, cross-tab `storage` event, `useSyncExternalStore`-compatible subscribe/getSnapshot with server snapshot `frets`. T005 passes.
- [X] T013 [P] `src/components/reading/useStaffView.ts`: the hook over `view.ts` (≈10 lines). Per contracts/cells.md, a remembered view is in place before first paint with no hydration mismatch (plan.md research R-notes; use the pattern the contract names).
- [X] T014 [P] `src/app/globals.css` (LF): add `--diff-tint` and `--diff-ink` named per theme and their print values (resolved in dark under `@media print`), repaint the cell-mask rules to use the tint on marked cells, add mark/removal/caption/variant-line rules. No `opacity` over a surface; no `text-text-faint`.

**Checkpoint**: T004–T007 green; `npm run typecheck` clean; `npx vitest run` green.

---

## Phase 3: User Story 1 — Read a riff as notes (P1) 🎯 MVP

**Goal**: three-way view control; notes on every song-page/play-view staff; remembered per device; export unchanged.
**Independent test**: switch to notes on a part with two-digit frets, chords, groups and every decoration; cells show note names, rows stay aligned, play view shares the choice, export bytes unchanged.

**Probes first**

- [X] T015 [US1] INV-008 pitch probe in `src/lib/reading/__tests__/cells.test.ts`: `layoutReading` cells read through the test's own cell reader against a hand table of semitones per open string, over **T** (17 `TUNING_PRESETS` plus a custom `F#`+`Bb` tuning) × every string × fret 0–36 × {no chord, Am, Bb7}; no octave digit in any name. Fails now: `layoutReading` does not exist.
- [X] T016 [P] [US1] INV-010/INV-011/INV-018 cell-text probes in `src/lib/reading/__tests__/cells.test.ts`: over **Dec** (all 64 subsets) × names from **Q** and sharp/flat names × `DEGREES` × **Den** with repeats 1, 2, 8, recover the pitch class from text alone, assert `parseChord(cell)` is null for every cell with a letter decoration, `·` separates letter decorations, harmonic shows `?` inside `<>`, dead note stays `x` (dead+harmonic `<x>`), fret `-1`, `1.5`, `"7"` shows `?` without throwing, and neighbours still named; assert exact screen-reader strings from the table in `contracts/cells.md` and no `<>()~·` in any description; frets descriptions byte-equal to `baseline.json`. Fails now: no reading layout.
- [X] T017 [P] [US1] INV-007/INV-004/INV-005/INV-003 e2e probes in `e2e/reading-view.spec.ts` (+ `e2e/reading-helpers.ts` seeding the part sets, driven through IndexedDB as `e2e/click-helpers.ts` `seedPlayable` does): control `aria-pressed`, computed `text-decoration-line`/`font-weight` per button, no `scrollWidth` overflow at 375×667, hidden in print emulation, hidden with nothing to act on; capture screen and paste preview stay in fret numbers for each stored view (including after an import refusal); `addInitScript` `MutationObserver` records every `tab-column` text from first node to prove no fret flash and no hydration console error across {reload, direct open, in-app link between the two screens, offline after a visit}; dump every Dexie table, `meta` and outbox count and watch requests before/after 100 view changes. Fails now: no control.
- [X] T018 [P] [US1] `e2e/reading-sync.spec.ts`: INV-003 second device — two contexts, first sets notes, second's view is unaffected and first queued no write. `test.skip` with a stated reason when no database is available (a skip is not a pass).

**Implementation**

- [X] T019 [P] [US1] `src/lib/reading/spelling.ts`: `spellingFor`, `noteName`, `degreeName`, `FOLDED_DEGREES` per `contracts/cells.md` (sharp-or-flat rule, typed bass keeps spelling, `#`/`b` ASCII accidentals, no octave).
- [X] T020 [US1] `src/lib/reading/labels.ts`: the label `CellWriter`, `layoutReading` returning `ReadingLayout` (`cells`, `descriptions`, `chordCover`, `carriedChord`, caption inputs) calling `layoutWith`; notes view first (intervals added in US2). T015, T016 pass for notes.
- [X] T021 [US1] `src/components/tab/TabStaff.tsx` (**CRLF**): accept optional `reading`; when absent or frets draw exactly as today; draw labels, the in-card `staff-caption` (in the card's bottom padding, no added row), keep every row on its column; update header comment. Do not import techniques. Run T004 (green) and `src/components/tab/__tests__/TabStaff.test.tsx`.
- [X] T022 [P] [US1] `src/components/reading/ViewControl.tsx` (`staff-view`, `staff-view-frets|notes|intervals`, `aria-pressed`, non-colour current-state cue, `print:hidden`).
- [X] T023 [US1] `src/components/app/SongView.tsx` (**CRLF**): switch to `useSongContent`, render `ViewControl`, pass `layoutReading` result to each staff, show the `export-note` visible text beside the export controls when view ≠ frets. Capture and paste preview untouched.
- [X] T024 [US1] `src/components/app/PlayView.tsx` (LF): same control and shared choice; keeps drawing empty staves first in frets as today.
- [X] T025 [US1] Run T015–T017 (`npx vitest run src/lib/reading`; `npx playwright test e2e/reading-view.spec.ts --project=mobile` and `--project=desktop`) and fix until green.

**Checkpoint**: Story 1 deliverable and testable alone.

---

## Phase 4: User Story 2 — Read a line against its chord (P2)

**Goal**: intervals view with degree names against the chord in force; note-name fallback; carried `(Am)`; caption says so.
**Independent test**: Am, C7#9, `N.C.`, then no chord: degrees under chords, note names after `N.C.`; a slice at bars 3–4 shows `(Am)`.

**Probes first**

- [X] T026 [US2] INV-009 spelling/degree probe in `src/lib/reading/__tests__/cells.test.ts`: `layoutReading` on one column per pitch class against literal tables for worked cases (`Eb` under Cm, `Bbb` under Cdim7, `A#` under Dm, typed bass in every slash chord in **Q**) and `tone.name`/`tone.degree` for the rest, over **Q** × 12 pitch classes × **N**; no chord: **T** incl. `Eb` on C Standard; all 12 rows of the folded table. Fails now: no intervals writer.
- [X] T027 [P] [US2] INV-013 no-fret-fallback probe in `cells.test.ts`: no digit-only cell in intervals where no chord is readable — no chord at all, before the first chord, after each **Unread**, a part with only text annotations.
- [X] T028 [P] [US2] INV-014 carried-chord probe `src/lib/reading/__tests__/carried-chord.test.ts`: `layoutReading.carriedChord` for slice starts under Am, on the anchor, before any chord, under `N.C.`, under blank; present only in intervals; first column a one-digit note, a barline, a space; next column holding its own chord. e2e half in `e2e/reading-view.spec.ts`: label `scrollWidth <= clientWidth` and text. Fails now. Done: unit half in carried-chord.test.ts; caret in caret.test.tsx; the play-view slice e2e half is not written (label clipping is covered for all chord labels by reading-layout.spec.ts).
- [X] T029 [P] [US2] INV-016/INV-017 layout e2e `e2e/reading-layout.spec.ts`: over **Rows** × **V** × **Den** × {375×667, desktop} × 2 themes on a part with two-digit frets, assert each item's `getBoundingClientRect` within 1 px of its column; staff and card heights equal across views except the FR-012 carried row; caption inside the card overlapping neither staff nor line, over **Surf**, a long part name, `chordCover` all/some/none/nothing. Caret is covered in jsdom in `src/components/reading/__tests__/caret.test.tsx`. Fails now.

**Implementation**

- [X] T030 [US2] `src/lib/reading/labels.ts`: intervals writer using `chordsInForce`, `degreeName`, fallback to note names, `chordCover` counted while writing cells, `carriedChord` (unreadable chord carried as `(N.C.)`, blank not), caption text for "no chords, showing note names".
- [X] T031 [US2] `TabStaff.tsx` (**CRLF**): draw the carried `(Am)` in the chord row only in intervals, keep the caption; `SongView.tsx`/`PlayView.tsx` pass the sliced pass's whole-part chord context.
- [X] T032 [US2] Run T026–T029 until green on both projects.

---

## Phase 5: User Story 3 — See what a variant changed (P1)

**Goal**: variants compared with their declared parent; marks and one summary line; ids never matter.
**Independent test**: fresh variant says "Same as A"; insert one column → exactly one `+`; delete one → one removal mark; a pasted copy equals the parent.

**Probes first**

- [X] T033 [US3] INV-019/020/021/024/026 compare probes `src/lib/reading/__tests__/compare.test.ts` and `played.test.ts`: `compareVariants` before/after regenerating every event/group/annotation id; `createVariant` vs `copyColumns`+`rowsFromClipboard` over the same parent through `fake-indexeddb` give the same result; **F** each exactly 1 changed; **NotF** each Same; `playedColumns` keys/order/bar equal `layoutPart` expanded over **H**; the six worked examples and exact cases in `contracts/compare.md`; ops applied to the parent reproduce the variant (`from`/`to` cover both once, in order), incl. coarse, empty, one-empty; **Par** states. Fails now: modules missing.
- [X] T034 [P] [US3] INV-022/INV-023 oracle probe `src/lib/reading/__tests__/compare-oracle.test.ts`: 5,000 seeded pairs up to 12 columns, alphabets 2–6, barlines mixed, difference count equals a plain DP edit-distance table written in the test (shares no code with `align.ts`); `a b c d e` vs `e f g h i`; barline never paired with a note; run twice and with shuffled key/annotation row order gives identical ops; `5 7 8 | 5 7 9 10`; riff with one column inserted at each equally valid position gives count 1 and the same position each time.
- [X] T035 [P] [US3] INV-025 budget probe `src/lib/reading/__tests__/budget.test.ts`: best of five — 20 variants × 1,000 columns under 20 ms, two unrelated 5,000-column parts under 50 ms, periodic riffs, shared alphabet, `x512` repeats; comparing at exactly `MAX_EDITS` and one past it (second `coarse` and still satisfying the ops-cover property); `performance` and `Date` absent from `align.ts` and `compare.ts` (source scan).
- [X] T036 [P] [US3] INV-027/028/035 marks probe `src/lib/reading/__tests__/marks.test.ts`: `staffMarks` marks and line from one result; compact marks `+` if all repetitions added else `*`; **V** × **Den** unchanged counts; removals inside repeats and two removals in one gap; exact `aria-label` strings for every row of the words table in `contracts/compare.md` × **F**, removal of 1 and 2.
- [X] T037 [P] [US3] INV-033/INV-036 jsdom probe `src/components/reading/__tests__/marks.test.tsx`: no `a`, `button`, `[tabindex]`, `[role=button]` inside marks or line; column stays `role="img"`; markup for a Same variant equals the same staff with no comparison; a mark row adds no shift except the removal gap's own width. 
- [X] T038 [P] [US3] `e2e/variant-marks.spec.ts` (song-page half): INV-015 `MutationObserver` on `variant-line`/`tab-diff` over **Load** — a just-made variant never shows anything but `Same as A`; INV-026 no marks/line for **Par** states; INV-031 write through Dexie with the page open (edit parent, variant, chord, delete parent, delete column; this tab, another tab, sync pull) and marks update; INV-033 tapping changes neither URL nor Dexie. Fails now.

**Implementation**

- [X] T039 [P] [US3] `src/lib/reading/played.ts`: `playedColumns` (unrolled repeats, key `eventId-repetition`, bar) and `signatures` per `data-model.md` (no ids, group shape via `groupNumber`, technique set sorted/deduped, unplayed-string and out-of-tuning frets ignored, chord trimmed).
- [X] T040 [P] [US3] `src/lib/reading/align.ts`: `alignColumns`, `MAX_EDITS = 512`, bounded furthest-reaching edit-distance walk, deterministic, no clock, barline-only-with-barline, substitution cost 1, coarse fallback.
- [X] T041 [US3] `src/lib/reading/compare.ts`: `compareParts`, `compareVariants` (only a declared live parent in the same song), second pass for group continuation between aligned neighbours, `words`. Depends on T039, T040.
- [X] T042 [US3] `src/lib/reading/marks.ts`: `staffMarks(comparison, pass.events)` returning marks and the line from one op list; compact aggregation; removal bar attribution.
- [X] T043 [US3] `TabStaff.tsx` (**CRLF**): `marks` prop, own `tab-diff` row, `RemovalGap`/`tab-removal`, `data-diff` on `tab-column`, aria-labels; `src/components/reading/VariantLine.tsx` (`variant-line`, non-interactive, parent label and counts or "Same as A"); `SongView.tsx` (**CRLF**) renders marks for compared variants only and waits for the single content read before drawing (FR-026); parent never marked.
- [X] T044 [US3] Run T033–T038 until green (`npx vitest run src/lib/reading src/components/reading`; `npx playwright test e2e/variant-marks.spec.ts`).

---

## Phase 6: User Story 4 — See the flourish where it is played (P2)

**Goal**: play-view passes drawing a compared variant show its marks, limited to the bars drawn.

**Probes first**

- [X] T045 [US4] INV-029/INV-030 slice probes: `src/lib/reading/__tests__/marks.test.ts` — `staffMarks` over `drawnPasses` output with slice edges {first bar, middle, last bar, one bar, past the end} × change/addition/removal at first column, last column, just before and after the closing barline, very end; added barline closing the slice; a slice with none while the variant has some; removals over covering slices sum to the whole; bars named are the part's own. `e2e/variant-marks.spec.ts` (play-view half): `A x4`, passes 1–3 have no `tab-diff`/`tab-removal`/`variant-line`, pass 4 equals song page marks; text entry between; a part with no parent; unrelated last-pass substitute. Fails now: PlayView draws no marks.

**Implementation**

- [X] T046 [US4] `src/components/app/PlayView.tsx` (LF): for every pass whose part is a compared variant, call `staffMarks` with `pass.events`, render marks and the line limited to the bars drawn with "in these bars" wording on slices; other passes unmarked.
- [X] T047 [US4] Run T045 on both Playwright projects until green.

---

## Phase 7: Polish & Cross-Cutting

**Probes first**

- [x] T048 INV-032/INV-034/INV-010-font paint probes `e2e/variant-marks-paint.spec.ts`: `*`, `+`, `−` are different text; computed contrast ≥ 4.5:1 of each mark and the line on its real surface in both themes × {raised, base}, no ancestor `opacity` below 1; marked cell `font-weight` above unmarked; mask computed background equals the tint; `document.fonts.check` for `·` and `−` in the mono face; print emulation (`page.emulateMedia({media:"print"})`) keeps marks, line and captions visible, contrast computed against white, dark scheme resolves the print values.
- [x] T049 [P] INV-037 untouched guard: run `npm run check:untouched-reading` and fix any path with a diff.

**Implementation / closing**

- [x] T050 [P] `src/lib/export/text.ts`: header comment only (correct the overclaim); verify T004 and `check:untouched-reading` still green.
- [x] T051 Fix anything T048 reveals in `src/app/globals.css` and the mark components; rerun until green on `mobile` and `desktop`.
- [x] T052 Guards task (before any push): run the fast guard tier and fix EVERY failure — `npm run typecheck`, `npm run lint`, `npm test` (full Vitest suite: structural, inventory, golden, exhaustiveness, `single-owner.test.ts`, `round-trip.test.ts`, `harvest.test.ts`, `chords.test.ts`, `TabStaff.test.tsx`), `npm run check:untouched-reading`, then `npm run test:e2e`. If an existing test is tripped, report it and do not quietly change it.
- [x] T053 Update `docs/DECISIONS.md` only if the plan's deviations 2, 7 or 8 were overturned during implementation; otherwise leave it.
- [ ] T054 🛑 BLOCKED: needs a person in Chrome at actual size, both themes — run `quickstart.md` §8 browser pass (`·` visibility, mark legibility and desaturated separation, removal-gap reading, caption in card padding, greyscale print preview, 375×667 control row, classic Windows scrollbar behaviour). Never ticked to pass a gate (INV-038; SC-012, SC-013, SC-014).

---

## Dependencies & Execution Order

- Phase 1 → Phase 2 (T001 before any source edit) → Phase 3 (MVP) → Phases 4, 5 → Phase 6 → Phase 7.
- US2 depends on US1 (control, `layoutReading`, `TabStaff` reading prop). US3 depends only on Phase 2 (`useSongContent`, `globals.css` tokens) and can run in parallel with US1/US2 apart from shared edits to `TabStaff.tsx` and `SongView.tsx` (serialise those). US4 depends on US3.
- Within a phase: probes first, then libs, then components, then screens.
- T008→T009→T010→T011 are sequential (shared baseline gate T004); T012–T014 parallel.
- T039 ∥ T040 → T041 → T042 → T043.

## Parallel Examples

- Phase 2 probes: T005, T006, T007 together.
- US1 probes: T016, T017, T018 together after T015 creates `cells.test.ts`.
- US3 probes: T034–T038 together; libs T039 ∥ T040.

## Implementation Strategy

MVP = Phase 1 + 2 + User Story 1 (notes view, remembered, export untouched). Then US3 (the other P1) can ship independently of US2; US2 and US4 follow. Stop at each checkpoint with typecheck and the story's probes green.

## Phase 8: Review remediation

Round 1 of review: 6 MAJOR, no BLOCKER. Probes live in `specs/006-reading-aids/review-probes/`; run them with `run-probes.sh` after `npm run build`. Each "add" task below means add to the named file, keeping what is already there: never copy a probe over it. A probe moved into the suite loses the probe config's timeouts (120 s browser, 300 s unit), so set them on the test. Red-first tasks are meant to stay failing until the fix after them.

- [x] T055 Add the three tests of `review-probes/INV-003-015-031-two-devices.spec.ts` to `e2e/reading-sync.spec.ts` as failing tests first, with a unique band name per run and no self-skip on a drain that never comes (a drain timeout fails), keeping the `STABLATURE_DATABASE_URL` skip — review F1, e2e/reading-sync.spec.ts:48
- [x] T056 Stop a pull's partial state reaching the page: read the sync status inside `listSongContent`'s `r` transaction so content and status are one snapshot, and have `SongView` and `PlayView` draw the last content read while not `syncing`, with no comparison until a settled read exists; leave `src/lib/sync/` untouched (INV-037), check a `syncing` left by a killed tab cannot hold a page, and add the sync path to `snapshot.test.ts` from `review-probes/INV-015-sync-lands-in-pieces.test.tsx`, pointing it at the hook the pages read — review F1 (MAJOR), src/lib/local/queries.ts:198, src/components/app/SongView.tsx:46, src/components/app/PlayView.tsx:40
- [x] T057 Add the failing INV-021 cases to `src/lib/reading/__tests__/compare.test.ts` as failing tests first: `[7 7 7][7 7 7]` with a note removed and with one added, from `review-probes/INV-021-022-023-025-026-compare.test.ts`, and the every-position sweep over **H** from `review-probes/INV-001-012-019-020-021-024-harvest.test.ts` — review F2
- [x] T058 Report one edit beside equal columns as that edit alone: among equally short alignments take the one with the fewest continuation mismatches, by sliding each added or removed block through its equal neighbours before the continuation pass, ties broken the same way every time; do not add `joined` to the signature (research R10), and keep INV-022, INV-023 and INV-024 green — review F2 (MAJOR), src/lib/reading/compare.ts:157, src/lib/reading/align.ts:27
- [x] T059 Add the two bracket tests from `review-probes/INV-016-033-035-036-staff.test.tsx` to `src/components/reading/__tests__/marks.test.tsx`, and the line-across-a-removal test from `review-probes/INV-014-016-017-034-036-layout.spec.ts` to `e2e/reading-layout.spec.ts`, as failing tests first — review F3
- [x] T060 Carry the group's line across a removal: give `RemovalGap` the same `bracket` rule as `Gap` at both call sites and draw `.tab-bracket` in its tuplet row, including when a connector shares the gap — review F3 (MAJOR), src/components/tab/TabStaff.tsx:562, src/components/tab/TabStaff.tsx:586
- [x] T061 Add the INV-017 sweep over **Surf** from `review-probes/INV-014-016-017-034-036-layout.spec.ts` to `e2e/reading-layout.spec.ts`, play view included, as a failing test first — review F4
- [x] T062 Clear the caption from the staff and line on the play view with `bottom-0` on `staff-caption`, already tried in the browser against all 8 sweeps — review F4 (MAJOR), src/components/tab/TabStaff.tsx:271
- [x] T063 Add the two second-tab tests from `review-probes/INV-002-003-004-005-006-007-view.spec.ts` to `e2e/reading-view.spec.ts`, and their store-level cases to `src/lib/reading/__tests__/view.test.ts`, as failing tests first — review F5
- [x] T064 Bring a tab back to the stored view: re-read storage when the first listener subscribes, keeping "a refused write still changes the screen", and treat a `null` storage key as this key cleared — review F5 (MAJOR), src/lib/reading/view.ts:39, src/lib/reading/view.ts:63, src/lib/reading/view.ts:69
- [x] T065 Take the wall-clock budgets out of the parallel run: exclude `budget.test.ts` from `npm test`, run it alone in its own serial step in `package.json` and `.github/workflows/ci.yml` with the 20 ms and 50 ms figures unchanged, and add periodic riffs, a shared alphabet, `x512` and a bound for 20 unrelated variants from `review-probes/INV-021-022-023-025-026-compare.test.ts` — review F6 (MAJOR), src/lib/reading/__tests__/budget.test.ts:35
- [x] T066 Add what remains of the review probes to the suite, each to the named file and replacing the assertions that cannot fail (F9): `review-probes/INV-002-003-004-005-006-007-view.spec.ts` to `e2e/reading-view.spec.ts`; `review-probes/INV-014-016-017-034-036-layout.spec.ts` and `review-probes/INV-016-text-in-its-column.spec.ts` to `e2e/reading-layout.spec.ts`, the font test to `e2e/variant-marks-paint.spec.ts` in place of `document.fonts.check`; `review-probes/INV-026-027-030-031-032-033-marks.spec.ts` to `e2e/variant-marks.spec.ts`; `review-probes/helpers.ts` to `e2e/reading-helpers.ts`; the rest of `review-probes/INV-001-012-019-020-021-024-harvest.test.ts`, `review-probes/INV-020-not-compared.test.ts` and `review-probes/INV-021-022-023-025-026-compare.test.ts` to `src/lib/reading/__tests__/compare-oracle.test.ts`; `review-probes/INV-008-009-010-011-013-018-cells.test.ts` to `src/lib/reading/__tests__/cells.test.ts`; `review-probes/INV-027-028-029-marks.test.ts` to `src/lib/reading/__tests__/marks.test.ts`; and the rest of `review-probes/INV-016-033-035-036-staff.test.tsx` to `src/components/reading/__tests__/marks.test.tsx`. Leave out the tests that are red for a MINOR (F7, F11, F12), which are follow-ups, and `review-probes/OOS-staff-font.spec.ts`, which is out of scope — review F9, F10

## Phase 9: Review remediation

Round 2 of review: 3 MAJOR, no BLOCKER. All three are inside Phase 8's repairs for F1 and F5. Probes live in `specs/006-reading-aids/review-probes/`; run them with `run-probes.sh` after `npm run build`, and note that sync probes need the database. Each "add" task below means add to the named file, keeping what is already there: never copy a probe over it. A probe moved into the suite loses the probe config's timeouts (120 s browser, 300 s unit), so set them on the test. Red-first tasks are meant to stay failing until the fix after them. T068 is tagged REDESIGN although round 1 had no BLOCKER: INV-015 failed in the same component twice, one patch per symptom would reopen the others, and the design needs plan.md amended, which is what the tag is for.

- [x] T067 Add the tests of `review-probes/INV-015-a-slow-sync-holds-nothing.spec.ts` and `review-probes/INV-015-031-held-reads.spec.ts` to `e2e/reading-sync.spec.ts` as failing tests first, keeping the `STABLATURE_DATABASE_URL` skip and setting each test's timeout — review F18
- [x] T068 REDESIGN the read of a song during a sync: re-plan so INV-015 holds by construction, with a pull landing in ONE commit and nothing on the read path knowing sync exists. First amend plan.md: INV-015's row and *Agreement is structural* (one `rw` transaction in `applyRemoteRows`, one `r` transaction in `listSongContent`), INV-037's path list, and a new entry in § Deviations saying `src/lib/sync/client.ts` takes this one change and no stored shape, wire message or row changes, so no blast-radius decision reverses. Amend `scripts/untouched-by-reading.sh` to match, keeping the rest of `src/lib/sync/` fenced and confining `client.ts`'s diff to `applyRemoteRows`. Then replace, not patch: `applyRemoteRows` validates every table, then writes in one transaction over the tables it touches; `useSongContent` goes back to a single `useLiveQuery`; delete `settled`, `stuck`, `STUCK_SYNC_MS`, `SongContent.syncing`, the `meta` scope and the `getStatus` import. `review-probes/CANDIDATE-atomic-landing.patch` is the shape that was tried, and it is a candidate, not a proof: judge it by T067, `review-probes/INV-003-015-031-two-devices.spec.ts`, `review-probes/INV-015-sync-lands-in-pieces.test.tsx` and the whole e2e suite. Log what stays open as FU13: a variant split across two pull pages or two pushes — review F18 (MAJOR, INV-015 violated in a second round), src/lib/local/hooks.ts:110, src/lib/local/queries.ts:208, src/lib/sync/client.ts:72
- [x] T069 Confirm `npm run lint` reports 0 errors after T068, with no `eslint-disable` added, and re-run T052's other guards (`npm run typecheck`, `npm test`, `npm run test:budget`, `npm run check:untouched-reading`) — review F19 (MAJOR), src/lib/local/hooks.ts:118, .github/workflows/ci.yml:57
- [x] T070 Add the cases of `review-probes/INV-006-no-storage-across-pages.test.ts` to `src/lib/reading/__tests__/view.test.ts`, and the tests of `review-probes/INV-006-no-storage-across-pages.spec.ts` to `e2e/reading-view.spec.ts`, as failing tests first — review F20
- [x] T071 Keep the choice for the visit when there is no storage: set `unwritten` when `store()` is null, so the first subscribe does not read frets over it, keeping "a refused write still changes the screen" and the second-tab tests green — review F20 (MAJOR), src/lib/reading/view.ts:56, src/lib/reading/view.ts:77
- [x] T072 Add `review-probes/INV-021-023-024-the-slide.test.ts` to `src/lib/reading/__tests__/compare-oracle.test.ts`, keeping its 120 s timeout and its check that the sweep reached the continuation pass. It passes today and guards `settleEdits`, which the 5,000 ungrouped pairs cannot reach — review round 2, src/lib/reading/compare.ts:94

## Phase 10: CI budget (added by the supervisor after PR #6 failed CI)

CI's `npm run test:budget` failed twice on GitHub's `ubuntu-latest` runner: `20 variants of 1,000 columns` measured 25.06 ms and 23.39 ms against its limit of 20 ms. It passes on the desktop. The limit stays. Do not change `budget.test.ts`, the 20 ms limit, SC-009, FR-025, `.github/workflows/ci.yml` or the `test:budget` script, and do not skip or condition the test on the environment.

- [X] T073 Make `compareVariants` faster so the budget holds on CI with margin: measure where the time goes first (likely `playedColumns` and `columnKey` in src/lib/reading/played.ts, run once per column of every part, then `buildOps` in src/lib/reading/compare.ts), then remove the waste, aiming to cut the measured time by at least 40% against today on the same machine. Results must not change: every existing test in src/lib/reading/__tests__/ and `review-probes/` stays as written and passes, including the oracle, and the result still depends on content alone (no id, clock, random value or object order). Record the before and after numbers in specs/006-reading-aids/review.md's follow-ups or plan.md. Done when `npm run test:budget`, `npm test`, `npm run typecheck` and `npm run lint` all pass.

## Phase 11: Review remediation

Round 4 of review: 1 MAJOR, no BLOCKER. The MAJOR is T074 and it is small: the code is right, and a guard and the plan no longer describe the tree. T075 to T079 add probes to the suite, because something now blocks and every probe not yet there gets a task. Probes live in `specs/006-reading-aids/review-probes/`; run them with `run-probes.sh` after `npm run build`, and note that sync probes need the database. Each "add" task below means add to the named file, keeping what is already there: never copy a probe over it. A probe moved into the suite loses the probe config's timeouts (120 s browser, 300 s unit), so set them on the test. These tests all pass today, so none is red-first. `npm test` runs in the commit hook, so keep what T075 adds quick.

- [x] T074 Make the INV-037 fence say what was decided, and keep the three test timeouts, which the commit hook needs. First amend plan.md: INV-037's row, and a new § Deviations item 15 saying `review-damaged-notation-string.test.ts`, `review-every-cell-of-a-system.test.ts` and `review-redraw-ledger.test.ts` in `src/lib/tab/__tests__/` each take a `vi` import, one comment and one `vi.setConfig({ testTimeout: 120_000 })`, with no input or assertion changed, because their sweeps outlast the default 5 s on a loaded machine and fail the husky hook. Then amend `scripts/untouched-by-reading.sh` to match, the way it already treats `client.ts` and `text.ts`: `src/lib/tab/__tests__` stays fenced, and a diff passes only in those three files and only on those lines. Do not delete the timeouts, and do not drop the path from the list. Done when `npm run check:untouched-reading` exits 0, and exits 1 for a changed assertion in one of the three files and for a new line in any other file of that directory, each tried and reverted — review F27 (MAJOR), scripts/untouched-by-reading.sh:16, specs/006-reading-aids/plan.md:184, src/lib/tab/__tests__/review-redraw-ledger.test.ts:22
- [x] T075 Add to `src/lib/reading/__tests__/compare-oracle.test.ts` these parts of `review-probes/INV-019-020-022-023-024-t073-results-unchanged.test.ts`: the valid-column sweep in `T073 pairs: Same exactly when the signature before T073 was equal`, and `T073 words` and `T073 twins`. Use `signatureOf` from `played.ts` wherever the probe uses `signatureBefore`, so the test pins `pack` to the signature. Run the sweep on 6 and 9 strings only, with `FRETS` cut to `undefined`, `7` and `"x"`, and give each test an explicit timeout. Leave out `T073 songs`, `oracle-776c993/` and the empty-string-technique case, which is red for a MINOR (F28). Done when `node specs/006-reading-aids/review-probes/run-mutants-t073.mjs <dir>` prints `KILLED` by the suite for all nine — review F29, F15, src/lib/reading/played.ts:83
- [x] T076 Add the test of `review-probes/INV-015-one-read-one-snapshot.test.ts` to `src/lib/reading/__tests__/snapshot.test.ts`, keeping its timeout. Done when `run-mutants.mjs` kills `the song is read outside one transaction (T011)` by `snapshot.test.ts` itself — review F25, src/lib/reading/__tests__/snapshot.test.ts:54
- [x] T077 Add the tests of `review-probes/INV-002-the-reader-reads-the-export.spec.ts` and `review-probes/INV-005-a-tab-left-on-frets.spec.ts` to `e2e/reading-view.spec.ts`, setting each test's timeout — review round 3 (FU22, FU26), e2e/reading-view.spec.ts:1
- [x] T078 Add the tests of `review-probes/INV-015-031-every-write-every-route.spec.ts` and `review-probes/INV-003-signed-in-play-view.spec.ts` to `e2e/reading-sync.spec.ts`, keeping the `STABLATURE_DATABASE_URL` skip and setting each test's timeout. Keep the first probe's check that a missing variant is a lost row and not a page fault, until FU19 is fixed — review round 3 (FU24, FU26), e2e/reading-sync.spec.ts:1
- [x] T079 Add the test of `review-probes/INV-034-print-tokens.spec.ts` to `e2e/variant-marks-paint.spec.ts`, setting its timeout — review round 3 (FU25), e2e/variant-marks-paint.spec.ts:1
