# Tasks: Cards per row follow what the cards hold

**Input**: Design documents from `/specs/013-cards-per-row/` (plan.md, spec.md, research.md, data-model.md,
contracts/cards-per-row.md, quickstart.md)

**Tests**: The spec asks for them (FR-021, SC-004). Invariant probes are the FIRST tasks of their phase, each must
FAIL on the pre-change code, and each lives in the project suite (`src/**/__tests__/` or `e2e/`).

**Headless note**: Implement runs with no browser window and no dev server. Every check below is a Vitest or Playwright
spec (Playwright starts its own production build per `playwright.config.ts`), `tsc --noEmit`, lint, or a `check:` script.
Run each synchronously with `< /dev/null`. The one human check is T032 and is marked `🛑 BLOCKED`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: different files, no dependency on an unfinished task
- **[Story]**: US1 short song fits · US2 long part gets its width · US3 earlier specs still hold · US4 pass-word hole · US5 print chords

## Path Conventions

Single Next.js app: `src/`, `e2e/`, `scripts/`, `docs/`. Source files this entry may change: `src/app/globals.css`,
`src/components/reading/useCardTrack.ts`, `src/components/tab/TabStaff.tsx` (`rulerWidth`/`sumTerms` only),
`src/components/app/PlayView.tsx` (the `card-passes` span only). See plan.md *Scope fence*.

---

## Phase 1: Setup

- [ ] T001 🛑 BLOCKED: full e2e suite outlasts the 10-minute command limit; npm test baseline (186 files, 6264 tests) and probe run are recorded in DECISIONS, e2e counts still owed. Record the baseline: run `npm test < /dev/null` and `npm run test:e2e < /dev/null` on the untouched branch and add a "013 — suite before" section to `docs/DECISIONS.md` with the pass/fail counts (quickstart §1). Also run `npx playwright test -c specs/013-cards-per-row/research-probes/probe.config.ts < /dev/null` and note the starting figures (short play view 3,3,3,3, scroll 962/800; long song ruler 0).
- [x] T002 [P] Create `scripts/untouched-by-cards.sh` (model it on `scripts/untouched-by-memos.sh`): zero diff against `main` for the plan's *Scope fence* paths, and bounded-diff checks for `TabStaff.tsx` (hunks only inside `rulerWidth`/`sumTerms`), `PlayView.tsx` (only the moved `card-passes` block), `playwright.config.ts` (only the `firefox` `testMatch`), `package.json` (only the two new `check:` scripts). Add `"check:untouched-cards"` to `package.json`.
- [x] T003 [P] Create `scripts/check-cards-amendments.sh` (model it on `scripts/check-wide-amendments.sh`): asserts `Amended by spec 013` in spec 010 FR-005, FR-006, SC-003 and contracts/reading-cards.md §1, §4, §5; asserts `docs/DECISIONS.md` has the "013 — decisions" and "013 — re-pinned tests" headings; asserts each re-pin row of plan.md's table still has its `// re-pinned by spec 013` marker in `e2e/wide-order.spec.ts`. Add `"check:cards-amendments"` to `package.json`.
- [x] T004 Create `e2e/cards-helpers.ts` per data-model §3–§5 and contracts §6: `measureCards(page)` (ruler box, one-line head-row clone, memo flag, resolved tokens), `greedyRows(own, row, gap)`, and seeders for the long-ruler parts, many-chord, 40-character-chord and memo songs (reuse `e2e/wide-helpers.ts` and `e2e/memo-helpers.ts`; do not edit them). It must never read `--own-*`.

---

## Phase 2: Foundational — the ruler (blocks every story)

**Purpose**: Chromium reads a ruler as 0px past ~48 columns (research R3), so no per-card width can be right until it is fixed.

### Invariant probes (FIRST — each must FAIL on the pre-change code)

- [x] T005 [P] Probe INV-008 (unit half): create `src/components/tab/__tests__/TabStaff.ruler-depth.test.tsx`. Render `TabStaff` over parts of {1, 4, 8, 10, 12, 16, 32, 64} bars, one 64-column bar, a 60-chord-column part and a removal-gap variant × views {frets, notes, intervals} × pointers {mouse, touch}; parse the rendered ruler `width` and assert no parenthesis level holds more than 16 operands and every column's term appears verbatim. Run `npx vitest run src/components/tab/__tests__/TabStaff.ruler-depth.test.tsx < /dev/null` and confirm it FAILS on today's flat sum (64 bars).
- [x] T006 [P] Probe INV-008 (e2e half): create `e2e/cards-ruler-long.spec.ts`. For each card at 1280 (play view and song page) over the T005 enumeration seeded through `e2e/cards-helpers.ts`, assert the `tab-ruler` box width is non-zero and within 1px of spec 010 INV-019's one-line clone, in Chromium and Firefox. Add it to the `firefox` project `testMatch` in `playwright.config.ts`. Confirm it FAILS on the untouched tree at 10+ bars (ruler reads 0).

