---

description: "Task list for the usability pass across every screen, phone first"
---

# Tasks: Usability pass across every screen, phone first

**Input**: `specs/007-usability-pass/` — plan.md, spec.md, research.md, data-model.md, contracts/ (surfaces, staff, click, keys, reader), quickstart.md

**Tests**: The spec asks for tests throughout (FR-010, FR-039, FR-065, SC-001 to SC-017), so test tasks are included. **Invariant probes** (plan.md § Invariants, INV-001 to INV-046) are the FIRST tasks of the phase that builds what they protect. Every probe lives in the project's suite (`e2e/` or `src/**/__tests__/`), never a temp dir, and each must FAIL on the pre-change code. Where a probe is a hold-the-line check that cannot fail first, its task says why and names the throwaway mutation that proves it can fail.

**Organization**: Grouped by user story. Stories are P1: US1, US2, US3. P2: US4, US5, US6. P3: US7, US8. **The cut, if the run is long, is after US3 plus the audit checkpoint (plan build step 6).** FR-047 to FR-061 (US5, US8) are the natural cut.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: parallel (different files, no dependency on an unfinished task)
- Headless rules: no dev server, no `curl`. Browser checks are Playwright specs run with `npx playwright test <file> --project=<p> < /dev/null` on a production build. **Never run the build or e2e while a dev server holds `.next`.** Run long commands synchronously.
- **Line endings**: CRLF files are `SongView.tsx`, `PasteTab.tsx`, `ui/index.tsx`, `useClick.ts`, `notation.ts`. Everything else is LF. Keep each file's endings when editing.
- **Fences** (plan.md Constraints): zero diff in `src/lib/tab/layout.ts`, `ascii.ts`, `reading.ts`, `src/lib/export/text.ts`, `src/lib/rhythm/audio.ts`, `stream.ts`. New unit tests go in `src/lib/reading/__tests__/` (not `src/lib/tab/__tests__/`). `TabStaff.tsx` must not import techniques. `npm run typecheck` covers `specs/` and tests.
- Unlayered CSS beats Tailwind utilities, so a rule a utility must override goes in `@layer base`.
- Paths: web app, single package. Source in `src/`, e2e in `e2e/`.

---

## Phase 1: Setup (shared infrastructure and "before" readings)

**Purpose**: The harness, the guard script, and every reading that only exists on unedited code. These "before" tasks are prerequisites of implementation, because after the change the pre-change state is gone.

### Invariant probes (FIRST — hold-the-line probes, with the reason each cannot fail first)

- [x] T001 [P] Probe INV-015 in `src/lib/reading/__tests__/frets-unchanged.test.ts` (extend) and `e2e/usability-staff.spec.ts` (create, with only this test for now): layout, ASCII, text and description entries byte-equal to `baseline.json`; and e2e "Copy text" with a wide chord on a narrow column equals the same text from a hand-written fixture, over **Bars** × {expanded, compact} × views {frets, notes, intervals} × pointers. It passes before the change by design (it guards drift). Prove it can fail: temporarily change one character in `src/lib/tab/ascii.ts` output, see it fail, revert.
- [x] T002 [P] Probe INV-044 in `src/lib/reading/__tests__/no-other-product.test.ts` (create): grep every user-visible string file under `src/` and every fixture under `e2e/` for the other product's name; `specs/007-usability-pass/audit/` is not bundled and is excluded. Passes before the change by design. Prove it can fail: add the name to a throwaway string, see it fail, revert.

### Setup and before-readings

- [x] T003 Add the `no-pointer` project to `playwright.config.ts`: Chromium launched with `--blink-settings=primaryPointerType=1,availablePointerTypes=1,primaryHoverType=1,availableHoverTypes=1`, matching only `usability-density.spec.ts`. No other harness change; never reuse a server, never share `.next`.
- [x] T004 [P] Create `e2e/usability-helpers.ts`: the floors table (from spec "Size floors"), `SENTENCE_LINKS` (named links per surfaces.md §12), `openTools(page)`, `openCluster(page)`, a `visualViewport` stub for the audit's keyboard heights (260px at 375×667, 336px at 390×844), a CDP safe-area override helper, and the target/text-node walkers.
- [x] T005 [P] Create `scripts/untouched-by-usability.sh` and add `check:untouched-usability` to `package.json`: prints nothing over the plan's *Scope fence* paths, checks `parse.ts`'s diff is confined to `REASONS`, the code union, `joinedByQuality`, `looksJoined`, `readsAsProse` and `failed`, and that `clickStream` is not named in `notation.ts`'s diff. Test it in a throwaway `git worktree` and with `grep -U`, as spec 006's review advised.
- [x] T006 [P] Record before-readings on unedited code, in `specs/007-usability-pass/audit/`: run `npx vitest run --config specs/004-ascii-import/review-probes/vitest.probes.config.mts < /dev/null` and write the failing probe names to `main-probe-failures.txt` (expect the 19 in quickstart §5), plus the F75 count by kind.
- [x] T007 [P] Record `readNotation` output for every **Bars** × **Arr** fixture at tempos 40, 120 and 300 into `src/lib/reading/__tests__/notation-baseline.json`, using a one-off script run on the unedited `src/lib/rhythm/notation.ts`. This is the baseline INV-036 compares against.
- [x] T008 [P] Record the before row heights for capture (`capture-title-row`-equivalents on current testids, neck and latch strip) at 375×667 into `e2e/usability-helpers.ts` as `BEFORE_HEIGHTS`, read with a throwaway Playwright script against the current build. INV-001 compares the neck and latch strip to these.

**Checkpoint**: Harness, guard and baselines exist.

---

## Phase 2: Foundational (tokens, viewport, primitives) — blocks every story

**Purpose**: Build step 1. One set of size tokens, colour tokens, type, viewport and primitives. Largest e2e churn, so it goes first. See contracts/surfaces.md §1–§5.

**⚠️ CRITICAL**: No story starts until this is done.

### Invariant probes (FIRST — each must FAIL on the pre-change code)

- [x] T009 [P] Probe INV-014 in `e2e/usability-density.spec.ts` (create): first asserts its own `matchMedia('(pointer: fine|coarse)')` state (so `no-pointer` fails loudly if the flag did not take), then compares sizes at 375×667, 500×800, 820×1180 and 1280×800 for {fret cell, dead-note cell, toolbar control, chip, column, string height} over **Ptr** (coarse, fine, none). Touch sizes equal the floors table and each other across windows; a 500px mouse uses mouse sizes; an 820px tablet uses touch sizes. Fails before: sizes today follow width breakpoints and are not tokenised.
- [x] T010 [P] Probe INV-010 in `e2e/usability-floors.spec.ts` (create): computed `font-size` ≥16px on touch for every **Inp** (Band name, Song title, part name, BPM, tuning select, Section name, Cue, last-pass select, paste box, chord form, inspector chord, sign-in email and password, and a test-added `contenteditable`) across **Scr** where reachable; the viewport `meta` `content` has no `maximum-scale` or `user-scalable`; `touch-action` is `manipulation` on a neck cell and toolbar control and `none` on the tap pad. Fails before: inputs are 14px and the viewport locks zoom.
- [x] T011 [P] Probe INV-021 in `e2e/usability-contrast.spec.ts` (create, this test only for now): CDP `CSS.getPlatformFontsForNode` reports `JetBrains Mono` for staff cells, chord row, numeral, rhythm mark, paste box, refused line and ignored line (with a deliberately missing glyph as a control that the check can fail); computed `font-variant-ligatures` is `none`; `|-` measures two advances. Fails before: the staff computes to the system stack and ligatures are `normal`.

### Implementation

- [x] T012 Add density tokens to `src/app/globals.css` per surfaces.md §1 (touch defaults in `:root`, one `@media (pointer: fine)` override block, `@custom-variant fine`), the colour tokens per research R11 (both themes, including the light `--accent` `#a74d08`, and `--text-faint` and `--fret-number` landing on one grey per theme), type rules (§3: `.tab-staff` in `var(--font-mono-face)`, `font-variant-ligatures: none` on `.tab-staff` and `.tab-text`, `input, select, textarea { font-size: var(--field-text) }` in `@layer base`), `--safe-*` variables, and `touch-action` in `@layer base` for `.capture-surface`. No size set by a width breakpoint; `pointer: coarse` is written nowhere.
- [x] T013 [P] Update `src/app/layout.tsx`: export `viewport` per surfaces.md §4 (`viewportFit: "cover"`, no `maximumScale`), rewrite the comment above it.
- [x] T014 Update `src/components/ui/index.tsx` (CRLF): `Button`, `ButtonLink` and `Input` take `min-h-(--control)` (icon-only `min-w-(--control)`), remove `text-sm` from `Input`; `PageHeader` one row (back at the floor, title with `line-clamp-2`, actions, subtitle beneath, `touchBar` flag); `Sheet` gets `--kb-inset` margin and `maxHeight`, bottom safe inset; new `Panel` (about 30 lines; `aria-expanded`, `aria-controls`, `hidden` body kept mounted, `data-testid` `panel-<id>` and `panel-<id>-body`, `no-print`). Remove any `py-1`/`h-9` that fights the floor.
- [x] T015 [P] Create `src/components/ui/useKeyboardInset.ts`: sets `--kb-inset` on `document.documentElement` from `innerHeight - visualViewport.height - visualViewport.offsetTop` while a sheet is open; clears on close; no-ops when `visualViewport` is missing.
- [x] T016 [P] Create `src/lib/reading/panels.ts` (React-free store, key `stablature.panels`, injected storage; missing/throwing/`"[]"`/`"nope"` storage reads closed and never throws; unknown keys kept on write; a refused write still changes the screen for the visit; server snapshot closed) and `src/components/reading/usePanel.ts` (`useSyncExternalStore`, `storage` event for a second tab). Unit tests in `src/lib/reading/__tests__/panels.test.ts` over **St** × {`song-tools`, `song-arrange`, `play-cluster`}.
- [x] T017 Apply the safe-area variables to `TopBar`, `Footer` and capture's root (`.capture-surface`) in `src/components/app/TopBar.tsx`, `src/components/app/Footer.tsx`, `src/components/capture/CaptureScreen.tsx` (edges per surfaces.md §4). `ClickBar` and the song page bar get theirs in US4.
- [x] T018 Re-record only the `TabStaff` markup entries of `src/lib/reading/__tests__/baseline.json` once the staff classes settle (do this at US3 T053; leave this task unchecked until then). Layout, ASCII, text and description entries MUST NOT move; confirm with `git diff -- src/lib/reading/__tests__/baseline.json` that every changed key is a markup key.
- [x] T019 Run `npm run typecheck < /dev/null`, `npm run lint < /dev/null`, `npm test < /dev/null`; then `npx playwright test e2e/usability-density.spec.ts e2e/usability-contrast.spec.ts -g INV-021 < /dev/null` after `npm run build < /dev/null`. T009, T010 (viewport/size parts that are token-owned), T011 now pass.

**Checkpoint**: Tokens, viewport, primitives, panel store in place.

---

## Phase 3: User Story 1 — See the whole part while capturing (P1) 🎯 MVP

**Goal**: At 375×667, 4, 5 and 6 strings with a chord row and a bracket fit whole, at rest and while selecting, frets 36×36, page not scrolling. Overflow has one rule.

**Independent Test**: `npx playwright test e2e/usability-height-budget.spec.ts --project=mobile < /dev/null`.

### Invariant probes for User Story 1 (FIRST — each must FAIL on the pre-change code)

- [x] T020 [P] [US1] (written: rest, selecting, start, barline, chord+bracket x 3 string counts; one tuning per count, 375 wide) Probe INV-001 and INV-002 in `e2e/usability-height-budget.spec.ts` (create): each row's `getBoundingClientRect` against the table (`capture-title-row` ≤45, `status-row` ≤26, `toolbar-stable` ≤46, contextual/selection/reserved ≤46, neck and latch strip equal `BEFORE_HEIGHTS`) and the count of the root's direct children against a named list (adding a row fails); at 375×667 × **Th** × {at rest, selecting with seven controls, on a barline, at the start with nothing focused}; {Bass 4, Bass 5, Guitar 6} × chord and bracket on one column: no string, chord row or bracket row lost, page does not scroll, fret cells 36×36, band ≥189px. Fails before: band is 130px and rows are 55/56.
- [x] T021 [P] [US1] Probe INV-003 in `e2e/usability-height-budget.spec.ts`: scroll the band to each end, read each row's rect, check `scrollHeight - clientHeight` covers the overflow, no class read; **Str** × **Hts** (667, 553) × {at rest, selecting, chord form open} with a chord and a bracket; 7 strings at 667 opens with the lowest strings in view. Fails before: `justify-end` strands content above the scroll origin (107px at five strings, 375×553). (reduced matrix: one tuning, 375 wide; Th/Str/Lat/Cap cross-products owed to review)
- [x] T022 [P] [US1] Probe INV-004 in the same spec: rects before and after entering a selection do not move the band or hide a string that was in view; the stable row does not move as the cursor moves over a note, a rest, a barline and the start; **Str** × {667, 553}. Fails before: row heights differ and the band shifts. (reduced matrix: one tuning, 375 wide; Th/Str/Lat/Cap cross-products owed to review)
- [x] T023 [P] [US1] Probe INV-005 in `e2e/usability-staff.spec.ts`: after grouping, the bracket's rect is inside both the band's and the strip's scroll viewports after delivery; a second browser context writing a group moves nothing; part change moves nothing; {tuplet control, plain group control, triplet button} × {far left, far right of strip} × {7 strings at 667, 6 at 553}. Fails before: a new group is left out of view. (reduced matrix: one tuning, 375 wide; Th/Str/Lat/Cap cross-products owed to review)
- [x] T024 [P] [US1] Probe INV-007 in `e2e/usability-floors.spec.ts`: at 375, `scrollWidth <= clientWidth` on stable, contextual (every member present), selection (seven controls), numerals 2 and 16; each child's height equal; each ≥ its floor; none narrower than its content. Fails before: rows are 1px overfull and controls differ in height (A33). (reduced matrix: one tuning, 375 wide; Th/Str/Lat/Cap cross-products owed to review)
- [x] T025 [P] [US1] Probe INV-031 in `e2e/usability-height-budget.spec.ts`: over **Cap** (at rest; selecting with all seven controls; chord form open; a chord in force; stack armed; each transition armed; stack and a transition armed; refused; at the start; mid-part; at the end) every control of FR-001's two rows and the toolbars is present and one tap away with no panel open. Passes on much of the pre-change screen, so it must be written to fail on the merged row: assert the back target, chips, `+ part`, tempo, sync word are in `capture-title-row` (absent before). (reduced matrix: one tuning, 375 wide; Th/Str/Lat/Cap cross-products owed to review)
- [x] T026 [P] [US1] Probe INV-022 in `e2e/usability-staff.spec.ts`: `scrollWidth <= clientWidth` on the status, text compared whole, both jump buttons present and ≥44×24; **Lat** × every status text × {no chord, `Am`, a 10-character chord, an unknown chord} × {end, start, mid-part} at 375; a triplet refusal keeps its words and cuts only the chord (Deviation 3). Fails before: status loses 151px, chord 92px (A16). (reduced matrix: one tuning, 375 wide; Th/Str/Lat/Cap cross-products owed to review)

### Implementation for User Story 1

- [x] T027 [US1] Rebuild capture's top in `src/components/capture/CaptureScreen.tsx` (contracts/surfaces.md §6): one merged `capture-title-row` (back `← title` yielding first down to its arrow, chips in their own scroller each ≥36×44 with the open chip `scrollIntoView({ inline:"nearest", block:"nearest" })`, `+ part`, tempo, `N unsynced` only when `pending > 0`; `all synced` goes); help control slot (fine pointer) at the row end; stable/contextual/selection/reserved rows at `--toolbar-row` with `--control` buttons all one height; band `flex min-h-0 flex-1 flex-col-reverse overflow-y-auto px-3 pt-1` and drop the `stringCount` import for it (one overflow rule, no branch on string count; opens showing strings nearest the neck).
- [x] T028 [US1] Status row in `CaptureScreen.tsx`: `h-(--status-row)` one line; status words and jump buttons (≥44×24) `shrink-0`; chord symbol `shrink-0` up to 10 characters; duration `min-w-0 truncate`; chord tones `min-w-0 truncate` first to go; remove the `tap a column to insert after it` hint; selection status line the same height.
- [x] T029 [P] [US1] Selection row: bracket controls `min-w-9` (≥36×44), `delete` `mx-1`, padding 4px, all seven on one line at 375 with numerals up to 16, in the component that renders them (find via `grep -rn "tuplet" src/components/capture`; likely `CaptureScreen.tsx` or its toolbar component).
- [x] T030 [P] [US1] Neck in `src/components/capture/Fretboard.tsx`: fret-number header `text-[0.6875rem]` in `text-text-dim`, same row height; inlay frets `font-semibold`; cells on `--fret`/`--dead-note` tokens; update the comment above `ROLE_STYLES` with the new contrast figures; export `maxFret` as one constant. `LatchStrip.tsx` uses `--latch`.
- [x] T031 [US1] Reveal in `src/components/tab/TabStaff.tsx` and `CaptureScreen.tsx` (contracts/staff.md §6): `revealGroups` prop; `CaptureScreen` bumps it just before any write that makes a group (tuplet, plain group, triplet button); an effect compares the set of `tupletId`s with the last drawn and calls `scrollIntoView({ block:"nearest", inline:"nearest" })` on the new group's first bracket element; sync arrival and part change move nothing.
- [x] T032 [US1] Update existing e2e that pin changed sizes, reading each before re-pinning and weakening no assertion: `e2e/capture-surface.spec.ts`, `e2e/rhythm-capture-height.spec.ts`, `e2e/techniques-layout.spec.ts`, `e2e/grouping-layout.spec.ts`, `e2e/grouping-controls.spec.ts`, `e2e/grouping-queued-row.spec.ts` (waits for `unsynced` to go), and **re-read, not re-pin**, the two `justify-end` band tests in `e2e/grouping-band.spec.ts`. Record each in `docs/DECISIONS.md` (FR-065).
- [x] T033 [US1] Build (`npm run build < /dev/null`, no dev server running) and run `npx playwright test e2e/usability-height-budget.spec.ts e2e/usability-staff.spec.ts e2e/usability-floors.spec.ts -g "INV-00[1-5]|INV-007|INV-022|INV-031" --project=mobile < /dev/null`. Prove the budget can fail: add a throwaway `<div className="h-1" />` to `CaptureScreen`'s root, see INV-001 fail, remove it.

**Checkpoint**: US1 independently green.

---

## Phase 4: User Story 2 — Hit what you mean (P1)

**Goal**: Every target meets the floors; inputs 16px on touch; no zoom lock; keyboard, insets and long-press reach handled.

**Independent Test**: `npx playwright test e2e/usability-floors.spec.ts e2e/usability-reach.spec.ts --project=mobile < /dev/null`.

### Invariant probes for User Story 2 (FIRST — each must FAIL on the pre-change code)