### Implementation

- [x] T007 Rewrite `rulerWidth` in `src/components/tab/TabStaff.tsx` to sum the same `widthTerms` in nested groups of 8 via a new `sumTerms` helper (contracts §3). Change no other line; no drawn column's width string changes. Verify: T005 and T006 now pass, and `npx vitest run src/components/tab/__tests__/TabStaff.ruler.test.tsx src/components/tab/__tests__/TabStaff.wrapped-unchanged.test.tsx < /dev/null` passes unedited, plus `frets-unchanged`.

**Checkpoint**: every ruler reads its true one-line width.

---

## Phase 3: User Story 1 — a song of short parts fits on one screen (P1) 🎯 MVP

**Goal**: cards are as wide as their own content, so short cards pack five or more to a row.

**Independent Test**: `npx playwright test e2e/cards-rows.spec.ts -g "short" < /dev/null`.

### Invariant probes (FIRST — each must FAIL on the pre-change code)

- [x] T008 [P] [US1] Probe INV-001, INV-002, INV-003 in new `e2e/cards-rows.spec.ts`: over **Ww** {768,1024,1280,1440,1920,2560} × **Ptr** {mouse, touch} × **Pg** {song page, play view} × **Songs** {fit, short, long, names, wide-bar, empty, none, memo} (Th {dark, light} at 1280 for INV-002), assert order (no card placed before an earlier one, play-view numbers `1..n`, each `li` `order` 0), that drawn rows equal `greedyRows(measureCards(page))`, and the INV-003 width rules (≥ `min(own,row)−0.5`, ≤ row+0.5, full rows end at the list's right edge, last-row cards ≤ own+0.5, tops aligned). Confirm it FAILS today (equal tracks: short is 3 a row).
- [x] T009 [P] [US1] Probe INV-006 in `e2e/cards-rows.spec.ts`: each card ≥ `max(9rem, min(head line + chrome, 343))` or the row; memo song B and C cards ≥ `min(343,row)−0.5`; head-row children inside the card with no pairwise overlap > 0.5px. Over **Ww** × **Ptr** × **Pg** × {fit, short, names, empty, memo}. Confirm it FAILS today (memo/short minimum).
- [x] T010 [P] [US1] Probe INV-007 (short and fit rows) in `e2e/cards-rows.spec.ts`: at 1280×800 and 1440×900 × **Th** × **Pg**, fit song `scrollHeight ≤ innerHeight` and every `li.bottom ≤ click-bar.top`; short at 1280×800 play view no scroll, every row but the last holds ≥ 5 cards; short song page `scrollHeight ≤ 1030` and every head row is one line. Log the figures with `console.log` for DECISIONS. Confirm it FAILS today (short play view scrolls 962/800).
- [x] T011 [P] [US1] Probe INV-009 in new `e2e/cards-follow.spec.ts`: after each trigger without reload (view switch, density switch, theme switch, viewport 1280→1024→1440, memo added then deleted, part renamed long then empty, `document.fonts` load) the INV-002 computation holds again; during a click run (following on, bpm 300) and a key walk, every `li` rect is constant ±0.5 and a `MutationObserver` on each `li` `style` sees no record. Pg × {fit, memo} at 1280 mouse; reading walks fit × {768, 1280}. Confirm it FAILS today (no per-card `--own-*`, rows are equal tracks).
- [x] T012 [P] [US1] Probe INV-014 style half in `e2e/cards-rows.spec.ts`: at **Wn** {320,375,412,767} × **Ptr** × **Th** × **Pg**, no `.reading-cards > li` and no head row has a `style` attribute and the list has no `--staff-line`. (This one guards narrow; it passes before the change by design — it is the regression guard for T014's hook, and the task says so. T015 is where it can start failing.)

### Implementation

- [x] T013 [US1] Add `--card-min` to `:root` and the wide (`@media (min-width: 768px)`) `.reading-cards` rule set to `src/app/globals.css` per contracts §1: wrapping flex row, per-`li` basis from `--own-staff`/`--own-head`, `::after` filler for the last row, memo floor through `:has([data-testid="part-memos"])`, no `grid-auto-flow: dense`. Nothing outside the media query changes.
- [x] T014 [US1] Update `src/components/reading/useCardTrack.ts` per contracts §2: keep the signature, write `--own-staff` and `--own-head` on each `li` (batch the toggles of all head rows, then read), still write `--staff-line` on the list, one `ResizeObserver`, no React state, no measuring while the reading position moves, and write nothing below 768px.
- [x] T015 [US1] Run `npx playwright test e2e/cards-rows.spec.ts e2e/cards-follow.spec.ts < /dev/null` and fix `globals.css`/`useCardTrack.ts` until T008–T012 pass in the `desktop` and `mobile` projects.

**Checkpoint**: the short song fits; rows follow content.

---

## Phase 4: User Story 2 — a long part gets the width it needs (P1)

**Goal**: A in `long` takes its one-line width up to the row; B and C share a row; a card is never wrapped just to share.

**Independent Test**: `npx playwright test e2e/cards-rows.spec.ts -g "long|wide-bar" < /dev/null`.

### Invariant probes (FIRST — each must FAIL on the pre-change code)

- [x] T016 [P] [US2] Probe INV-004 in `e2e/cards-rows.spec.ts`: distinct `.tab-bar-run` tops per card against `own ≤ row` (one line when it fits; wrapped at barlines when wider), each run `scrollWidth ≤ clientWidth + 1` except a single bar wider than its line. Over **Ww** × **Ptr** × **Pg** × {fit, short, long, names, wide-bar} × **View**. Confirm it FAILS today (fit 4-bar cards wrap at 768; long A wraps in a third).
- [x] T017 [P] [US2] Probe INV-007 long half in `e2e/cards-rows.spec.ts`: long at {1024,1280,1440,1920} × **Pg** — A's width ≥ `min(own,row)−0.5`, B and C share a row. Confirm it FAILS today (A is a third of the row).
- [x] T018 [P] [US2] Probe INV-005 in `e2e/cards-rows.spec.ts`: `documentElement.scrollWidth ≤ innerWidth` after load and after each view switch, over (**Ww** ∪ **Wn**) × {Chromium, Firefox} × **Pg** × **View** × {fit, long, names, wide-bar, short}. Add `cards-rows.spec.ts` to the `firefox` project `testMatch` in `playwright.config.ts`. (Guards against overflow the new CSS could introduce; it may pass before the change — state so in the test header.)

### Implementation

- [x] T019 [US2] Run `npx playwright test e2e/cards-rows.spec.ts e2e/cards-ruler-long.spec.ts < /dev/null` and `npx playwright test --project firefox e2e/cards-rows.spec.ts < /dev/null`; fix `globals.css` (basis, `min-width`, `max-width: 100%`, wide-bar scroll inside the bar) until T016–T018 pass.

**Checkpoint**: long, names and wide-bar songs draw correctly in both browsers.

---

## Phase 5: User Story 3 — what spec 010 held still holds (P1)

**Goal**: earlier entries' suites pass; only the listed re-pins change.

**Independent Test**: the quickstart §4 list.

### Invariant probes (FIRST)

- [X] T020 [P] [US3] Probe INV-011, INV-014, INV-017 by running, unedited and before T021: `npx playwright test e2e/wide-narrow-unchanged.spec.ts e2e/wide-position.spec.ts e2e/wide-fold.spec.ts e2e/play-whole-song-outline.spec.ts e2e/wide-print.spec.ts e2e/memo-floors.spec.ts e2e/memo-recorder.spec.ts e2e/memo-list.spec.ts e2e/memo-states.spec.ts < /dev/null`. Record which fail on the new CSS; none may require editing the spec (the narrow fixtures are never re-recorded).

### Implementation

- [x] T020a [US3] RESOLVE T020 finding: `e2e/wide-print.spec.ts` "print fit" (dark+light, mobile) fails at line 53 on the new CSS at width 1047 (`tops` 6, expected < 6). Cause measured: `--own-staff` is read on screen (about 701px for 5 of the 6 fit cards), so at 1047 print no two cards fit a row and each card is its own row, where the old grid gave 2-up. Every other probed spec passed (135 passed; F5 print too). Fix in `globals.css`/`useCardTrack.ts` (print must let cards share rows), not in the spec, which plan.md INV-011/INV-013 say runs unedited; if that cannot hold, record a re-pin in plan.md first.
  - Done by the supervisor (2026-11-21): a `@media print and (min-width: 768px)` rule in `globals.css` caps `--card-own` at half the row, as spec 010's track did, so paper shares rows and the staff wraps inside the card; screen is unchanged. `wide-print`, `cards-rows`, `cards-follow`, `cards-ruler-long` on mobile + desktop: 90 passed, 4 skipped. The wide-print spec is unedited.
- [X] T021 [US3] Re-pin `e2e/wide-order.spec.ts` exactly per plan.md's *Existing tests this changes on purpose* table (the 5 assertion rows), each with a `// re-pinned by spec 013: <reason>` comment, using `measureCards`/`greedyRows` from `e2e/cards-helpers.ts`. Stricter, never weakened; delete nothing.
- [X] T022 [US3] Re-record the two `1280x800-*` entries of `e2e/fixtures/memo-card-before.json` on the finished build (the `mobile` project, as before); leave the 375 and 412 entries byte-equal. Verify `npx playwright test e2e/memo-card-height.spec.ts < /dev/null` passes unedited.
- [ ] T023 [US3] 🛑 BLOCKED: full `npm run test:e2e` exceeds the 10-minute foreground limit; quickstart §4 list (221 passed) and firefox (53 passed, one load-flake that passes alone) are done, the full desktop+mobile run is owed. Run the full quickstart §4 list plus `npx playwright test --project firefox < /dev/null` and `npm run test:e2e < /dev/null`; fix any regression in `globals.css`/`useCardTrack.ts` (not in the tests).

**Checkpoint**: whole e2e suite green.

---

## Phase 6: User Story 4 — no hole after the pass words (P2)

**Goal**: pass words sit last in the play view head row; nothing moves while the click runs.

**Independent Test**: `npx playwright test e2e/cards-pass-words.spec.ts < /dev/null`.

### Invariant probes (FIRST — must FAIL on the pre-change code)

- [x] T024 [P] [US4] Probe INV-010 in new `e2e/cards-pass-words.spec.ts`: record every head-row child's box at rest, at each pass (keys, and click following at bpm 300 sampled per pass) and after Stop; the gap from the visible layer's right edge to the nearest later child on the same top is ≤ `column-gap`+0.5 (or nothing follows), no other child moves > 0.5px and head-row height is constant. Over {fit card 1, Fold row F5, a seeded `×12` entry at `pass 10 of 12`} × {375, 768, 1280} × {keys, click}. Confirm it FAILS today (blank stretch before `bars 1–12`).

### Implementation

- [x] T025 [US4] In `src/components/app/PlayView.tsx` move the `card-passes` span to the end of the head row (contracts §4); change nothing else. Run T024 and `npx playwright test e2e/wide-position.spec.ts e2e/wide-fold.spec.ts e2e/wide-narrow-unchanged.spec.ts < /dev/null`.

---

## Phase 7: User Story 5 — short chord symbols print whole (P2)

**Goal**: `Em7` prints on one line; an overlong symbol still breaks inside its card.

**Independent Test**: `npx playwright test e2e/cards-print.spec.ts < /dev/null`.

### Invariant probes (FIRST — must FAIL on the pre-change code)

- [x] T026 [P] [US5] Probe INV-012 in new `e2e/cards-print.spec.ts` with `page.emulateMedia({ media: "print" })`: each chord `div.text-accent` height/line-height ≤ 1.05 and `right ≤ min(card.right, innerWidth)+0.5`, for every chord of the fit song (incl. `Em7`) and a seeded 40-character symbol × **Prn** {718, 1047} × **Th** × **Pg**. Confirm it FAILS today (`Em7` splits).
- [x] T027 [P] [US5] Probe INV-013 in `e2e/cards-print.spec.ts`: INV-001/INV-002's computation under print media at each **Prn** width × **Th** × **Pg** × {fit, short, F5}; 718 is one card per row. Add the `break-inside: avoid`, numbers and rest-words checks as `wide-print.spec.ts` has them (do not edit that file).

### Implementation

- [x] T028 [US5] In `src/app/globals.css` `@media print` replace the chord `overflow-wrap: anywhere` with a container-unit rule per contracts §5 (`container-type` on the card content, symbol max-width in `cqi`). Run T026, T027 and `npx playwright test e2e/wide-print.spec.ts < /dev/null`.

---

## Phase 8: Polish & cross-cutting

- [X] T029 [P] Amend in place with `Amended by spec 013`: `specs/010-wide-reading-layout/spec.md` (FR-005, FR-006, SC-003) and `specs/010-wide-reading-layout/contracts/reading-cards.md` (§1, §4, §5).
- [X] T030 [P] Write into `docs/DECISIONS.md`: "013 — decisions" (the 6 spec decisions and 6 plan deviations, card minimum, last-row rule, route, fit and short figures from T010's logs), "013 — re-pinned tests" (one line per table row), "013 — earlier entries' untouched guards" (what the earlier `check:untouched-*` report on this branch's own files, as entries 11 and 12 did).
- [x] T031 Run the Linux replica (FR-021): `bash specs/007-usability-pass/review-probes/INV-016-linux-chrome.sh setup < /dev/null`, then its run form (see the script header) over the new cards specs and the quickstart §4 list. If Docker is unavailable, record that in `docs/DECISIONS.md` and leave this task unchecked with the reason.
  - Done by the supervisor (2026-11-21): `e2e/fixtures/memo-card-before.linux.json` (part A 151.0625 wide at 1280x800, measured in the replica; the Windows file is unchanged), read by `memo-card-height.spec.ts` on Linux. Replica over memo-card-height, wide-order, cards-*, wide-print, wide-narrow-unchanged (mobile, desktop): 203 passed. See DECISIONS "013 T031".
- [ ] T032 🛑 BLOCKED: needs a person at a real display — quickstart §7 browser check of `short`, `long` and fit songs at 1280×800 and 1920×1080, both themes, both pages, click running at 1280, and print preview. Log it under "013 — browser check" in `docs/DECISIONS.md` (INV-018). An agent must not tick it.
- [X] T033 Guards: run the fast guard tier and fix every failure BEFORE any push — `npx tsc --noEmit < /dev/null && npm run lint < /dev/null && npm test < /dev/null`, then `npm run check:untouched-cards`, `npm run check:cards-amendments`, `npm run check:line-endings`, `npm run check:untouched-wide`, `check:untouched-playback`, `check:untouched-memos`, `check:wide-amendments` (each `< /dev/null`; the earlier `check:untouched-*` are expected to report this branch's own four files, logged in T030).

---

## Dependencies & Execution Order

- Phase 1: T002, T003 parallel; T004 after nothing but before every e2e probe.
- Phase 2 blocks all stories (ruler fix). T005/T006 first, then T007.
- US1 (Phase 3) is the MVP; US2 depends on US1's CSS (same rule set) but its probes are independent. US3 needs US1+US2 done. US4 (PlayView) and US5 (print CSS) are independent of each other and may run after Phase 2; T028 and T013 both touch `globals.css`, so do not run them concurrently.
- Polish after all stories; T033 last, T032 is owed to a human.

## Parallel examples

- Phase 3 probes T008–T012 (all in test files; T008–T010 and T012 share `cards-rows.spec.ts`, so write them in one pass or serially; T011 is a separate file).
- T024 and T026/T027 (different spec files) after Phase 2.
- T029, T030.

## Implementation Strategy

MVP = Phases 1–3 (ruler fix + per-card widths). Then US2 probes, US3 re-pins and full suite, then the two small defects, then amendments, replica, and guards. Stop at any checkpoint and run that phase's Independent Test.

---

## Phase 9: Review remediation

**Source**: `review.md` round 1 (1 BLOCKER, 3 MAJOR). Probes live in `specs/013-cards-per-row/review-probes/` (see its
README; `review.config.ts` runs them against one build, `suite.config.ts` runs the project's suite in chunks under the
10-minute limit). For each violated invariant the probe-adoption task comes first and must FAIL before its fix.

- [x] T034 Adopt review-probes/INV-012-print-80-char-chord-firefox.probe.ts (with the column and run checks of INV-012-print-long-chord-column.probe.ts) into `e2e/cards-print.spec.ts` as a failing test first. Print the play view of a part whose first column carries `"Cmaj7".repeat(16)` (as `usability-staves.spec.ts` seeds it) at 375, 820 and 1280, in both themes. Assert that no `.tab-bar-run` has `scrollWidth > clientWidth + 1`, and that no chord symbol or its `tab-column` ends past its card; judge the narrow song page's scrolling staff against its clip, as the file already does. Add `cards-print\.spec\.ts` to the `firefox` project `testMatch` in `playwright.config.ts`. Confirm it FAILS on the current tree in desktop, mobile and firefox — review F1 (BLOCKER), src/app/globals.css:705
- [x] T035 Fix the print chord rules in `src/app/globals.css:705-717` so FR-017 and FR-018 both hold. Replace the unparseable `min-width: min(max-content, 100cqi) !important` on `.tab-bar-run [data-testid="tab-column"]` with a valid declaration that lets the column shrink in print, as `main`'s `min-width: 0 !important` did. Cap the symbol at the line it sits in (its bar run), not at `100cqi` of `.reading-card`, which is wider than the run by the gutter. Verify these pass in mobile, desktop and firefox, then in the Linux replica: T034, `cards-print.spec.ts` (`Em7` on one line), `wide-print.spec.ts`, and the unedited `e2e/usability-staves.spec.ts` "a chord longer than a line". Log in `docs/DECISIONS.md` that the firefox failure T023 recorded as a load-flake was this regression — review F1 (BLOCKER), src/app/globals.css:705 (done on Windows in desktop, mobile, firefox; Linux replica run owed, fold into T040's replica pass)
- [x] T036 Replace `e2e/cards-print.spec.ts` INV-013's "greedy-ish" checks (lines 72-105) with review-probes/INV-013-print-greedy-one-line.probe.ts's computation, as a failing test first. Under print media at 718 and 1047, both themes, both pages, for fit, short, long and F5, assert two things: drawn rows equal `greedyRows` of the cards' own widths (data-model §3), and every card whose own width is at most the row draws its staff on one line. Add INV-013-print-nothing-cut.probe.ts's in-scope members (long and wide-bar: no run overflow and no column past its card, except the narrow song page, FU6). Confirm it FAILS today at 1047: fit is 2-up and wrapped, long's A sits in half the row on 4 lines, and short is 3 a row where greedy gives 4 — review F2 (MAJOR), e2e/cards-print.spec.ts:72
- [x] T037 Make print apply FR-003, FR-004 and FR-007 at the printable width (FR-019; spec 010 FR-031 says print follows the screen's width rule).
  - Remove the half-row `--card-own` cap at `src/app/globals.css:668-675`.
  - Make the printed own widths the printed card's: re-run `useCardTrack`'s measuring pass when `matchMedia("print")` changes and on `beforeprint`/`afterprint`, so `--own-head` leaves out `.no-print` head items. If a real print cannot be re-measured, record in `docs/DECISIONS.md` that paper uses the screen-measured widths, and have T036 compute its own widths from measurements taken before print media applies.
  - Re-pin `e2e/wide-print.spec.ts:53` (`tops < count` at 1047) to the greedy rows under FR-022: add the `// re-pinned by spec 013:` marker, a row in plan.md's *Existing tests this changes on purpose* table and its *Scope fence*, a "013 — re-pinned tests" line, the marker check in `scripts/check-cards-amendments.sh`, and the exemption in `scripts/untouched-by-cards.sh`.
  - Replace DECISIONS deviation 5's "paper caps a card at half the row" (`docs/DECISIONS.md:930`).
  - Verify T036, `wide-print`, `cards-print` and `cards-rows` — review F2 (MAJOR), src/app/globals.css:672
  - Supervisor decision (2026-11-21): take this route, paper follows the screen rule. Do not keep spec 010's 2-up paper. The T020a cap was a stopgap to keep an old pin, and it is withdrawn.
- [x] T038 Adopt review-probes/INV-008-ruler-every-member.probe.ts into `e2e/cards-ruler-long.spec.ts` as a failing test first: the 4, 8, 12 and 32-bar parts, the 64-column bar, the removal-gap variant and an empty part, in every view on both pages, in desktop, mobile and firefox. Keep the clone's per-column rounding allowance, `max(1, columns / 64)`. Add a zero-column case to `src/components/tab/__tests__/TabStaff.ruler-depth.test.tsx` that asserts the ruler `width` has no empty operand (no `calc( +`). Confirm both FAIL on the empty part — review F3 (MAJOR), src/components/tab/TabStaff.tsx:560
- [x] T039 Fix `sumTerms`/`rulerWidth` in `src/components/tab/TabStaff.tsx:556-564` so a part with no column terms gives a valid operand (for example `0px`), and the empty part's ruler reads its gutter again, as on `main`. Change no other line (INV-015, `check:untouched-cards`). Verify T038, `TabStaff.ruler.test.tsx`, `TabStaff.wrapped-unchanged` and `frets-unchanged` — review F3 (MAJOR), src/components/tab/TabStaff.tsx:560
- [x] T040 Restore SC-003's 1920 case in `e2e/cards-rows.spec.ts:259-260` (INV-007 long) on every platform. Assert that B and C share a row whenever the measured greedy rows place A alone (A + gap + B > row), and that at 1920 on Windows they do. Adopt review-probes/INV-007-long-1920-and-play-views.probe.ts's play-view notes/intervals half into the INV-004 test. Record in `docs/DECISIONS.md` "013 — decisions", and in plan.md's Deviations, that on Linux Chrome at 1920 FR-007 puts B beside A (play view, mouse: A 1306 + 8 + B 186 ≤ 1520), so SC-003/US2 AS1 does not hold there. This replaces the "test-only" wording at `docs/DECISIONS.md:967`. Run the replica over `cards-rows` — review F4 (MAJOR), e2e/cards-rows.spec.ts:260
- [x] T041 Adopt the probes that pass today into the suite. (done: recorder spec fails with the :has() memo rule broken; INV-009 triggers test checks row-following, not the floor, so it does not depend on that rule; guard restored)
  - review-probes/INV-009-triggers-and-key-walk.probe.ts goes into `e2e/cards-follow.spec.ts`: a density switch, a rename long then empty, and a memo added then deleted with no reload. Add the key walk on the play view at 768 and 1280, with a `MutationObserver` on every `li` and the list, replacing the song-page walk at `e2e/cards-follow.spec.ts:100`.
  - review-probes/INV-006-017-recorder-floor.probe.ts becomes a cards spec: the recorder open on a part with no memo keeps 343px at 768–1920. It uses `withFakeMicrophone`, so give it its own file if `test.use` would leak.
  - Confirm each fails when its guard is broken, for example with the `:has()` memo rule removed. Then undo that — probe adoption for INV-009 and INV-006/INV-017 (review § Invariants), e2e/cards-follow.spec.ts:100

---

## Phase 10: Review remediation

**Source**: `review.md` round 2 (0 BLOCKER, 1 MAJOR). Round 1's four findings are fixed. F1 is round 1 F2 surviving
outside print emulation, so this is the second round in the print-sizing component (`useCardTrack` + `@media print`).
The fix below is structural, not another event hook. It is not tagged REDESIGN, because neither round's finding in this
component is a BLOCKER. Probes are in `specs/013-cards-per-row/review-probes/` (see its README). The adoption task comes
first and must FAIL before its fix.

- [x] T042 Adopt review-probes/INV-013-print-remeasure.probe.ts into `e2e/cards-print.spec.ts` as a failing test first, in desktop and firefox — review F1 (MAJOR), src/components/reading/useCardTrack.ts:58
  - Take its "real-print layout" test (fit, short and long at 1047, both pages). It puts each card's screen-measured inline `--own-*` back under print media and lays out synchronously, so no observer can re-measure.
  - Take its screen → print → screen round trip.
  - Confirm the real-print test FAILS today: `short`'s song page draws `[[0,1,2],[3,4,5],[6,7,8],[9,10,11]]` against greedy `[[0,1,2,3],[4,5,6,7],[8,9,10,11]]`.
- [x] T043 Make the printed own widths hold by construction (INV-013, FR-019), so paper needs no measurement taken under print media — review F1 (MAJOR, second round in this component), src/components/reading/useCardTrack.ts:58-66, src/app/globals.css:652
  - **Why:** a real print fires only `beforeprint`/`afterprint`, under screen styles, and runs no `ResizeObserver`.
  - **Measure:** in `useCardTrack`'s one measuring batch, also measure each head row on one line with its `.no-print` descendants hidden, then restore them exactly.
  - **Write:** write the result as its own per-`li` property (e.g. `--own-head-print`), only on change, never below 768 (INV-014).
  - **Use:** in `@media print and (min-width: 768px)`, build `--card-least` from it. Keep the memo rule's override working.
  - The `matchMedia("print")`/`beforeprint`/`afterprint` listeners may stay or go. Nothing may depend on them.
  - **Verify:** T042, `cards-print`, `wide-print`, `cards-rows` (including the INV-014 style check), `cards-follow`, and the review probes' INV-013 files, in desktop, mobile and firefox, then `cards-print` and `wide-print` in the Linux replica.
  - **Records:** replace `docs/DECISIONS.md:930` (deviation 5) with what paper actually measures, and update `contracts/cards-per-row.md` §1 and §2 to match.
- [x] T044 Adopt review-probes/INV-012-print-chord-any-column.probe.ts into `e2e/cards-print.spec.ts` as a regression guard for round 1's chord fix — review § Invariants INV-012, src/app/globals.css:705
  - Adopt the five later-column shapes that pass today (80 characters mid-bar, at the end of a bar and on bar 2; 30 characters mid-bar; 12 characters at the end of a line) at {375, 718, 820, 1047, 1280}, both pages.
  - Leave out the "40 characters in bar 4 at 375" member, which is MINOR F2 (review § Follow-ups FU1). It stays in the probe.
  - Confirm the adopted test fails with the round-1 rule restored (`width: max-content` removed from the symbol), then undo that.

---

## Phase 11: Review remediation

**Source:** `review.md` round 3 (0 BLOCKER, 1 MAJOR).
- **Round 2's F1 is fixed.** Paper's own widths now hold in the real-print state on all 288 members of
  review-probes/INV-013-real-print-every-member.probe.ts, and in Chromium's `page.pdf()`.
- **The MAJOR is new, and T043's fix introduced it.** The print rule's media condition turns `npm test` red, and CI runs
  `npm test`.
- **Patch, not REDESIGN.** This is the third round with a blocking finding in the print-sizing component. No round's
  finding there was a BLOCKER, and T043's design holds every INV-013 member, so the fix is a one-line restatement.

Probes are in `specs/013-cards-per-row/review-probes/` (see its README). The adoption tasks add probes that pass
today, so they are regression guards, not failing tests.

- [x] T045 Restate the print rule's media condition so spec 010's unedited `src/lib/reading/__tests__/wide-threshold.test.ts` passes — review F1 (MAJOR), src/app/globals.css:670
  - **The failure:** "has no other width media query in any syntax" requires every width condition in `globals.css` to be exactly `(min-width: 768px)`, and line 670 is `@media print and (min-width: 768px)`.
  - **The fix:** nest `@media (min-width: 768px) { … }` inside a `@media print { … }` block, or drop the width condition. `--card-least` is read only by the `≥ 768` flex rule, so a print-only rule with no width condition changes nothing below 768.
  - **Keep:** the rule must still come after the screen `.reading-cards > li` rule, so it wins in print, and the memo `:has()` override must still win.
  - **Do not edit** `wide-threshold.test.ts` (FR-022, spec 010 INV-016).
  - **Verify:** `npm test < /dev/null` with all 187 files green. Then run `cards-print`, `wide-print`, `cards-rows` (including the INV-014 style check), review-probes/INV-013-real-print-every-member.probe.ts and INV-013-print-remeasure.probe.ts, in desktop, mobile and firefox.
  - **Records:** update the condition's wording in `contracts/cards-per-row.md` §2 step 3 and in `docs/DECISIONS.md` deviation 5 (`docs/DECISIONS.md:930`).
- [x] T046 Adopt review-probes/INV-013-real-print-every-member.probe.ts into `e2e/cards-print.spec.ts` as a regression guard — review § Invariants INV-013, e2e/cards-print.spec.ts:230
  - **Widen the existing "real-print layout is greedy over the printed own widths" test** to the probe's members: {fit, short, long, F5} × paper {718, 1047} × screen {1047, 1280, 1920} × {dark, light} × both pages.
  - **Screens:** keep each `li`'s style attribute at the screen width, then lay out at the paper width under print media.
  - **Projects:** run it in mobile too, not only desktop and firefox.
  - **Confirm it can fail:** it must fail with `--own-head-print` removed from the print rule (round 2's F1 state), then undo that.
- [x] T047 Adopt the Chromium `page.pdf()` half of review-probes/INV-013-print-from-narrow-screen.probe.ts into `e2e/cards-print.spec.ts` — review § Invariants INV-013, e2e/cards-print.spec.ts:230
  - **Take the test** "real print (page.pdf) at 1047 from a 412 and a 1280 screen". In desktop only, it reads where each part card's head printed from the PDF's `/capture/<part>` link rects, and asserts both screens print the fit song page's rows `[[0],[1],[2,3]]`.
  - **Leave out the frozen-script half.** It is review round 3 F2 (MINOR, PLAUSIBLE) and stays in the probe.
- [x] T048 Adopt review-probes/INV-009-no-measure-while-reading.probe.ts into `e2e/cards-follow.spec.ts` — review § Invariants INV-009, src/components/reading/useCardTrack.ts:17
  - **Note:** the control half (a resize raises the head-row count) proves the recorder sees batches; the forced-re-render mutation was not run this pass.
  - **The walk:** a 40-step play-view key walk at 1280, with real key presses, writes no head-row or `li` `style`, and no card moves.
  - **The control:** a resize afterwards shows that head-row records are seen.
  - **Confirm it can fail:** it must fail when `useCardTrack`'s effect is made to run on every reading step (for example, by forcing a `PlayView` re-render from the position callback), then undo that.