- [x] T034 [P] [US2] Probe INV-006 in `e2e/usability-floors.spec.ts`: walk every `a, button, input, select, textarea, [role=button], summary` in view against the floors table; `SENTENCE_LINKS` is the only exemption and each named link is asserted to exist; **Scr** × **Sz** coarse, then **Scr** at 1280×800 fine against the mouse column. Fails before: targets as small as 16×36 (A1–A8).
- [x] T035 [P] [US2] Probe INV-008 in `e2e/usability-floors.spec.ts`: rect gaps ≥8px to every neighbour for delete in the stable row, delete in the selection row, part `Delete`, tuning `Delete`, the inspector's delete, arrangement `Remove`; × 375 and 390. Fails before: adjacent with no gap.
- [x] T036 [P] [US2] Probe INV-009 in `e2e/usability-floors.spec.ts`: tab to a cue (song page, and in a section), press Enter, it is selected; its role is `button`; × coarse and fine. Fails before: a cue is bare text with a tap handler.
- [x] T037 [P] [US2] Probe INV-011 in `e2e/usability-reach.spec.ts` (create): `visualViewport` stubbed via `addInitScript`; after focus, real rects show the paste status, and the inspector's input and set button, above the keyboard; the first refused line is reachable by scrolling; **Sz** × {paste with a refusal, paste ready, inspector chord}. Fails before: 115px and 68px under the keyboard.
- [x] T038 [P] [US2] Probe INV-012 in `e2e/usability-floors.spec.ts`: every action in the long-press sheet is reachable with no press longer than a tap, for {note, rest, barline, repeat}. If it already holds, make it fail on a mutated build that hides the details button, then restore (the audit found no gap, FR-021 keeps it that way).
- [x] T039 [P] [US2] Probe INV-013 in `e2e/usability-reach.spec.ts`: CDP `Emulation.setSafeAreaInsetsOverride` top 47, bottom 34, and landscape left and right 47; every target's rect inside the insets on capture, song page, play view idle, play view running, an open sheet and band's songs. Fails before: no inset is applied (A23).
- [x] T040 [P] [US2] Probe INV-023 in `e2e/usability-reach.spec.ts`: a 120-character title on bands, band's songs, song page, play view and capture shows `-webkit-line-clamp` at most 2 lines (capture alone cuts, back target at the floor); the chord form's hint at a computed 16px has `scrollWidth <= clientWidth`; × **Sz**. Fails before: title cut by 142px (A17) and hint cut at "writte" (A18).

### Implementation for User Story 2

- [x] T041 [P] [US2] Apply floors on remaining raw controls: `src/components/app/TopBar.tsx`, `Footer.tsx`, `BandView.tsx` (titles `line-clamp-2`), `TuningsView.tsx` (family tabs at the floor, `Delete` `ml-2`), `AuthForm.tsx` and `JoinBand.tsx`/`InviteBandmate.tsx` (sentence links exempt, names in `SENTENCE_LINKS`), `src/components/reading/ViewControl.tsx`, density control, `src/components/rhythm/TempoControl.tsx`, `src/components/capture/LatchStrip.tsx` and chord form hint (fits at 16px). Remove all `text-sm` / small-height classes that fight the primitives.
- [x] T042 [P] [US2] `src/components/capture/ColumnInspector.tsx`: stepper halves ≥32×44, `close` at the floor, `TextControl` scrolls its form into view on focus one frame after the inset lands (use `useKeyboardInset`), delete gap ≥8px.
- [x] T043 [P] [US2] `src/components/arrangement/Roadmap.tsx`: a `text` node is a `button` when `onSelectEntry` is given, else a `span`; the section label stays a button. `ArrangementEditor.tsx` gets floors, `Remove` gap ≥8px, stepper ≥32×44.
- [x] T044 [US2] `src/components/app/PasteTab.tsx` (CRLF): order is `role="status"` line, the box (`max-h-[30dvh]` on touch, `rows={8}` on fine), then refusals or preview; `scroll-mt` equal to the status line's height; the box and refused/ignored `code` get `.tab-text`. Update e2e helpers/specs whose selectors move (`e2e/import*.spec.ts` must pass unedited unless a selector truly moved; if one trips, stop and report).
- [x] T045 [US2] Run `npm run build < /dev/null` then `npx playwright test e2e/usability-floors.spec.ts e2e/usability-reach.spec.ts --project=mobile < /dev/null` and `--project=desktop`. Fix every walker finding, or name the control in the plan's accepted list in `docs/DECISIONS.md` with a reason.

**Checkpoint**: US2 independently green.

---

## Phase 5: User Story 3 — Read what is drawn (P1)

**Goal**: Whole chord symbols, legible numerals and rhythm marks on their notes, 4.5:1 text everywhere, staff in JetBrains Mono.

**Independent Test**: `npx vitest run src/lib/reading/__tests__/staff.test.ts` and `npx playwright test e2e/usability-staff.spec.ts e2e/usability-contrast.spec.ts < /dev/null`.

### Invariant probes for User Story 3 (FIRST — each must FAIL on the pre-change code)

- [x] T046 [P] [US3] Probe INV-016 in `src/lib/reading/__tests__/staff.test.ts` (create; arithmetic vs a hand table, no shared code with `chordRooms`) and `e2e/usability-staff.spec.ts`: `scrollWidth <= clientWidth` on each label, no `…`, adjacent labels ≥2px apart, no label past the staff's right edge; **Stf** × {`Em7`, `Cmaj7`, `F#m7b5`, a 10-character symbol, a symbol longer than a line} × {one-digit column, two-digit column, adjacent columns, last column, before a barline, on a repeat, carried in intervals} × **Ptr**. Fails before: `E…`, `F#m7b5` gets 18 of 41px.
- [x] T047 [P] [US3] Probe INV-017 in `e2e/usability-staff.spec.ts`: rect of each row's item within 1px of its column's, on every line of a wrapped staff; **Rows** × **Stf** × **V** × {375×667, 1280×800} × **Bars**; rhythm marks centred on the note. Fails before: marks sit 5–10px off (A27).
- [x] T048 [P] [US3] Probe INV-018 in `e2e/usability-contrast.spec.ts`: every text node's computed colour against its real painted surface with opacity multiplied through ≥4.5:1; a disabled control identified by `disabled` only; **Scr** × **Sz** × **Th**; plus numerals, marks and bar numbers on each of {base, raised, selection}. Fails before: 3–12 runs per screen, 49 on capture (A24, A25).
- [x] T049 [P] [US3] Probe INV-019 in `e2e/usability-contrast.spec.ts`: computed size ≥12px for numerals 2, 3, 16, rhythm marks `1`, `32`, dotted, and bar numbers 1, 17, 128 × {touch, mouse} × **Th**, numeral box bottom at or above the line's top, a mark fits the narrowest column without widening it; neck header 11px with row height equal to `BEFORE_HEIGHTS` and an inlay's `font-weight` above a plain fret's with the same colour. Fails before: 10.4px and struck through (A26).

### Implementation for User Story 3

- [x] T050 [P] [US3] Create `src/lib/reading/staff.ts` (React-free): `chordRooms`, `barRuns`, `barStarts` per contracts/staff.md §2 and data-model.md "Chord room"; room stops at the barline where a line may break. Make T046's unit half pass.
- [x] T051 [US3] Update `src/components/tab/TabStaff.tsx` per contracts/staff.md §3–§4 and §7: column width via `calc(<width>ch + var(--col-pad) + max(0px, …))` (no `0.6rem` literal); chord row `text-[0.7rem]`, semibold, `nowrap`, no `truncate`, `relative z-[1]`; bracket numeral 12px, `line-height: 12px`, `top: 0`, centred, line at `bottom: 0`; rhythm marks 12px centred on the column; bar-number row (`barNumbers` prop, `data-testid="tab-bar-number"`, 12px `--text-dim`, columns that open a bar get a `min-width`); `offsetFor` counts the bar-number row; every column has `data-column`; add `wrap`, `pass`, `revealGroups`, `barNumbers` props with the table in §1. Do not import techniques (`single-owner.test.ts`). `layout.ts` untouched.
- [x] T052 [P] [US3] CSS in `src/app/globals.css`: `.tab-column-selected .tab-bracket-label` and `.tab-bracket` use `--text`; `.tab-rhythm` is `--text-dim`; `.tab-column-reading` outline (staff.md §7, none in print); wrapped-staff rules (staff.md §5) can be added now or in US5.
- [x] T053 [US3] Update `src/components/tab/__tests__/TabStaff.test.tsx` (chord row no `truncate`, numeral size) and then run T018 (re-record markup entries of `baseline.json` only).
- [x] T054 [US3] Build, then run `npx playwright test e2e/usability-staff.spec.ts e2e/usability-contrast.spec.ts --project=mobile --project=desktop < /dev/null` and `npx vitest run src/lib/reading < /dev/null`. Update `e2e/rhythm-marks.spec.ts`, `e2e/rhythm-unknown-values.spec.ts`, `e2e/variant-marks.spec.ts`, `e2e/techniques-surfaces.spec.ts`, `e2e/grouping-surfaces.spec.ts` where sizes moved, reading each first; name each in `docs/DECISIONS.md`.

**Checkpoint**: US1–US3 (the three P1 stories) landed.

---

## Phase 6: User Story 4 — Get to the tab quickly (P2)

**Goal**: Song page and play view put the tab on the first screen and the main actions under the thumb; rarely used controls wait behind one tap.

**Independent Test**: `npx playwright test e2e/usability-reach.spec.ts -g "INV-02[4-6]|SC-010" < /dev/null`.

### Invariant probes for User Story 4 (FIRST — each must FAIL on the pre-change code)

- [X] T055 [P] [US4] Probe INV-024 in `src/lib/reading/__tests__/panels.test.ts` (store, injected storage, **St** × panels × read/set/read again) and `e2e/usability-reach.spec.ts` (dump every Dexie table, count the outbox and watch network requests across 50 toggles; reload; second tab; a hydration error fails it). Fails before: no panel store exists.
- [X] T056 [P] [US4] Probe INV-025 in `e2e/usability-reach.spec.ts`: at song-page scroll top, middle and end × **Sz** × {coarse, none}, Capture and Play view's top is at or below half the screen on touch; on fine the bar is absent and the header has both; last card's bottom clears the bar; empty song, one part, many parts; print: absent. Fails before: Capture and Play view at y=155 (A10).
- [X] T057 [P] [US4] Probe INV-026 in `e2e/usability-reach.spec.ts`: with the state forced through each real route, `click-state` is visible when it must be, the cluster is ≥44 and ≤60 high idle, never hides a message, last staff's bottom clears it, print: absent; {no tempo; stopped hidden, audio lost, fell behind; running with sound; soundless; counting in; following; plain} × {collapsed, open} × **Sz**. Also SC-010: song-page first staff y≤520, play view's y≤160. Fails before: cluster is 81 tall and first staff y=744/244.

### Implementation for User Story 4

- [X] T058 [US4] Song page in `src/components/app/SongView.tsx` (CRLF), contracts/surfaces.md §7: `PageHeader` with Play view and Capture shown on a fine pointer only; one row of `Panel song-tools` (tuning, BPM, export with `export-note` beside it, density, `ViewControl`) and `Panel song-arrange` (adding controls; with no entries the add controls show directly and there is no panel; the selected entry's controls show outside any panel); `song-actions` sticky bottom bar (hidden on fine, `no-print`, bottom/left/right safe insets); part card shows `tempo · beats` from `partHeading` (once T062 lands) and `Delete` has `ml-2`. Edit `src/components/arrangement/ArrangementEditor.tsx` accordingly. Spec 006 FR-020's note stays beside export.
- [X] T059 [US4] Cluster in `src/components/rhythm/ClickBar.tsx` per contracts/click.md §6: collapsed single 57px row (start or beat+stop at left, tempo then `panel-play-cluster` at right; keep `w-[86px]`, beat box and test ids), open adds follow choice, `cluster?: ReactNode` (ViewControl and Capture link) and `onColumn`; `click-state` stays one `role="status"` element always in DOM with the messages table (idle text `sr-only` when collapsed); `click-help` while running; sticky, in flow, `no-print`, bottom safe inset. Update `src/components/rhythm/TempoControl.tsx` floors.
- [X] T060 [US4] `src/components/app/PlayView.tsx`: `main` `max-w-screen-2xl pt-2`; one-row heading (back and title, then `stringLabels — N bpm`); pass `ViewControl` and the Capture link into `ClickBar` as `cluster`; `document.documentElement.style.scrollPaddingBottom` follows the cluster (done in T071's hook once it exists).
- [X] T061 [US4] Update existing tests the cluster and reach changes touch, reading each first: `e2e/click-bar-at-size.spec.ts`, `e2e/click-bar-fit.spec.ts`, `e2e/click-layout.spec.ts`, `src/components/rhythm/__tests__/click-bar.test.tsx`, `e2e/reading-view.spec.ts`, `reading-layout.spec.ts`, `reading-sync.spec.ts`, `reading-helpers.ts`, `tempo-sheet-and-tempo.spec.ts`, `capture.spec.ts`, `sync.spec.ts` (add `openTools(page)`/`openCluster(page)` before reaching tools, view control or an add control; no assertion weakens). Name each in `docs/DECISIONS.md`.
- [X] T062 [US4] T073 and T081 have landed: confirm the song page's `tempo · beats` head text in `src/components/app/SongView.tsx` (CRLF) reads `partHeading` from `src/lib/reading/bars.ts` and `e2e/usability-reach.spec.ts` still passes; until then it shows tempo only.

**Checkpoint**: US4 green.

---

## Phase 7: User Story 6 — A mouse gets a tighter screen (P2)

**Goal**: A fine pointer gets tighter sizes at any width; touch is unchanged. (Ordered before US5 because it is small and tokens already exist.)

**Independent Test**: `npx playwright test e2e/usability-density.spec.ts --project=mobile --project=desktop --project=no-pointer < /dev/null`.

### Invariant probes for User Story 6 (FIRST — each must FAIL on the pre-change code)

- [x] T063 [P] [US6] Probe INV-020 in `e2e/usability-density.spec.ts`: in the same window one per pointer, a mouse shows ≥15% more columns on a line and a six-string staff ≥15% shorter than touch, at {500×800, 1280×800} × {with a chord row, with a bar row, plain}. Fails before: sizes do not follow the pointer.

### Implementation for User Story 6

- [x] T064 [US6] Verify every size in the floors table's "Mouse after" column is produced by the tokens in `src/app/globals.css` and no component overrides it with a fixed class (`grep -rn "h-9\|py-1\b\|text-sm\|sm:" src/components`); fix stragglers. Fret cell 32×32, dead-note 32×24, latch 70×26, control 32.
- [x] T065 [US6] Build and run `npx playwright test e2e/usability-density.spec.ts --project=mobile --project=desktop --project=no-pointer < /dev/null`; confirm T009 and T063 pass, including a 500px mouse and an 820px tablet, and that `no-pointer` asserts its own state first.

**Checkpoint**: US6 green.

---

## Phase 8: User Story 5 — Keep your place, and say where you are (P2)

**Goal**: Wrapped lines at barlines, bar numbers, named section passes, beats per bar, and a highlight that follows the click.

**Independent Test**: A sixteen-bar part arranged twice inside a section at 375 and 1280 with the click running: `npx playwright test e2e/usability-wrap.spec.ts e2e/usability-highlight.spec.ts < /dev/null`.

### Invariant probes for User Story 5 (FIRST — each must FAIL on the pre-change code)

- [X] T066 [P] [US5] Probe INV-032 in `e2e/usability-wrap.spec.ts` (create): over a fixture with a hand-written expected list per shape, `passBars` against `countBars` summed in the test; two browser contexts agree; a sliced pass says its own range and the running number; capture, paste preview and export have none; **Bars** × **Arr**. Fails before: no bar numbers exist.
- [X] T067 [P] [US5] Probe INV-033 in `src/lib/reading/__tests__/bars.test.ts` (create; `expandArrangement` against hand tables) and `e2e/usability-wrap.spec.ts` (heading text): every pass through a section is named and the second-time-through marked; `visits` never changes `sections`, `pass` or order; names compare trimmed and case-insensitively; **Arr**. Fails before: only name changes are announced.
- [X] T068 [P] [US5] Probe INV-034 in `src/lib/reading/__tests__/bars.test.ts` and `e2e/usability-wrap.spec.ts`: `beatsPerBar` against hand tables and the heading text is absent or exact, never containing `/`; all bars 3, 4, 5, 6 beats; one bar differs; a pickup; one untimed bar; an empty bar in the middle; leading and trailing barline; a tuplet in a bar; a part of no durations; a fractional bar; tempo absent with no usable tempo. Fails before: `beatsPerBar` does not exist.
- [X] T069 [P] [US5] Probe INV-038 in `e2e/usability-wrap.spec.ts`: each line's top against the gutter block's within 1px, `.tab-lines` `scrollWidth` against its width; **Bars** × **V** × {375, 820, 1280} × **Ptr**; at 1280 the staff is ≥90% of the window; print emulation cuts no line; a variant's marks and removal gaps stay on their columns with one caption per pass. Fails before: the play view scrolls sideways (11% shown on a phone, 54% at 1280).
- [X] T070 [P] [US5] Probe INV-035 in `e2e/usability-highlight.spec.ts` (create): a `MutationObserver` installed before start logs each change of `.tab-column-reading` and of the beat box with timestamps; the highlight never shows outside following, and changes within 50ms of a beat; count-in, first column, each pass, across a barline, a repeat, a tuplet, last timed column, into the plain beat, a part that stops being timed, a tempo change mid-run, the follow choice off, every ending of `click-every-ending.spec.ts`. Fails before: no highlight exists.
- [X] T071 [P] [US5] Probe INV-036 in `src/lib/reading/__tests__/notation-unchanged.test.ts` (create): `readNotation` output deep-equal to `notation-baseline.json` (T007); `playhead()` called between every step of a recorded engine run leaves the schedule identical; **Bars** × **Arr** × tempos 40, 120, 300. `click-timing.spec.ts`, `click-running.spec.ts`, `engine-seams.test.ts` and `tables.test.ts` stay unedited. This guards drift so it passes before the change by design: the `playhead()` half fails before because `playhead` does not exist, and the baseline half is proven able to fail by a throwaway edit to the walker's `at` arithmetic. (Done by `notation-baseline.test.ts` and the `playhead` block of `scheduler.test.ts`; no separate file was made.)
- [X] T072 [P] [US5] Probe INV-037 in `e2e/usability-highlight.spec.ts`: wheel away during a run, no scroll for 4s, then following resumes; {wheel, touch swipe, scroll key} on the page; reduced motion jumps; computed `outline-style` differs from the selection's and the variant's; print: none. Fails before: no highlight or follow exists. (Split from the original T072; the rest is T115 to T117.)
- [X] T115 [P] [US5] Probe INV-037 in `e2e/usability-highlight.spec.ts`: {wheel, touch swipe, scroll key} on a wide bar's own scroller pause following as they do on the page. Fails before: no highlight or follow exists.
- [X] T116 [P] [US5] Probe INV-037 in `e2e/usability-highlight.spec.ts`: a column removed mid-run. Fails before: no highlight or follow exists.
- [X] T117 [P] [US5] Probe INV-037 in `e2e/usability-highlight.spec.ts`: a sync write mid-run keeps the highlight. Fails before: no highlight or follow exists.

### Implementation for User Story 5

- [X] T073 [P] [US5] Create `src/lib/reading/bars.ts`: `passBars` (calls `countBars`; a column's number is `offset + column.barNumber` from `layoutPart`) and `partHeading` (calls `beatsPerBar`; words like `4 beats a bar`, never a fraction; tempo left out with no usable tempo) per data-model.md "Bars" and "Part heading". Make the unit halves of T067/T068 pass.
- [X] T074 [P] [US5] `src/lib/arrangement/expand.ts`: add `visits` to each step and export `ordinal`, a read-side derivation only (`visits` never changes `sections`, `pass` or order). Nothing stored.
- [X] T075 [US5] `src/lib/rhythm/notation.ts` (CRLF): move the loop into one internal walker with a sink; `readNotation` unchanged in signature and result; export `notationColumns(passes)` and `beatsPerBar(events)` (calls `readBar`); `readBar` reports each hit to the sink at the moment it advances `at`. `clickStream` is not named in the diff. Make T071's baseline half pass.
- [X] T076 [US5] `src/lib/rhythm/scheduler.ts`: add `playhead()` per contracts/click.md §2 (`due()` keeps the last click as `shown`; interpolates between `shown` and `queue[0]`, clamped; `stop` clears `shown`; reads only). `audio.ts`, `stream.ts` zero diff.
- [X] T077 [P] [US5] Create `src/lib/reading/position.ts`: `columnKey`, `columnAt`, `readingStops`, `stepColumn`, `stepBar` (back goes to the current bar's start first), `FOLLOW_REST_MS = 4000`, `mayFollow`, with hand-table tests in `src/lib/reading/__tests__/position.test.ts`. `marks.ts` keeps its own copy of the column key text; pin it with a test (plan: "Pinned, not structural").
- [X] T078 [US5] `src/components/rhythm/useClick.ts` (CRLF): capture `score`, `notationColumns` and `follow` at `start`; in the existing `tick`, right after `due()` and the beat write, read `playhead()`, subtract the count-in's ticks, call `columnAt`, and call `onColumn` on change (never with a column when `follow` is false); add `restart()` (`engine.stop("tap")` then `start()` synchronously in the same event); `onColumn` is a ref.
- [X] T079 [P] [US5] Create `src/components/reading/useReadingPosition.ts` per contracts/click.md §5: owns the one highlighted element, writes `.tab-column-reading` directly on the DOM, reapplies after any commit of passes, remembers the last reader scroll (`wheel`, `touchmove`, `pointerdown` on the document element, PageUp/PageDown/Home/End/Up/Down not used by a shortcut), follows with `scrollIntoView` (smooth unless reduced motion), sets `scrollPaddingBottom` from the cluster's height.
- [X] T080 [US5] Wrapped staff in `src/components/tab/TabStaff.tsx` and `src/app/globals.css` per contracts/staff.md §5: gutter blocks built from the same row components, `.tab-lines` flex-wrap, `.tab-bar-run` with hidden scrollbar (Deviation 7), `.tab-lines-end`; `RemovalGap`/`Gap` go in the run of the column they come before; bars from `barRuns`.
- [X] T081 [US5] `src/components/app/PlayView.tsx`: use `wrap`, `barNumbers={{ offset: passBars.offset[i] }}` and `pass` on each staff; pass-head row in order (part label, `Verse, 2nd time`, `pass 2 of 4`, `bars 3–4 of this part`, part name, at a part's first pass `120 bpm · 4 beats a bar`), the `bars` text says it counts the part's own bars; no section heading above the card; each entry `print-keep`; wire `useClick`'s `onColumn` to `useReadingPosition.place`. Song page: `barNumbers={{ offset: 0 }}` in `SongView.tsx` (CRLF). Section name moves into the head row (Deviation 8).
- [X] T082 (click-* specs updated to open the More panel before using Follow/Capture, and click-state reads the 32px fine-pointer floor; all green) [US5] Update `e2e/reading-view.spec.ts`/`variant-marks.spec.ts` selectors for wrapped play-view markup if needed, build, and run `npx playwright test e2e/usability-wrap.spec.ts e2e/usability-highlight.spec.ts e2e/click- < /dev/null` plus `npx vitest run src/lib/rhythm src/lib/reading < /dev/null`. `click-timing`, `click-running`, `click-every-ending`, `engine-seams.test.ts`, `tables.test.ts`, `stream.test.ts` pass unedited; if one trips, stop and report.

**Checkpoint**: US5 green; the song page's `tempo · beats` (T062) now has its source.

---

## Phase 9: User Story 7 — Paste ordinary text without a fight (P3)

**Goal**: `Am7-D7` beside a good system is listed as ignored; still-refused hyphen-joined chords say so. Spec 004 holds.

**Independent Test**: `npx vitest run src/lib/reading/__tests__/paste-joined-chords.test.ts src/lib/tab < /dev/null`, then the spec 004 probe config.

### Invariant probes for User Story 7 (FIRST — each must FAIL on the pre-change code)

- [X] T083 [P] [US7] Probe INV-027 in `src/lib/reading/__tests__/paste-joined-chords.test.ts` (create), through `readTab`: each **Joined** line (`Am7-D7`, `Am7-D7-G`, `Cmaj7-Fmaj7`, `Dm7-G7-Cmaj7`, `F#m7-B7`, `Dsus4-A7`, `Cadd9-G`, `Bbm7-Eb7`, `Am-G7`) × **Pos** (directly above/below; apart above/below; between two systems) reads `ready`, same columns as without it, and the line is in `ignored` with its number; at an offset above, the line reads as a chord row exactly as `main` (compare clipboards). Fails before: refused.
- [X] T084 [P] [US7] Probe INV-028 in the same file: every **Stays** line (`A7-D7`, `E5-A5`, `C-G7`, `A7-D7-E7`, `E5-G5-A5`, `D-7-G-7`, `Am7-b7`, `Am7-7`, `Am7-5`, `Bm7-5`, `Am7-D7-`, `-Am7-D7`, `Am7--D7`, `G5-7`, `E-5-7`, `(c) 1999-2004`, `1-2-3-4-`) × **Pos** × {bass4-e, guitar6} still refuses; the oracle is a literal table, not `joinedByQuality`. Passes before the change by design (a hold-the-line check); proven able to fail by making `joinedByQuality` accept `A7-D7` temporarily.
- [X] T085 [P] [US7] Probe INV-029 in the same file: for each refused line the kind and the set of refused line numbers equal `main`'s recorded ones (record them from unedited `parse.ts` into a literal table first); for `chords-joined`, following the advice (spaces, set apart; or deleted) makes the paste read; {`A7-D7`, `E5-A5`, `D-7-G-7`, `C-G7`, `A7-D7-E7`, `E5-G5-A5`} × **Pos** × {spaces, set apart; deleted}; `G5-7`, `E-5-7`, `Am7 - D7` keep today's code. Fails before: wording is about notation characters and there is no `chords-joined` code.
- [X] T086 [P] [US7] Probe INV-030: add the post-change check script step to `quickstart.md` runs by writing `src/lib/reading/__tests__/spec004-holds.test.ts` that shells nothing but asserts `specs/004-ascii-import/review-probes` failures equal the set in `specs/007-usability-pass/audit/main-probe-failures.txt` (T006) and F75's count ≤43, expected 39. It cannot fail first: it compares post-change failures to a recorded set. Prove it can fail by temporarily making `readsAsProse` accept `A7-D7`.

### Implementation for User Story 7

- [X] T087 [US7] `src/lib/tab/parse.ts` only per contracts/reader.md: add `joinedByQuality` (split on `-`, ≥2 non-empty pieces, uppercase root and `parseChord` reads each, `N.C.` excluded, some piece matches `^[A-G][#b]?[a-z]`), one line in `readsAsProse`, the `chords-joined` code and reason text, `looksJoined`, and one line in `failed` mapping a refusal on a line to the same refusal with that code. Nothing else. Commit this on its own (plan build step 5). `reading.ts` zero diff.
- [X] T088 [US7] Run `npx vitest run src/lib/tab src/lib/reading/__tests__/paste-joined-chords.test.ts < /dev/null` (spec 004's `src/lib/tab/__tests__/` unedited), then `npx vitest run --config specs/004-ascii-import/review-probes/vitest.probes.config.mts < /dev/null`: only the 19 recorded failures may fail (the timing probe `INV-014-030` may fail under load; compare with `main` in the same session). Record the F75 count (expect 39 of 202, at most 43) in `docs/DECISIONS.md`. Then `npx playwright test e2e/import < /dev/null`.

**Checkpoint**: US7 green.

---

## Phase 10: User Story 8 — Work from the keyboard (P3)

**Goal**: Shortcuts per FR-057 from one table, a help overlay, typed frets through the same `press` a tap uses.

**Independent Test**: `npx playwright test e2e/usability-keys.spec.ts < /dev/null` and `npx vitest run src/lib/keys src/lib/capture < /dev/null`.

### Invariant probes for User Story 8 (FIRST — each must FAIL on the pre-change code)

- [x] T089 [P] [US8] Probe INV-039 in `e2e/usability-keys.spec.ts` (create): for each key, type into each input and compare value, URL, Dexie and page state before and after (**Keys** × **Inp**); **Keys** × **Mod** (Ctrl, Cmd, Alt, composition); **Keys** with a sheet open; Space and Enter on a focused button, a link and a column; a key on a screen it is not listed for does nothing. Fails before: `?`, Space-on-play and the rest do nothing/exist nowhere, so the positive control (the key acts when it should) fails.
- [x] T090 [P] [US8] Probe INV-040 in `e2e/usability-keys.spec.ts`: run each key on one page and the tap on another, compare a full Dexie dump ignoring ids and clocks; read the help's rows and run each, so a row cannot be listed and dead; **Keys** × screens × **Lat**, first and last column, both ends of part and string; no shortcut deletes, cuts or pastes. Fails before: no shortcuts or help exist.
- [x] T091 [P] [US8] Probe INV-041 in `src/lib/keys/__tests__/fretEntry.test.ts` (create, hand tables) and `e2e/usability-keys.spec.ts`: `keyboard.type` with no delay then read columns in rank order; `5 7 3 8 0 12 15 24 25` at delay 0, 10, 700; `1` then each of Enter, a wait, `x`, Left, a digit that goes over; `2` on a neck of 24; held keys; a part change with a digit waiting; a sheet opening with one waiting; no two stored ranks equal. Fails before: no keyboard entry exists.

### Implementation for User Story 8

- [x] T092 [P] [US8] Create `src/lib/keys/shortcuts.ts` (`SHORTCUTS` with every row of FR-057 and nothing else, `screenFor`, `shortcutFor`, `acceptsShortcut` per contracts/keys.md §1–§2; Shift is not a modifier; Esc is never a shortcut; `event.repeat` ignored for digits and `x`) with tests in `src/lib/keys/__tests__/shortcuts.test.ts`.
- [x] T093 [P] [US8] Create `src/lib/keys/fretEntry.ts` (pure reducer, data-model.md; `1`/`2` wait ~600ms; pair above `maxFret` enters two notes; other key/sheet/part change flushes the waiting digit; leaving enters nothing), reading the same exported `maxFret` as `Fretboard.tsx`.
- [x] T094 [P] [US8] `src/lib/capture/cursor.ts`: move `Cursor` here; add `cursorStep` and `cursorBar` (step by stored column, back from first gives `null`, on from last gives `"end"`) with tests in `src/lib/capture/__tests__/cursor.test.ts`.
- [x] T095 [US8] Create `src/components/keys/KeyboardHelp.tsx` (the one `keydown` listener and the overlay `Sheet` labelled `Keyboard shortcuts`, `data-testid="help-overlay"`, `help-open` visible on fine pointer only, `?` opens or closes anywhere unless resting, closes on Esc, close control or `?`) and `src/components/keys/useScreenKeys.ts` (actions read through a ref); mount `KeyboardHelp` once in `src/app/layout.tsx`. Put the `help-open` control in `TopBar.tsx` and capture's merged row.
- [x] T096 [US8] Play view keys in `src/components/app/PlayView.tsx`: Space toggles click (nothing with no usable tempo or notation not ready), `r` restarts via `useClick.restart`, Left/Right and `[`/`]` use `stepColumn`/`stepBar` from the keyed position while stopped; starting clears a keyed position (data-model.md "Reading position").
- [x] T097 [US8] Capture keys in `src/components/capture/CaptureScreen.tsx` and `Fretboard.tsx` per contracts/keys.md §5: Left/Right/`[`/`]` call the same `onSelectColumn` route as a tap; Home/End the jump buttons; `,`/`.` the chips' `openPart` (one function shared with tap); Up/Down move the keyboard string (starts on the lowest, clamped on tuning change, never stored; neck marks it with `data-keyboard-string` and `▸E` once used); digits/Enter through the reducer and a promise-chain queue calling `pressRef.current` (latest `press`, `waitForDelivery` on next `columns` change or 250ms); `x` is `press(string, "x")`; `digit-waiting` shown in the status row in place of the duration. `press` itself is not copied or wrapped.
- [x] T098 [US8] Build and run `npx playwright test e2e/usability-keys.spec.ts --project=desktop < /dev/null` and `npx vitest run src/lib/keys src/lib/capture < /dev/null`; then the whole existing capture/click specs once: `npx playwright test e2e/capture e2e/click- < /dev/null`. Results: usability-keys 9/9, keys+capture units green. Existing-spec failures NOT from US8, left for review: capture-surface parity/INV-009 (Download button now inside the collapsed tools panel), INV-011 neck height +24px at phone, click-following:233 (follow toggle in the closed cluster panel), flaky timeouts; US8 itself fixed one clash (help-open aria-label contained "cut").

**Checkpoint**: US8 green.

---

## Phase 11: Polish, audit, amendments and the guards

**Purpose**: Build steps 6 and 10. Close the audit, amend earlier specs in place, run the fast guard tier.

### Invariant probes (FIRST in the phase — each must FAIL on the pre-change code)

- [x] T099 [P] Probe INV-045 in `scripts/check-usability-amendments.sh` (create, add `check:usability-amendments` to `package.json`): each row of plan.md's *Existing tests this changes on purpose* appears in `docs/DECISIONS.md`, and FR-064's named requirements (specs 001 FR-026, 002 SC-006, 003 FR-020/SC-009/plan INV-013, 004 reader contract and INV-010, 005 FR-026/FR-013–015, 006 FR-001) carry the new text, including FR-020's exact wording. Fails before: nothing is amended.
- [x] T100 [P] Probe INV-046 in `scripts/check-usability-audit.sh` (create, add `check:usability-audit`): every A-number A1 to A33 in `specs/007-usability-pass/audit/` has an outcome in `after.txt`/`outcomes.md` (fixed, accepted with a reason, or logged as a new idea). Fails before: no outcomes file exists.

### Closing work

- [x] T101 Re-run the audit on a production build: `npm run build < /dev/null`, `npx playwright test -c specs/007-usability-pass/audit/playwright.audit.config.ts < /dev/null`, `node specs/007-usability-pass/audit/summarise.mjs < /dev/null > specs/007-usability-pass/audit/after.txt`. (This is the audit checkpoint after the P1 stories, plan build step 6; repeat at the end.)
- [x] T102 Write `specs/007-usability-pass/audit/outcomes.md`: one row per A1 to A33 with outcome and, for accepted/logged, the reason (A11 accepted, A30 accepted, A32 logged as a new idea). Make T100 pass.
- [x] T103 Amend in place and record in `docs/DECISIONS.md` with before and after figures (FR-064): `specs/003-*` FR-020 (use the exact wording in spec.md FR-064), SC-009 and plan INV-013; `specs/001-*` FR-026's list of rows; `specs/002-*` SC-006 "toolbar position unchanged"; `specs/005-*` FR-026 and FR-013 to FR-015; `specs/006-*` FR-001; `specs/004-ascii-import/contracts/reader.md` and INV-010's cost (43 → 39 of 202). Also record Deviations 1 to 19 that change an earlier decision. Make T099 pass.
- [x] T104 [P] Run `npm run check:untouched-usability < /dev/null` and expect no output. Run `check:untouched`, `check:untouched-rhythm`, `check:untouched-reading` and note in `docs/DECISIONS.md` that they fail on this branch by design (Deviation 12; none in CI).
- [x] T105 [P] Run `npm run typecheck < /dev/null` and `npm run lint < /dev/null`; fix everything. Run `npm run test:budget < /dev/null`.
- [x] T118 `e2e/capture-surface.spec.ts` INV-011, neck baseline height on the desktop project (x4, grid 24px off `NECK_HEIGHT_BASELINE_PX`, line 762). Find out whether the 24px is FR-023's tighter fine-pointer frets. If it is, keep `NECK_HEIGHT_BASELINE_PX` for the coarse pointer unchanged, give the fine pointer its own recorded baseline, and record before and after in `docs/DECISIONS.md`. If it is not, fix the layout. Touch sizing must not change either way.
- [x] T119 `e2e/capture-surface.spec.ts` "inspector parity with the toolbar" (x6, desktop): diagnose, then fix the product or, only if the expectation is provably stale, amend it and record why in `docs/DECISIONS.md`.
- [x] T120 `e2e/reading-layout.spec.ts` INV-016 (play view frets, pass 1) and INV-017 (line 290) (x6, desktop): diagnose, then fix the product or, only if the expectation is provably stale, amend it and record why in `docs/DECISIONS.md`.
- [x] T121 `e2e/tempo-tap-pad-and-set.spec.ts` INV-015/016 double tap on set (x3): the second tap adds a column behind the closed sheet at every gap from 40 to 160ms. This is a real defect: fix it in the product so the second tap never reaches what is under the sheet. Do not edit, loosen or skip the test.
- [x] T122 `e2e/grouping-layout.spec.ts` and `e2e/grouping-controls.spec.ts`: add `openTools`/`openCluster` where they reach the expanded, compact or add controls, and run both on every project.
- [x] T123 (all e2e files re-run: click 191, usability 112, rest 1860 passed, 0 failed) Run the e2e files not yet re-run since the layout changed: every `e2e/click-*.spec.ts`, every `e2e/usability-*.spec.ts`, and the rest of `ls e2e/*.spec.ts`. For each failure outside the known FU19 sync flake and the 19 known spec 004 probe failures, fix the product, or amend a provably stale expectation and record why in `docs/DECISIONS.md`. If a failure needs real work, add it as its own new task and tick this one.
- [x] T106 Run quickstart.md §1 to §8 end to end as written (the commands, not the §9/§10 human passes). Record any failure outside the known FU19 sync flake and the 19 known spec 004 probe failures, and fix it. (Earlier passes: §1 and §3 to §6 passed; T118 to T123 hold what §7 found.)
- [x] T107 Guards: run the project's fast guard tier — `npm test < /dev/null` (structural, inventory, golden, exhaustiveness and fixture-writer tests, including `frets-unchanged.test.ts`, `round-trip.test.ts`, `single-owner.test.ts`, `assert-model` and the baseline), `npm run typecheck`, `npm run lint`, `npm run check:untouched-usability`, `npm run check:usability-amendments`, `npm run check:usability-audit` — and fix every failure BEFORE any push.

### Owed to a person or a real phone (human-owned; leave unchecked until done)

- [ ] T108 🛑 BLOCKED: needs a real iOS Safari phone — confirm 16px inputs do not zoom on focus, a pinch zooms, and a double tap on the neck does not (INV-043 item 1).
- [ ] T109 🛑 BLOCKED: needs real iOS and Android phones with the on-screen keyboard — confirm the keyboard hides neither the paste status nor the inspector's input and set button (INV-043 item 2).
- [ ] T110 🛑 BLOCKED: needs a phone with the app installed to the home screen — confirm nothing sits under the status bar or home indicator (INV-043 item 3).
- [ ] T111 🛑 BLOCKED: needs a real phone browser with its bars showing (screen shorter than 375×667) — confirm six strings behave as the swipe rule says (INV-043 item 4).
- [ ] T112 🛑 BLOCKED: needs a real thumb on a real phone — try a fret tap, a jump button in its 26px row, and the two bracket controls (INV-043 item 5).
- [ ] T113 🛑 BLOCKED: needs a real phone with the click running — see the reading highlight and judge it (INV-043 item 6).
- [ ] T114 🛑 BLOCKED: needs a person looking at a real browser at actual size in dark and light themes — work through quickstart.md §9 (capture six strings, selection row, status row, neck header, chord-tone contrast with the new light accent, JetBrains Mono staff, song page panels and bottom bar, wrapped play view at 375 and 1280, a bar wider than a line on Windows desktop, highlight, help overlay, mouse density, landscape capture, print preview) (INV-042). Never ticked to pass a gate.

---

## Dependencies & Execution Order

### Phase dependencies

- **Phase 1 (Setup)**: none. T006, T007, T008 MUST run before any source edit (they read unedited code).
- **Phase 2 (Foundational)**: after Phase 1. Blocks all stories.
- **US1 (P1)** → **US2 (P1)** → **US3 (P1)**: all need Phase 2. US1 T031 and US3 T051 both edit `TabStaff.tsx`: do US1 first. US2 T044 and US1 T027 are different files and can overlap.
- **US4 (P2)** needs Phase 2; T059/T060 prefer US3's staff changes done; T062 waits on T073/T081 (from US5) for `partHeading`.
- **US6 (P2)** needs Phase 2 and US1/US3 (the tokens in use).
- **US5 (P2)** needs US3 (staff rows, `data-column`) and US4 (`ClickBar` cluster, `PlayView` heading).
- **US7 (P3)** is independent of the rest (only `parse.ts` and tests); it can run any time after Phase 1.
- **US8 (P3)** needs US1 (`maxFret`, cursor), US5 (`restart`, position) and Phase 2 (`Sheet`).
- **Phase 11** needs all stories wanted. T101 may run early as the step-6 checkpoint.

### Within each story

- Probes first and must fail on pre-change code (or carry the stated reason and mutation proof); then implementation; then the existing-tests update; then the build-and-run task.
- Never run `npm run build` or Playwright while a dev server holds `.next`.

### Parallel opportunities

- Setup T001, T002, T004–T008 in parallel after T003.
- Phase 2 probes T009–T011 in parallel; T013, T015, T016 in parallel with T012.
- Every story's probe block is [P] (different spec files or distinct sections of one file written by one agent).
- US7 can run entirely in parallel with US1–US6.
- T041, T042, T043 touch different files.

### Parallel example: User Story 1 probes

```bash
Task: "Probe INV-001/002 in e2e/usability-height-budget.spec.ts"
Task: "Probe INV-005 in e2e/usability-staff.spec.ts"
Task: "Probe INV-007 in e2e/usability-floors.spec.ts"
```

---

## Implementation Strategy

### MVP first (P1 stories, the plan's cut)

1. Phase 1 → Phase 2 → US1 → US2 → US3 → T101/T102 audit checkpoint → T103 amendments for what has landed.
2. **STOP and VALIDATE**: `quickstart.md` §1–§4 and §8. This lands all three P1 stories (plan build step 6).

### Incremental delivery

3. US7 (small, separable) → US4 → US6 → US5 → US8, each leaving the suite green.
4. Phase 11 closing work and T107 guards before any push.

### Notes

- Existing tests that pin changed sizes are edited only to match the amended requirement, each named in `docs/DECISIONS.md`; none is deleted (FR-065).
- Must pass unedited: `src/lib/tab/__tests__/`, `click-timing.spec.ts`, `click-running.spec.ts`, `click-every-ending.spec.ts`, `engine-seams.test.ts`, `tables.test.ts`, `stream.test.ts`, `import*.spec.ts`. If one trips, stop and report.
- Spec 006 FU19 (sync flake) is not this entry's: do not lengthen a wait for it.
- Phase 11's 🛑 tasks are owed, not missing; they are never ticked to satisfy a gate.

## Phase 12: Review remediation

- [x] T124 Adopt review-probes/INV-041-typing-keeps-order.spec.ts into e2e/ as a failing test first, and replace the column count in `INV-041 fast typing keeps every note in order` with the stored order — review F1
- [x] T125 Put the capture navigation keys through the same queue as fret presses, so a key applies after every note before it has landed and reads the delivered cursor: `1` Left `3` on `5 5` stores `5 5 3 1` at any speed — review F1 (BLOCKER), src/components/capture/CaptureScreen.tsx:335
- [x] T126 Adopt review-probes/INV-037-highlight-stays-on-screen.spec.ts into e2e/ as a failing test first, and run its unrun members: a touch swipe and a scroll key away, a column removed mid-run, reduced motion — review F2
- [x] T127 Give `ClickBar` a ref on its root and pass it to `useReadingPosition`, keeping `scrollPaddingBottom` current as the panel opens and closes, so a followed column is never under the cluster — review F2 (MAJOR), src/components/app/PlayView.tsx:57
- [x] T128 Adopt review-probes/INV-001-002-003-004-031-capture-matrix.spec.ts into e2e/ as a failing test first — review F3, F6
- [x] T129 Drop `hidden min-[400px]:inline` and let the title truncate as a `min-w-0` flex item, so it shares the row at 375 and gives way only as the chips need the room — review F3 (MAJOR), src/components/capture/CaptureScreen.tsx:484
- [x] T130 Adopt review-probes/INV-022-status-every-combination.spec.ts into e2e/ as a failing test first — review F4
- [x] T131 Re-budget the status row so the longest status, a 10-character symbol, the waiting digit and both jump buttons fit at 375 with only the tones giving way, and hold an unknown symbol whole as a known one is — review F4 (MAJOR), src/components/capture/CaptureScreen.tsx:577
- [x] T132 Adopt review-probes/INV-019-neck.spec.ts into e2e/ as a failing test first — review F5
- [x] T133 Mark inlay frets `font-semibold` in the neck header, keeping the row height and the one colour — review F5 (MAJOR), src/components/capture/Fretboard.tsx:145
- [x] T134 Keep a usable band with the chord form open at 553 on six and seven strings, for example by letting the form take the neck's place while it is open; probe adopted in T128 — review F6 (MAJOR), src/components/capture/CaptureScreen.tsx:646
- [x] T135 Adopt review-probes/INV-016-017-038-staves.spec.ts into e2e/ as a failing test first, and add its unmeasured surfaces: song page compact, capture selecting, paste preview — review F7 — adopted as e2e/usability-staves.spec.ts; the song page now gets the print measure too. Capture selecting and the paste preview are not separately measured: they use the same `.tab-bar-run` print rule.
- [x] T136 In the print rules, let `.tab-bar-run` wrap or break so every column of a bar wider than the page prints — review F7 (MAJOR), src/app/globals.css:413
- [x] T137 Adopt review-probes/INV-040-capture-keys.spec.ts into e2e/ as a failing test first; leave its `Home during a selection` test out, as that is MINOR F14 and not this phase's — review F8
- [x] T138 Scroll the active column into view when the keyboard moved it, by the call contracts/staff.md §6 names and gated as it says — review F8 (MAJOR), src/components/tab/TabStaff.tsx:165
- [x] T139 Adopt review-probes/INV-005-new-group-in-view.spec.ts into e2e/ as a failing test first — review F9
- [x] T140 Arm the reveal only once a group was made, or disarm it on a refusal, so a group arriving by sync moves nothing — review F9 (MAJOR), src/components/capture/CaptureScreen.tsx:880
- [x] T141 Adopt review-probes/INV-006-010-018-every-screen.spec.ts and review-probes/screens.ts into e2e/ as a failing test first — review F10, F11
- [x] T142 Give the offline page's link the control height on both pointers — review F10 (MAJOR), src/app/offline/page.tsx:16
- [x] T143 Give the `default` pill an ink that reaches 4.5:1 on its surface in both themes — review F11 (MAJOR), src/components/app/TuningsView.tsx:52
- [x] T144 Adopt review-probes/INV-007-008-toolbars.spec.ts into e2e/ — held in review, no fix owed
- [x] T145 Adopt review-probes/INV-009-012-021-023-025-surfaces.spec.ts into e2e/ — held in review, no fix owed
- [x] T146 Adopt review-probes/INV-013-insets.spec.ts into e2e/ — held in review, no fix owed
- [x] T147 Adopt review-probes/INV-020-two-pointers.spec.ts into e2e/, replacing the hand-applied tokens in `usability-density.spec.ts` — held in review, no fix owed
- [x] T148 Adopt review-probes/INV-026-cluster-states.spec.ts into e2e/ — held in review, no fix owed
- [x] T149 Adopt review-probes/INV-032-033-034-bars-sections.spec.ts into e2e/ — held in review, no fix owed
- [x] T150 Adopt review-probes/INV-035-highlight-timing.spec.ts into e2e/ — held in review, no fix owed
- [x] T151 Adopt review-probes/INV-039-every-input.spec.ts into e2e/ — held in review, no fix owed
- [x] T152 Adopt review-probes/reader/ into src/lib/reading/__tests__/, recording `main`'s results as a literal table so the suite needs no extraction of `main` — adopted as src/lib/reading/__tests__/reader-vs-main.test.ts with main-reader-table.json; the offsets-and-sus probe only prints (no assertion), so it stays in review-probes
- [x] T153 Name `e2e/click-running.spec.ts` and `e2e/click-every-ending.spec.ts` in `docs/DECISIONS.md` as edited, with why — review F22
- [x] T154 After every fix above, re-run `audit/` so `audit/after.txt` holds current figures, and update `audit/outcomes.md` if any changed — review F20
- [x] T155 Delete `zz2.mjs` and `.vitest/` from the repo root; if the suite recreates `.vitest/`, add it to `.gitignore` — review F23
- [x] T156 Last of all: for every file changed against `main` that `main` holds, restore `main`'s line endings, so `git diff main --stat` matches `git diff main --stat --ignore-space-at-eol` — review F21

## Phase 13: Review remediation

Each "add" below means append to that file by hand: never `cp` a probe over an existing file. Leave out each probe's `CANDIDATE` hook and keep its `test.setTimeout`. Keep each file's line endings.

- [x] T157 Add the tests of review-probes/INV-031-title-beside-chips.spec.ts to e2e/capture-matrix.spec.ts as failing tests first, and give the test at e2e/capture-matrix.spec.ts:217 the long title its name claims — review F28
- [x] T158 Let the title give way first and the chips hold their content, so the strip is never 0px and `+ part` is reachable at any title length, with the back target at its 44px floor: drop `min-w-0`, and use back `flex: 1 1 0; min-width: var(--control); max-width: max-content` with the scroller `flex: 0 1 auto; min-width: 0`, which passed 24 of 24 through the page. `e2e/usability-reach.spec.ts:159` must pass on both projects — review F28 (BLOCKER), src/components/capture/CaptureScreen.tsx:529
- [x] T159 Add the tests of review-probes/INV-040-jump-keys-against-buttons.spec.ts to e2e/usability-capture-keys.spec.ts as failing tests first — review F29
- [x] T160 Make the `start` and `end` keys do exactly what the jump buttons do, setting the cursor without clearing latches, still through the queue, and still resting during a selection — review F29 (MAJOR), src/components/capture/CaptureScreen.tsx:455
- [x] T161 Add the tests of review-probes/INV-022-long-symbols-and-waiting-words.spec.ts to e2e/usability-status-row.spec.ts as failing tests first — review F30, F31
- [x] T162 Hold a chord symbol `shrink-0` up to 10 characters only; past that, let it shrink to 10 characters and truncate, known and unknown alike, so both jump buttons stay on the row — review F30 (MAJOR), src/components/capture/CaptureScreen.tsx:656
- [x] T163 While a digit waits, show words that are true for what is armed, from each latch's `statusShort`, never `stacking` for a transition, shortened only as far as the row needs and inside the row at the longest combination — review F31 (MAJOR), src/components/capture/CaptureScreen.tsx:635
- [x] T164 Add the three route tests and the opening test of review-probes/INV-003-chord-form-and-the-neck.spec.ts to e2e/capture-matrix.spec.ts as failing tests first; leave out the height sweep, which is MINOR F36 — review F32
- [x] T165 Use one boolean for "the chord form is showing", read by the form and by the neck's wrapper, so a short screen always has one of the two — review F32 (MAJOR), src/components/capture/CaptureScreen.tsx:1046
- [x] T166 Add the tests of review-probes/INV-038-print-lines.spec.ts to e2e/usability-staves.spec.ts as failing tests first — review F33
- [x] T167 Keep string labels on every printed line of a wrapped bar: `row-gap: var(--line-gap)` on `.tab-bar-run` in print, and enough gutter blocks to cover the most lines a print can have, with the surplus clipped as now. Check the frets baseline's markup still holds — review F33 (MAJOR), src/app/globals.css:496, src/components/tab/TabStaff.tsx:356
- [x] T168 Add `await expect(page.getByTestId("click-start")).toBeEnabled()` before the first Space in e2e/usability-keys.spec.ts:26, as review-probes/INV-039-space-once-ready.spec.ts does — held in review, no product fix owed
- [x] T169 Add the tests of review-probes/INV-016-017-remaining-surfaces.spec.ts to e2e/usability-staves.spec.ts — held in review, no fix owed
- [x] T170 Add the tests of review-probes/INV-019-numerals-marks-and-bars.spec.ts to e2e/usability-neck.spec.ts — held in review, no fix owed
- [x] T171 Add the tests of review-probes/INV-041-part-change-with-a-long-queue.spec.ts to e2e/usability-typing-order.spec.ts, and the landscape test of review-probes/staff-section-6-caret-beyond-the-keys.spec.ts to e2e/capture-matrix.spec.ts — held in review, no fix owed
- [x] T172 Last of all: run every `e2e/*.spec.ts` on all three projects against a fresh build, in slices if needed through review-probes/playwright.suite.config.ts, then run every probe in review-probes/. Fix each failure outside spec 006's FU19 sync flake, this review's FU18 (`durations.spec.ts:33`), and the probes this review's FU13 and FU14 name, and record the totals here. **Totals (fresh build, 3 projects, in 4 slices):** 2,534 passed, 617 skipped; 5 failed in the u-z slice (usability-keys:47 both projects, usability-bars-sections:141, variant-marks:212 and :255 mobile), all passed on rerun of those files (variant-marks:212 6 of 6 repeated): load flakes. Probes: 373 passed, 3 failed: INV-031 "title shares the row" (the old probe measures spare room inside the strip, which the fix makes zero by design; the e2e copy measures the row) and INV-003 Guitar 7 height sweep (MINOR F36, left out by T164). Vitest: 6146 of 6148, the 2 failures (spec004-holds, review-every-character-stored) pass alone: timeouts under load. Phase 12 had no such task, which is how `usability-reach.spec.ts:159` went red unseen — review F28
- [x] T173 After T172: for every file changed against `main` that `main` holds, restore `main`'s line endings again, so `git diff main --stat` matches `git diff main --stat --ignore-space-at-eol`, and leave no scratch files at the repo root — review F21, F23

## Phase 14: Review remediation

Each "add" below means append to that file by hand: never `cp` a probe over an existing file. Leave out each probe's `CANDIDATE` hook and keep its `test.setTimeout`. Keep each file's line endings.

- [x] T174 Add the tests of review-probes/INV-022-every-long-symbol-state.spec.ts to e2e/usability-status-row.spec.ts as failing tests first — review F39
- [x] T175 Give the status row's chord symbol one rule for its fit, taking `refused`, read by both the known and the unknown branch: `min-w-0 truncate` during a refusal, `symbolFit` otherwise, so an unknown symbol gives way during a refusal as a known one does and both jump buttons stay on the row. `flex-shrink: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis` passed 6 of 6 through the page — review F39 (MAJOR), src/components/capture/CaptureScreen.tsx:696
- [x] T176 Add the tests of review-probes/INV-031-title-row-fully-loaded.spec.ts to e2e/capture-matrix.spec.ts — held in review, no fix owed
- [x] T177 Add the tests of review-probes/INV-040-041-every-key-against-its-tap.spec.ts to e2e/usability-capture-keys.spec.ts — held in review, no fix owed
- [x] T178 Add the tests of review-probes/INV-026-fell-behind-by-a-real-stall.spec.ts to e2e/usability-cluster-states.spec.ts — held in review, no fix owed
- [x] T179 Add the tests of review-probes/INV-017-compact-in-every-view.spec.ts to e2e/usability-staves.spec.ts — held in review, no fix owed
- [x] T180 Add the tests of review-probes/INV-040-every-help-row-runs.spec.ts to e2e/usability-capture-keys.spec.ts — held in review, no fix owed
- [x] T181 (Run by the supervisor, outside the pipeline, on the fresh 00:01 build, all projects, 4 workers: c 738 passed; d 20; g 409; i 139; o 11; r 246; s 11; t 521; u 486; v 78 passed and 1 failed; probes 515 passed and 3 failed. No other failure in any slice. The 3 probe failures are named exceptions: `INV-003 Guitar 7` height sweep (FU13) and INV-038 at 1400 columns at 600 and 794 (FU15). NOT a named exception: `e2e/variant-marks.spec.ts:255` INV-027 `only additions, on every surface` failed once on desktop, Expected `Differs from A in bar 3: 2 added`, Received null; re-run alone with --repeat-each=8 it passed 8 of 8, so it looks like a read before the staff has settled, not proven. Round 4 to rule on it.) (Slices run so far, fresh build: `c*` — 738 passed, 261 skipped, 0 failed, 7.5m, 15 files. Left: d(4) g(13) i(15) o(1) r(9) s(1) t(14) u(24) v(2), then probes. Note `[a-b]` matches no file but runs the no-pointer density test.) (The probes and config are at `specs/007-usability-pass/review-probes/`; `review-probes/` below means that folder. Run in slices across as many passes as it takes; record each slice's result here.) Last of all: run every `e2e/*.spec.ts` on all three projects against a fresh build, in slices through review-probes/playwright.suite.config.ts, then every probe in review-probes/. SUITE_MATCH is matched against the whole path, so use a form like `e2e[\/][c-g][^\/]*.spec.ts$`. Fix each failure outside spec 006's FU19 sync flake, `durations.spec.ts` (this review's FU18), the race in `usability-bars-sections.spec.ts:145` (this review's FU22), and the probes this review's FU12, FU13, FU15 and FU20 name, and record the totals here. Then restore `main`'s line endings on every file changed against `main` that `main` holds, and leave no scratch files at the repo root — review F39
- [x] T182 After T181 (checked now: stats identical, no root scratch files; re-check if T181 is ever run): for every file changed against `main` that `main` holds, restore `main`'s line endings again, so `git diff main --stat` matches `git diff main --stat --ignore-space-at-eol`, and leave no scratch files at the repo root — review F21, F23
